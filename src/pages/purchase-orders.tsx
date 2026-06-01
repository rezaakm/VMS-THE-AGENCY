import { useState } from "react";
import { useListPurchaseOrders, useCreatePurchaseOrder, useUpdatePurchaseOrder, useDeletePurchaseOrder, useListVendors, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ShoppingCart, Building2, Calendar } from "lucide-react";

interface Form {
  poNumber: string;
  vendorId: string;
  date: string;
  expectedDelivery: string;
  status: string;
  paymentTerms: string;
  notes: string;
}
const empty: Form = { poNumber: "", vendorId: "", date: "", expectedDelivery: "", status: "draft", paymentTerms: "", notes: "" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400",
  confirmed: "bg-purple-500/15 text-purple-400",
  received: "bg-emerald-500/15 text-emerald-400",
  paid: "bg-primary/15 text-primary",
  cancelled: "bg-red-500/15 text-red-400",
};

export default function PurchaseOrdersPage() {
  const { data: pos, isLoading } = useListPurchaseOrders();
  const { data: vendors } = useListVendors();
  const create = useCreatePurchaseOrder();
  const update = useUpdatePurchaseOrder();
  const del = useDeletePurchaseOrder();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [delId, setDelId] = useState<number | null>(null);

  function vendorName(id: number | null | undefined) {
    if (!id) return "—";
    const v = vendors?.find(x => x.id === id);
    return v ? v.company : `#${id}`;
  }

  function openCreate() {
    setEditingId(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...empty, date: today, poNumber: `PO-${Date.now().toString().slice(-6)}` });
    setOpen(true);
  }
  function openEdit(p: NonNullable<typeof pos>[0]) {
    setEditingId(p.id);
    setForm({
      poNumber: p.poNumber,
      vendorId: p.vendorId == null ? "" : String(p.vendorId),
      date: p.date,
      expectedDelivery: p.expectedDelivery ?? "",
      status: p.status,
      paymentTerms: p.paymentTerms ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      poNumber: form.poNumber,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      date: form.date,
      expectedDelivery: form.expectedDelivery || null,
      status: form.status as "draft" | "sent" | "confirmed" | "received" | "paid" | "cancelled",
      paymentTerms: form.paymentTerms || null,
      notes: form.notes || null,
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() }); toast({ title: editingId ? "PO updated" : "PO created" }); setOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (editingId) await update.mutateAsync({ id: editingId, data: payload }, opts);
    else await create.mutateAsync({ data: payload }, opts);
  }
  async function remove(id: number) {
    await del.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() }); toast({ title: "Deleted" }); setDelId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = pos ?? [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Vendor orders & deliveries</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> New PO
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No purchase orders yet.</div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">PO #</th>
                <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Expected</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium flex items-center gap-2"><ShoppingCart className="w-3.5 h-3.5 text-primary" />{p.poNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {vendorName(p.vendorId)}</span></td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.date}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.expectedDelivery ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelId(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit PO" : "New PO"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>PO Number *</Label>
                <Input value={form.poNumber} onChange={(e) => setForm(f => ({ ...f, poNumber: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="draft">Draft</option><option value="sent">Sent</option><option value="confirmed">Confirmed</option>
                  <option value="received">Received</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Vendor</Label>
              <select value={form.vendorId} onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="">—</option>
                {(vendors ?? []).map(v => <option key={v.id} value={v.id}>{v.company} — {v.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Expected Delivery</Label>
                <Input type="date" value={form.expectedDelivery} onChange={(e) => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Payment Terms</Label>
              <Input value={form.paymentTerms} onChange={(e) => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="50% advance, balance on delivery" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delId !== null} onOpenChange={() => setDelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete PO?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delId && remove(delId)} disabled={del.isPending}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
