import { useState } from "react";
import { useListQuotations, useCreateQuotation, useUpdateQuotation, useDeleteQuotation, useListEnquiries, getListQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, Pencil } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceButton } from "@/components/ui/voice-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { formatOMR } from "@/lib/utils";
import { format } from "date-fns";
import { useTableControls } from "@/hooks/use-table-controls";
import { TableToolbar, FilterSelect, SortHeader, Pagination, RowAction, TableSkeleton, TableEmpty } from "@/components/table-controls";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

// Real quotations rows expose `createdAt` (ISO string). Format defensively so a
// missing / malformed value never throws.
function fmtDate(v: any): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy");
}

// Real DB statuses are draft / sent / accepted. Keep approved/rejected in the
// ordering map too so any legacy rows still sort deterministically.
const STATUS_ORDER: Record<string, number> = { draft: 0, sent: 1, accepted: 2, approved: 2, rejected: 3 };
const STATUS_OPTIONS = ["draft", "sent", "accepted"];

interface FormData {
  serialNumber: string; clientName: string; clientCompany: string; subject: string; scopeOfWork: string;
  quotationDate: string; enquiryId: string; paymentTerms: string; termsAndConditions: string; status: string;
}

const today = new Date().toISOString().split("T")[0];
const randomSN = () => String(Math.floor(1000 + Math.random() * 9000));

const emptyForm: FormData = {
  serialNumber: randomSN(), clientName: "", clientCompany: "", subject: "", scopeOfWork: "",
  quotationDate: today, enquiryId: "", paymentTerms: "50% advance with LPO, balance on delivery/completion",
  termsAndConditions: "", status: "draft",
};

export default function Quotations() {
  const { data: quotations, isLoading } = useListQuotations();
  const { data: enquiries } = useListEnquiries();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const deleteQuotation = useDeleteQuotation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);

  const subjectVoice = useVoiceInput({ onResult: (t) => setForm((f) => ({ ...f, subject: t })) });
  const scopeVoice = useVoiceInput({ onResult: (t) => setForm((f) => ({ ...f, scopeOfWork: (f.scopeOfWork ? f.scopeOfWork + " " : "") + t })) });
  const clientVoice = useVoiceInput({ onResult: (t) => setForm((f) => ({ ...f, clientName: t })) });

  const ctl = useTableControls<NonNullable<typeof quotations>[0], "sn" | "client" | "subject" | "date" | "status", "status">({
    data: quotations,
    searchFields: (q) => [q.quotationNumber, q.client, q.title],
    sortAccessors: {
      sn: (q) => parseInt(q.quotationNumber, 10) || 0,
      client: (q) => q.client ?? "",
      subject: (q) => q.title ?? "",
      date: (q) => new Date(q.createdAt),
      status: (q) => STATUS_ORDER[q.status] ?? 99,
    },
    defaultSort: { key: "date", dir: "desc" },
    filterAccessors: { status: (q) => q.status },
    pageSize: 25,
  });

  function openCreate() { setEditingId(null); setForm({ ...emptyForm, serialNumber: randomSN() }); setDialogOpen(true); }
  function openEdit(q: NonNullable<typeof quotations>[0]) {
    setEditingId(q.id);
    setForm({
      serialNumber: q.serialNumber, clientName: q.clientName, clientCompany: q.clientCompany ?? "", subject: q.subject,
      scopeOfWork: q.scopeOfWork ?? "", quotationDate: q.quotationDate,
      enquiryId: q.enquiryId ? String(q.enquiryId) : "", paymentTerms: q.paymentTerms ?? "",
      termsAndConditions: q.termsAndConditions ?? "", status: q.status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      serialNumber: form.serialNumber, clientName: form.clientName, clientCompany: form.clientCompany || null,
      subject: form.subject, scopeOfWork: form.scopeOfWork || null, quotationDate: form.quotationDate,
      enquiryId: form.enquiryId && form.enquiryId !== "none" ? parseInt(form.enquiryId, 10) : null,
      paymentTerms: form.paymentTerms || null, termsAndConditions: form.termsAndConditions || null,
      status: form.status, vatPercent: 5, currency: "OMR",
    };
    if (editingId) {
      await updateQuotation.mutateAsync({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); toast({ title: "Quotation updated" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error updating quotation", variant: "destructive" }),
      });
    } else {
      await createQuotation.mutateAsync({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); toast({ title: "Quotation created" }); setDialogOpen(false); setForm({ ...emptyForm, serialNumber: randomSN() }); },
        onError: () => toast({ title: "Error creating quotation", variant: "destructive" }),
      });
    }
  }

  async function handleDelete(id: number | string) {
    await deleteQuotation.mutateAsync({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); toast({ title: "Deleted" }); setDeleteId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  async function quickSetStatus(id: number, status: string) {
    await updateQuotation.mutateAsync({ id, data: { status } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); toast({ title: `Marked ${status}` }); },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  }

  const hasFilters = !!ctl.filters.status && ctl.filters.status !== "all";

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <PageHeader title="Quotations" description="Client proposals">
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold" data-testid="button-create-quotation">
          <Plus className="w-4 h-4" /> New Quotation
        </Button>
      </PageHeader>

      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search by S.N., client, or subject…"
        totalCount={ctl.totalCount}
        filteredCount={ctl.filteredCount}
        hasActiveFilters={hasFilters}
        onClearFilters={ctl.clearFilters}
      >
        <FilterSelect
          value={ctl.filters.status}
          onChange={(v) => ctl.setFilter("status", v)}
          options={STATUS_OPTIONS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          placeholder="All statuses"
        />
      </TableToolbar>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : ctl.rows.length === 0 ? (
          <TableEmpty
            title={ctl.totalCount === 0 ? "No quotations yet" : "No matches found"}
            description={ctl.totalCount === 0 ? "Create your first quotation to get started." : "Try adjusting your search or filters."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <SortHeader label="S.N." sortKey="sn" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "sn")} />
                  <SortHeader label="Client" sortKey="client" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "client")} />
                  <SortHeader label="Subject" sortKey="subject" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "subject")} className="hidden md:table-cell" />
                  <SortHeader label="Date" sortKey="date" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "date")} />
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</th>
                  <SortHeader label="Status" sortKey="status" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "status")} />
                  <th className="px-3 py-2.5 w-24 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ctl.rows.map((q) => (
                  <tr key={q.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors group" data-testid={`row-quotation-${q.id}`}>
                    <td className="px-3 py-2.5 text-left">
                      <Link href={`/quotations/${q.id}`} className="text-primary font-mono text-xs font-semibold hover:underline">{q.quotationNumber}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <div className="font-medium text-foreground">{q.client}</div>
                    </td>
                    <td className="px-3 py-2.5 text-left text-muted-foreground hidden md:table-cell truncate max-w-[220px]">{q.title}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs whitespace-nowrap">{fmtDate(q.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-foreground whitespace-nowrap">{formatOMR(num((q as any).totalAmount))}</td>
                    <td className="px-3 py-2.5">
                      <Select value={q.status} onValueChange={(v) => quickSetStatus(q.id, v)}>
                        <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 hover:opacity-80 focus:ring-0 [&>svg]:hidden" data-testid={`select-q-status-${q.id}`}>
                          <StatusBadge status={q.status} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <RowAction icon={Eye} label="View" href={`/quotations/${q.id}`} />
                        <RowAction icon={Pencil} label="Edit" onClick={() => openEdit(q)} />
                        <RowAction icon={Trash2} label="Delete" destructive onClick={() => setDeleteId(q.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={ctl.page} totalPages={ctl.totalPages} onPage={ctl.setPage} pageSize={ctl.pageSize} onPageSize={ctl.setPageSize} filteredCount={ctl.filteredCount} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Quotation" : "New Quotation"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>S.N. *</Label><Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} required data-testid="input-quotation-sn" /></div>
              <div className="flex flex-col gap-1.5"><Label>Date *</Label><Input type="date" value={form.quotationDate} onChange={(e) => setForm((f) => ({ ...f, quotationDate: e.target.value }))} required data-testid="input-quotation-date" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Client Name *</Label>
                  <div className="flex items-center gap-1">
                    {clientVoice.isListening && <span className="text-xs text-red-400 animate-pulse">Listening...</span>}
                    <VoiceButton isListening={clientVoice.isListening} isSupported={clientVoice.isSupported} onClick={clientVoice.toggle} size="sm" />
                  </div>
                </div>
                <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} required data-testid="input-quotation-client" />
              </div>
              <div className="flex flex-col gap-1.5"><Label>Company</Label><Input value={form.clientCompany} onChange={(e) => setForm((f) => ({ ...f, clientCompany: e.target.value }))} data-testid="input-quotation-company" /></div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Subject *</Label>
                <div className="flex items-center gap-1">
                  {subjectVoice.isListening && <span className="text-xs text-red-400 animate-pulse">Listening...</span>}
                  <VoiceButton isListening={subjectVoice.isListening} isSupported={subjectVoice.isSupported} onClick={subjectVoice.toggle} size="sm" />
                </div>
              </div>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required data-testid="input-quotation-subject" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Scope of Work</Label>
                <div className="flex items-center gap-1">
                  {scopeVoice.isListening && <span className="text-xs text-red-400 animate-pulse">Listening...</span>}
                  <VoiceButton isListening={scopeVoice.isListening} isSupported={scopeVoice.isSupported} onClick={scopeVoice.toggle} size="sm" />
                </div>
              </div>
              <Textarea rows={2} value={form.scopeOfWork} onChange={(e) => setForm((f) => ({ ...f, scopeOfWork: e.target.value }))} data-testid="input-quotation-scope" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Link to Enquiry</Label>
                <Select value={form.enquiryId} onValueChange={(v) => setForm((f) => ({ ...f, enquiryId: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-quotation-enquiry"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(enquiries ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.clientName} — {e.subject}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-quotation-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} data-testid="input-quotation-payment-terms" /></div>
            <div className="flex flex-col gap-1.5"><Label>Terms & Conditions</Label><Textarea rows={3} value={form.termsAndConditions} onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))} data-testid="input-quotation-tnc" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createQuotation.isPending || updateQuotation.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-quotation">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Quotation?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={deleteQuotation.isPending} data-testid="button-confirm-delete-quotation">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
