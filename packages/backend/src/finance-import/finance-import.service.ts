import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiAssistantService } from '../ai-assistant/ai-assistant.service';

@Injectable()
export class FinanceImportService {
  private readonly logger = new Logger(FinanceImportService.name);

  constructor(
    private prisma: PrismaService,
    private aiAssistant: AiAssistantService,
  ) {}

  /**
   * Ingests a "Monthly Finance Pack" style Excel (like the April 2026 one).
   */
  async ingestMonthlyFinancePack(filePath: string, period: string, userId: string) {
    this.logger.log(`Starting ingestion of finance pack for period ${period}: ${filePath}`);

    const doc = await this.prisma.financialDocument.create({
      data: {
        type: 'MONTHLY_FINANCE_PACK',
        period,
        originalName: filePath.split(/[\/\\]/).pop() || 'Monthly_Finance_Pack.xlsx',
        status: 'PROCESSING',
      },
    });

    // TODO: Real Excel parsing + mapping to flags/checklist/processes
    await this.prisma.financialDocument.update({
      where: { id: doc.id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });

    return { documentId: doc.id, message: 'Monthly pack received. Full parser coming.' };
  }

  /**
   * Ingests P&L PDF reports (the kind the old accountant used to send monthly).
   * Example: "The Agency-P&L Dec'2025.pdf"
   *
   * This is critical for rebuilding historical finance data.
   */
  async ingestPLReportPdf(filePath: string, period: string, userId: string) {
    this.logger.log(`Ingesting P&L PDF for ${period}: ${filePath}`);

    const doc = await this.prisma.financialDocument.create({
      data: {
        type: 'PDF_REPORT',
        period,
        originalName: filePath.split(/[\/\\]/).pop() || 'P&L Report.pdf',
        status: 'PROCESSING',
      },
    });

    // TODO (high priority):
    // 1. Extract text from PDF (pdf-parse or similar)
    // 2. Send extracted text + smart prompt to the Finance AI Controller
    //    Prompt idea: "You are analyzing The Agency Oman's P&L for ${period}.
    //    Extract: Revenue breakdown, Direct Costs by major categories,
    //    Gross Profit, Operating Expenses (detailed if possible), Net Profit/Loss.
    //    Also flag any unusual variances or items. Return structured JSON."
    // 3. Store structured result in extractedData
    // 4. Optionally auto-create FinancialFlag records for suspicious items

    await this.prisma.financialDocument.update({
      where: { id: doc.id },
      data: {
        status: 'RECEIVED',
        notes: 'P&L PDF queued for AI extraction. This will feed the finance data model and AI controller.',
      },
    });

    return {
      documentId: doc.id,
      message: `P&L for ${period} received. AI will extract revenue, costs, margins and look for issues.`,
    };
  }
}
