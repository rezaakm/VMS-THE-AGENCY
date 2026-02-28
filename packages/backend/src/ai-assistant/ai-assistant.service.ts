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
    return `You are the built-in AI assistant for The Agency Oman's Vendor Management System (VMS).
You help the team navigate the app, answer questions about vendors, costs, margins, and trigger useful actions.

Current context:
- Page: ${context?.page || 'dashboard'}
- User: ${context?.userName || 'team member'} (${context?.userRole || 'user'})
- Current time: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Muscat' })}

You have tools to:
1. Query live data (vendors, POs, cost sheets, estimates, margins)
2. Navigate the user to any page
3. Trigger app actions (sync Drive, create estimate)

Be concise and helpful. Use OMR for currency. When showing data, format it clearly.
If credentials are missing (e.g. OpenAI key, Google Drive), explain what to set up.`;
  }

  private getTools(): Tool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'queryData',
          description: 'Query live data from the VMS database. Use to answer questions about vendors, POs, contracts, cost estimates, margins, raw materials.',
          parameters: {
            type: 'object',
            properties: {
              entity: {
                type: 'string',
                enum: ['vendors', 'purchaseOrders', 'contracts', 'costEstimates', 'rawMaterials', 'costSheets', 'marginSummary'],
                description: 'What to query',
              },
              filters: {
                type: 'object',
                description: 'Optional filters: { search, status, limit, sortBy }',
              },
            },
            required: ['entity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'navigate',
          description: 'Navigate the user to a specific page in the VMS app.',
          parameters: {
            type: 'object',
            properties: {
              route: {
                type: 'string',
                description: 'The frontend route, e.g. /dashboard/cost-engine, /dashboard/vendors, /dashboard/cost-sheets, /dashboard/purchase-orders, /dashboard/contracts, /dashboard/reports',
              },
              reason: { type: 'string', description: 'Why you are navigating there' },
            },
            required: ['route'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'syncGoogleDrive',
          description: 'Trigger a sync of cost sheets from Google Drive. Use when the user asks to sync or refresh data from Drive.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'createCostEstimate',
          description: 'Create a new cost estimate using AI dissection. Navigates to the cost engine and prepopulates with the description.',
          parameters: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Item or job description to estimate' },
              category: { type: 'string', description: 'Category: events, construction, goods' },
            },
            required: ['description'],
          },
        },
      },
    ];
  }

  private async executeToolCall(name: string, args: any): Promise<string> {
    switch (name) {
      case 'queryData':
        return this.handleQueryData(args.entity, args.filters || {});

      case 'navigate':
        return JSON.stringify({ action: 'navigate', route: args.route, reason: args.reason });

      case 'syncGoogleDrive':
        return JSON.stringify({ action: 'syncDrive', message: 'Drive sync triggered. Results will appear on the Cost Sheets page.' });

      case 'createCostEstimate':
        return JSON.stringify({ action: 'navigate', route: '/dashboard/cost-engine', prefill: { description: args.description, category: args.category } });

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  private async handleQueryData(entity: string, filters: any): Promise<string> {
    const limit = Math.min(filters.limit || 10, 50);
    try {
      switch (entity) {
        case 'vendors': {
          const vendors = await this.prisma.vendor.findMany({
            where: filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : undefined,
            take: limit,
            orderBy: { name: 'asc' },
            select: { name: true, status: true, industry: true, totalOrders: true, totalSpent: true, performanceScore: true },
          });
          return JSON.stringify({ count: vendors.length, vendors });
        }
        case 'purchaseOrders': {
          const pos = await this.prisma.purchaseOrder.findMany({
            where: filters.status ? { status: filters.status } : undefined,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { vendor: { select: { name: true } } },
          });
          return JSON.stringify({ count: pos.length, orders: pos.map((p) => ({ ...p, vendorName: p.vendor.name })) });
        }
        case 'contracts': {
          const contracts = await this.prisma.contract.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { vendor: { select: { name: true } } },
          });
          return JSON.stringify({ count: contracts.length, contracts: contracts.map((c) => ({ ...c, vendorName: c.vendor.name })) });
        }
        case 'costEstimates': {
          const estimates = await this.prisma.costEstimate.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, clientName: true, category: true, totalCostPrice: true, sellingPrice: true, margin: true, confidenceScore: true, status: true, createdAt: true },
          });
          return JSON.stringify({ count: estimates.length, estimates });
        }
        case 'marginSummary': {
          const estimates = await this.prisma.costEstimate.findMany({
            select: { title: true, margin: true, totalCostPrice: true, sellingPrice: true, confidenceScore: true },
          });
          const atRisk = estimates.filter((e) => e.margin !== null && e.margin < 25);
          const avgMargin = estimates.filter((e) => e.margin !== null).length
            ? estimates.filter((e) => e.margin !== null).reduce((s, e) => s + (e.margin || 0), 0) / estimates.filter((e) => e.margin !== null).length
            : 0;
          return JSON.stringify({ totalEstimates: estimates.length, atRisk: atRisk.length, avgMargin: avgMargin.toFixed(1), atRiskItems: atRisk.map((e) => ({ title: e.title, margin: e.margin })) });
        }
        case 'rawMaterials': {
          const materials = await this.prisma.rawMaterial.findMany({
            where: filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : undefined,
            take: limit,
            include: { prices: { orderBy: { recordedAt: 'desc' }, take: 1 } },
          });
          return JSON.stringify({ count: materials.length, materials: materials.map((m) => ({ name: m.name, unit: m.unit, category: m.category, latestPrice: m.prices[0]?.unitPrice, source: m.prices[0]?.source })) });
        }
        case 'costSheets': {
          const sheets = await this.prisma.costSheet.findMany({
            take: limit,
            orderBy: { lastSynced: 'desc' },
            include: { _count: { select: { items: true } } },
          });
          return JSON.stringify({ count: sheets.length, sheets: sheets.map((s) => ({ ...s, itemCount: s._count.items })) });
        }
        default:
          return JSON.stringify({ error: `Unknown entity: ${entity}` });
      }
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  }

  async chat(messages: Message[], context: any, res: Response): Promise<void> {
    if (!this.openai) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: 'AI Assistant is not configured. Please add OPENAI_API_KEY to the backend .env file and restart the server.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }

    const systemMessage: Message = { role: 'system', content: this.getSystemPrompt(context) };
    const allMessages = [systemMessage, ...messages.slice(-20)]; // keep last 20 for context

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: allMessages,
        tools: this.getTools(),
        tool_choice: 'auto',
        stream: true,
        max_tokens: parseInt(this.configService.get('AI_ASSISTANT_MAX_TOKENS') || '2000'),
      });

      let toolCallBuffer: { id: string; name: string; args: string }[] = [];
      let currentToolIdx = -1;

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined && tc.index !== currentToolIdx) {
              currentToolIdx = tc.index;
              toolCallBuffer[tc.index] = { id: '', name: '', args: '' };
            }
            if (currentToolIdx < 0 || !toolCallBuffer[currentToolIdx]) continue;
            if (tc.id) toolCallBuffer[currentToolIdx].id = tc.id;
            if (tc.function?.name) toolCallBuffer[currentToolIdx].name += tc.function.name;
            if (tc.function?.arguments) toolCallBuffer[currentToolIdx].args += tc.function.arguments;
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer.length > 0) {
          // Execute all tool calls
          for (const tc of toolCallBuffer) {
            if (!tc.name) continue;
            let args: any = {};
            try { args = JSON.parse(tc.args); } catch { /* ignore */ }

            res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: tc.name, args })}\n\n`);
            const result = await this.executeToolCall(tc.name, args);
            let parsed: any;
            try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: tc.name, result: parsed })}\n\n`);

            // Continue the conversation with tool result
            const followUp = await this.openai.chat.completions.create({
              model: this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
              messages: [
                ...allMessages,
                { role: 'assistant', content: null, tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }] },
                { role: 'tool', tool_call_id: tc.id, content: result },
              ],
              stream: true,
              max_tokens: parseInt(this.configService.get('AI_ASSISTANT_MAX_TOKENS') || '2000'),
            });

            for await (const followChunk of followUp) {
              const followDelta = followChunk.choices[0]?.delta;
              if (followDelta?.content) {
                res.write(`data: ${JSON.stringify({ type: 'text', content: followDelta.content })}\n\n`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`AI chat error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', content: `Error: ${err.message}` })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
}
