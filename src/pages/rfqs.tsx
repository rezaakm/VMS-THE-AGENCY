import { useState } from "react";
import { useListRfqs, useCreateRfq, useUpdateRfq, useDeleteRfq, getListRfqsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ClipboardList, Calendar } from "lucide-react";

interface Form {
  rfqNumber: string;
  title: string;
  description: string;
  category: string;
  issueDate: string;
  responseDueDate: string;
  status: string;
  notes: string;
}
const empty: Form = { rfqNumber: "", title: "", description: "", category: "", issueDate: "", responseDueDate: "", status: "draft", notes: "" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400",
  receiving_bids: "bg-yellow-500/15 text-yellow-400",
  awarded: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/15 text-red-400",
};

export default function RfqsPage() {
  const { data: rfqs, isLoading } = useListRfqs();
  const create = useCreateRfq();
  const update = useUpdateRfq();
  const del = useDeleteRfq();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [delId, setDelId] = useState<number | null>(null);

  function openCreate() {
    setEditingId(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...empty, rfqNumber: `RFQ-${Date.now().toString().slice(-6)}`, issueDate: today });
    setOpen(true);
  }
  function openEdit(r: NonNullable<typeof rfqs>[0]) {
    setEditingId(r.id);
    setForm({
      rfqNumber: r.rfqNumber,
      title: r.title,
      description: r.description ?? "",
      category: r.category ?? "",
      issueDate: r.issueDate,
      responseDueDate: r.responseDueDate ?? "",
      status: r.status,
      notes: r.notes ?? "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      rfqNumber: form.rfqNumber,
      title: form.title,
      description: form.description || null,
      category: form.category || null,
      issueDate: form.issueDate,
      responseDueDate: form.responseDueDate || null,
      status: form.status as "draft" | "sent" | "receiving_bids" | "awarded" | "closed" | "cancelled",
      notes: form.notes || null,
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListRfqsQueryKey() }); toast({ title: editingId ? "Updated" : "Created" }); setOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (editingId) await update.mutateAsync({ id: editingId, data: payload }, opts);
    else await create.mutateAsync({ data: payload }, opts);
  }
  async function remove(id: number) {
    await del.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListRfqsQueryKey() }); toast({ title: "Deleted" }); setDelId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = rfqs ?? [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">RFQs</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Requests for quotation — invite vendors to bid</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> New RFQ
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-lg" /> : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No RFQs yet. Issue one to start collecting vendor bids.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-base flex items-center gap-2 truncate"><ClipboardList className="w-4 h-4 text-primary shrink-0" />{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">#{r.rfqNumber}{r.category ? ` · ${r.category}` : ""}</div>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shrink-0 ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground"}`}>{r.status.replace("_", " ")}</span>
              </div>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Issued {r.issueDate}</span>
                {r.responseDueDate && <span>Due {r.responseDueDate}</span>}
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit RFQ" : "New RFQ"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>RFQ # *</Label><Input value={form.rfqNumber} onChange={(e) => setForm(f => ({ ...f, rfqNumber: e.target.value }))} required /></div>
              <div className="flex flex-col gap-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="AV, Catering..." /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="flex flex-col gap-1.5"><Label>Description / Scope</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Issue Date *</Label><Input type="date" value={form.issueDate} onChange={(e) => setForm(f => ({ ...f, issueDate: e.target.value }))} required /></div>
              <div className="flex flex-col gap-1.5"><Label>Response Due</Label><Input type="date" value={form.responseDueDate} onChange={(e) => setForm(f => ({ ...f, responseDueDate: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="draft">Draft</option><option value="sent">Sent</option><option value="receiving_bids">Receiving bids</option>
                <option value="awarded">Awarded</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
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
          <DialogHeader><DialogTitle>Delete RFQ?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delId && remove(delId)} disabled={del.isPending}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
