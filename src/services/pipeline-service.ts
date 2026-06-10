import { supabase } from "@/lib/supabase";
import { computeLineConfidence, computeSheetConfidence, type ConfidenceBucket } from "@/lib/confidence";
import {
  ENQUIRY_STATUSES,
  COST_SHEET_STATUSES,
  CONFIDENCE_THRESHOLDS,
  type EnquiryStatus,
  type CostSheetStatus
} from "@/lib/constants/pipeline";

export interface Enquiry {
  id: string;
  enquiryNumber?: string;
  client?: string;
  clientName?: string;
  title?: string;
  subject?: string;
  description?: string;
  status: EnquiryStatus;
  source?: string;
}

export interface CostSheetItem {
  id: string;
  itemNumber: number;
  description: string;
  vendor?: string;
  days?: number;
  unitCost?: number;
  totalCost?: number;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  match_type?: string;
  confidence?: number;
  price_source?: string;
  // Enriched fields added by getCostSheetItems(): the rounded line total and
  // the computed per-line confidence. Optional because raw DB rows omit them.
  total?: number;
  conf?: ReturnType<typeof computeLineConfidence>;
}

export interface CostSheet {
  id: string;
  jobNumber: string;
  client?: string;
  event?: string;
  status: CostSheetStatus;
  enquiry_id?: string;
  confidence?: number;
  items: CostSheetItem[];
  sheetConfidence: number;
}

export interface BuildCostSheetParams {
  enquiry: Enquiry;
}

export interface ApprovalParams {
  sheetId: string;
  action: 'approved' | 'rejected';
}

export interface SendQuotationParams {
  sheet: CostSheet;
  email: string;
  accountOwner: string;
}

export class PipelineService {
  /**
   * Fetches enquiries in pipeline statuses
   */
  async getNewEnquiries(): Promise<Enquiry[]> {
    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .in("status", [ENQUIRY_STATUSES.NEW, ENQUIRY_STATUSES.IN_PROGRESS, ENQUIRY_STATUSES.DRAFTING, ENQUIRY_STATUSES.APPROVED, ENQUIRY_STATUSES.QUOTED])
      .order("createdAt", { ascending: false });

    if (error) throw new Error(`Failed to fetch enquiries: ${error.message}`);
    return data ?? [];
  }

  /**
   * Fetches cost sheets with items and calculates confidence
   */
  async getDraftCostSheets(): Promise<CostSheet[]> {
    const { data: sheets, error } = await supabase
      .from("cost_sheets")
      .select("*")
      .in("status", [COST_SHEET_STATUSES.DRAFT, COST_SHEET_STATUSES.APPROVED, COST_SHEET_STATUSES.REJECTED])
      .order("createdAt", { ascending: false });

    if (error) throw new Error(`Failed to fetch cost sheets: ${error.message}`);

    const results: CostSheet[] = [];
    for (const sheet of sheets ?? []) {
      const items = await this.getCostSheetItems(sheet.id);
      const sheetConfidence = this.calculateSheetConfidence(items);

      results.push({
        ...sheet,
        items,
        sheetConfidence,
      });
    }

    return results;
  }

  /**
   * Builds a cost sheet from an enquiry by parsing description and matching pricing
   */
  async buildCostSheetFromEnquiry(params: BuildCostSheetParams): Promise<{ sheet: any; items: any[] }> {
    const { enquiry } = params;

    // Parse description into line items
    const candidateLines = this.parseEnquiryDescription(enquiry.description || enquiry.title || "");

    // Create the cost sheet
    const sheet = await this.createCostSheet({
      jobNumber: enquiry.enquiryNumber || `ENQ-${enquiry.id}`,
      client: enquiry.client || enquiry.clientName || "",
      event: enquiry.title || "",
      enquiry_id: enquiry.id,
    });

    // Create items with pricing matches
    const items = await this.createCostSheetItems(sheet.id, candidateLines);

    // Update enquiry status
    await this.updateEnquiryStatus(enquiry.id, ENQUIRY_STATUSES.DRAFTING);

    return { sheet, items };
  }

  /**
   * Approves or rejects a cost sheet and creates quotation if approved
   */
  async approveCostSheet(params: ApprovalParams): Promise<{ quotation?: any }> {
    const { sheetId, action } = params;

    await supabase
      .from("cost_sheets")
      .update({
        status: action,
        approved_by: "reza",
        approved_at: new Date().toISOString(),
      })
      .eq("id", sheetId);

    if (action === 'approved') {
      return await this.generateQuotationFromCostSheet(sheetId);
    }

    return { quotation: null };
  }

  /**
   * Creates Gmail compose URL and logs send details
   */
  async sendQuotation(params: SendQuotationParams): Promise<void> {
    const { sheet, email, accountOwner } = params;

    // Find linked quotation
    const { data: quotation, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("cost_sheet_id", sheet.id)
      .single();

    if (error || !quotation) {
      throw new Error("No quotation found for this cost sheet");
    }

    // Get quotation items for email body
    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotationId", quotation.id)
      .order("itemNumber", { ascending: true });

    // Build email and open Gmail
    const gmailUrl = this.buildGmailComposeUrl(
      email,
      `Quotation — ${sheet.event || sheet.jobNumber}`,
      this.buildQuoteEmailBody(sheet, items ?? [], {
        subtotal: Number(quotation.subtotal) || 0,
        vat: Number(quotation.taxAmount) || 0,
        total: Number(quotation.totalAmount) || 0,
      })
    );

    window.open(gmailUrl, "_blank");

    // Log the send
    await this.logQuotationSend(quotation.id, email, accountOwner);

    // Update statuses
    await this.updateCostSheetStatus(sheet.id, COST_SHEET_STATUSES.QUOTED);
    if (sheet.enquiry_id) {
      await this.updateEnquiryStatus(sheet.enquiry_id, ENQUIRY_STATUSES.SENT);
    }
  }

  // Private helper methods

  private async getCostSheetItems(costSheetId: string): Promise<CostSheetItem[]> {
    const { data: items } = await supabase
      .from("cost_sheet_items")
      .select("*")
      .eq("costSheetId", costSheetId)
      .order("itemNumber", { ascending: true });

    return (items ?? []).map((item) => ({
      ...item,
      conf: computeLineConfidence(item.match_type, item.confidence),
      total: this.roundTo3(item.totalSellingPrice ?? item.totalCost ?? 0),
    }));
  }

  private calculateSheetConfidence(items: CostSheetItem[]): number {
    return computeSheetConfidence(
      items.map((item) => ({
        total: item.total || 0,
        confidence: computeLineConfidence(item.match_type, item.confidence).score,
      }))
    );
  }

  private parseEnquiryDescription(description: string): string[] {
    const lines = description
      .split(/[\n;•·\-]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 3);

    return lines.length > 0 ? lines : ["Service item"];
  }

  private async createCostSheet(params: any): Promise<any> {
    const { data: sheet, error } = await supabase
      .from("cost_sheets")
      .insert({
        ...params,
        date: new Date().toISOString().slice(0, 10),
        status: COST_SHEET_STATUSES.DRAFT,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create cost sheet: ${error.message}`);
    return sheet;
  }

  private async createCostSheetItems(costSheetId: string, descriptions: string[]): Promise<any[]> {
    const items = [];

    for (let i = 0; i < descriptions.length; i++) {
      const description = descriptions[i];
      const match = await this.matchPricing(description);

      const confidence = computeLineConfidence(match?.match_type, match?.score);
      const cost = this.roundTo3(match?.typical_cost ?? match?.typical_sell ?? 0);
      const sell = this.roundTo3(match?.typical_sell ?? match?.typical_cost ?? 0);

      const { data: item, error } = await supabase
        .from("cost_sheet_items")
        .insert({
          costSheetId,
          itemNumber: i + 1,
          description: match?.item_label || description,
          vendor: match?.usual_vendor || "",
          days: 1,
          unitCost: cost,
          totalCost: cost,
          unitSellingPrice: sell,
          totalSellingPrice: sell,
          match_type: match?.match_type || null,
          confidence: confidence.score,
          price_source: match ? `history:${match.match_type}` : "manual",
        })
        .select()
        .single();

      if (!error && item) items.push(item);
    }

    return items;
  }

  private async matchPricing(query: string): Promise<any> {
    const { data } = await supabase.rpc("match_pricing", { q: query });
    return data?.[0] || null;
  }

  private async generateQuotationFromCostSheet(sheetId: string): Promise<{ quotation: any }> {
    const { data: sheet } = await supabase
      .from("cost_sheets")
      .select("*")
      .eq("id", sheetId)
      .single();

    const { data: items } = await supabase
      .from("cost_sheet_items")
      .select("*")
      .eq("costSheetId", sheetId)
      .order("itemNumber", { ascending: true });

    if (!sheet || !items) throw new Error("Cost sheet or items not found");

    const subtotal = this.roundTo3(items.reduce((s, it) => s + (it.totalSellingPrice ?? 0), 0));
    const taxAmount = this.roundTo3(subtotal * 0.05);
    const totalAmount = this.roundTo3(subtotal + taxAmount);

    const { data: quotation, error } = await supabase
      .from("quotations")
      .insert({
        quotationNumber: sheet.jobNumber,
        client: sheet.client,
        title: sheet.event,
        status: "draft",
        subtotal,
        taxAmount,
        totalAmount,
        notes: `Auto-generated from cost sheet #${sheetId}`,
        cost_sheet_id: sheetId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create quotation: ${error.message}`);

    // Create quotation items
    for (const item of items) {
      await supabase.from("quotation_items").insert({
        quotationId: quotation.id,
        itemNumber: item.itemNumber,
        description: item.description,
        quantity: item.days ?? 1,
        unitPrice: item.unitSellingPrice ?? 0,
        totalPrice: item.totalSellingPrice ?? 0,
      });
    }

    // Update enquiry status if linked
    if (sheet.enquiry_id) {
      await this.updateEnquiryStatus(sheet.enquiry_id, ENQUIRY_STATUSES.QUOTED);
    }

    return { quotation };
  }

  private buildGmailComposeUrl(to: string, subject: string, body: string): string {
    const params = new URLSearchParams({ to, su: subject, body });
    return `https://mail.google.com/mail/?view=cm&fs=1&tf=1&${params.toString()}`;
  }

  private buildQuoteEmailBody(sheet: any, items: any[], totals: { subtotal: number; vat: number; total: number }): string {
    const lines = items.map((it: any, i: number) =>
      `${i + 1}. ${it.description} — ${this.formatOMR(it.unitSellingPrice ?? 0)} × ${it.days ?? 1} = ${this.formatOMR(it.totalSellingPrice ?? 0)}`
    ).join("\n");

    return [
      `Dear ${sheet.client || "Client"},`,
      "",
      `Please find below our quotation for: ${sheet.event || "your enquiry"}`,
      `Reference: ${sheet.jobNumber || "—"}`,
      "",
      "─── Line Items ───",
      lines,
      "",
      `Sub Total: ${this.formatOMR(totals.subtotal)}`,
      `VAT (5%): ${this.formatOMR(totals.vat)}`,
      `Total: ${this.formatOMR(totals.total)}`,
      "",
      "Payment Terms: 50% advance with LPO as confirmation. Remaining 50% payable on day of delivery.",
      "Quotation Validity: 7 Working Days",
      "",
      "All cheques payable to Modern Lifestyle.",
      "IBAN: OM110270323021625490018 | SWIFT: BMUSOMRXXXX",
      "",
      "Best regards,",
      "The Agency Oman",
      "info@theagencyoman.com | +968 9317 1717",
    ].join("\n");
  }

  private async logQuotationSend(quotationId: string, email: string, accountOwner: string): Promise<void> {
    await supabase
      .from("quotations")
      .update({
        sent_at: new Date().toISOString(),
        sent_to: email,
        account_owner: accountOwner,
        status: "sent",
      })
      .eq("id", quotationId);
  }

  private async updateEnquiryStatus(enquiryId: string, status: EnquiryStatus): Promise<void> {
    await supabase
      .from("enquiries")
      .update({ status })
      .eq("id", enquiryId);
  }

  private async updateCostSheetStatus(sheetId: string, status: CostSheetStatus): Promise<void> {
    await supabase
      .from("cost_sheets")
      .update({ status })
      .eq("id", sheetId);
  }

  private roundTo3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  private formatOMR(n: number): string {
    return (n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }) + " OMR";
  }

  public getConfidenceBucket(score: number): ConfidenceBucket {
    if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
    if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
    if (score > 0) return 'low';
    return 'none';
  }
}

export const pipelineService = new PipelineService();