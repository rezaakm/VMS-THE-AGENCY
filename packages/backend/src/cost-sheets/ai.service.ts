import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ParsedQuery {
  keywords: string[];
  vendor: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

@Injectable()
export class AiService {
  private openai: any;

  constructor(private configService: ConfigService) {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      const OpenAI = (await import('openai')).default;
      const apiKey = this.configService.get('OPENAI_API_KEY');
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      }
    } catch (error) {
      console.warn('OpenAI not configured');
    }
  }

  async parseNaturalLanguageQuery(query: string): Promise<ParsedQuery> {
    if (!this.openai) {
      return {
        keywords: query.split(/\s+/).filter((w) => w.length > 2),
        vendor: null,
        priceMin: null,
        priceMax: null,
      };
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Convert search query to JSON with: keywords (array), vendor (string|null), priceMin (number|null), priceMax (number|null). Return only JSON.' },
          { role: 'user', content: query },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        keywords: result.keywords || [],
        vendor: result.vendor || null,
        priceMin: result.priceMin ?? result.price_min ?? null,
        priceMax: result.priceMax ?? result.price_max ?? null,
      };
    } catch {
      return { keywords: query.split(/\s+/).filter((w) => w.length > 2), vendor: null, priceMin: null, priceMax: null };
    }
  }

  async askVendorQuestion(question: string, vendor1: string, vendor2: string): Promise<string> {
    if (!this.openai) return 'AI not configured. Set OPENAI_API_KEY.';

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a vendor comparison assistant. Keep responses brief (2-3 sentences).' },
          { role: 'user', content: `Compare vendors "${vendor1}" and "${vendor2}". Question: ${question}` },
        ],
        max_tokens: 150,
      });
      return completion.choices[0]?.message?.content || 'Unable to generate response.';
    } catch {
      return 'Failed to process AI request.';
    }
  }

  async extractEstimate(text: string): Promise<Array<{ item: string; qty: number; budget: number | null }>> {
    if (!this.openai) return [];

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Extract items from client brief. Return JSON: { items: [{ item, qty, budget }] }' },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      });
      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return result.items || [];
    } catch {
      return [];
    }
  }
}
