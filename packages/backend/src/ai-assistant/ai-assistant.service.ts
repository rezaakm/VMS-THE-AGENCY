import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private openai: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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

  private getSystemPrompt(context: any): string {
    return `You are the **Finance AI Controller** for The Agency Oman.

Your mission: Help the company gain complete control over its finances using data, audit trails, and intelligent recommendations.

You have deep access to:
- All vendors, purchase orders, contracts
- Cost sheets and real cost intelligence data
- The 12 real Financial Flags from the April 2026 audit + ongoing oversight system
- Monthly financial checklists and process registry

Core principles:
- Be direct and action-oriented.
- Always reference real data when possible.
- Prioritize risk and overdue items.
- Suggest concrete next steps the user can take in the system.
- Use OMR for all money.

Current context: ${context?.page || 'dashboard'} | User: ${context?.userName || 'team'} (${context?.userRole || 'user'})`;
  }

  private getTools(): Tool[] {
    return [
      { type: 'function', function: { name: 'queryData', description: 'Query vendors, POs, contracts, cost data, etc.', parameters: { type: 'object', properties: { entity: { type: 'string' }, filters: { type: 'object' } }, required: ['entity'] } } },
      { type: 'function', function: { name: 'navigate', description: 'Navigate user to a page', parameters: { type: 'object', properties: { route: { type: 'string' } }, required: ['route'] } } },

      // === NEW POWERFUL FINANCE CONTROL TOOLS ===
      { type: 'function', function: { name: 'getFinancialFlags', description: 'Get current financial flags (the 12 audit issues + ongoing).', parameters: { type: 'object', properties: { status: { type: 'string' }, severity: { type: 'string' }, onlyOverdue: { type: 'boolean' } } } } },
      { type: 'function', function: { name: 'analyzeFinanceHealth', description: 'Run financial health analysis using flags, checklist, and processes.', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'getChecklistStatus', description: 'Get current monthly financial checklist status.', parameters: { type: 'object', properties: { period: { type: 'string' } } } } },
      { type: 'function', function: { name: 'prioritizeActions', description: 'Get AI-prioritized list of financial actions based on risk.', parameters: { type: 'object', properties: {} } } }
    ];
  }

  private async executeToolCall(name: string, args: any): Promise<string> {
    switch (name) {
      case 'queryData': return this.handleQueryData(args.entity, args.filters || {});
      case 'navigate': return JSON.stringify({ action: 'navigate', route: args.route });
      case 'getFinancialFlags': return this.handleGetFinancialFlags(args);
      case 'analyzeFinanceHealth': return this.handleAnalyzeFinanceHealth();
      case 'getChecklistStatus': return this.handleGetChecklistStatus(args.period);
      case 'prioritizeActions': return this.handlePrioritizeActions();
      default: return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  private async handleGetFinancialFlags(args: any) {
    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.severity) where.severity = args.severity;
    if (args.onlyOverdue) { where.dueDate = { lt: new Date() }; where.status = { in: ['OPEN', 'IN_PROGRESS'] }; }

    const flags = await this.prisma.financialFlag.findMany({ where, orderBy: [{ severity: 'asc' }, { dueDate: 'asc' }], take: 30 });
    return JSON.stringify({ count: flags.length, flags });
  }

  private async handleAnalyzeFinanceHealth() {
    const openFlags = await this.prisma.financialFlag.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } } });
    const overdueFlags = await this.prisma.financialFlag.count({ where: { dueDate: { lt: new Date() }, status: { in: ['OPEN', 'IN_PROGRESS'] } } });
    return JSON.stringify({ openFlags, overdueFlags, riskLevel: overdueFlags > 3 ? 'HIGH' : 'MEDIUM' });
  }

  private async handleGetChecklistStatus(period?: string) {
    const p = period || this.getCurrentPeriod();
    const items = await this.prisma.financialChecklistItem.findMany({ where: { isActive: true }, include: { completions: { where: { period: p } } } });
    return JSON.stringify({ period: p, items });
  }

  private async handlePrioritizeActions() {
    const overdue = await this.prisma.financialFlag.findMany({ where: { dueDate: { lt: new Date() }, status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { severity: 'asc' }, take: 5 });
    return JSON.stringify({ topActions: overdue.map(f => f.title) });
  }

  private getCurrentPeriod() {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  async chat(messages: Message[], context: any, res: Response): Promise<void> {
    if (!this.openai) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: 'AI Finance Controller not configured. Add OPENAI_API_KEY.' })}\n\n`); res.end(); return;
    }

    const systemMessage: Message = { role: 'system', content: this.getSystemPrompt(context) };
    const allMessages = [systemMessage, ...messages.slice(-20)];

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: allMessages,
        tools: this.getTools(),
        tool_choice: 'auto',
        stream: true,
      });

      // Streaming logic (simplified for this update)
      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }
      }
    } catch (err: any) {
      this.logger.error(err);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
}
