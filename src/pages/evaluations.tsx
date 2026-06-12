import { useState } from "react";
import { useListEvaluations, useCreateEvaluation, useUpdateEvaluation, useDeleteEvaluation, useListVendors, getListEvaluationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star, Building2 } from "lucide-react";

interface Form {
  vendorId: string;
  qualityScore: number;
  timelinessScore: number;
  communicationScore: number;
  valueScore: number;
  evaluator: string;
  evaluationDate: string;
  wouldRecommend: "yes" | "no" | "maybe";
  comments: string;
}
const empty: Form = { vendorId: "", qualityScore: 4, timelinessScore: 4, communicationScore: 4, valueScore: 4, evaluator: "", evaluationDate: "", wouldRecommend: "yes", comments: "" };

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={`p-0.5 ${onChange ? "hover:scale-110 transition-transform" : ""}`}>
          <Star className={`w-5 h-5 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

export default function EvaluationsPage() {
  const { data: evals, isLoading } = useListEvaluations();
  const { data: vendors } = useListVendors();
  const create = useCreateEvaluation();
  const update = useUpdateEvaluation();
  const del = useDeleteEvaluation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [delId, setDelId] = useState<number | null>(null);

  function vendor(id: number) {
    const v = vendors?.find(x => x.id === id);
    return v ? `${v.company} — ${v.name}` : `#${id}`;
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...empty, evaluationDate: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }
  function openEdit(e: NonNullable<typeof evals>[0]) {
    setEditingId(e.id);
    setForm({
      vendorId: String(e.vendorId),
      qualityScore: e.qualityScore,
      timelinessScore: e.timelinessScore,
      communicationScore: e.communicationScore,
      valueScore: e.valueScore,
      evaluator: e.evaluator ?? "",
      evaluationDate: e.evaluationDate,
      wouldRecommend: e.wouldRecommend as "yes" | "no" | "maybe",
      comments: e.comments ?? "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { toast({ title: "Pick a vendor", variant: "destructive" }); return; }
    const overall = Math.round(((form.qualityScore + form.timelinessScore + form.communicationScore + form.valueScore) / 4) * 10) / 10 * 1;
    const payload = {
      vendorId: Number(form.vendorId),
      qualityScore: form.qualityScore,
      timelinessScore: form.timelinessScore,
      communicationScore: form.communicationScore,
      valueScore: form.valueScore,
      overallScore: Math.round((form.qualityScore + form.timelinessScore + form.communicationScore + form.valueScore) / 4),
      evaluator: form.evaluator || null,
      evaluationDate: form.evaluationDate,
      wouldRecommend: form.wouldRecommend,
      comments: form.comments || null,
    };
    void overall;
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() }); toast({ title: editingId ? "Updated" : "Created" }); setOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (editingId) await update.mutateAsync({ id: editingId, data: payload }, opts);
    else await create.mutateAsync({ data: payload }, opts);
  }
  async function remove(id: number) {
    await del.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() }); toast({ title: "Deleted" }); setDelId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = evals ?? [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Vendor Evaluations</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Performance tracking after each job</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> New Evaluation
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-lg" /> : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No evaluations yet. Rate a vendor after a completed job.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(e => (
            <div key={e.id} className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-primary shrink-0" />{vendor(e.vendorId)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{e.evaluationDate}{e.evaluator ? ` · ${e.evaluator}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-primary">{e.overallScore ?? "—"}<span className="text-sm text-muted-foreground">/5</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-muted-foreground mb-0.5">Quality</div><Stars value={e.qualityScore} /></div>
                <div><div className="text-muted-foreground mb-0.5">Timeliness</div><Stars value={e.timelinessScore} /></div>
                <div><div className="text-muted-foreground mb-0.5">Communication</div><Stars value={e.communicationScore} /></div>
                <div><div className="text-muted-foreground mb-0.5">Value</div><Stars value={e.valueScore} /></div>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Would recommend: </span>
                <span className={`font-semibold ${e.wouldRecommend === "yes" ? "text-emerald-400" : e.wouldRecommend === "no" ? "text-red-400" : "text-yellow-400"}`}>{(e.wouldRecommend ?? "—").toUpperCase()}</span>
              </div>
              {e.comments && <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-3">{e.comments}</p>}
              <div className="flex justify-end gap-1 pt-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelId(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Evaluation" : "New Evaluation"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Vendor *</Label>
              <select value={form.vendorId} onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm" required>
                <option value="">— Select —</option>
                {(vendors ?? []).map(v => <option key={v.id} value={v.id}>{v.company} — {v.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5"><Label>Quality</Label><Stars value={form.qualityScore} onChange={(v) => setForm(f => ({ ...f, qualityScore: v }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Timeliness</Label><Stars value={form.timelinessScore} onChange={(v) => setForm(f => ({ ...f, timelinessScore: v }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Communication</Label><Stars value={form.communicationScore} onChange={(v) => setForm(f => ({ ...f, communicationScore: v }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Value for Money</Label><Stars value={form.valueScore} onChange={(v) => setForm(f => ({ ...f, valueScore: v }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Evaluator</Label><Input value={form.evaluator} onChange={(e) => setForm(f => ({ ...f, evaluator: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Date *</Label><Input type="date" value={form.evaluationDate} onChange={(e) => setForm(f => ({ ...f, evaluationDate: e.target.value }))} required /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Would Recommend</Label>
              <select value={form.wouldRecommend} onChange={(e) => setForm(f => ({ ...f, wouldRecommend: e.target.value as "yes" | "no" | "maybe" }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Comments</Label><Textarea rows={3} value={form.comments} onChange={(e) => setForm(f => ({ ...f, comments: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delId !== null} onOpenChange={() => setDelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete evaluation?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delId && remove(delId)} disabled={del.isPending}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
