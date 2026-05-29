import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiAssistantService } from '../ai-assistant/ai-assistant.service';
import { ExcelParserService } from '../cost-sheets/excel-parser.service';
import * as fs from 'fs';

@Injectable()
export class FinanceImportService {
  private readonly logger = new Logger(FinanceImportService.name);

  constructor(
    private prisma: PrismaService,
    private aiAssistant: AiAssistantService,
    private excelParser: ExcelParserService,
  ) {}

  // ... existing monthly pack and P&L methods ...

  /**
   * Imports a detailed Cost Sheet from the "Cost Sheet-Master" folder style.
   * File format example: "4169- Saud Bahwan Group- iCAUR Test drive- Cost Sheet.xlsx"
   *
   * These are the granular per-job cost breakdowns. Importing them at scale
   * gives the AI Finance Controller deep actual vs sell data for analysis.
   */
  async importCostSheetFromMaster(filePath: string) {
    this.logger.log(`Importing cost sheet: ${filePath}`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = filePath.split(/[\/\\]/).pop() || 'cost-sheet.xlsx';

      const result = await this.excelParser.parseAndInsert(
        fileBuffer,
        fileName,
        `local-master-${Date.now()}-${fileName}`,
      );

      return {
        success: result.success,
        fileName,
        rowsInserted: result.rowsInserted,
        rowsSkipped: result.rowsSkipped,
        error: result.error,
      };
    } catch (error: any) {
      this.logger.error(`Failed importing cost sheet: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk import the entire Cost Sheet-Master folder.
   * This lets the user point at their desktop folder and suck in years of detailed cost data.
   */
  async importCostSheetMasterFolder(folderPath: string) {
    this.logger.log(`Bulk importing Cost Sheet-Master folder: ${folderPath}`);

    const results: any[] = [];
    try {
      const files = fs.readdirSync(folderPath)
        .filter((f: string) => f.endsWith('.xlsx') || f.endsWith('.xls'));

      for (const file of files) {
        const fullPath = `${folderPath}/${file}`;
        const res = await this.importCostSheetFromMaster(fullPath);
        results.push({ file, ...res });
      }

      const totalInserted = results.reduce((sum, r) => sum + (r.rowsInserted || 0), 0);

      return {
        success: true,
        totalFiles: files.length,
        totalItemsImported: totalInserted,
        results,
      };
    } catch (error: any) {
      return { success: false, error: error.message, partialResults: results };
    }
  }
}
