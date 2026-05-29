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

  /**
   * Imports a single detailed Cost Sheet from the Cost Sheet-Master style.
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
   * Bulk import for historical data (2023 - present).
   * Much more robust version for large historical imports.
   */
  async importCostSheetMasterFolder(folderPath: string, options?: { skipDuplicates?: boolean }) {
    this.logger.log(`Starting historical bulk import from: ${folderPath} (data from 2023+)`);

    const results: any[] = [];
    let totalInserted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const files = fs.readdirSync(folderPath)
        .filter((f: string) => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
        .sort(); // Sort for consistent processing

      this.logger.log(`Found ${files.length} cost sheet files`);

      for (const [index, file] of files.entries()) {
        const fullPath = `${folderPath}/${file}`;

        try {
          // Optional duplicate check based on filename/job number
          if (options?.skipDuplicates) {
            const { jobNumber } = this.extractJobFromFilename(file);
            const existing = await this.prisma.costSheet.findFirst({
              where: { jobNumber },
            });
            if (existing) {
              this.logger.log(`Skipping duplicate: ${file} (job ${jobNumber} already exists)`);
              skipped++;
              continue;
            }
          }

          const res = await this.importCostSheetFromMaster(fullPath);
          results.push({ file, ...res });

          if (res.success) {
            totalInserted += res.rowsInserted || 0;
          } else {
            errors++;
          }

          // Progress log every 20 files
          if ((index + 1) % 20 === 0) {
            this.logger.log(`Progress: ${index + 1}/${files.length} files processed`);
          }
        } catch (err: any) {
          this.logger.error(`Error on file ${file}: ${err.message}`);
          errors++;
          results.push({ file, success: false, error: err.message });
        }
      }

      return {
        success: true,
        totalFiles: files.length,
        successfullyProcessed: results.filter(r => r.success).length,
        totalItemsImported: totalInserted,
        skipped,
        errors,
        results: results.slice(0, 50), // Return first 50 for review
      };
    } catch (error: any) {
      return { success: false, error: error.message, partialResults: results };
    }
  }

  private extractJobFromFilename(fileName: string) {
    const withoutExt = fileName.replace(/\.xlsx?$/i, '');
    const parts = withoutExt.split(/[-–—]/);
    return { jobNumber: parts[0]?.trim() || 'Unknown' };
  }
}
