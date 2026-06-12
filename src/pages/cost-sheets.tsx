import { useState } from "react";
import { useListCostSheets, useCreateCostSheet, useUpdateCostSheet, useDeleteCostSheet, getListCostSheetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, Pencil, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { format } from "date-fns";
import { useTableControls } from "@/hooks/use-table-controls";
import { TableToolbar, FilterSelect, SortHeader, Pagination, RowAction, TableSkeleton, TableEmpty } from "@/components/table-controls";

interface FormData { client: string; title: string; date: string; }
const emptyForm: FormData = { client: "", title: "", date: "" };

// Display a row's date — prefer the explicit `date` column, fall back to createdAt.
function rowDate(s: any): Date | null {
  const raw = s.date ?? s.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function CostSheets() {
  const { data: sheets, isLoading } = useListCostSheets();
  const createSheet = useCreateCostSheet();
  const updateSheet = useUpdateCostSheet();
  const deleteSheet = useDeleteCostSheet();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  // Display-only recency window. Defaults to All time so nothing is hidden
  // unless the user narrows it.
  const [range, setRange] = useState<"all" | "30d" | "60d" | "90d" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const visibleSheets = (() => {
    if (range === "all") return sheets;
    if (range === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      // Include the whole "to" day by pushing to end-of-day.
      const to = customTo ? new Date(customTo + "T23:59:59.999") : null;
      if (!from && !to) return sheets;
      return (sheets ?? []).filter((s) => {
        const d = rowDate(s);
        if (!d) return true;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    const days = range === "30d" ? 30 : range === "60d" ? 60 : 90;
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })();
    return (sheets ?? []).filter((s) => { const d = rowDate(s); return d ? d >= cutoff : true; });
  })();

  const ctl = useTableControls<NonNullable<typeof sheets>[0], "client" | "title" | "createdAt", "linked">({
    data: visibleSheets,
    searchFields: (s) => [s.client, s.title],
    sortAccessors: {
      client: (s) => s.client ?? "",
      title: (s) => s.title ?? "",
      createdAt: (s) => rowDate(s) ?? new Date(0),
    },
    defaultSort: { key: "createdAt", dir: "desc" },
    filterAccessors: { linked: (s) => s.enquiry_id ? "yes" : "no" },
    pageSize: 25,
  });

  function openCreate() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(s: NonNullable<typeof sheets>[0]) {
    setEditingId(s.id);
    setForm({ client: s.client ?? "", title: s.title ?? "", date: s.date ? String(s.date).split("T")[0] : "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientName = form.client.trim() || "Untitled Client";
    if (!form.client.trim()) {
      toast({ title: "Client name is required to save cost sheet.", variant: "destructive" });
      return;
    }
    const payload: Record<string, any> = {
      client: clientName,
      title: form.title, // mapped to the `event` column by the api-client
      date: form.date || null,
      status: "draft",
    };
    // jobNumber is NOT NULL with no default — auto-generate when creating.
    if (!editingId) payload.jobNumber = `CS-${Date.now()}`;
    if (editingId) {
      await updateSheet.mutateAsync({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetsQueryKey() }); toast({ title: "Cost sheet updated" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error updating cost sheet", variant: "destructive" }),
      });
    } else {
      await createSheet.mutateAsync({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetsQueryKey() }); toast({ title: "Cost sheet created" }); setDialogOpen(false); setForm(emptyForm); },
        onError: () => toast({ title: "Error creating cost sheet", variant: "destructive" }),
      });
    }
  }

  async function handleDelete(id: number | string) {
    await deleteSheet.mutateAsync({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetsQueryKey() }); toast({ title: "Deleted" }); setDeleteId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <PageHeader title="Cost Sheets" description="Internal vendor costing">
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold" data-testid="button-create-cost-sheet">
          <Plus className="w-4 h-4" /> New Cost Sheet
        </Button>
      </PageHeader>

      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search by client or job…"
        totalCount={ctl.totalCount}
        filteredCount={ctl.filteredCount}
        hasActiveFilters={range !== "all"}
        onClearFilters={() => { setRange("all"); setCustomFrom(""); setCustomTo(""); ctl.clearFilters(); }}
      >
        <FilterSelect
          value={range}
          onChange={(v) => setRange(v as typeof range)}
          options={[
            { value: "30d", label: "Last 30 days" },
            { value: "60d", label: "Last 60 days" },
            { value: "90d", label: "Last 90 days" },
            { value: "custom", label: "Custom range" },
          ]}
          placeholder="All time"
        />
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-auto" data-testid="input-cost-sheet-from" />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-auto" data-testid="input-cost-sheet-to" />
            </div>
          </div>
        )}
      </TableToolbar>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : ctl.rows.length === 0 ? (
          <TableEmpty
            icon={FileSpreadsheet}
            title={ctl.totalCount === 0 ? "No cost sheets yet" : "No matches found"}
            description={ctl.totalCount === 0 ? "Create your first cost sheet to start costing." : "Try adjusting your search or filters."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <SortHeader label="Client (Company)" sortKey="client" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "client")} />
                  <SortHeader label="Job" sortKey="title" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "title")} className="hidden md:table-cell" />
                  <SortHeader label="Date" sortKey="createdAt" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "createdAt")} className="hidden lg:table-cell" />
                  <th className="px-3 py-2.5 w-24 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ctl.rows.map((s) => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors group" data-testid={`row-cost-sheet-${s.id}`}>
                    <td className="px-3 py-2.5">
                      <Link href={`/cost-sheets/${s.id}`} className="font-semibold text-foreground hover:text-primary transition-colors">{s.client || "—"}</Link>
                      {s.title && <div className="text-xs text-muted-foreground truncate max-w-[280px] md:hidden">{s.title}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-sm hidden md:table-cell truncate max-w-[280px]">{s.title || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs whitespace-nowrap hidden lg:table-cell">{(() => { const d = rowDate(s); return d ? format(d, "dd MMM yyyy") : "—"; })()}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <RowAction icon={Eye} label="View" href={`/cost-sheets/${s.id}`} />
                        <RowAction icon={Pencil} label="Edit" onClick={() => openEdit(s)} />
                        <RowAction icon={Trash2} label="Delete" destructive onClick={() => setDeleteId(s.id)} />
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
        <DialogContent>
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Cost Sheet" : "New Cost Sheet"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Company / Client *</Label>
              <Input value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} required placeholder="e.g. Bank Muscat" data-testid="input-cost-sheet-client" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Job Description *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="e.g. iCAUR Launch Event" data-testid="input-cost-sheet-title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="input-cost-sheet-date" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createSheet.isPending || updateSheet.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-cost-sheet">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Cost Sheet?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This will delete the cost sheet and all its items.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={deleteSheet.isPending} data-testid="button-confirm-delete-cost-sheet">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
