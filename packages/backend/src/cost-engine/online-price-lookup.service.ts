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

// ── Static price table ────────────────────────────────────────────────────────
// OMR unit prices for materials common in events/fabrication/construction in Oman.
// Updated Feb 2026. Unit is noted per entry comment.
const STATIC_PRICES: Array<{ keywords: string[]; price: number; unit: string; confidence: number }> = [
  // ── Metals (per kg) ──────────────────────────────────────────────────────
  { keywords: ['aluminium', 'aluminum', 'aluminium extrusion', 'aluminium profile'], price: 2.85, unit: 'kg', confidence: 0.7 },
  { keywords: ['steel', 'mild steel', 'steel tube', 'steel pipe', 'steel bar'], price: 0.32, unit: 'kg', confidence: 0.7 },
  { keywords: ['stainless steel', 'ss304', 'ss316'], price: 1.95, unit: 'kg', confidence: 0.7 },
  { keywords: ['copper wire', 'copper cable', 'copper'], price: 3.75, unit: 'kg', confidence: 0.65 },
  { keywords: ['galvanized steel', 'galvanised', 'gi pipe', 'gi tube'], price: 0.45, unit: 'kg', confidence: 0.65 },
  { keywords: ['iron', 'iron bar', 'iron rod'], price: 0.30, unit: 'kg', confidence: 0.65 },
  { keywords: ['zinc', 'zinc sheet'], price: 1.10, unit: 'kg', confidence: 0.65 },
  // ── Fabric / textiles (per sqm) ───────────────────────────────────────────
  { keywords: ['pvc fabric', 'pvc banner', 'pvc flex', 'flex banner', 'banner material', 'banner fabric', '510gsm', '440gsm'], price: 1.85, unit: 'sqm', confidence: 0.75 },
  { keywords: ['backlit fabric', 'backlit banner', 'backlit flex'], price: 2.40, unit: 'sqm', confidence: 0.72 },
  { keywords: ['fabric display', 'stretch fabric', 'tension fabric', 'pop up fabric'], price: 3.20, unit: 'sqm', confidence: 0.70 },
  { keywords: ['mesh banner', 'mesh fabric', 'wind mesh'], price: 1.50, unit: 'sqm', confidence: 0.70 },
  { keywords: ['velvet fabric', 'velvet', 'velvet cloth'], price: 4.50, unit: 'sqm', confidence: 0.65 },
  { keywords: ['blackout fabric', 'blackout cloth', 'blackout banner'], price: 2.10, unit: 'sqm', confidence: 0.70 },
  { keywords: ['satin fabric', 'satin cloth'], price: 3.80, unit: 'sqm', confidence: 0.65 },
  { keywords: ['carpet', 'exhibition carpet', 'event carpet', 'carpet tile'], price: 4.20, unit: 'sqm', confidence: 0.70 },
  // ── Printing / graphics (per sqm) ─────────────────────────────────────────
  { keywords: ['vinyl printing', 'vinyl print', 'sticker printing', 'vinyl sticker'], price: 3.50, unit: 'sqm', confidence: 0.75 },
  { keywords: ['digital printing', 'inkjet printing', 'large format print'], price: 4.00, unit: 'sqm', confidence: 0.75 },
  { keywords: ['uv printing', 'uv print', 'uv flatbed'], price: 5.50, unit: 'sqm', confidence: 0.70 },
  { keywords: ['canvas printing', 'canvas print'], price: 6.50, unit: 'sqm', confidence: 0.68 },
  { keywords: ['one way vision', 'one-way vision', 'perforated vinyl'], price: 5.00, unit: 'sqm', confidence: 0.70 },
  { keywords: ['floor sticker', 'floor graphic', 'floor vinyl'], price: 5.50, unit: 'sqm', confidence: 0.70 },
  // ── Boards / panels / sheeting (per sqm unless noted) ─────────────────────
  { keywords: ['acrylic sheet', 'acrylic board', 'plexiglass', 'perspex', '3mm acrylic', '5mm acrylic', '6mm acrylic'], price: 18.00, unit: 'sqm', confidence: 0.72 },
  { keywords: ['acrylic 3mm'], price: 14.00, unit: 'sqm', confidence: 0.75 },
  { keywords: ['acrylic 5mm'], price: 20.00, unit: 'sqm', confidence: 0.75 },
  { keywords: ['acrylic 10mm'], price: 36.00, unit: 'sqm', confidence: 0.75 },
  { keywords: ['foam board', 'foamboard', 'forex board', '5mm foam', '10mm foam'], price: 6.50, unit: 'sqm', confidence: 0.72 },
  { keywords: ['sintra board', 'pvc sintra', 'pvc board', 'pvc sheet', 'celuka'], price: 8.50, unit: 'sqm', confidence: 0.72 },
  { keywords: ['dibond', 'aluminium composite', 'aluminium composite panel', 'acp panel', 'acp sheet'], price: 22.00, unit: 'sqm', confidence: 0.72 },
  { keywords: ['mdf board', 'mdf sheet', 'mdf panel', '18mm mdf', '12mm mdf'], price: 12.00, unit: 'sqm', confidence: 0.70 },
  { keywords: ['plywood', 'ply board', '18mm plywood', '12mm plywood'], price: 10.50, unit: 'sqm', confidence: 0.68 },
  { keywords: ['polycarbonate sheet', 'polycarbonate panel', 'pc sheet'], price: 28.00, unit: 'sqm', confidence: 0.68 },
  { keywords: ['honeycomb panel', 'honeycomb board'], price: 35.00, unit: 'sqm', confidence: 0.65 },
  { keywords: ['glass', 'tempered glass', 'glass panel'], price: 45.00, unit: 'sqm', confidence: 0.65 },
  { keywords: ['gypsum board', 'gypsum partition', 'drywall', 'plasterboard'], price: 4.80, unit: 'sqm', confidence: 0.70 },
  // ── LED / lighting (per unit) ─────────────────────────────────────────────
  { keywords: ['led screen', 'led display', 'led wall', 'led panel', 'p3 led', 'p4 led', 'p5 led', 'p6 led'], price: 180.00, unit: 'sqm', confidence: 0.60 },
  { keywords: ['led strip', 'led tape', 'led ribbon'], price: 3.50, unit: 'metre', confidence: 0.70 },
  { keywords: ['led spotlight', 'led spot', 'led downlight'], price: 12.00, unit: 'piece', confidence: 0.65 },
  { keywords: ['led flood light', 'led floodlight', 'led flood'], price: 25.00, unit: 'piece', confidence: 0.65 },
  { keywords: ['neon sign', 'neon flex', 'led neon', 'neon flex led'], price: 18.00, unit: 'metre', confidence: 0.65 },
  { keywords: ['power supply', 'led driver', 'led transformer'], price: 8.50, unit: 'piece', confidence: 0.62 },
  { keywords: ['rgb led', 'rgb strip', 'dmx light', 'moving head'], price: 85.00, unit: 'piece', confidence: 0.58 },
  // ── Events / staging (per unit or sqm or day) ─────────────────────────────
  { keywords: ['exhibition stand', 'exhibition booth', 'exhibition shell scheme'], price: 35.00, unit: 'sqm', confidence: 0.60 },
  { keywords: ['folding table', 'trestle table', 'event table'], price: 8.00, unit: 'piece', confidence: 0.68 },
  { keywords: ['chair', 'event chair', 'banquet chair', 'chiavari chair'], price: 3.50, unit: 'piece', confidence: 0.68 },
  { keywords: ['stanchion', 'queue barrier', 'crowd barrier', 'belt barrier'], price: 18.00, unit: 'piece', confidence: 0.65 },
  { keywords: ['roll up banner', 'roll-up banner', 'pull up banner', 'rollup stand'], price: 22.00, unit: 'piece', confidence: 0.75 },
  { keywords: ['x-banner', 'x banner', 'x stand'], price: 15.00, unit: 'piece', confidence: 0.75 },
  { keywords: ['pop up display', 'pop-up display', 'popup booth'], price: 120.00, unit: 'piece', confidence: 0.65 },
  { keywords: ['backdrop', 'step and repeat', 'photo backdrop', 'media wall'], price: 8.00, unit: 'sqm', confidence: 0.68 },
  { keywords: ['podium', 'lectern', 'presentation podium'], price: 65.00, unit: 'piece', confidence: 0.62 },
  { keywords: ['truss', 'box truss', 'trussing', 'aluminium truss'], price: 12.00, unit: 'metre', confidence: 0.65 },
  { keywords: ['stage', 'staging', 'stage platform', 'stage deck'], price: 18.00, unit: 'sqm', confidence: 0.60 },
  // ── Paint / finishing (per litre) ─────────────────────────────────────────
  { keywords: ['spray paint', 'aerosol paint', 'spray can'], price: 2.80, unit: 'litre', confidence: 0.65 },
  { keywords: ['emulsion paint', 'wall paint', 'interior paint'], price: 1.80, unit: 'litre', confidence: 0.65 },
  { keywords: ['epoxy paint', 'epoxy coating', 'floor epoxy'], price: 6.50, unit: 'litre', confidence: 0.63 },
  { keywords: ['primer', 'wood primer', 'metal primer'], price: 2.20, unit: 'litre', confidence: 0.65 },
  // ── Wood / timber (per piece or metre) ────────────────────────────────────
  { keywords: ['timber', 'wood plank', 'pine timber', 'pine plank', '4x2 timber', '2x4 timber'], price: 2.50, unit: 'metre', confidence: 0.65 },
  { keywords: ['hardwood', 'oak', 'teak', 'mahogany'], price: 8.00, unit: 'metre', confidence: 0.60 },
  // ── Adhesives / consumables ────────────────────────────────────────────────
  { keywords: ['double sided tape', 'double-sided tape', '3m tape', 'foam tape'], price: 4.50, unit: 'roll', confidence: 0.70 },
  { keywords: ['silicone sealant', 'silicon sealant', 'silicone'], price: 2.20, unit: 'piece', confidence: 0.68 },
  { keywords: ['hot glue', 'hot melt glue', 'glue stick'], price: 3.50, unit: 'kg', confidence: 0.65 },
  { keywords: ['epoxy adhesive', 'epoxy glue', 'two part epoxy'], price: 6.00, unit: 'piece', confidence: 0.65 },
  // ── Labour (per hour) ─────────────────────────────────────────────────────
  { keywords: ['labour', 'labor', 'worker', 'installation labour', 'skilled labour'], price: 2.00, unit: 'hour', confidence: 0.60 },
  { keywords: ['carpenter', 'carpentry', 'carpenter labour'], price: 2.50, unit: 'hour', confidence: 0.62 },
  { keywords: ['electrician', 'electrical labour', 'electrical work'], price: 3.00, unit: 'hour', confidence: 0.62 },
  { keywords: ['painter', 'painting labour', 'painting work'], price: 2.00, unit: 'hour', confidence: 0.60 },
];

// Metals that get live prices from metals.live (in troy oz) → converted to OMR/kg
const LIVE_METALS: Record<string, { apiKey: string; label: string }> = {
  aluminium: { apiKey: 'aluminum', label: 'Aluminium' },
  aluminum: { apiKey: 'aluminum', label: 'Aluminium' },
  copper: { apiKey: 'copper', label: 'Copper' },
  steel: { apiKey: 'steel', label: 'Steel' },
  zinc: { apiKey: 'zinc', label: 'Zinc' },
  nickel: { apiKey: 'nickel', label: 'Nickel' },
  lead: { apiKey: 'lead', label: 'Lead' },
  tin: { apiKey: 'tin', label: 'Tin' },
  gold: { apiKey: 'gold', label: 'Gold' },
  silver: { apiKey: 'silver', label: 'Silver' },
};

// USD → OMR exchange rate (fixed peg; 1 USD = 0.385 OMR as of 2026)
const USD_TO_OMR = 0.385;

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
    // 1. DB cache — valid ONLINE price within TTL
    const cached = await this.getCachedPrice(materialName);
    if (cached) {
      this.logger.debug(`Cache hit for "${materialName}": ${cached.unitPrice} OMR`);
      return { unitPrice: cached.unitPrice, currency: 'OMR', source: 'ONLINE (cached)', confidence: cached.confidence ?? 0.6 };
    }

    // 2. Live metals API (no key required)
    const metalResult = await this.tryLiveMetalsApi(materialName);
    if (metalResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, metalResult);
      return metalResult;
    }

    // 3. Static price table (comprehensive Oman market rates)
    const staticResult = this.lookupStaticPrice(materialName);
    if (staticResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, staticResult);
      return staticResult;
    }

    // 4. DuckDuckGo instant answer (no key, best-effort)
    const ddgResult = await this.tryDuckDuckGo(materialName);
    if (ddgResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, ddgResult);
      return ddgResult;
    }

    // 5. Keyed search APIs (Google CSE / SerpAPI / Brave) if configured
    const keyedResult = await this.tryKeyedSearch(materialName);
    if (keyedResult.unitPrice !== null) {
      await this.savePrice(materialName, unit, keyedResult);
      return keyedResult;
    }

    this.logger.warn(`No price found for "${materialName}"`);
    return { unitPrice: null, currency: 'OMR', source: 'none', confidence: 0 };
  }

  async lookupAndSaveAll(materialNames: string[]): Promise<Record<string, LookupResult>> {
    const results: Record<string, LookupResult> = {};
    for (const name of materialNames) {
      results[name] = await this.lookup(name, 'piece');
    }
    return results;
  }

  // ── Static price table lookup ─────────────────────────────────────────────

  private lookupStaticPrice(materialName: string): LookupResult {
    const lower = materialName.toLowerCase();
    // Find best match — prefer entry whose keywords have the most overlap with input
    let best: (typeof STATIC_PRICES)[0] | null = null;
    let bestScore = 0;

    for (const entry of STATIC_PRICES) {
      for (const kw of entry.keywords) {
        if (lower.includes(kw) || kw.includes(lower)) {
          const score = kw.length; // longer keyword = more specific match
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }
    }

    if (best) {
      return {
        unitPrice: best.price,
        currency: 'OMR',
        source: `static:${best.unit}`,
        confidence: best.confidence,
        raw: `Oman market rate ~Feb 2026 (${best.unit})`,
      };
    }

    return { unitPrice: null, currency: 'OMR', source: 'static', confidence: 0 };
  }

  // ── metals.live — free, no key ────────────────────────────────────────────

  private async tryLiveMetalsApi(materialName: string): Promise<LookupResult> {
    const lower = materialName.toLowerCase();
    const metalEntry = Object.entries(LIVE_METALS).find(([k]) => lower.includes(k));
    if (!metalEntry) return { unitPrice: null, currency: 'OMR', source: 'metals.live', confidence: 0 };

    const [, { apiKey, label }] = metalEntry;

    try {
      const res = await axios.get('https://api.metals.live/v1/spot', { timeout: 6000 });
      const data: Array<Record<string, number>> = res.data;
      const entry = data.find((d) => Object.keys(d)[0]?.toLowerCase() === apiKey);
      if (entry) {
        const usdPerTroyOz = Object.values(entry)[0];
        // 1 metric tonne = 32,150.75 troy oz → price per kg
        const usdPerKg = (usdPerTroyOz * 32150.75) / 1000;
        const omrPerKg = Math.round(usdPerKg * USD_TO_OMR * 1000) / 1000;
        return { unitPrice: omrPerKg, currency: 'OMR', source: `metals.live:${label}`, confidence: 0.78 };
      }
    } catch (err: any) {
      this.logger.debug(`metals.live unavailable: ${err.message}`);
    }

    return { unitPrice: null, currency: 'OMR', source: 'metals.live', confidence: 0 };
  }

  // ── DuckDuckGo instant answer — no key ───────────────────────────────────

  private async tryDuckDuckGo(materialName: string): Promise<LookupResult> {
    const query = `${materialName} price oman OMR`;
    const pricePattern = /(?:OMR|RO|ر\.ع\.?)\s*([\d,]+(?:\.\d{1,3})?)|(?:[\d,]+(?:\.\d{1,3})?)\s*(?:OMR|RO)/i;

    try {
      const res = await axios.get('https://api.duckduckgo.com/', {
        params: { q: query, format: 'json', no_html: '1', skip_disambig: '1' },
        headers: { 'User-Agent': 'VMS-Price-Lookup/1.0' },
        timeout: 8000,
      });

      const data = res.data;
      const texts = [
        data.Abstract,
        data.Answer,
        ...(data.RelatedTopics || []).map((t: any) => t.Text || ''),
      ].filter(Boolean).join(' ');

      const match = texts.match(pricePattern);
      if (match) {
        const raw = (match[1] ?? match[0]).replace(/,/g, '');
        const price = parseFloat(raw);
        if (!isNaN(price) && price > 0 && price < 100000) {
          return { unitPrice: Math.round(price * 1000) / 1000, currency: 'OMR', source: 'duckduckgo', confidence: 0.50, raw: texts.substring(0, 120) };
        }
      }
    } catch (err: any) {
      this.logger.debug(`DuckDuckGo lookup failed: ${err.message}`);
    }

    return { unitPrice: null, currency: 'OMR', source: 'duckduckgo', confidence: 0 };
  }

  // ── Keyed search APIs (optional — works if any key is set) ───────────────

  private async tryKeyedSearch(materialName: string): Promise<LookupResult> {
    const query = `${materialName} price oman OMR 2026`;
    const pricePattern = /(?:OMR|RO|ر\.ع\.?)\s*([\d,]+(?:\.\d{1,3})?)|(?:[\d,]+(?:\.\d{1,3})?)\s*(?:OMR|RO)/i;

    const parseSnippets = (texts: string[]): LookupResult | null => {
      for (const text of texts) {
        const match = text.match(pricePattern);
        if (match) {
          const raw = (match[1] ?? match[0]).replace(/,/g, '');
          const price = parseFloat(raw);
          if (!isNaN(price) && price > 0 && price < 50000) {
            return { unitPrice: Math.round(price * 1000) / 1000, currency: 'OMR', source: 'web-search', confidence: 0.55, raw: text.substring(0, 120) };
          }
        }
      }
      return null;
    };

    // Google CSE
    const gcseKey = this.configService.get<string>('GOOGLE_CSE_API_KEY');
    const gcseId = this.configService.get<string>('GOOGLE_CSE_ID');
    if (gcseKey && gcseId) {
      try {
        const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: { key: gcseKey, cx: gcseId, q: query, num: 5, gl: 'om' },
          timeout: 10000,
        });
        const snippets = (res.data?.items ?? []).map((i: any) => `${i.title} ${i.snippet}`);
        const found = parseSnippets(snippets);
        if (found) return { ...found, source: 'google-cse' };
      } catch (err: any) { this.logger.debug(`Google CSE: ${err.message}`); }
    }

    // SerpAPI
    const serpKey = this.configService.get<string>('SERPAPI_KEY');
    if (serpKey) {
      try {
        const res = await axios.get('https://serpapi.com/search', {
          params: { engine: 'google', q: query, api_key: serpKey, num: 5, gl: 'om' },
          timeout: 10000,
        });
        const snippets = (res.data?.organic_results ?? []).map((r: any) => `${r.title} ${r.snippet}`);
        const found = parseSnippets(snippets);
        if (found) return { ...found, source: 'serp' };
      } catch (err: any) { this.logger.debug(`SerpAPI: ${err.message}`); }
    }

    // Brave Search
    const braveKey = this.configService.get<string>('BRAVE_SEARCH_KEY');
    if (braveKey) {
      try {
        const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
          headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey },
          params: { q: query, count: 5, country: 'om' },
          timeout: 10000,
        });
        const snippets = (res.data?.web?.results ?? []).map((r: any) => `${r.title} ${r.description}`);
        const found = parseSnippets(snippets);
        if (found) return { ...found, source: 'brave' };
      } catch (err: any) { this.logger.debug(`Brave: ${err.message}`); }
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
      where: { materialId: material.id, source: PriceSource.ONLINE, expiresAt: { gt: new Date() } },
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
        material = await this.prisma.rawMaterial.create({ data: { name: materialName, unit } });
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
      this.logger.log(`Saved price for "${materialName}": ${result.unitPrice} OMR (${result.source})`);
    } catch (err: any) {
      this.logger.warn(`Could not save price for "${materialName}": ${err.message}`);
    }
  }
}
