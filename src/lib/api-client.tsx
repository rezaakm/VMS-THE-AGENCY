import {
  useQuery,
  useMutation,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { supabase } from "./supabase";

/* ===========================================================================
 * THE AGENCY · VMS data layer
 * Direct-to-Supabase replacement for the old @workspace/api-client-react
 * package (which lived only on Replit). No backend required.
 * ======================================================================== */

// Legacy no-op: VMS used to point at a REST base URL. Now Supabase-direct.
export function setBaseUrl(_url?: string): void {
  /* intentionally empty */
}

type Row = Record<string, any>;

// Known columns per table — writes are filtered to these so a stray form
// field (e.g. a UI-only key) can never blow up an insert/update.
const COLUMNS: Record<string, string[]> = {
  vendors: ["name","code","email","phone","website","taxId","status","address","city","state","country","postalCode","industry","category","description","registrationDate","paymentTerms","creditLimit","currency","performanceScore","totalOrders","totalSpent"],
  purchase_orders: ["orderNumber","vendorId","userId","status","orderDate","requiredDate","deliveryDate","subtotal","taxAmount","shippingCost","totalAmount","description","notes","deliveryAddress"],
  po_items: ["poId","itemNumber","description","quantity","unitPrice","discount","taxRate","totalPrice"],
  invoices: ["invoiceNumber","vendorId","poId","invoiceDate","dueDate","paidDate","amount","taxAmount","totalAmount","paidAmount","status","description","notes"],
  cost_sheets: ["jobNumber","client","event","date","driveFileId","fileName","lastSynced"],
  cost_sheet_items: ["costSheetId","itemNumber","description","vendor","days","unitCost","totalCost","unitSellingPrice","totalSellingPrice"],
  rfqs: ["rfqNumber","title","description","category","deadline","deliveryDate","status","createdById","notes"],
  rfq_items: ["rfqId","itemNumber","description","quantity","unit","specs"],
  evaluations: ["vendorId","evaluatorId","qualityScore","deliveryScore","pricingScore","serviceScore","overallScore","comments","evaluationDate","period"],
  contracts: ["vendorId","contractNumber","title","status","startDate","endDate","signedDate","contractValue","currency","terms","description","autoRenew","renewalPeriod"],
  enquiries: ["enquiryNumber","client","title","description","status","category","source","value","expectedCloseDate","assignedToId"],
  quotations: ["quotationNumber","enquiryId","client","title","status","subtotal","taxAmount","totalAmount","validUntil","notes"],
  quotation_items: ["quotationId","itemNumber","description","quantity","unitPrice","totalPrice"],
  openai_conversations: ["title"],
  openai_messages: ["conversationId","role","content"],
};

const HAS_UPDATED_AT = new Set([
  "vendors","purchase_orders","invoices","cost_sheets","rfqs",
  "evaluations","contracts","enquiries","quotations","openai_conversations",
]);

function prepWrite(table: string, payload: Row, isUpdate: boolean): Row {
  const allowed = COLUMNS[table] ?? [];
  const out: Row = {};
  for (const k of allowed) if (payload[k] !== undefined) out[k] = payload[k];
  if (isUpdate && HAS_UPDATED_AT.has(table)) out.updatedAt = new Date().toISOString();
  return out;
}

async function fetchList(table: string, orderBy: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: false });
  if (error) throw error;
  return data ?? [];
}
async function fetchOne(table: string, id: number | string): Promise<Row | null> {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function insertRow(table: string, payload: Row): Promise<Row> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}
async function updateRow(table: string, id: number | string, payload: Row): Promise<Row> {
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
async function deleteRow(table: string, id: number | string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

/* ===========================================================================
 * CRUD factory
 * ======================================================================== */
interface EntityOpts {
  order?: string;
  toPage?: (r: Row) => Row;
  toDb?: (p: Row) => Row;
}

function crud(table: string, opts: EntityOpts = {}) {
  const order = opts.order ?? "id";
  const listKey = () => [table] as const;
  const getKey = (id: number | string) => [table, id] as const;

  const useList = (): UseQueryResult<Row[]> =>
    useQuery({
      queryKey: listKey(),
      queryFn: async () => {
        const rows = await fetchList(table, order);
        return opts.toPage ? rows.map(opts.toPage) : rows;
      },
    });

  const useGet = (id: number | string): UseQueryResult<Row | null> =>
    useQuery({
      queryKey: getKey(id),
      enabled: id !== undefined && id !== null && id !== "",
      queryFn: async () => {
        const row = await fetchOne(table, id);
        return row && opts.toPage ? opts.toPage(row) : row;
      },
    });

  const useCreate = (): UseMutationResult<Row, Error, any> =>
    useMutation({
      mutationFn: async (vars: any) => {
        const payload = vars?.data ?? vars ?? {};
        return insertRow(table, prepWrite(table, opts.toDb ? opts.toDb(payload) : payload, false));
      },
    });

  const useUpdate = (): UseMutationResult<Row, Error, any> =>
    useMutation({
      mutationFn: async (vars: any) => {
        const id = vars.id;
        const payload = vars.data ?? {};
        return updateRow(table, id, prepWrite(table, opts.toDb ? opts.toDb(payload) : payload, true));
      },
    });

  const useDelete = (): UseMutationResult<void, Error, any> =>
    useMutation({
      mutationFn: async (vars: any) => {
        const id = vars && typeof vars === "object" ? vars.id : vars;
        return deleteRow(table, id);
      },
    });

  return { useList, useGet, useCreate, useUpdate, useDelete, listKey, getKey };
}

/* ===========================================================================
 * Entities
 * ======================================================================== */
const vendors = crud("vendors", {
  order: "name",
  toPage: (r) => ({ ...r, company: r.industry ?? "", specialty: r.category ?? "", notes: r.description ?? "" }),
  toDb: (p) => ({
    name: p.name, email: p.email, phone: p.phone,
    industry: p.company, category: p.specialty, description: p.notes,
    website: p.website, status: p.status, code: p.code,
  }),
});
const rfqs = crud("rfqs", { order: "createdAt" });
const purchaseOrders = crud("purchase_orders", { order: "createdAt" });
const invoices = crud("invoices", { order: "createdAt" });
const evaluations = crud("evaluations", { order: "createdAt" });
const contracts = crud("contracts", { order: "createdAt" });
const costSheets = crud("cost_sheets", { order: "createdAt" });
const costSheetItems = crud("cost_sheet_items", { order: "itemNumber" });
const enquiries = crud("enquiries", { order: "createdAt" });
const quotations = crud("quotations", { order: "createdAt" });
const quotationItems = crud("quotation_items", { order: "itemNumber" });
const openaiConversations = crud("openai_conversations", { order: "createdAt" });
const openaiMessages = crud("openai_messages", { order: "createdAt" });

/* Vendors */
export const useListVendors = vendors.useList;
export const useGetVendor = vendors.useGet;
export const useCreateVendor = vendors.useCreate;
export const useUpdateVendor = vendors.useUpdate;
export const useDeleteVendor = vendors.useDelete;
export const getListVendorsQueryKey = vendors.listKey;
export const getGetVendorQueryKey = vendors.getKey;

/* RFQs */
export const useListRfqs = rfqs.useList;
export const useGetRfq = rfqs.useGet;
export const useCreateRfq = rfqs.useCreate;
export const useUpdateRfq = rfqs.useUpdate;
export const useDeleteRfq = rfqs.useDelete;
export const getListRfqsQueryKey = rfqs.listKey;

/* Purchase Orders */
export const useListPurchaseOrders = purchaseOrders.useList;
export const useGetPurchaseOrder = purchaseOrders.useGet;
export const useCreatePurchaseOrder = purchaseOrders.useCreate;
export const useUpdatePurchaseOrder = purchaseOrders.useUpdate;
export const useDeletePurchaseOrder = purchaseOrders.useDelete;
export const getListPurchaseOrdersQueryKey = purchaseOrders.listKey;

/* Invoices */
export const useListInvoices = invoices.useList;
export const useGetInvoice = invoices.useGet;
export const useCreateInvoice = invoices.useCreate;
export const useUpdateInvoice = invoices.useUpdate;
export const useDeleteInvoice = invoices.useDelete;
export const getListInvoicesQueryKey = invoices.listKey;

/* Evaluations */
export const useListEvaluations = evaluations.useList;
export const useCreateEvaluation = evaluations.useCreate;
export const useUpdateEvaluation = evaluations.useUpdate;
export const useDeleteEvaluation = evaluations.useDelete;
export const getListEvaluationsQueryKey = evaluations.listKey;

/* Contracts */
export const useListContracts = contracts.useList;
export const useCreateContract = contracts.useCreate;
export const useUpdateContract = contracts.useUpdate;
export const useDeleteContract = contracts.useDelete;
export const getListContractsQueryKey = contracts.listKey;

/* Cost Sheets (+items) */
export const useListCostSheets = costSheets.useList;
export const useGetCostSheet = costSheets.useGet;
export const useCreateCostSheet = costSheets.useCreate;
export const useUpdateCostSheet = costSheets.useUpdate;
export const useDeleteCostSheet = costSheets.useDelete;
export const getListCostSheetsQueryKey = costSheets.listKey;
export const getGetCostSheetQueryKey = costSheets.getKey;
export const useListCostSheetItems = costSheetItems.useList;
export const useCreateCostSheetItem = costSheetItems.useCreate;
export const useUpdateCostSheetItem = costSheetItems.useUpdate;
export const useDeleteCostSheetItem = costSheetItems.useDelete;
export const getListCostSheetItemsQueryKey = costSheetItems.listKey;

/* Enquiries */
export const useListEnquiries = enquiries.useList;
export const useGetEnquiry = enquiries.useGet;
export const useCreateEnquiry = enquiries.useCreate;
export const useUpdateEnquiry = enquiries.useUpdate;
export const useDeleteEnquiry = enquiries.useDelete;
export const getListEnquiriesQueryKey = enquiries.listKey;
export const getGetEnquiryQueryKey = enquiries.getKey;

/* Quotations (+items) */
export const useListQuotations = quotations.useList;
export const useGetQuotation = quotations.useGet;
export const useCreateQuotation = quotations.useCreate;
export const useUpdateQuotation = quotations.useUpdate;
export const useDeleteQuotation = quotations.useDelete;
export const getListQuotationsQueryKey = quotations.listKey;
export const getGetQuotationQueryKey = quotations.getKey;
export const useListQuotationItems = quotationItems.useList;
export const useCreateQuotationItem = quotationItems.useCreate;
export const useUpdateQuotationItem = quotationItems.useUpdate;
export const useDeleteQuotationItem = quotationItems.useDelete;
export const getListQuotationItemsQueryKey = quotationItems.listKey;

/* OpenAI assistant */
export const useListOpenaiConversations = openaiConversations.useList;
export const useCreateOpenaiConversation = openaiConversations.useCreate;
export const useDeleteOpenaiConversation = openaiConversations.useDelete;
export const getListOpenaiConversationsQueryKey = openaiConversations.listKey;
export const useListOpenaiMessages = openaiMessages.useList;
export const useCreateOpenaiMessage = openaiMessages.useCreate;
export const getListOpenaiMessagesQueryKey = openaiMessages.listKey;

/* ===========================================================================
 * Reports & dashboard aggregations (computed live from the spine)
 * ======================================================================== */
function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function useGetReportsOverview(): UseQueryResult<Row> {
  return useQuery({
    queryKey: ["reports", "overview"],
    queryFn: async () => {
      const [v, po, inv, c, rfq, enq, q] = await Promise.all([
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("purchase_orders").select("totalAmount,status"),
        supabase.from("invoices").select("totalAmount,paidAmount,status"),
        supabase.from("contracts").select("id,status,contractValue"),
        supabase.from("rfqs").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("id", { count: "exact", head: true }),
        supabase.from("quotations").select("id,totalAmount", { count: "exact" }),
      ]);
      const poRows = po.data ?? [];
      const invRows = inv.data ?? [];
      const cRows = c.data ?? [];
      const totalSpend = poRows.reduce((s, r) => s + num(r.totalAmount), 0);
      const invoicedTotal = invRows.reduce((s, r) => s + num(r.totalAmount), 0);
      const paidTotal = invRows.reduce((s, r) => s + num(r.paidAmount), 0);
      const pendingInvoices = invRows.filter((r) => (r.status ?? "").toLowerCase() !== "paid").length;
      return {
        totalVendors: v.count ?? 0,
        totalPurchaseOrders: poRows.length,
        totalInvoices: invRows.length,
        totalRfqs: rfq.count ?? 0,
        totalEnquiries: enq.count ?? 0,
        totalQuotations: q.count ?? 0,
        totalContracts: cRows.length,
        activeContracts: cRows.filter((r) => (r.status ?? "").toLowerCase() === "active").length,
        totalSpend,
        invoicedTotal,
        paidTotal,
        outstanding: invoicedTotal - paidTotal,
        pendingInvoices,
        paidInvoices: invRows.length - pendingInvoices,
      };
    },
  });
}
export const getGetReportsOverviewQueryKey = () => ["reports", "overview"];

export function useGetSpendByVendor(): UseQueryResult<Row[]> {
  return useQuery({
    queryKey: ["reports", "spendByVendor"],
    queryFn: async () => {
      const [{ data: pos }, { data: vlist }] = await Promise.all([
        supabase.from("purchase_orders").select("vendorId,totalAmount"),
        supabase.from("vendors").select("id,name"),
      ]);
      const names = new Map((vlist ?? []).map((v) => [v.id, v.name]));
      const agg = new Map<number, { vendorId: number; vendorName: string; totalSpend: number; orderCount: number }>();
      for (const p of pos ?? []) {
        const id = p.vendorId;
        if (id == null) continue;
        const cur = agg.get(id) ?? { vendorId: id, vendorName: names.get(id) ?? `Vendor ${id}`, totalSpend: 0, orderCount: 0 };
        cur.totalSpend += num(p.totalAmount);
        cur.orderCount += 1;
        agg.set(id, cur);
      }
      return Array.from(agg.values()).sort((a, b) => b.totalSpend - a.totalSpend);
    },
  });
}
export const getGetSpendByVendorQueryKey = () => ["reports", "spendByVendor"];

export function useGetMonthlySpend(): UseQueryResult<Row[]> {
  return useQuery({
    queryKey: ["reports", "monthlySpend"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("orderDate,totalAmount");
      const agg = new Map<string, number>();
      for (const r of data ?? []) {
        const d = r.orderDate ? new Date(r.orderDate) : null;
        if (!d || isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        agg.set(key, (agg.get(key) ?? 0) + num(r.totalAmount));
      }
      return Array.from(agg.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, total]) => ({ month, total }));
    },
  });
}
export const getGetMonthlySpendQueryKey = () => ["reports", "monthlySpend"];

export function useGetEnquiryStats(): UseQueryResult<Row> {
  return useQuery({
    queryKey: ["enquiries", "stats"],
    queryFn: async () => {
      const { data } = await supabase.from("enquiries").select("status,value");
      const rows = data ?? [];
      const by = (s: string) => rows.filter((r) => (r.status ?? "").toLowerCase() === s).length;
      return {
        total: rows.length,
        new: by("new"),
        inProgress: by("in_progress") + by("in progress"),
        won: by("won"),
        lost: by("lost"),
        totalValue: rows.reduce((s, r) => s + num(r.value), 0),
      };
    },
  });
}
export const getGetEnquiryStatsQueryKey = () => ["enquiries", "stats"];

export function useGetRecentQuotations(): UseQueryResult<Row[]> {
  return useQuery({
    queryKey: ["quotations", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*")
        .order("createdAt", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}
export const getGetRecentQuotationsQueryKey = () => ["quotations", "recent"];
