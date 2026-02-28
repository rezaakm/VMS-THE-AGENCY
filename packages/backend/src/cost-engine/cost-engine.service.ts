import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PriceSource } from '@prisma/client';
import { OnlinePriceLookupService } from './online-price-lookup.service';

export interface BOMLine {
  materialName: string;
  quantity: number;
  unit: string;
}

export interface CostEstimateInput {
  title: string;
  description?: string;
  category?: string;
  clientName?: string;
  bomLines?: BOMLine[];
  sellingPrice?: number;
}

export interface LineWithPrice extends BOMLine {
  unitPrice: number;
  totalPrice: number;
  source: string;
  confidence: number;
  materialId?: string;
}

@Injectable()
export class CostEngineService {
  private readonly logger = new Logger(CostEngineService.name);
  private openai: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private onlineLookup: OnlinePriceLookupService,
  ) {
    this.initOpenAI();
  }

  private async initOpenAI() {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (key) {
      const { default: OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  // ── BOM Dissection ─────────────────────────────────────────────────────────

  async dissectItem(description: string, category?: string): Promise<BOMLine[]> {
    if (!this.openai) {
      return [{ materialName: description, quantity: 1, unit: 'piece' }];
    }

    const systemPrompt = `You are a cost estimation expert for an events and production company in Oman.
Break down the given item/job into its raw materials and components.
Return a JSON object: { "lines": [{ "materialName": string, "quantity": number, "unit": string }] }
Units should be: sqm, metre, kg, piece, hour, day, set, panel, litre, roll.
Be specific with material names (e.g. "Aluminium extrusion 40x40mm", "PVC fabric 510gsm").`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Category: ${category || 'general'}. Item: ${description}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      });
      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return (result.lines || []).filter((l: any) => l.materialName && l.quantity);
    } catch (err: any) {
      this.logger.error(`BOM dissection failed: ${err.message}`);
      return [{ materialName: description, quantity: 1, unit: 'piece' }];
    }
  }

  // ── Price Lookup ───────────────────────────────────────────────────────────

  async getBestPrice(materialName: string): Promise<{ unitPrice: number; source: string; confidence: number }> {
    const material = await this.prisma.rawMaterial.findFirst({
      where: { name: { contains: materialName, mode: 'insensitive' } },
      include: {
        prices: {
          orderBy: { recordedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!material || material.prices.length === 0) {
      // Nothing in catalog — try online lookup as the last resort
      const online = await this.onlineLookup.lookup(materialName, material?.unit ?? 'piece');
      if (online.unitPrice !== null) {
        return { unitPrice: online.unitPrice, source: 'ONLINE', confidence: online.confidence };
      }
      return { unitPrice: 0, source: 'none', confidence: 0 };
    }

    const now = new Date();
    const validPrices = material.prices.filter(
      (p) => !p.expiresAt || p.expiresAt > now,
    );

    if (validPrices.length === 0) {
      // All cached prices expired — try online lookup to refresh
      const online = await this.onlineLookup.lookup(materialName, material.unit);
      if (online.unitPrice !== null) {
        return { unitPrice: online.unitPrice, source: 'ONLINE', confidence: online.confidence };
      }
      return { unitPrice: 0, source: 'expired', confidence: 0 };
    }

    // Priority: MANUAL > VENDOR_PO > COST_SHEET > ONLINE
    const priority: Record<string, number> = { MANUAL: 4, VENDOR_PO: 3, COST_SHEET: 2, ONLINE: 1 };
    const sorted = [...validPrices].sort((a, b) => (priority[b.source] || 0) - (priority[a.source] || 0));
    const best = sorted[0];

    // Average over same-source prices for confidence
    const sameSrc = validPrices.filter((p) => p.source === best.source);
    const avgPrice = sameSrc.reduce((s, p) => s + p.unitPrice, 0) / sameSrc.length;
    const variance = sameSrc.length > 1 && avgPrice !== 0
      ? Math.sqrt(sameSrc.reduce((s, p) => s + Math.pow(p.unitPrice - avgPrice, 2), 0) / sameSrc.length) / avgPrice
      : 0;

    const confidence = Math.max(0, Math.min(1, (0.5 + sameSrc.length * 0.1) * (1 - variance)));

    return {
      unitPrice: avgPrice,
      source: best.source,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  // ── Full Estimate ──────────────────────────────────────────────────────────

  async createEstimate(input: CostEstimateInput): Promise<any> {
    const labourRate = parseFloat(this.configService.get('LABOUR_RATE_DEFAULT') || '15');
    const overheadPct = parseFloat(this.configService.get('OVERHEAD_PERCENT_DEFAULT') || '10') / 100;

    const bomLines = input.bomLines ?? await this.dissectItem(input.description || input.title, input.category);

    const resolvedLines: LineWithPrice[] = [];
    let totalConfidence = 0;

    for (const line of bomLines) {
      const { unitPrice, source, confidence } = await this.getBestPrice(line.materialName);
      resolvedLines.push({
        ...line,
        unitPrice,
        totalPrice: unitPrice * line.quantity,
        source,
        confidence,
      });
      totalConfidence += confidence;
    }

    const materialCost = resolvedLines.reduce((s, l) => s + l.totalPrice, 0);
    const labourCost = labourRate;
    const overheadCost = (materialCost + labourCost) * overheadPct;
    const totalCostPrice = materialCost + labourCost + overheadCost;
    const confidenceScore = bomLines.length > 0
      ? Math.round((totalConfidence / bomLines.length) * 100)
      : 0;

    const sellingPrice = input.sellingPrice ?? null;
    const margin = sellingPrice && totalCostPrice > 0
      ? Math.round(((sellingPrice - totalCostPrice) / sellingPrice) * 100 * 10) / 10
      : null;

    // Persist to DB
    const estimate = await this.prisma.costEstimate.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        clientName: input.clientName,
        materialCost,
        labourCost,
        overheadCost,
        totalCostPrice,
        sellingPrice,
        margin,
        confidenceScore,
        lines: {
          create: resolvedLines.map((l) => ({
            description: l.materialName,
            materialName: l.materialName,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalPrice: l.totalPrice,
            source: l.source,
            confidence: l.confidence,
          })),
        },
      },
      include: { lines: true },
    });

    return estimate;
  }

  // ── Margin Dashboard ───────────────────────────────────────────────────────

  async getMarginDashboard(filters?: { category?: string; minMargin?: number; maxMargin?: number }) {
    const where: any = {};
    if (filters?.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters?.minMargin !== undefined) where.margin = { ...where.margin, gte: filters.minMargin };
    if (filters?.maxMargin !== undefined) where.margin = { ...where.margin, lte: filters.maxMargin };

    const estimates = await this.prisma.costEstimate.findMany({
      where,
      orderBy: { margin: 'asc' },
      include: { _count: { select: { lines: true } } },
    });

    const targetMargin = parseFloat(this.configService.get('MARGIN_TARGET_PERCENT') || '25');

    return {
      estimates: estimates.map((e) => ({
        ...e,
        atRisk: e.margin !== null && e.margin < targetMargin,
        targetMargin,
      })),
      summary: {
        total: estimates.length,
        atRisk: estimates.filter((e) => e.margin !== null && e.margin < targetMargin).length,
        avgMargin: estimates.length
          ? estimates.filter((e) => e.margin !== null).reduce((s, e) => s + (e.margin || 0), 0) /
            estimates.filter((e) => e.margin !== null).length
          : 0,
        targetMargin,
      },
    };
  }

  // ── Raw Material Catalog ───────────────────────────────────────────────────

  async upsertMaterialPrice(
    materialName: string,
    unit: string,
    unitPrice: number,
    source: PriceSource,
    options?: { vendorName?: string; sourceRef?: string; category?: string; confidence?: number; ttlHours?: number },
  ) {
    let material = await this.prisma.rawMaterial.findFirst({
      where: { name: { equals: materialName, mode: 'insensitive' } },
    });

    if (!material) {
      material = await this.prisma.rawMaterial.create({
        data: { name: materialName, unit, category: options?.category },
      });
    }

    const expiresAt = options?.ttlHours
      ? new Date(Date.now() + options.ttlHours * 3600 * 1000)
      : source === 'ONLINE'
      ? new Date(Date.now() + 24 * 3600 * 1000)
      : null;

    return this.prisma.materialPrice.create({
      data: {
        materialId: material.id,
        source,
        unitPrice,
        vendorName: options?.vendorName,
        sourceRef: options?.sourceRef,
        confidence: options?.confidence ?? 1.0,
        expiresAt,
      },
    });
  }

  async getRawMaterials(search?: string) {
    return this.prisma.rawMaterial.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      include: {
        prices: {
          orderBy: { recordedAt: 'desc' },
          take: 3,
        },
        _count: { select: { prices: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getEstimate(id: string) {
    const estimate = await this.prisma.costEstimate.findUnique({
      where: { id },
      include: { lines: true, template: true },
    });
    if (!estimate) throw new NotFoundException(`Estimate ${id} not found`);
    return estimate;
  }

  async listEstimates() {
    return this.prisma.costEstimate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { lines: true } } },
    });
  }

  async updateSellingPrice(id: string, sellingPrice: number) {
    const estimate = await this.prisma.costEstimate.findUnique({ where: { id } });
    if (!estimate) throw new NotFoundException(`Estimate ${id} not found`);

    const margin = estimate.totalCostPrice > 0
      ? Math.round(((sellingPrice - estimate.totalCostPrice) / sellingPrice) * 100 * 10) / 10
      : null;

    return this.prisma.costEstimate.update({
      where: { id },
      data: { sellingPrice, margin },
    });
  }
}
