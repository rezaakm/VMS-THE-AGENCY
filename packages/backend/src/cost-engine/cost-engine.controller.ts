import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CostEngineService } from './cost-engine.service';
import { DocumentService, DocumentType } from './document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PriceSource } from '@prisma/client';

@ApiTags('cost-engine')
@Controller('cost-engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CostEngineController {
  constructor(
    private readonly costEngineService: CostEngineService,
    private readonly documentService: DocumentService,
  ) {}

  // ── BOM Dissection ─────────────────────────────────────────────────────────

  @Post('dissect')
  @ApiOperation({ summary: 'Use AI to break an item into Bill of Materials lines' })
  async dissect(@Body() body: { description: string; category?: string }) {
    const lines = await this.costEngineService.dissectItem(body.description, body.category);
    return { lines };
  }

  // ── Estimates ─────────────────────────────────────────────────────────────

  @Post('estimates')
  @ApiOperation({ summary: 'Create a cost estimate (AI dissection + price lookup)' })
  create(@Body() body: {
    title: string;
    description?: string;
    category?: string;
    clientName?: string;
    sellingPrice?: number;
    bomLines?: Array<{ materialName: string; quantity: number; unit: string }>;
  }) {
    return this.costEngineService.createEstimate(body);
  }

  @Get('estimates')
  @ApiOperation({ summary: 'List all cost estimates' })
  list() {
    return this.costEngineService.listEstimates();
  }

  @Get('estimates/:id')
  @ApiOperation({ summary: 'Get a single estimate with lines' })
  findOne(@Param('id') id: string) {
    return this.costEngineService.getEstimate(id);
  }

  @Patch('estimates/:id/selling-price')
  @ApiOperation({ summary: 'Update selling price and recalculate margin' })
  updateSellingPrice(@Param('id') id: string, @Body() body: { sellingPrice: number }) {
    return this.costEngineService.updateSellingPrice(id, body.sellingPrice);
  }

  // ── Margin Dashboard ───────────────────────────────────────────────────────

  @Get('margin-dashboard')
  @ApiOperation({ summary: 'Margin overview — all estimates sorted by margin risk' })
  marginDashboard(
    @Query('category') category?: string,
    @Query('minMargin') minMargin?: string,
    @Query('maxMargin') maxMargin?: string,
  ) {
    return this.costEngineService.getMarginDashboard({
      category,
      minMargin: minMargin ? parseFloat(minMargin) : undefined,
      maxMargin: maxMargin ? parseFloat(maxMargin) : undefined,
    });
  }

  // ── Raw Material Catalog ───────────────────────────────────────────────────

  @Get('materials')
  @ApiOperation({ summary: 'List raw materials catalog' })
  getMaterials(@Query('search') search?: string) {
    return this.costEngineService.getRawMaterials(search);
  }

  @Post('materials/price')
  @ApiOperation({ summary: 'Add a price entry to the raw material catalog' })
  addPrice(@Body() body: {
    materialName: string;
    unit: string;
    unitPrice: number;
    source: PriceSource;
    vendorName?: string;
    sourceRef?: string;
    category?: string;
  }) {
    return this.costEngineService.upsertMaterialPrice(
      body.materialName,
      body.unit,
      body.unitPrice,
      body.source,
      { vendorName: body.vendorName, sourceRef: body.sourceRef, category: body.category },
    );
  }

  @Post('price-lookup')
  @ApiOperation({ summary: 'Look up best price for a material by name' })
  priceLookup(@Body() body: { materialName: string }) {
    return this.costEngineService.getBestPrice(body.materialName);
  }

  // ── Document Output ────────────────────────────────────────────────────────

  @Get('estimates/:id/document')
  @ApiOperation({ summary: 'Generate PDF document from estimate (quotation, cost-sheet, rfq, draft-po)' })
  async generateDocument(
    @Param('id') id: string,
    @Query('type') type: string = 'quotation',
    @Res() res: Response,
  ) {
    const result = await this.documentService.generateEstimateDocument(id, type as DocumentType);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.send(result.buffer);
  }

  @Get('estimates/:id/document/excel')
  @ApiOperation({ summary: 'Generate Excel cost sheet from estimate' })
  async generateCostSheetExcel(@Param('id') id: string, @Res() res: Response) {
    const result = await this.documentService.generateCostSheetExcel(id);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    res.send(result.buffer);
  }

  @Get('margin-report/excel')
  @ApiOperation({ summary: 'Export full margin report as Excel' })
  async generateMarginReport(@Res() res: Response) {
    const result = await this.documentService.generateMarginReportExcel();
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    res.send(result.buffer);
  }
}
