import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExcelParserService {
  constructor(private prisma: PrismaService) {}

  private parseFilenameMetadata(fileName: string): { jobNumber: string; client: string; event: string } {
    const withoutExt = fileName.replace(/\.xlsx?$/i, '');
    const parts = withoutExt.split(/[-–—]/);
    return {
      jobNumber: parts[0]?.trim() || 'Unknown',
      client: parts[1]?.trim() || 'Unknown Client',
      event: parts.slice(2).join(' - ').trim() || 'Cost Sheet',
    };
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[,$]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  async parseAndInsert(
    fileBuffer: Buffer,
    fileName: string,
    driveFileId: string,
  ): Promise<{ success: boolean; rowsInserted: number; rowsSkipped: number; error?: string }> {
    let rowsInserted = 0;
    let rowsSkipped = 0;

    try {
      const { jobNumber, client, event } = this.parseFilenameMetadata(fileName);

      // Check if exists
      const existing = await this.prisma.costSheet.findUnique({ where: { driveFileId } });

      let costSheet;
      if (existing) {
        await this.prisma.costSheetItem.deleteMany({ where: { costSheetId: existing.id } });
        costSheet = await this.prisma.costSheet.update({
          where: { id: existing.id },
          data: { lastSynced: new Date() },
        });
      } else {
        costSheet = await this.prisma.costSheet.create({
          data: { jobNumber, client, event, driveFileId, fileName, date: new Date() },
        });
      }

      // Parse Excel
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];

      // Find header row
      let headerRowIndex = -1;
      if (rows.length > 8) {
        const row9Str = JSON.stringify(rows[8]).toLowerCase();
        if (row9Str.includes('description') && (row9Str.includes('qty') || row9Str.includes('cost'))) {
          headerRowIndex = 8;
        }
      }
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const rowStr = JSON.stringify(rows[i]).toLowerCase();
          if (rowStr.includes('description') && (rowStr.includes('qty') || rowStr.includes('cost'))) {
            headerRowIndex = i;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        return { success: true, rowsInserted: 0, rowsSkipped: rows.length };
      }

      const headerRow = rows[headerRowIndex];
      const getColIndex = (patterns: RegExp[]): number => {
        for (const pattern of patterns) {
          const index = headerRow.findIndex((h: any) => pattern.test(String(h).toLowerCase()));
          if (index !== -1) return index;
        }
        return -1;
      };

      const descCol = getColIndex([/description/i, /desc/i, /item/i, /particular/i]);
      const vendorCol = getColIndex([/vendor/i, /supplier/i]);
      const qtyCol = getColIndex([/qty/i, /quantity/i, /days?/i]);
      const unitCostCol = getColIndex([/unit.*cost/i, /cost.*unit/i, /unit.*price/i]);
      const totalCostCol = getColIndex([/total.*cost/i, /cost.*total/i, /total.*price/i]);
      const unitSellCol = getColIndex([/unit.*sell/i, /sell.*unit/i]);
      const totalSellCol = getColIndex([/total.*sell/i, /sell.*total/i]);

      const itemsToInsert: any[] = [];

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) { rowsSkipped++; continue; }

        const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';
        if (!description || description.toLowerCase().includes('total') || description.toLowerCase().includes('vat')) {
          rowsSkipped++;
          continue;
        }

        const vendor = vendorCol >= 0 ? String(row[vendorCol] || '').trim() || null : null;
        const qty = qtyCol >= 0 ? parseFloat(String(row[qtyCol] || '0')) : null;

        itemsToInsert.push({
          costSheetId: costSheet.id,
          description,
          vendor,
          days: qty && !isNaN(qty) ? Math.round(qty) : null,
          unitCost: unitCostCol >= 0 ? this.parseDecimal(row[unitCostCol]) : null,
          totalCost: totalCostCol >= 0 ? this.parseDecimal(row[totalCostCol]) : null,
          unitSellingPrice: unitSellCol >= 0 ? this.parseDecimal(row[unitSellCol]) : null,
          totalSellingPrice: totalSellCol >= 0 ? this.parseDecimal(row[totalSellCol]) : null,
        });
      }

      if (itemsToInsert.length > 0) {
        await this.prisma.costSheetItem.createMany({ data: itemsToInsert });
        rowsInserted = itemsToInsert.length;
      }

      return { success: true, rowsInserted, rowsSkipped };
    } catch (e: any) {
      return { success: false, rowsInserted, rowsSkipped, error: e.message };
    }
  }
}
