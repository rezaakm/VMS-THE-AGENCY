import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PriceSource } from '@prisma/client';
import axios from 'axios';

export interface LookupResult {
  unitPrice: number | null;
  currency: string;
  source: string;
  confidence: number;
  raw?: string;
}

// Known commodity material keywords mapped to their LME/commodity API commodity code.
// These bypass SerpAPI and hit direct commodity feeds for higher accuracy.
const COMMODITY_MAP: Record<string, { metal?: string; label: string }> = {
  aluminium: { metal: 'aluminium', label: 'Aluminium' },
  aluminum: { metal: 'aluminium', label: 'Aluminium' },
  copper: { metal: 'copper', label: 'Copper' },
  steel: { metal: 'steel', label: 'Steel' },
  iron: { metal: 'steel', label: 'Steel' },
  zinc: { metal: 'zinc', label: 'Zinc' },
  nickel: { metal: 'nickel', label: 'Nickel' },
  lead: { metal: 'lead', label: 'Lead' },
  tin: { metal: 'tin', label: 'Tin' },
};

@Injectable()
export class OnlinePriceLookupService {
  private readonly logger = new Logger(OnlinePriceLookupService.name);
  private readonly TTL_HOURS = 24;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async lookup(materialName: string, unit: string): Promise<LookupResult> {
    // 1. Check if a fresh cached ONLINE price exists (within TTL)
    const cached = await this.getCachedPrice(materialName);
    if (cached) {
      this.logger.debug(`Cache hit for "${materialName}": ${cached.unitPrice} OMR`);
      return { unitPrice: cached.unitPrice, currency: 'OMR', source: 'ONLINE (cached)', confidence: cached.confidence ?? 0.6 };
    }

    // 2. Try commodity feed for known raw materials
    const commodityResult = await this.tryCommodityFeed(materialName);
    if (commodityResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, commodityResult);
      return commodityResult;
    }

    // 3. Web search (Google CSE → SerpAPI → Brave, whichever key is set)
    const serpResult = await this.tryWebSearch(materialName);
    if (serpResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, serpResult);
      return serpResult;
    }

    this.logger.warn(`No online price found for "${materialName}"`);
    return { unitPrice: null, currency: 'OMR', source: 'none', confidence: 0 };
  }

  async lookupAndSaveAll(materialNames: string[]): Promise<Record<string, LookupResult>> {
    const results: Record<string, LookupResult> = {};
    for (const name of materialNames) {
      results[name] = await this.lookup(name, 'unit');
    }
    return results;
  }

  // ── Commodity feed (metalpriceapi.com or fallback estimate) ──────────────

  private async tryCommodityFeed(materialName: string): Promise<LookupResult> {
    const lower = materialName.toLowerCase();
    const commodity = Object.entries(COMMODITY_MAP).find(([key]) => lower.includes(key));
    if (!commodity) return { unitPrice: null, currency: 'OMR', source: 'commodity', confidence: 0 };

    const [, { label }] = commodity;
    const apiKey = this.configService.get<string>('METALPRICES_API_KEY');

    if (apiKey) {
      try {
        // metalpriceapi.com returns prices per troy oz in USD; we convert to OMR per kg
        const response = await axios.get(`https://api.metalpriceapi.com/v1/latest`, {
          params: { api_key: apiKey, base: 'USD', currencies: 'OMR' },
          timeout: 8000,
        });
        const usdToOmr = response.data?.rates?.OMR ?? 0.385;
        // Commodity prices are per metric tonne from LME; approximate unit conversion
        const lmePriceUsdPerTonne = await this.getLmeCommodityPrice(commodity[1].metal!);
        if (lmePriceUsdPerTonne) {
          const priceOmrPerKg = (lmePriceUsdPerTonne / 1000) * usdToOmr;
          return { unitPrice: Math.round(priceOmrPerKg * 1000) / 1000, currency: 'OMR', source: `commodity:${label}`, confidence: 0.75 };
        }
      } catch (err: any) {
        this.logger.warn(`Metalprices API error: ${err.message}`);
      }
    }

    // Static fallback estimates (OMR per kg, approximate Feb 2026 market rates)
    const staticRates: Record<string, number> = {
      aluminium: 0.99,  // ~USD 2570/tonne
      copper: 3.68,     // ~USD 9570/tonne
      steel: 0.29,      // ~USD 760/tonne
      zinc: 1.14,       // ~USD 2970/tonne
      nickel: 5.62,     // ~USD 14620/tonne
      lead: 0.74,       // ~USD 1920/tonne
      tin: 12.3,        // ~USD 32000/tonne
    };
    const rate = Object.entries(staticRates).find(([k]) => lower.includes(k));
    if (rate) {
      return { unitPrice: rate[1], currency: 'OMR', source: `commodity:${label}:static`, confidence: 0.5, raw: `Static estimate for ${label}` };
    }

    return { unitPrice: null, currency: 'OMR', source: 'commodity', confidence: 0 };
  }

  private async getLmeCommodityPrice(metal: string): Promise<number | null> {
    // Uses comex/LME via a free metals API endpoint (no key required for basic metals)
    try {
      const response = await axios.get('https://api.metals.live/v1/spot', { timeout: 6000 });
      const data = response.data as Array<Record<string, number>>;
      const entry = data.find((d) => Object.keys(d)[0]?.toLowerCase() === metal);
      if (entry) {
        const usdPerTroyOz = Object.values(entry)[0];
        // Convert troy oz → metric tonne (1 t = 32,150.75 troy oz)
        return usdPerTroyOz * 32150.75;
      }
    } catch {
      // silently fall through to static rates
    }
    return null;
  }

  // ── Web search (Google Custom Search → SerpAPI fallback) ─────────────────

  private async tryWebSearch(materialName: string): Promise<LookupResult> {
    const query = `${materialName} price oman OMR 2026`;
    const pricePattern = /(?:OMR|RO|ر\.ع\.?)\s*([\d,]+(?:\.\d+)?)|(?:[\d,]+(?:\.\d+)?)\s*(?:OMR|RO)/i;

    // ── Option A: Google Custom Search JSON API (same Google Cloud project as Drive) ──
    const googleApiKey = this.configService.get<string>('GOOGLE_CLIENT_ID')
      ? this.configService.get<string>('GOOGLE_CSE_API_KEY')
      : null;
    const cseId = this.configService.get<string>('GOOGLE_CSE_ID');

    if (googleApiKey && cseId) {
      try {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: { key: googleApiKey, cx: cseId, q: query, num: 5, gl: 'om' },
          timeout: 10000,
        });
        const items: any[] = response.data?.items ?? [];
        for (const item of items) {
          const text = `${item.title ?? ''} ${item.snippet ?? ''}`;
          const match = text.match(pricePattern);
          if (match) {
            const raw = (match[1] ?? match[0]).replace(/,/g, '');
            const price = parseFloat(raw);
            if (!isNaN(price) && price > 0 && price < 50000) {
              return { unitPrice: Math.round(price * 1000) / 1000, currency: 'OMR', source: 'google-cse', confidence: 0.55, raw: text.substring(0, 120) };
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Google CSE error for "${materialName}": ${err.message}`);
      }
    }

    // ── Option B: SerpAPI (if key provided) ───────────────────────────────
    const serpKey = this.configService.get<string>('SERPAPI_KEY');
    if (serpKey) {
      try {
        const response = await axios.get('https://serpapi.com/search', {
          params: { engine: 'google', q: query, api_key: serpKey, num: 5, gl: 'om', hl: 'en' },
          timeout: 10000,
        });
        const results: any[] = response.data?.organic_results ?? [];
        for (const result of results) {
          const text = `${result.title ?? ''} ${result.snippet ?? ''}`;
          const match = text.match(pricePattern);
          if (match) {
            const raw = (match[1] ?? match[0]).replace(/,/g, '');
            const price = parseFloat(raw);
            if (!isNaN(price) && price > 0 && price < 50000) {
              return { unitPrice: Math.round(price * 1000) / 1000, currency: 'OMR', source: 'serp', confidence: 0.55, raw: text.substring(0, 120) };
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`SerpAPI error for "${materialName}": ${err.message}`);
      }
    }

    // ── Option C: Brave Search API (free tier, no phone needed) ───────────
    const braveKey = this.configService.get<string>('BRAVE_SEARCH_KEY');
    if (braveKey) {
      try {
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey },
          params: { q: query, count: 5, country: 'om' },
          timeout: 10000,
        });
        const results: any[] = response.data?.web?.results ?? [];
        for (const result of results) {
          const text = `${result.title ?? ''} ${result.description ?? ''}`;
          const match = text.match(pricePattern);
          if (match) {
            const raw = (match[1] ?? match[0]).replace(/,/g, '');
            const price = parseFloat(raw);
            if (!isNaN(price) && price > 0 && price < 50000) {
              return { unitPrice: Math.round(price * 1000) / 1000, currency: 'OMR', source: 'brave', confidence: 0.55, raw: text.substring(0, 120) };
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Brave Search error for "${materialName}": ${err.message}`);
      }
    }

    return { unitPrice: null, currency: 'OMR', source: 'web:no-key', confidence: 0 };
  }

  // ── Cache helpers ─────────────────────────────────────────────────────────

  private async getCachedPrice(materialName: string) {
    const material = await this.prisma.rawMaterial.findFirst({
      where: { name: { equals: materialName, mode: 'insensitive' } },
    });
    if (!material) return null;

    return this.prisma.materialPrice.findFirst({
      where: {
        materialId: material.id,
        source: PriceSource.ONLINE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  private async savePrice(materialName: string, unit: string, result: LookupResult) {
    if (result.unitPrice === null) return;
    try {
      let material = await this.prisma.rawMaterial.findFirst({
        where: { name: { equals: materialName, mode: 'insensitive' } },
      });
      if (!material) {
        material = await this.prisma.rawMaterial.create({
          data: { name: materialName, unit },
        });
      }
      await this.prisma.materialPrice.create({
        data: {
          materialId: material.id,
          source: PriceSource.ONLINE,
          unitPrice: result.unitPrice,
          currency: result.currency,
          sourceRef: result.source,
          confidence: result.confidence,
          expiresAt: new Date(Date.now() + this.TTL_HOURS * 3600 * 1000),
        },
      });
      this.logger.log(`Saved online price for "${materialName}": ${result.unitPrice} OMR (${result.source})`);
    } catch (err: any) {
      this.logger.warn(`Failed to save price for "${materialName}": ${err.message}`);
    }
  }
}
