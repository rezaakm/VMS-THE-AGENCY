import { useState } from "react";
import { useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useListVendors, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Receipt, Calendar, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface Form {
  invoiceNumber: string;
  type: "client" | "vendor";
  vendorId: string;
  clientName: string;
  clientCompany: string;
  description: string;
  amount: string;
  vatAmount: string;
  totalAmount: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate: string;
  notes: string;
}
const empty: Form = { invoiceNumber: "", type: "client", vendorId: "", clientName: "", clientCompany: "", description: "", amount: "0", vatAmount: "0", totalAmount: "0", status: "draft", issueDate: "", dueDate: "", paidDate: "", notes: "" };

function fmtOMR(v: number) { return `OMR ${v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`; }
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-400",
  overdue: "bg-red-500/15 text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useListInvoices();
  const { data: vendors } = useListVendors();
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const del = useDeleteInvoice();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "client" | "vendor">("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [delId, setDelId] = useState<number | null>(null);

  function vendorName(id: number | null | undefined) {
    if (!id) return "—";
    const v = vendors?.find(x => x.id === id);
    return v ? v.company : `#${id}`;
  }

  function recompute(f: Form): Form {
    const amt = Number(f.amount) || 0;
    const vat = Number(f.vatAmount) || 0;
    return { ...f, totalAmount: (amt + vat).toFixed(3) };
  }

  function openCreate() {
    setEditingId(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...empty, invoiceNumber: `INV-${Date.now().toString().slice(-6)}`, issueDate: today });
    setOpen(true);
  }
  function openEdit(i: NonNullable<typeof invoices>[0]) {
    setEditingId(i.id);
    setForm({
      invoiceNumber: i.invoiceNumber,
      type: i.type as "client" | "vendor",
      vendorId: i.vendorId == null ? "" : String(i.vendorId),
      clientName: i.clientName ?? "",
      clientCompany: i.clientCompany ?? "",
      description: i.description ?? "",
      amount: String(i.amount),
      vatAmount: String(i.vatAmount),
      totalAmount: String(i.totalAmount),
      status: i.status,
      issueDate: i.issueDate,
      dueDate: i.dueDate ?? "",
      paidDate: i.paidDate ?? "",
      notes: i.notes ?? "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      invoiceNumber: form.invoiceNumber,
      type: form.type,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      clientName: form.clientName || null,
      clientCompany: form.clientCompany || null,
      description: form.description || null,
      amount: Number(form.amount) || 0,
      vatAmount: Number(form.vatAmount) || 0,
      totalAmount: Number(form.totalAmount) || 0,
      status: form.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      paidDate: form.paidDate || null,
      notes: form.notes || null,
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }); toast({ title: editingId ? "Invoice updated" : "Invoice created" }); setOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (editingId) await update.mutateAsync({ id: editingId, data: payload }, opts);
    else await create.mutateAsync({ data: payload }, opts);
  }
  async function remove(id: number) {
    await del.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }); toast({ title: "Deleted" }); setDelId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = (invoices ?? []).filter(i => filter === "all" || i.type === filter);
  const totalIn = (invoices ?? []).filter(i => i.type === "client" && i.status !== "cancelled").reduce((s, i) => s + i.totalAmount, 0);
  const totalOut = (invoices ?? []).filter(i => i.type === "vendor" && i.status !== "cancelled").reduce((s, i) => s + i.totalAmount, 0);
  const outstanding = (invoices ?? []).filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + (i.type === "client" ? i.totalAmount : -i.totalAmount), 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Client billing & vendor bills</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Client Invoiced</div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{fmtOMR(totalIn)}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-red-400" /> Vendor Bills</div>
          <div className="text-2xl font-bold text-red-400 mt-2">{fmtOMR(totalOut)}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Outstanding (Net)</div>
          <div className="text-2xl font-bold text-primary mt-2">{fmtOMR(outstanding)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "client", "vendor"] as const).map(t => (
          <Button key={t} variant={filter === t ? "default" : "outline"} size="sm" onClick={() => setFilter(t)} className="uppercase tracking-wider text-xs">{t}</Button>
        ))}
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-lg" /> : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No invoices yet.</div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Party</th>
                <th className="text-left px-4 py-3 font-semibold">Issue</th>
                <th className="text-left px-4 py-3 font-semibold">Due</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium flex items-center gap-2"><Receipt className="w-3.5 h-3.5 text-primary" />{i.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{i.type}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{i.type === "client" ? (i.clientCompany ?? i.clientName ?? "—") : vendorName(i.vendorId)}</td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{i.issueDate}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{i.dueDate ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtOMR(i.totalAmount)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${STATUS_COLORS[i.status] ?? "bg-muted text-muted-foreground"}`}>{i.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelId(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Invoice" : "New Invoice"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Invoice # *</Label><Input value={form.invoiceNumber} onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} required /></div>
              <div className="flex flex-col gap-1.5"><Label>Type</Label>
                <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value as "client" | "vendor" }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="client">Client (Receivable)</option><option value="vendor">Vendor (Payable)</option>
                </select>
              </div>
            </div>
            {form.type === "vendor" ? (
              <div className="flex flex-col gap-1.5"><Label>Vendor</Label>
                <select value={form.vendorId} onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="">—</option>
                  {(vendors ?? []).map(v => <option key={v.id} value={v.id}>{v.company} — {v.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5"><Label>Client Name</Label><Input value={form.clientName} onChange={(e) => setForm(f => ({ ...f, clientName: e.target.value }))} /></div>
                <div className="flex flex-col gap-1.5"><Label>Client Company</Label><Input value={form.clientCompany} onChange={(e) => setForm(f => ({ ...f, clientCompany: e.target.value }))} /></div>
              </div>
            )}
            <div className="flex flex-col gap-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Amount</Label><Input type="number" step="0.001" value={form.amount} onChange={(e) => setForm(f => recompute({ ...f, amount: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>VAT</Label><Input type="number" step="0.001" value={form.vatAmount} onChange={(e) => setForm(f => recompute({ ...f, vatAmount: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Total</Label><Input type="number" step="0.001" value={form.totalAmount} onChange={(e) => setForm(f => ({ ...f, totalAmount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Issue Date *</Label><Input type="date" value={form.issueDate} onChange={(e) => setForm(f => ({ ...f, issueDate: e.target.value }))} required /></div>
              <div className="flex flex-col gap-1.5"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Paid Date</Label><Input type="date" value={form.paidDate} onChange={(e) => setForm(f => ({ ...f, paidDate: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delId !== null} onOpenChange={() => setDelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete invoice?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delId && remove(delId)} disabled={del.isPending}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
