import { useState } from "react";
import { useListContracts, useCreateContract, useUpdateContract, useDeleteContract, useListVendors, getListContractsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileSignature, Calendar, Building2, AlertTriangle } from "lucide-react";

interface Form {
  vendorId: string;
  title: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  value: string;
  status: string;
  notes: string;
}
const empty: Form = { vendorId: "", title: "", contractNumber: "", startDate: "", endDate: "", value: "0", status: "active", notes: "" };

function fmtOMR(v: number) {
  return `OMR ${v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}
function isExpiringSoon(endDate: string | null) {
  if (!endDate) return false;
  const days = (new Date(endDate).getTime() - Date.now()) / 86400_000;
  return days >= 0 && days <= 30;
}
function isExpired(endDate: string | null) {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}

export default function ContractsPage() {
  const { data: contracts, isLoading } = useListContracts();
  const { data: vendors } = useListVendors();
  const create = useCreateContract();
  const update = useUpdateContract();
  const del = useDeleteContract();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [delId, setDelId] = useState<number | null>(null);

  function vendorName(id: number | null | undefined) {
    if (!id) return "—";
    const v = vendors?.find((x) => x.id === id);
    return v ? `${v.company}` : `#${id}`;
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...empty, startDate: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }
  function openEdit(c: NonNullable<typeof contracts>[0]) {
    setEditingId(c.id);
    setForm({
      vendorId: c.vendorId == null ? "" : String(c.vendorId),
      title: c.title,
      contractNumber: c.contractNumber ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      value: String(c.value ?? 0),
      status: c.status,
      notes: c.notes ?? "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      title: form.title,
      contractNumber: form.contractNumber || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      value: Number(form.value) || 0,
      status: form.status as "active" | "expired" | "cancelled" | "pending",
      notes: form.notes || null,
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListContractsQueryKey() }); toast({ title: editingId ? "Contract updated" : "Contract created" }); setOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (editingId) await update.mutateAsync({ id: editingId, data: payload }, opts);
    else await create.mutateAsync({ data: payload }, opts);
  }
  async function remove(id: number) {
    await del.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListContractsQueryKey() }); toast({ title: "Deleted" }); setDelId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = contracts ?? [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Vendor agreements & retainers</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> New Contract
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No contracts yet. Click "New Contract" to add your first vendor agreement.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c) => {
            const expiring = isExpiringSoon(c.endDate);
            const expired = isExpired(c.endDate);
            return (
              <div key={c.id} className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-base truncate flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-primary shrink-0" /> {c.title}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                      <Building2 className="w-3 h-3" /> {vendorName(c.vendorId)}
                    </div>
                    {c.contractNumber && <div className="text-xs text-muted-foreground mt-0.5">#{c.contractNumber}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      c.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                      c.status === "expired" ? "bg-red-500/15 text-red-400" :
                      c.status === "cancelled" ? "bg-muted text-muted-foreground" :
                      "bg-yellow-500/15 text-yellow-400"
                    }`}>{c.status}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold tracking-tight text-primary">{fmtOMR(c.value)}</div>
                {(c.startDate || c.endDate) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {c.startDate ?? "—"} → {c.endDate ?? "—"}
                    {(expired || expiring) && <span className={`ml-1 inline-flex items-center gap-1 ${expired ? "text-red-400" : "text-yellow-400"}`}><AlertTriangle className="w-3 h-3" /> {expired ? "Expired" : "Expiring soon"}</span>}
                  </div>
                )}
                {c.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{c.notes}</p>}
                <div className="flex justify-end gap-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Contract" : "New Contract"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vendor</Label>
                <select value={form.vendorId} onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="">—</option>
                  {(vendors ?? []).map(v => <option key={v.id} value={v.id}>{v.company} — {v.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Contract #</Label>
                <Input value={form.contractNumber} onChange={(e) => setForm(f => ({ ...f, contractNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Start</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Value (OMR)</Label>
                <Input type="number" step="0.001" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
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
          <DialogHeader><DialogTitle>Delete contract?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => delId && remove(delId)} disabled={del.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
