import { useState } from "react";
import { useListFinancialFlags, useCreateFinancialFlag, useUpdateFinancialFlag, useDeleteFinancialFlag, useListChecklistItems, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, getListFinancialFlagsQueryKey, getListChecklistItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ShieldAlert, ListChecks, AlertTriangle, Check } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/15 text-red-400",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  escalated: "bg-purple-500/15 text-purple-400",
  overdue: "bg-red-500/30 text-red-300",
};

interface FlagForm {
  flagNumber: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  grade: string;
  raisedDate: string;
  dueDate: string;
  assignee: string;
  resolution: string;
}
const emptyFlag: FlagForm = { flagNumber: "1", title: "", description: "", category: "general", severity: "medium", status: "open", grade: "", raisedDate: "", dueDate: "", assignee: "", resolution: "" };

interface ChkForm { title: string; description: string; frequency: string; owner: string; nextDue: string; status: string; }
const emptyChk: ChkForm = { title: "", description: "", frequency: "monthly", owner: "", nextDue: "", status: "pending" };

export default function FinancialOversightPage() {
  const { data: flags, isLoading: loadingFlags } = useListFinancialFlags();
  const { data: items, isLoading: loadingChk } = useListChecklistItems();
  const createFlag = useCreateFinancialFlag();
  const updateFlag = useUpdateFinancialFlag();
  const delFlag = useDeleteFinancialFlag();
  const createChk = useCreateChecklistItem();
  const updateChk = useUpdateChecklistItem();
  const delChk = useDeleteChecklistItem();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"flags" | "checklist">("flags");
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagEditId, setFlagEditId] = useState<number | null>(null);
  const [flagForm, setFlagForm] = useState<FlagForm>(emptyFlag);
  const [delFlagId, setDelFlagId] = useState<number | null>(null);
  const [chkOpen, setChkOpen] = useState(false);
  const [chkEditId, setChkEditId] = useState<number | null>(null);
  const [chkForm, setChkForm] = useState<ChkForm>(emptyChk);
  const [delChkId, setDelChkId] = useState<number | null>(null);

  function openCreateFlag() {
    setFlagEditId(null);
    const today = new Date().toISOString().slice(0, 10);
    const nextNum = ((flags ?? []).reduce((m, f) => Math.max(m, f.flagNumber), 0) + 1);
    setFlagForm({ ...emptyFlag, flagNumber: String(nextNum), raisedDate: today });
    setFlagOpen(true);
  }
  function openEditFlag(f: NonNullable<typeof flags>[0]) {
    setFlagEditId(f.id);
    setFlagForm({
      flagNumber: String(f.flagNumber), title: f.title, description: f.description ?? "",
      category: f.category, severity: f.severity, status: f.status, grade: f.grade ?? "",
      raisedDate: f.raisedDate, dueDate: f.dueDate ?? "", assignee: f.assignee ?? "", resolution: f.resolution ?? "",
    });
    setFlagOpen(true);
  }
  async function submitFlag(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      flagNumber: Number(flagForm.flagNumber) || 1,
      title: flagForm.title,
      description: flagForm.description || null,
      category: flagForm.category,
      severity: flagForm.severity as "low" | "medium" | "high" | "critical",
      status: flagForm.status as "open" | "in_progress" | "resolved" | "escalated" | "overdue",
      grade: (flagForm.grade ? flagForm.grade : null) as "A" | "B" | "C" | "D" | "E" | "F" | null,
      raisedDate: flagForm.raisedDate,
      dueDate: flagForm.dueDate || null,
      assignee: flagForm.assignee || null,
      resolution: flagForm.resolution || null,
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFinancialFlagsQueryKey() }); toast({ title: flagEditId ? "Updated" : "Created" }); setFlagOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (flagEditId) await updateFlag.mutateAsync({ id: flagEditId, data: payload }, opts);
    else await createFlag.mutateAsync({ data: payload }, opts);
  }
  async function removeFlag(id: number) {
    await delFlag.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListFinancialFlagsQueryKey() }); toast({ title: "Deleted" }); setDelFlagId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function openCreateChk() { setChkEditId(null); setChkForm(emptyChk); setChkOpen(true); }
  function openEditChk(c: NonNullable<typeof items>[0]) {
    setChkEditId(c.id);
    setChkForm({ title: c.title, description: c.description ?? "", frequency: c.frequency, owner: c.owner ?? "", nextDue: c.nextDue ?? "", status: c.status });
    setChkOpen(true);
  }
  async function submitChk(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: chkForm.title, description: chkForm.description || null,
      frequency: chkForm.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "annually",
      owner: chkForm.owner || null, nextDue: chkForm.nextDue || null,
      status: chkForm.status as "pending" | "in_progress" | "done" | "skipped",
    };
    const opts = {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChecklistItemsQueryKey() }); toast({ title: chkEditId ? "Updated" : "Created" }); setChkOpen(false); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    };
    if (chkEditId) await updateChk.mutateAsync({ id: chkEditId, data: payload }, opts);
    else await createChk.mutateAsync({ data: payload }, opts);
  }
  async function removeChk(id: number) {
    await delChk.mutateAsync({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChecklistItemsQueryKey() }); toast({ title: "Deleted" }); setDelChkId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }
  async function toggleChkDone(c: NonNullable<typeof items>[0]) {
    const newStatus = c.status === "done" ? "pending" : "done";
    const today = new Date().toISOString().slice(0, 10);
    await updateChk.mutateAsync({ id: c.id, data: { status: newStatus, lastCompleted: newStatus === "done" ? today : c.lastCompleted } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListChecklistItemsQueryKey() }),
    });
  }

  const flagRows = flags ?? [];
  const chkRows = items ?? [];
  const openFlags = flagRows.filter(f => f.status !== "resolved").length;
  const criticalOpen = flagRows.filter(f => f.severity === "critical" && f.status !== "resolved").length;
  const overdue = flagRows.filter(f => f.status === "overdue" || (f.dueDate && f.status !== "resolved" && new Date(f.dueDate) < new Date())).length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Financial Oversight</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Audit flags · controls checklist · grading</p>
        </div>
        <Button onClick={tab === "flags" ? openCreateFlag : openCreateChk} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">
          <Plus className="w-4 h-4" /> {tab === "flags" ? "New Flag" : "New Control"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Open Flags</div>
          <div className="text-3xl font-bold text-primary mt-2">{openFlags}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Critical</div>
          <div className="text-3xl font-bold text-red-400 mt-2">{criticalOpen}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Overdue</div>
          <div className="text-3xl font-bold text-yellow-400 mt-2">{overdue}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setTab("flags")} className={`px-4 py-2 text-sm uppercase tracking-wider font-bold border-b-2 transition-colors ${tab === "flags" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          <span className="inline-flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Audit Flags ({flagRows.length})</span>
        </button>
        <button onClick={() => setTab("checklist")} className={`px-4 py-2 text-sm uppercase tracking-wider font-bold border-b-2 transition-colors ${tab === "checklist" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          <span className="inline-flex items-center gap-2"><ListChecks className="w-4 h-4" /> Controls ({chkRows.length})</span>
        </button>
      </div>

      {tab === "flags" && (
        loadingFlags ? <Skeleton className="h-40 rounded-lg" /> : flagRows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No flags yet. Raise a flag when an audit issue is detected.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {flagRows.map(f => (
              <div key={f.id} className={`bg-card border rounded-lg p-5 ${SEVERITY_COLORS[f.severity] ?? "border-card-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{f.flagNumber}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${STATUS_COLORS[f.status] ?? "bg-muted text-muted-foreground"}`}>{f.status.replace("_", " ")}</span>
                      {f.grade && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary">Grade {f.grade}</span>}
                      <span className="text-xs text-muted-foreground capitalize">{f.category}</span>
                    </div>
                    <div className="font-semibold mt-1.5">{f.title}</div>
                    {f.description && <p className="text-sm text-muted-foreground mt-1">{f.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span>Raised: {f.raisedDate}</span>
                      {f.dueDate && <span>Due: {f.dueDate}</span>}
                      {f.assignee && <span>Owner: {f.assignee}</span>}
                    </div>
                    {f.resolution && <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded p-2 text-emerald-300"><strong>Resolution:</strong> {f.resolution}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditFlag(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelFlagId(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "checklist" && (
        loadingChk ? <Skeleton className="h-40 rounded-lg" /> : chkRows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No controls yet. Add monthly checks like "Bank reconciliation" or "VAT return".</div>
        ) : (
          <div className="flex flex-col gap-2">
            {chkRows.map(c => (
              <div key={c.id} className="bg-card border border-card-border rounded-lg p-4 flex items-center gap-3 hover:border-primary/30 transition-colors">
                <button onClick={() => toggleChkDone(c)} className={`w-7 h-7 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${c.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-muted hover:border-primary"}`}>
                  {c.status === "done" && <Check className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${c.status === "done" ? "line-through text-muted-foreground" : ""}`}>{c.title}</div>
                  {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="capitalize">{c.frequency}</span>
                    {c.owner && <span>· {c.owner}</span>}
                    {c.nextDue && <span>· Due {c.nextDue}</span>}
                    {c.lastCompleted && <span>· Last done {c.lastCompleted}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditChk(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelChkId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )
      )}

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{flagEditId ? "Edit Flag" : "New Flag"}</DialogTitle></DialogHeader>
          <form onSubmit={submitFlag} className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Flag #</Label><Input type="number" value={flagForm.flagNumber} onChange={(e) => setFlagForm(f => ({ ...f, flagNumber: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Severity</Label>
                <select value={flagForm.severity} onChange={(e) => setFlagForm(f => ({ ...f, severity: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5"><Label>Grade</Label>
                <select value={flagForm.grade} onChange={(e) => setFlagForm(f => ({ ...f, grade: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="">—</option>{["A","B","C","D","E","F"].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Title *</Label><Input value={flagForm.title} onChange={(e) => setFlagForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="flex flex-col gap-1.5"><Label>Description</Label><Textarea rows={3} value={flagForm.description} onChange={(e) => setFlagForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Category</Label><Input value={flagForm.category} onChange={(e) => setFlagForm(f => ({ ...f, category: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Status</Label>
                <select value={flagForm.status} onChange={(e) => setFlagForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option><option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Raised</Label><Input type="date" value={flagForm.raisedDate} onChange={(e) => setFlagForm(f => ({ ...f, raisedDate: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Due</Label><Input type="date" value={flagForm.dueDate} onChange={(e) => setFlagForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Owner</Label><Input value={flagForm.assignee} onChange={(e) => setFlagForm(f => ({ ...f, assignee: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Resolution</Label><Textarea rows={2} value={flagForm.resolution} onChange={(e) => setFlagForm(f => ({ ...f, resolution: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFlagOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">{flagEditId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delFlagId !== null} onOpenChange={() => setDelFlagId(null)}>
        <DialogContent><DialogHeader><DialogTitle>Delete flag?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelFlagId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delFlagId && removeFlag(delFlagId)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chkOpen} onOpenChange={setChkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{chkEditId ? "Edit Control" : "New Control"}</DialogTitle></DialogHeader>
          <form onSubmit={submitChk} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5"><Label>Title *</Label><Input value={chkForm.title} onChange={(e) => setChkForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="flex flex-col gap-1.5"><Label>Description</Label><Textarea rows={2} value={chkForm.description} onChange={(e) => setChkForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Frequency</Label>
                <select value={chkForm.frequency} onChange={(e) => setChkForm(f => ({ ...f, frequency: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5"><Label>Owner</Label><Input value={chkForm.owner} onChange={(e) => setChkForm(f => ({ ...f, owner: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Next Due</Label><Input type="date" value={chkForm.nextDue} onChange={(e) => setChkForm(f => ({ ...f, nextDue: e.target.value }))} /></div>
              <div className="flex flex-col gap-1.5"><Label>Status</Label>
                <select value={chkForm.status} onChange={(e) => setChkForm(f => ({ ...f, status: e.target.value }))} className="bg-background border border-input rounded-md px-3 py-2 text-sm">
                  <option value="pending">Pending</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="skipped">Skipped</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setChkOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold">{chkEditId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delChkId !== null} onOpenChange={() => setDelChkId(null)}>
        <DialogContent><DialogHeader><DialogTitle>Delete control?</DialogTitle></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDelChkId(null)}>Cancel</Button><Button variant="destructive" onClick={() => delChkId && removeChk(delChkId)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
