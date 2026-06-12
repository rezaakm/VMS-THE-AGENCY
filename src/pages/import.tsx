import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateVendor,
  useCreateEnquiry,
  useCreateCostSheet,
  useCreateCostSheetItem,
  useCreateQuotation,
  useCreateQuotationItem,
  getListVendorsQueryKey,
  getListEnquiriesQueryKey,
  getListCostSheetsQueryKey,
  getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Bot, CheckCircle, XCircle, Loader2, AlertTriangle,
  ArrowLeft, ChevronDown, ChevronUp, Users, ClipboardList,
  Calculator, Quote, FileText, Link, Plus, Trash2, RefreshCw,
  FolderOpen,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedVendor {
  name: string; company: string; email?: string | null;
  phone?: string | null; specialty?: string | null; notes?: string | null;
}
interface ExtractedEnquiry {
  clientName: string; clientCompany?: string | null; clientEmail?: string | null;
  clientPhone?: string | null; subject: string; scopeOfWork?: string | null;
  eventDate?: string | null; status?: string;
}
interface ExtractedCostSheetItem {
  description: string; qty: number; unit?: string | null;
  vendorUnitCost: number; sellUnitCost: number; itemNotes?: string | null;
}
interface ExtractedCostSheet {
  title: string; notes?: string | null; items: ExtractedCostSheetItem[];
  client?: string | null;
  clientName?: string | null;
}
interface ExtractedQuotationItem {
  description: string; qty: number; unit?: string | null;
  unitCost: number; isFoc: boolean;
}
interface ExtractedQuotation {
  serialNumber: string; clientName: string; clientCompany?: string | null;
  subject?: string; quotationDate?: string | null; status?: string;
  paymentTerms?: string | null; items: ExtractedQuotationItem[];
}
interface AgentAnalysis {
  summary: string; confidence: number; notes?: string;
  entities: {
    vendors: ExtractedVendor[];
    enquiries: ExtractedEnquiry[];
    costSheets: ExtractedCostSheet[];
    quotations: ExtractedQuotation[];
  };
}
interface FileResult {
  url: string;
  fileName: string;
  status: "pending" | "analyzing" | "done" | "error";
  analysis?: AgentAnalysis;
  error?: string;
}

type PageState = "input" | "analyzing" | "review" | "importing" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function mergeSummary(results: FileResult[]): AgentAnalysis["entities"] {
  const merged: AgentAnalysis["entities"] = { vendors: [], enquiries: [], costSheets: [], quotations: [] };
  for (const r of results) {
    if (!r.analysis) continue;
    merged.vendors.push(...r.analysis.entities.vendors);
    merged.enquiries.push(...r.analysis.entities.enquiries);
    merged.costSheets.push(...r.analysis.entities.costSheets);
    merged.quotations.push(...r.analysis.entities.quotations);
  }
  return merged;
}

function totalEntities(e: AgentAnalysis["entities"]) {
  return e.vendors.length + e.enquiries.length + e.costSheets.length + e.quotations.length;
}

function isDriveUrl(url: string) {
  return url.includes("drive.google.com") || url.includes("docs.google.com");
}

// ── Review section ────────────────────────────────────────────────────────────

function ReviewSection<T>({ icon: Icon, title, color, items, headers, renderRow }: {
  icon: React.ElementType; title: string; color: string;
  items: T[]; headers: string[]; renderRow: (item: T, i: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-accent/5 transition-colors border-b border-card-border">
        <div className={`p-1.5 rounded ${color}`}><Icon className="w-4 h-4 text-white" /></div>
        <span className="text-sm font-bold uppercase tracking-wider flex-1 text-left">{title}</span>
        <span className="text-xs text-primary font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{items.length}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="border-b border-card-border bg-background/40">
                {headers.map((h) => <th key={h} className="px-4 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-card-border/50 hover:bg-accent/5">{renderRow(item, i)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TD({ v }: { v?: string | number | boolean | null }) {
  return (
    <td className="px-4 py-2 text-foreground max-w-[220px] truncate whitespace-nowrap">
      {v != null && v !== "" ? String(v) : <span className="text-muted-foreground/30">—</span>}
    </td>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ImportData() {
  const [links, setLinks] = useState<string[]>([""]);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [pageState, setPageState] = useState<PageState>("input");
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createVendor = useCreateVendor();
  const createEnquiry = useCreateEnquiry();
  const createCostSheet = useCreateCostSheet();
  const createCostSheetItem = useCreateCostSheetItem();
  const createQuotation = useCreateQuotation();
  const createQuotationItem = useCreateQuotationItem();

  const validLinks = links.map((l) => l.trim()).filter((l) => l && isDriveUrl(l));

  // ── Analyze ──
  const runAnalysis = useCallback(async () => {
    if (!validLinks.length) return;
    const initial: FileResult[] = validLinks.map((url) => ({ url, fileName: url, status: "pending" }));
    setFileResults(initial);
    setPageState("analyzing");

    const updated = [...initial];

    for (let i = 0; i < validLinks.length; i++) {
      updated[i] = { ...updated[i], status: "analyzing" };
      setFileResults([...updated]);

      try {
        const res = await fetch(`${BASE}/api/drive/analyze-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: validLinks[i] }),
        });
        const data = await res.json();
        if (!res.ok) {
          updated[i] = { ...updated[i], status: "error", error: data.error ?? "Failed" };
        } else {
          updated[i] = { ...updated[i], status: "done", fileName: data.file?.name ?? validLinks[i], analysis: data.analysis };
        }
      } catch (err) {
        updated[i] = { ...updated[i], status: "error", error: (err as Error).message };
      }
      setFileResults([...updated]);
    }

    const hasAny = updated.some((r) => r.status === "done" && r.analysis);
    setPageState(hasAny ? "review" : "analyzing");
    if (!hasAny) toast({ title: "All files failed to analyze. Check that they are shared with 'Anyone with the link'.", variant: "destructive" });
  }, [validLinks, toast]);

  // ── Import ──
  const runImport = useCallback(async () => {
    const entities = mergeSummary(fileResults);
    setPageState("importing");
    const errors: string[] = [];
    let success = 0, failed = 0;

    for (const v of entities.vendors) {
      try {
        await createVendor.mutateAsync({ data: { name: v.name, company: v.company, email: v.email ?? null, phone: v.phone ?? null, specialty: v.specialty ?? null, notes: v.notes ?? null } });
        success++;
      } catch { errors.push(`Vendor "${v.name}": failed`); failed++; }
    }

    const validStatuses = ["new", "in_progress", "quoted", "won", "lost"];
    for (const e of entities.enquiries) {
      try {
        const status = validStatuses.includes(e.status ?? "") ? e.status as "new" | "in_progress" | "quoted" | "won" | "lost" : "new";
        await createEnquiry.mutateAsync({ data: { clientName: e.clientName, clientCompany: e.clientCompany ?? null, clientEmail: e.clientEmail ?? null, clientPhone: e.clientPhone ?? null, subject: e.subject, scopeOfWork: e.scopeOfWork ?? null, eventDate: e.eventDate ?? null, status } });
        success++;
      } catch { errors.push(`Enquiry "${e.subject}": failed`); failed++; }
    }

    for (const cs of entities.costSheets) {
      try {
        const sheet = await createCostSheet.mutateAsync({ data: { 
          title: cs.title, 
          enquiryId: null, 
          notes: cs.notes ?? null,
          client: cs.client || cs.clientName || "Untitled Client"  // ensure non-null for DB constraint
        } });
        success++;
        for (const item of cs.items) {
          try {
            await createCostSheetItem.mutateAsync({ costSheetId: sheet.id, data: { description: item.description, qty: item.qty ?? 1, unit: item.unit ?? null, vendorUnitCost: item.vendorUnitCost ?? 0, sellUnitCost: item.sellUnitCost ?? 0, vendorId: null, notes: item.itemNotes ?? null } });
          } catch { errors.push(`Item "${item.description}" in "${cs.title}": failed`); }
        }
      } catch { errors.push(`Cost sheet "${cs.title}": failed`); failed++; }
    }

    const today = new Date().toISOString().split("T")[0];
    const validQStatuses = ["draft", "sent", "approved", "rejected"];
    for (const q of entities.quotations) {
      try {
        const status = validQStatuses.includes(q.status ?? "") ? q.status as "draft" | "sent" | "approved" | "rejected" : "draft";
        const quot = await createQuotation.mutateAsync({ data: { serialNumber: q.serialNumber, clientName: q.clientName, clientCompany: q.clientCompany ?? null, subject: q.subject ?? "", quotationDate: q.quotationDate ?? today, status, paymentTerms: q.paymentTerms ?? "50% advance with LPO, balance on delivery/completion", termsAndConditions: null, enquiryId: null, vatPercent: 5, currency: "OMR" } });
        success++;
        for (const item of q.items) {
          try {
            await createQuotationItem.mutateAsync({ quotationId: quot.id, data: { description: item.description, qty: item.qty ?? 1, unit: item.unit ?? null, unitCost: item.unitCost ?? 0, isFoc: item.isFoc ?? false } });
          } catch { errors.push(`Item "${item.description}" in quotation "${q.serialNumber}": failed`); }
        }
      } catch { errors.push(`Quotation "${q.serialNumber}": failed`); failed++; }
    }

    queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCostSheetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });

    setImportResult({ success, failed, errors });
    setPageState("done");
    if (success > 0) toast({ title: `Imported ${success} records successfully` });
  }, [fileResults, createVendor, createEnquiry, createCostSheet, createCostSheetItem, createQuotationItem, createQuotation, queryClient, toast]);

  const reset = () => { setPageState("input"); setFileResults([]); setImportResult(null); setLinks([""]); };

  const entities = mergeSummary(fileResults);
  const total = totalEntities(entities);

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight">Import Agent</h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">AI-powered · Google Drive</p>
      </div>

      {/* ── INPUT ── */}
      {pageState === "input" && (
        <div className="flex flex-col gap-5">

          {/* How it works */}
          <div className="bg-card border border-card-border rounded-xl p-5 flex gap-4 items-start">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 mt-0.5 flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">How the agent works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste sharing links for each Google Drive file you want to sync — Google Sheets, Docs, Excel, CSV, or images. The agent reads each one, extracts all cost sheet, quotation, vendor, and enquiry data it finds, and shows you a preview before anything is saved.
              </p>
              <div className="mt-3 flex gap-2 items-start p-3 bg-background border border-border rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">Each file must be shared with <strong className="text-foreground">"Anyone with the link"</strong> — right-click the file in Drive → Share → change to "Anyone with the link".</p>
              </div>
            </div>
          </div>

          {/* Folder reference */}
          <div className="bg-card border border-card-border rounded-lg px-5 py-4 flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Source Folder</p>
              <a href="https://drive.google.com/drive/folders/1uDCJBOZARhEiBrOEdG3QP2Cm0GrNI-2I" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block font-mono">
                drive.google.com/drive/folders/1uDCJBOZARhEiBrOEdG3QP2Cm0GrNI-2I
              </a>
            </div>
          </div>

          {/* Link inputs */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Link className="w-3.5 h-3.5" /> File Sharing Links
              </span>
              <span className="text-xs text-muted-foreground">{validLinks.length} link{validLinks.length !== 1 ? "s" : ""} ready</span>
            </div>

            <div className="p-5 flex flex-col gap-2.5">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${link.trim() && isDriveUrl(link) ? "bg-green-500" : link.trim() ? "bg-red-500" : "bg-border"}`} />
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => {
                      const next = [...links];
                      next[i] = e.target.value;
                      setLinks(next);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                  {links.length > 1 && (
                    <button onClick={() => setLinks(links.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={() => setLinks([...links, ""])}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors mt-1 w-fit"
              >
                <Plus className="w-3.5 h-3.5" /> Add another file
              </button>
            </div>

            <div className="px-5 pb-5">
              <Button
                onClick={runAnalysis}
                disabled={validLinks.length === 0}
                className="w-full bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold gap-2 h-11"
              >
                <Bot className="w-4 h-4" /> Analyse {validLinks.length > 0 ? `${validLinks.length} File${validLinks.length !== 1 ? "s" : ""}` : "Files"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYZING ── */}
      {pageState === "analyzing" && (
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-xl p-5 flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Import Agent</p>
              <p className="text-sm">Reading {fileResults.length} file{fileResults.length !== 1 ? "s" : ""} and extracting data…</p>
            </div>
            <div className="flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {fileResults.map((r, i) => (
              <div key={i} className="bg-card border border-card-border rounded-lg px-5 py-3.5 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {r.status === "pending" && <div className="w-5 h-5 rounded-full border-2 border-border" />}
                  {r.status === "analyzing" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                  {r.status === "done" && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {r.status === "error" && <XCircle className="w-5 h-5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground truncate">{r.fileName !== r.url ? r.fileName : r.url}</p>
                  {r.status === "done" && r.analysis && (
                    <p className="text-xs text-green-400 mt-0.5">{r.analysis.summary}</p>
                  )}
                  {r.status === "error" && (
                    <p className="text-xs text-destructive mt-0.5">{r.error}</p>
                  )}
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  r.status === "done" ? "text-green-400 bg-green-400/10" :
                  r.status === "error" ? "text-destructive bg-destructive/10" :
                  r.status === "analyzing" ? "text-primary bg-primary/10" :
                  "text-muted-foreground bg-muted/10"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {pageState === "review" && (
        <div className="flex flex-col gap-5">

          {/* Agent summary */}
          <div className="bg-card border border-card-border rounded-xl p-5 flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Import Agent · {fileResults.filter((r) => r.status === "done").length} file{fileResults.filter((r) => r.status === "done").length !== 1 ? "s" : ""} read</p>
              <div className="flex flex-col gap-1.5">
                {fileResults.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {r.status === "done"
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    }
                    <span className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{r.fileName !== r.url ? r.fileName : `File ${i + 1}`}</span>
                      {r.status === "done" && r.analysis ? ` — ${r.analysis.summary}` : ` — ${r.error ?? "failed"}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Vendors", count: entities.vendors.length, icon: Users, color: "text-blue-400" },
              { label: "Enquiries", count: entities.enquiries.length, icon: ClipboardList, color: "text-purple-400" },
              { label: "Cost Sheets", count: entities.costSheets.length, icon: Calculator, color: "text-green-400" },
              { label: "Quotations", count: entities.quotations.length, icon: Quote, color: "text-yellow-400" },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className={`bg-card border border-card-border rounded-lg p-4 text-center ${count === 0 ? "opacity-25" : ""}`}>
                <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {total === 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-10 text-center">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <p className="text-sm font-semibold">No recognizable data found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Make sure each file is shared with "Anyone with the link" and contains cost sheet, quotation, vendor, or enquiry data.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ReviewSection icon={Users} title="Vendors" color="bg-blue-600" items={entities.vendors}
                headers={["Name", "Company", "Email", "Phone", "Specialty"]}
                renderRow={(v) => <><TD v={v.name} /><TD v={v.company} /><TD v={v.email} /><TD v={v.phone} /><TD v={v.specialty} /></>}
              />
              <ReviewSection icon={ClipboardList} title="Enquiries" color="bg-purple-600" items={entities.enquiries}
                headers={["Client", "Company", "Subject", "Event Date", "Status"]}
                renderRow={(e) => <><TD v={e.clientName} /><TD v={e.clientCompany} /><TD v={e.subject} /><TD v={e.eventDate} /><TD v={e.status} /></>}
              />
              <ReviewSection icon={Calculator} title="Cost Sheets" color="bg-green-700" items={entities.costSheets}
                headers={["Title", "Items", "Notes"]}
                renderRow={(cs) => <><TD v={cs.title} /><TD v={cs.items.length} /><TD v={cs.notes} /></>}
              />
              {entities.costSheets.flatMap((cs) => cs.items).length > 0 && (
                <div className="ml-5">
                  <ReviewSection icon={FileText} title="Cost Sheet Line Items" color="bg-green-800"
                    items={entities.costSheets.flatMap((cs) => cs.items.map((item) => ({ ...item, _sheet: cs.title })))}
                    headers={["Sheet", "Description", "Qty", "Unit", "Vendor Cost", "Sell Price"]}
                    renderRow={(item: ExtractedCostSheetItem & { _sheet: string }) => <><TD v={item._sheet} /><TD v={item.description} /><TD v={item.qty} /><TD v={item.unit} /><TD v={item.vendorUnitCost?.toFixed(3)} /><TD v={item.sellUnitCost?.toFixed(3)} /></>}
                  />
                </div>
              )}
              <ReviewSection icon={Quote} title="Quotations" color="bg-yellow-700" items={entities.quotations}
                headers={["S/N", "Client", "Company", "Subject", "Date", "Status"]}
                renderRow={(q) => <><TD v={q.serialNumber} /><TD v={q.clientName} /><TD v={q.clientCompany} /><TD v={q.subject} /><TD v={q.quotationDate} /><TD v={q.status} /></>}
              />
              {entities.quotations.flatMap((q) => q.items).length > 0 && (
                <div className="ml-5">
                  <ReviewSection icon={FileText} title="Quotation Line Items" color="bg-yellow-800"
                    items={entities.quotations.flatMap((q) => q.items.map((item) => ({ ...item, _sn: q.serialNumber })))}
                    headers={["S/N", "Description", "Qty", "Unit", "Unit Cost", "FOC"]}
                    renderRow={(item: ExtractedQuotationItem & { _sn: string }) => <><TD v={item._sn} /><TD v={item.description} /><TD v={item.qty} /><TD v={item.unit} /><TD v={item.unitCost?.toFixed(3)} /><TD v={item.isFoc ? "Yes" : "No"} /></>}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button variant="outline" onClick={() => setPageState("input")} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button variant="outline" onClick={runAnalysis} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Re-analyse
            </Button>
            {total > 0 && (
              <Button onClick={runImport} className="ml-auto gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold h-10">
                <CheckCircle className="w-4 h-4" /> Confirm & Save {total} Records
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── IMPORTING ── */}
      {pageState === "importing" && (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold uppercase tracking-wide">Saving Records</p>
            <p className="text-sm text-muted-foreground mt-1">Writing to database…</p>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {pageState === "done" && importResult && (
        <div className="flex flex-col gap-5">
          <div className={`bg-card border rounded-xl p-10 text-center ${importResult.failed > 0 ? "border-destructive/30" : "border-green-800/30"}`}>
            {importResult.failed === 0
              ? <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              : <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            }
            <p className="text-3xl font-bold mb-1">{importResult.success}</p>
            <p className="text-sm text-muted-foreground">records imported successfully</p>
            {importResult.failed > 0 && <p className="text-sm text-destructive mt-2">{importResult.failed} failed</p>}
          </div>
          {importResult.errors.length > 0 && (
            <div className="bg-card border border-destructive/20 rounded-lg p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-destructive mb-3">Errors</p>
              <div className="space-y-1.5">
                {importResult.errors.map((e, i) => (
                  <div key={i} className="text-xs font-mono bg-destructive/10 text-destructive px-3 py-1.5 rounded flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{e}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button variant="outline" onClick={reset} className="gap-2 w-fit">
            <ArrowLeft className="w-4 h-4" /> Import More Files
          </Button>
        </div>
      )}
    </div>
  );
}
