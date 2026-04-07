import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CostEngineService } from '../cost-engine/cost-engine.service';
import { GoogleDriveService } from '../cost-sheets/google-drive.service';
import { CreateBoqDto } from './dto/create-boq.dto';
import { UpdateBoqItemDto } from './dto/update-boq-item.dto';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedItem {
  section?: string;
  sectionNumber?: string;
  description: string;
  quantity: number;
  unit: string;
  specs?: string;
  drawingRef?: string;
}

@Injectable()
export class BoqService {
  private readonly logger = new Logger(BoqService.name);
  private openai: any;
  private readonly uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private costEngine: CostEngineService,
    private driveService: GoogleDriveService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'boq-drawings');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    this.initOpenAI();
  }

  private async initOpenAI() {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (key) {
      const { default: OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  // ── Create BOQ with uploaded drawings ─────────────────────────────────────

  async create(dto: CreateBoqDto, userId: string, files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('At least one drawing file is required');
    }

    const boqNumber = await this.generateBoqNumber();

    // Save files to disk
    const savedFiles = files.map((file) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(this.uploadDir, uniqueName);
      fs.writeFileSync(filePath, file.buffer);
      return {
        fileName: file.originalname,
        fileUrl: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    });

    // Create BOQ record
    const boq = await this.prisma.bOQ.create({
      data: {
        boqNumber,
        title: dto.title,
        description: dto.description,
        projectName: dto.projectName,
        clientName: dto.clientName,
        createdById: userId,
        drawingCount: files.length,
        status: 'PROCESSING',
        drawings: {
          create: savedFiles,
        },
      },
      include: { drawings: true },
    });

    // Process drawings asynchronously (don't block the response)
    this.processDrawings(boq.id, savedFiles).catch((err) =>
      this.logger.error(`BOQ ${boq.id} processing failed: ${err.message}`),
    );

    return boq;
  }

  // ── AI Vision: Extract BOQ items from drawings ────────────────────────────

  private async processDrawings(boqId: string, files: { fileName: string; fileUrl: string; mimeType: string }[]) {
    const allItems: ExtractedItem[] = [];

    for (const file of files) {
      const items = await this.extractFromDrawing(file.fileUrl, file.mimeType, file.fileName);
      allItems.push(...items);
    }

    if (allItems.length === 0) {
      // Fallback: create a single placeholder item
      allItems.push({
        section: 'General',
        sectionNumber: '1',
        description: 'Items to be quantified from drawings',
        quantity: 1,
        unit: 'lot',
        drawingRef: files[0]?.fileName,
      });
    }

    // Look up prices from cost engine
    const pricedItems = await this.priceItems(allItems);

    // Calculate totals
    let totalCost = 0;
    let totalSelling = 0;

    const itemsData = pricedItems.map((item, idx) => {
      const tc = item.unitCost * item.quantity;
      const ts = item.unitSelling * item.quantity;
      totalCost += tc;
      totalSelling += ts;
      return {
        boqId,
        itemNumber: idx + 1,
        sectionNumber: item.sectionNumber,
        section: item.section,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: tc,
        unitSelling: item.unitSelling,
        totalSelling: ts,
        priceSource: item.priceSource,
        priceConfidence: item.priceConfidence,
        specs: item.specs,
        drawingRef: item.drawingRef,
      };
    });

    await this.prisma.bOQItem.createMany({ data: itemsData });

    const margin = totalSelling > 0
      ? Math.round(((totalSelling - totalCost) / totalSelling) * 100 * 10) / 10
      : null;

    await this.prisma.bOQ.update({
      where: { id: boqId },
      data: {
        status: 'DRAFT',
        totalCost,
        totalSelling,
        margin,
        aiModel: this.openai ? 'gpt-4o' : 'fallback',
      },
    });

    this.logger.log(`BOQ ${boqId}: extracted ${pricedItems.length} items, total cost ${totalCost.toFixed(2)} OMR`);
  }

  private async extractFromDrawing(filePath: string, mimeType: string, fileName: string): Promise<ExtractedItem[]> {
    // If OpenAI is available, use GPT-4o vision
    if (this.openai && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
      return this.extractWithVision(filePath, mimeType, fileName);
    }

    // Fallback: return placeholder items based on file name hints
    return this.extractFallback(fileName);
  }

  private async extractWithVision(filePath: string, mimeType: string, fileName: string): Promise<ExtractedItem[]> {
    const systemPrompt = `You are a quantity surveyor / cost estimator for an events, fabrication, and construction company in Oman.
Analyze the uploaded drawing/plan and extract a Bill of Quantities (BOQ).

For each item you can identify, provide:
- section: category group (e.g. "Structural", "Finishes", "MEP", "Signage", "Staging", "Lighting", "Fabric", "Flooring")
- sectionNumber: hierarchical number (e.g. "1", "1.1", "2")
- description: specific item description with material/specification
- quantity: estimated quantity from the drawing (be as accurate as possible)
- unit: one of [sqm, lm, piece, kg, set, lot, hour, day, m3, roll, panel, metre]
- specs: any specifications visible (dimensions, material grade, finish)

Return JSON: { "items": [...], "notes": "any observations about the drawing" }

Be thorough — extract EVERY quantifiable item. Include structural elements, finishes, MEP (if visible), signage, furniture, and accessories.
If you cannot determine an exact quantity, provide your best estimate.
For architectural plans, calculate areas from dimensions shown.`;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');

      // For PDFs, use the file as a document; for images, use image_url
      const imageContent = mimeType === 'application/pdf'
        ? { type: 'image_url' as const, image_url: { url: `data:${mimeType};base64,${base64}` } }
        : { type: 'image_url' as const, image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' as const } };

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Drawing file: "${fileName}". Extract the complete Bill of Quantities.` },
              imageContent,
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

      // Update drawing with AI notes
      if (result.notes) {
        await this.prisma.bOQDrawing.updateMany({
          where: { fileName },
          data: { aiNotes: result.notes },
        });
      }

      const items: ExtractedItem[] = (result.items || [])
        .filter((i: any) => i.description && i.quantity)
        .map((i: any) => ({
          section: i.section || 'General',
          sectionNumber: i.sectionNumber || null,
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'piece',
          specs: i.specs || null,
          drawingRef: fileName,
        }));

      this.logger.log(`Vision extracted ${items.length} items from ${fileName}`);
      return items;
    } catch (err: any) {
      this.logger.error(`Vision extraction failed for ${fileName}: ${err.message}`);
      return this.extractFallback(fileName);
    }
  }

  private extractFallback(fileName: string): ExtractedItem[] {
    // Generate reasonable placeholder items based on file name keywords
    const name = fileName.toLowerCase();
    const items: ExtractedItem[] = [];

    if (name.includes('floor') || name.includes('plan') || name.includes('layout')) {
      items.push(
        { section: 'Flooring', sectionNumber: '1', description: 'Floor finish area', quantity: 1, unit: 'sqm', drawingRef: fileName },
        { section: 'Flooring', sectionNumber: '1.1', description: 'Floor preparation', quantity: 1, unit: 'sqm', drawingRef: fileName },
        { section: 'Walls', sectionNumber: '2', description: 'Partition walls', quantity: 1, unit: 'lm', drawingRef: fileName },
      );
    } else if (name.includes('elevation') || name.includes('facade')) {
      items.push(
        { section: 'Facade', sectionNumber: '1', description: 'Facade cladding', quantity: 1, unit: 'sqm', drawingRef: fileName },
        { section: 'Signage', sectionNumber: '2', description: 'Signage / lettering', quantity: 1, unit: 'set', drawingRef: fileName },
      );
    } else if (name.includes('stage') || name.includes('event')) {
      items.push(
        { section: 'Staging', sectionNumber: '1', description: 'Stage platform', quantity: 1, unit: 'sqm', drawingRef: fileName },
        { section: 'Lighting', sectionNumber: '2', description: 'Lighting rig', quantity: 1, unit: 'set', drawingRef: fileName },
        { section: 'Fabric', sectionNumber: '3', description: 'Backdrop / draping', quantity: 1, unit: 'sqm', drawingRef: fileName },
      );
    } else {
      items.push(
        { section: 'General', sectionNumber: '1', description: 'Items from drawing - review required', quantity: 1, unit: 'lot', drawingRef: fileName },
      );
    }

    return items;
  }

  // ── Price Lookup: Cost Sheets first, then Cost Engine catalog ────────────

  private async priceItems(items: ExtractedItem[]): Promise<(ExtractedItem & { unitCost: number; unitSelling: number; priceSource: string; priceConfidence: number })[]> {
    const defaultMarkup = 1.35; // 35% markup for selling price

    return Promise.all(
      items.map(async (item) => {
        // 1. Search cost sheet items for historical pricing (best data)
        const costSheetPrice = await this.lookupFromCostSheets(item.description);
        if (costSheetPrice) {
          return {
            ...item,
            unitCost: costSheetPrice.unitCost,
            unitSelling: costSheetPrice.unitSelling || Math.round(costSheetPrice.unitCost * defaultMarkup * 100) / 100,
            priceSource: `COST_SHEET (${costSheetPrice.matchCount} records, best: ${costSheetPrice.bestJob})`,
            priceConfidence: costSheetPrice.confidence,
          };
        }

        // 2. Fall back to cost engine material catalog (vendor POs, manual, online)
        try {
          const price = await this.costEngine.getBestPrice(item.description);
          if (price.unitPrice > 0) {
            return {
              ...item,
              unitCost: Math.round(price.unitPrice * 100) / 100,
              unitSelling: Math.round(price.unitPrice * defaultMarkup * 100) / 100,
              priceSource: price.source,
              priceConfidence: price.confidence,
            };
          }
        } catch {
          // Ignore price lookup errors
        }

        return {
          ...item,
          unitCost: 0,
          unitSelling: 0,
          priceSource: 'NONE',
          priceConfidence: 0,
        };
      }),
    );
  }

  /**
   * Search historical cost sheet items for pricing.
   * Compares across all past jobs to find the best (lowest) unit cost
   * and average selling price for similar items.
   */
  private async lookupFromCostSheets(description: string): Promise<{
    unitCost: number;
    unitSelling: number | null;
    confidence: number;
    matchCount: number;
    bestJob: string;
  } | null> {
    // Extract key words for fuzzy matching (skip very short words)
    const keywords = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return null;

    // Search cost sheet items matching any keyword
    const items = await this.prisma.costSheetItem.findMany({
      where: {
        AND: [
          { unitCost: { not: null, gt: 0 } },
          {
            OR: keywords.slice(0, 3).map((kw) => ({
              description: { contains: kw, mode: 'insensitive' as const },
            })),
          },
        ],
      },
      include: {
        costSheet: { select: { jobNumber: true, client: true, date: true } },
      },
      orderBy: { costSheet: { date: 'desc' } },
      take: 50,
    });

    if (items.length === 0) return null;

    // Score matches by keyword overlap
    const scored = items.map((item) => {
      const itemDesc = item.description.toLowerCase();
      const matchedKws = keywords.filter((kw) => itemDesc.includes(kw));
      return { ...item, score: matchedKws.length / keywords.length };
    }).filter((i) => i.score >= 0.3); // at least 30% keyword match

    if (scored.length === 0) return null;

    // Sort by score (best match first), then by date (newest first)
    scored.sort((a, b) => b.score - a.score ||
      ((b.costSheet?.date?.getTime() || 0) - (a.costSheet?.date?.getTime() || 0)));

    const costs = scored.map((i) => i.unitCost!);
    const sellingPrices = scored
      .filter((i) => i.unitSellingPrice && i.unitSellingPrice > 0)
      .map((i) => i.unitSellingPrice!);

    const bestCost = Math.min(...costs);
    const avgCost = costs.reduce((s, c) => s + c, 0) / costs.length;
    const avgSelling = sellingPrices.length > 0
      ? sellingPrices.reduce((s, c) => s + c, 0) / sellingPrices.length
      : null;

    // Use the best (lowest) cost, not the average — gives competitive pricing
    const unitCost = Math.round(bestCost * 100) / 100;
    const unitSelling = avgSelling ? Math.round(avgSelling * 100) / 100 : null;

    // Confidence: based on match quality and data volume
    const topScore = scored[0].score;
    const dataBonus = Math.min(scored.length * 0.05, 0.3); // more data = more confident
    const confidence = Math.min(1, topScore * 0.7 + dataBonus);

    const bestJob = scored[0].costSheet?.jobNumber || 'unknown';

    return {
      unitCost,
      unitSelling,
      confidence: Math.round(confidence * 100) / 100,
      matchCount: scored.length,
      bestJob,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(filters?: { status?: string; search?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { boqNumber: { contains: filters.search, mode: 'insensitive' } },
        { projectName: { contains: filters.search, mode: 'insensitive' } },
        { clientName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.bOQ.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true, drawings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const boq = await this.prisma.bOQ.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        drawings: true,
        items: { orderBy: [{ sectionNumber: 'asc' }, { itemNumber: 'asc' }] },
      },
    });
    if (!boq) throw new NotFoundException(`BOQ ${id} not found`);
    return boq;
  }

  async updateItem(itemId: string, dto: UpdateBoqItemDto) {
    const item = await this.prisma.bOQItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`BOQ item ${itemId} not found`);

    const quantity = dto.quantity ?? item.quantity;
    const unitCost = dto.unitCost ?? item.unitCost;
    const unitSelling = dto.unitSelling ?? item.unitSelling;

    const updated = await this.prisma.bOQItem.update({
      where: { id: itemId },
      data: {
        ...dto,
        quantity,
        unitCost,
        unitSelling,
        totalCost: unitCost * quantity,
        totalSelling: unitSelling * quantity,
        priceSource: dto.unitCost !== undefined ? 'MANUAL' : item.priceSource,
        priceConfidence: dto.unitCost !== undefined ? 1.0 : item.priceConfidence,
      },
    });

    // Recalculate BOQ totals
    await this.recalculateTotals(item.boqId);
    return updated;
  }

  async addItem(boqId: string, dto: UpdateBoqItemDto & { description: string; quantity: number; unit: string }) {
    const boq = await this.findOne(boqId);
    const maxItem = boq.items.reduce((max, i) => Math.max(max, i.itemNumber), 0);

    const unitCost = dto.unitCost || 0;
    const unitSelling = dto.unitSelling || 0;
    const quantity = dto.quantity;

    const item = await this.prisma.bOQItem.create({
      data: {
        boqId,
        itemNumber: maxItem + 1,
        section: dto.section,
        sectionNumber: dto.sectionNumber,
        description: dto.description,
        quantity,
        unit: dto.unit,
        unitCost,
        totalCost: unitCost * quantity,
        unitSelling,
        totalSelling: unitSelling * quantity,
        priceSource: 'MANUAL',
        priceConfidence: 1.0,
        specs: dto.specs,
      },
    });

    await this.recalculateTotals(boqId);
    return item;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.bOQItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`BOQ item ${itemId} not found`);

    await this.prisma.bOQItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(item.boqId);
    return { message: 'Item removed' };
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    return this.prisma.bOQ.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bOQ.delete({ where: { id } });
    return { message: 'BOQ deleted' };
  }

  // ── Re-price all items from cost engine ───────────────────────────────────

  async repriceAll(id: string) {
    const boq = await this.findOne(id);
    const defaultMarkup = 1.35;
    let updated = 0;

    for (const item of boq.items) {
      const price = await this.costEngine.getBestPrice(item.description);
      if (price.unitPrice > 0) {
        await this.prisma.bOQItem.update({
          where: { id: item.id },
          data: {
            unitCost: Math.round(price.unitPrice * 100) / 100,
            totalCost: Math.round(price.unitPrice * item.quantity * 100) / 100,
            unitSelling: Math.round(price.unitPrice * defaultMarkup * 100) / 100,
            totalSelling: Math.round(price.unitPrice * defaultMarkup * item.quantity * 100) / 100,
            priceSource: price.source,
            priceConfidence: price.confidence,
          },
        });
        updated++;
      }
    }

    await this.recalculateTotals(id);
    return { updated, total: boq.items.length };
  }

  // ── Sync cost sheets from Google Drive and re-price ────────────────────

  async syncAndReprice(id: string) {
    // 1. Sync latest cost sheets from Google Drive master folder
    let syncResult: any = null;
    try {
      syncResult = await this.driveService.syncFolder();
      this.logger.log(`Drive sync: ${syncResult.filesProcessed} files processed`);
    } catch (err: any) {
      this.logger.warn(`Drive sync skipped (not configured): ${err.message}`);
    }

    // 2. Re-price all BOQ items from the refreshed data
    const repriceResult = await this.repriceAll(id);

    return {
      sync: syncResult ? {
        filesFound: syncResult.filesFound,
        filesProcessed: syncResult.filesProcessed,
        filesSkipped: syncResult.filesSkipped,
      } : { message: 'Google Drive not configured, using existing data' },
      reprice: repriceResult,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async recalculateTotals(boqId: string) {
    const items = await this.prisma.bOQItem.findMany({ where: { boqId } });
    const totalCost = items.reduce((s, i) => s + i.totalCost, 0);
    const totalSelling = items.reduce((s, i) => s + i.totalSelling, 0);
    const margin = totalSelling > 0
      ? Math.round(((totalSelling - totalCost) / totalSelling) * 100 * 10) / 10
      : null;

    await this.prisma.bOQ.update({
      where: { id: boqId },
      data: { totalCost, totalSelling, margin },
    });
  }

  private async generateBoqNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.bOQ.count({
      where: { boqNumber: { startsWith: `BOQ-${year}` } },
    });
    return `BOQ-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}
