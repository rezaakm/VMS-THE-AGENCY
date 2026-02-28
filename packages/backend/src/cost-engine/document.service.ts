import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

export type DocumentType = 'quotation' | 'cost-sheet' | 'margin-report' | 'rfq' | 'draft-po';

const COMPANY = {
  name: 'The Agency Oman',
  address: 'Muscat, Sultanate of Oman',
  email: 'info@theagency.om',
  phone: '+968 XXXX XXXX',
};

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  async generateEstimateDocument(estimateId: string, type: DocumentType): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const estimate = await this.prisma.costEstimate.findUnique({
      where: { id: estimateId },
      include: { lines: true },
    });
    if (!estimate) throw new NotFoundException(`Estimate ${estimateId} not found`);

    switch (type) {
      case 'quotation':
        return this.generateQuotationPdf(estimate);
      case 'cost-sheet':
        return this.generateCostSheetPdf(estimate);
      case 'rfq':
        return this.generateRfqPdf(estimate);
      case 'draft-po':
        return this.generateDraftPoPdf(estimate);
      default:
        throw new BadRequestException(`Unknown document type: ${type}`);
    }
  }

  async generateMarginReportExcel(): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const estimates = await this.prisma.costEstimate.findMany({
      orderBy: { margin: 'asc' },
      include: { lines: true },
    });
    return this.buildMarginReportExcel(estimates);
  }

  async generateCostSheetExcel(estimateId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const estimate = await this.prisma.costEstimate.findUnique({
      where: { id: estimateId },
      include: { lines: true },
    });
    if (!estimate) throw new NotFoundException(`Estimate ${estimateId} not found`);
    return this.buildCostSheetExcel(estimate);
  }

  // ── PDF helpers ────────────────────────────────────────────────────────────

  private async generateQuotationPdf(estimate: any): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text(COMPANY.name, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`${COMPANY.address}  |  ${COMPANY.email}  |  ${COMPANY.phone}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('QUOTATION', { align: 'center' });
    doc.moveDown(0.3);

    // Meta
    const dateStr = new Date().toLocaleDateString('en-GB');
    const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Date: ${dateStr}`, 50);
    doc.text(`Valid Until: ${validUntil}`);
    if (estimate.clientName) doc.text(`Client: ${estimate.clientName}`);
    doc.text(`Ref: QT-${estimate.id.substring(0, 8).toUpperCase()}`);
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text(`Subject: ${estimate.title}`);
    doc.moveDown(0.5);

    // Line items table
    const tableTop = doc.y;
    const cols = { desc: 50, qty: 310, unit: 360, price: 410, total: 470 };

    doc.rect(50, tableTop, 495, 20).fill('#1a1a2e');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    doc.text('Description', cols.desc + 5, tableTop + 5);
    doc.text('Qty', cols.qty, tableTop + 5);
    doc.text('Unit', cols.unit, tableTop + 5);
    doc.text('Unit Price', cols.price, tableTop + 5);
    doc.text('Total', cols.total, tableTop + 5);

    let y = tableTop + 22;
    doc.fillColor('#000').font('Helvetica').fontSize(9);
    const sellingLines = (estimate.lines || []).filter((l: any) => l.totalPrice > 0);
    const markupFactor = estimate.sellingPrice && estimate.totalCostPrice > 0
      ? estimate.sellingPrice / estimate.totalCostPrice
      : 1.3;

    for (const [i, line] of sellingLines.entries()) {
      if (i % 2 === 0) doc.rect(50, y - 2, 495, 18).fill('#f9f9f9');
      doc.fillColor('#000');
      const sellUnitPrice = (line.unitPrice || 0) * markupFactor;
      const sellTotal = (line.totalPrice || 0) * markupFactor;
      doc.text(line.description.substring(0, 45), cols.desc + 5, y);
      doc.text(String(line.quantity), cols.qty, y);
      doc.text(line.unit || '', cols.unit, y);
      doc.text(`OMR ${sellUnitPrice.toFixed(3)}`, cols.price, y);
      doc.text(`OMR ${sellTotal.toFixed(3)}`, cols.total, y);
      y += 18;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 8;

    // Totals
    const subtotal = estimate.sellingPrice || estimate.totalCostPrice * markupFactor;
    const vat = subtotal * 0.05;
    const grandTotal = subtotal + vat;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Subtotal:`, 380, y); doc.font('Helvetica').text(`OMR ${subtotal.toFixed(3)}`, 460, y);
    y += 16;
    doc.font('Helvetica-Bold').text(`VAT (5%):`, 380, y); doc.font('Helvetica').text(`OMR ${vat.toFixed(3)}`, 460, y);
    y += 16;
    doc.rect(378, y - 2, 167, 20).fill('#1a1a2e');
    doc.fillColor('#fff').font('Helvetica-Bold').text(`TOTAL:`, 382, y + 3);
    doc.text(`OMR ${grandTotal.toFixed(3)}`, 460, y + 3);
    doc.fillColor('#000');

    // Terms
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica-Bold').text('Terms & Conditions:');
    doc.font('Helvetica').text('1. This quotation is valid for 30 days from the date above.');
    doc.text('2. 50% advance payment required upon confirmation.');
    doc.text('3. Prices are in Omani Riyals (OMR) and inclusive of VAT as stated.');

    doc.end();
    await new Promise((r) => doc.on('end', r));
    const buffer = Buffer.concat(chunks);
    return { buffer, filename: `Quotation-${estimate.id.substring(0, 8)}.pdf`, mimeType: 'application/pdf' };
  }

  private async generateCostSheetPdf(estimate: any): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).font('Helvetica-Bold').text('INTERNAL COST SHEET', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(COMPANY.name, { align: 'center' });
    doc.fillColor('#000').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text(estimate.title);
    doc.fontSize(10).font('Helvetica');
    if (estimate.clientName) doc.text(`Client: ${estimate.clientName}`);
    if (estimate.category) doc.text(`Category: ${estimate.category}`);
    doc.text(`Date: ${new Date(estimate.createdAt).toLocaleDateString('en-GB')}`);
    doc.text(`Confidence Score: ${estimate.confidenceScore}%`);
    doc.moveDown(0.5);

    // BOM table
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 18).fill('#1a1a2e');
    doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
    doc.text('Material / Item', 55, tableTop + 4);
    doc.text('Qty', 290, tableTop + 4);
    doc.text('Unit', 330, tableTop + 4);
    doc.text('Unit Price', 370, tableTop + 4);
    doc.text('Total', 430, tableTop + 4);
    doc.text('Conf.', 490, tableTop + 4);

    let y = tableTop + 20;
    doc.fillColor('#000').font('Helvetica').fontSize(8);
    for (const [i, line] of (estimate.lines || []).entries()) {
      if (i % 2 === 0) doc.rect(50, y - 1, 495, 16).fill('#f5f5f5');
      doc.fillColor('#000');
      doc.text(line.description.substring(0, 40), 55, y);
      doc.text(String(line.quantity), 290, y);
      doc.text(line.unit || '', 330, y);
      doc.text(`${(line.unitPrice || 0).toFixed(3)}`, 370, y);
      doc.text(`${(line.totalPrice || 0).toFixed(3)}`, 430, y);
      const conf = Math.round((line.confidence || 0) * 100);
      doc.fillColor(conf >= 80 ? '#16a34a' : conf >= 50 ? '#ca8a04' : '#dc2626')
        .text(`${conf}%`, 490, y);
      doc.fillColor('#000');
      y += 16;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
    y += 8;

    doc.fontSize(9).font('Helvetica-Bold');
    const rows = [
      ['Material Cost:', `OMR ${estimate.materialCost.toFixed(3)}`],
      ['Labour Cost:', `OMR ${estimate.labourCost.toFixed(3)}`],
      ['Overhead:', `OMR ${estimate.overheadCost.toFixed(3)}`],
      ['TOTAL COST PRICE:', `OMR ${estimate.totalCostPrice.toFixed(3)}`],
    ];
    if (estimate.sellingPrice) rows.push(['Selling Price:', `OMR ${estimate.sellingPrice.toFixed(3)}`]);
    if (estimate.margin !== null && estimate.margin !== undefined) {
      rows.push(['Gross Margin:', `${estimate.margin.toFixed(1)}%`]);
    }

    for (const [label, value] of rows) {
      doc.text(label, 350, y);
      doc.font('Helvetica').text(value, 460, y);
      doc.font('Helvetica-Bold');
      y += 14;
    }

    doc.end();
    await new Promise((r) => doc.on('end', r));
    return { buffer: Buffer.concat(chunks), filename: `CostSheet-${estimate.id.substring(0, 8)}.pdf`, mimeType: 'application/pdf' };
  }

  private async generateRfqPdf(estimate: any): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).font('Helvetica-Bold').text('REQUEST FOR QUOTATION', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(COMPANY.name, { align: 'center' });
    doc.fillColor('#000').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`RFQ Ref: RFQ-${estimate.id.substring(0, 8).toUpperCase()}`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`);
    doc.text(`Response Required By: ${new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB')}`);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('To: [Vendor Name]');
    doc.font('Helvetica').text('Please provide your best pricing for the following items:');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 18).fill('#1a1a2e');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    doc.text('#', 55, tableTop + 4);
    doc.text('Description / Material', 75, tableTop + 4);
    doc.text('Qty', 330, tableTop + 4);
    doc.text('Unit', 375, tableTop + 4);
    doc.text('Unit Price (OMR)', 415, tableTop + 4);

    let y = tableTop + 20;
    doc.fillColor('#000').font('Helvetica').fontSize(9);
    for (const [i, line] of (estimate.lines || []).entries()) {
      if (i % 2 === 0) doc.rect(50, y - 1, 495, 18).fill('#f9f9f9');
      doc.fillColor('#000');
      doc.text(String(i + 1), 55, y + 2);
      doc.text(line.description.substring(0, 42), 75, y + 2);
      doc.text(String(line.quantity), 330, y + 2);
      doc.text(line.unit || '', 375, y + 2);
      doc.rect(413, y, 130, 16).stroke();
      y += 20;
    }

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica-Bold').text('Notes:');
    doc.font('Helvetica').text('- Please include delivery timeline and payment terms.');
    doc.text('- Prices must be valid for 30 days.');
    doc.text('- All prices in Omani Riyals (OMR), exclusive of VAT.');

    doc.end();
    await new Promise((r) => doc.on('end', r));
    return { buffer: Buffer.concat(chunks), filename: `RFQ-${estimate.id.substring(0, 8)}.pdf`, mimeType: 'application/pdf' };
  }

  private async generateDraftPoPdf(estimate: any): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).font('Helvetica-Bold').text('PURCHASE ORDER (DRAFT)', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#888').text('DRAFT — Pending Approval', { align: 'center' });
    doc.fillColor('#000').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`PO Number: PO-DRAFT-${estimate.id.substring(0, 8).toUpperCase()}`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`);
    doc.text(`From: ${COMPANY.name}`);
    doc.text('To: [Vendor — to be confirmed]');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 18).fill('#1a1a2e');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    doc.text('Item', 55, tableTop + 4);
    doc.text('Description', 90, tableTop + 4);
    doc.text('Qty', 310, tableTop + 4);
    doc.text('Unit', 355, tableTop + 4);
    doc.text('Est. Unit Price', 395, tableTop + 4);
    doc.text('Est. Total', 480, tableTop + 4);

    let y = tableTop + 20;
    doc.fillColor('#000').font('Helvetica').fontSize(9);
    for (const [i, line] of (estimate.lines || []).entries()) {
      if (i % 2 === 0) doc.rect(50, y - 1, 495, 18).fill('#f9f9f9');
      doc.fillColor('#000');
      doc.text(String(i + 1), 55, y + 2);
      doc.text(line.description.substring(0, 38), 90, y + 2);
      doc.text(String(line.quantity), 310, y + 2);
      doc.text(line.unit || '', 355, y + 2);
      doc.text(`${(line.unitPrice || 0).toFixed(3)}`, 395, y + 2);
      doc.text(`${(line.totalPrice || 0).toFixed(3)}`, 480, y + 2);
      y += 20;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
    y += 8;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Estimated Total: OMR ${estimate.totalCostPrice.toFixed(3)}`, 350, y);
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica').fillColor('#888')
      .text('This is a draft PO generated from cost estimate. Prices are estimates only. Final PO to be issued after vendor confirmation.');

    doc.end();
    await new Promise((r) => doc.on('end', r));
    return { buffer: Buffer.concat(chunks), filename: `DraftPO-${estimate.id.substring(0, 8)}.pdf`, mimeType: 'application/pdf' };
  }

  // ── Excel helpers ──────────────────────────────────────────────────────────

  private async buildMarginReportExcel(estimates: any[]): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const wb = new ExcelJS.Workbook();
    wb.creator = COMPANY.name;
    const ws = wb.addWorksheet('Margin Report');

    ws.columns = [
      { header: 'Title', key: 'title', width: 35 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Cost Price (OMR)', key: 'totalCostPrice', width: 18 },
      { header: 'Selling Price (OMR)', key: 'sellingPrice', width: 20 },
      { header: 'Margin %', key: 'margin', width: 12 },
      { header: 'Confidence %', key: 'confidenceScore', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created', key: 'createdAt', width: 14 },
    ];

    // Header styling
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    for (const est of estimates) {
      const row = ws.addRow({
        title: est.title,
        clientName: est.clientName || '',
        category: est.category || '',
        totalCostPrice: Number(est.totalCostPrice.toFixed(3)),
        sellingPrice: est.sellingPrice ? Number(est.sellingPrice.toFixed(3)) : null,
        margin: est.margin !== null && est.margin !== undefined ? Number(est.margin.toFixed(1)) : null,
        confidenceScore: est.confidenceScore,
        status: est.status,
        createdAt: new Date(est.createdAt).toLocaleDateString('en-GB'),
      });
      // Red for at-risk margins
      if (est.margin !== null && est.margin !== undefined && est.margin < 25) {
        row.getCell('margin').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
        row.getCell('margin').font = { color: { argb: 'FFDC2626' }, bold: true };
      }
    }

    // Summary sheet
    const summary = wb.addWorksheet('Summary');
    const atRisk = estimates.filter((e) => e.margin !== null && e.margin < 25).length;
    const avgMargin = estimates.filter((e) => e.margin !== null).length
      ? estimates.filter((e) => e.margin !== null).reduce((s, e) => s + (e.margin || 0), 0) /
        estimates.filter((e) => e.margin !== null).length
      : 0;

    summary.addRow(['Margin Report Summary']).getCell(1).font = { bold: true, size: 14 };
    summary.addRow([]);
    summary.addRow(['Generated', new Date().toLocaleDateString('en-GB')]);
    summary.addRow(['Total Estimates', estimates.length]);
    summary.addRow(['At Risk (margin < 25%)', atRisk]);
    summary.addRow(['Average Margin', `${avgMargin.toFixed(1)}%`]);
    summary.addRow(['Target Margin', '25%']);
    summary.columns = [{ width: 25 }, { width: 20 }];

    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return { buffer, filename: `MarginReport-${new Date().toISOString().substring(0, 10)}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  private async buildCostSheetExcel(estimate: any): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cost Sheet');

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `${COMPANY.name} — Internal Cost Sheet`;
    ws.getCell('A1').font = { bold: true, size: 14 };

    ws.addRow([]);
    ws.addRow(['Title', estimate.title]);
    ws.addRow(['Client', estimate.clientName || '']);
    ws.addRow(['Category', estimate.category || '']);
    ws.addRow(['Confidence', `${estimate.confidenceScore}%`]);
    ws.addRow(['Date', new Date(estimate.createdAt).toLocaleDateString('en-GB')]);
    ws.addRow([]);

    ws.addRow(['Description', 'Qty', 'Unit', 'Unit Price (OMR)', 'Total (OMR)', 'Source', 'Confidence']).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    for (const line of estimate.lines || []) {
      const row = ws.addRow([
        line.description,
        line.quantity,
        line.unit,
        Number((line.unitPrice || 0).toFixed(3)),
        Number((line.totalPrice || 0).toFixed(3)),
        line.source,
        `${Math.round((line.confidence || 0) * 100)}%`,
      ]);
      if ((line.confidence || 0) < 0.5) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      }
    }

    ws.addRow([]);
    ws.addRow(['Material Cost (OMR)', '', '', '', Number(estimate.materialCost.toFixed(3))]).getCell(5).font = { bold: true };
    ws.addRow(['Labour Cost (OMR)', '', '', '', Number(estimate.labourCost.toFixed(3))]).getCell(5).font = { bold: true };
    ws.addRow(['Overhead (OMR)', '', '', '', Number(estimate.overheadCost.toFixed(3))]).getCell(5).font = { bold: true };
    ws.addRow(['TOTAL COST PRICE (OMR)', '', '', '', Number(estimate.totalCostPrice.toFixed(3))]).eachCell((c) => { c.font = { bold: true }; });
    if (estimate.sellingPrice) ws.addRow(['Selling Price (OMR)', '', '', '', Number(estimate.sellingPrice.toFixed(3))]);
    if (estimate.margin !== null && estimate.margin !== undefined) {
      ws.addRow(['Gross Margin', '', '', '', `${estimate.margin.toFixed(1)}%`]).getCell(5).font = {
        bold: true,
        color: { argb: estimate.margin >= 25 ? 'FF16a34a' : 'FFDC2626' },
      };
    }

    ws.columns = [{ width: 40 }, { width: 8 }, { width: 8 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 12 }];

    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return { buffer, filename: `CostSheet-${estimate.id.substring(0, 8)}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
}
