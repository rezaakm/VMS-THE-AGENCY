import { useState } from "react";
import { useListCostSheets, useCreateCostSheet, useUpdateCostSheet, useDeleteCostSheet, getListCostSheetsQueryKey, useListEnquiries } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, Pencil, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useTableControls } from "@/hooks/use-table-controls";
import { TableToolbar, FilterSelect, SortHeader, Pagination, RowAction, TableSkeleton, TableEmpty } from "@/components/table-controls";

interface FormData { title: string; enquiryId: string; notes: string; }
const emptyForm: FormData = { title: "", enquiryId: "", notes: "" };

export default function CostSheets() {
  const { data: sheets, isLoading } = useListCostSheets();
  const { data: enquiries } = useListEnquiries();
  const createSheet = useCreateCostSheet();
  const updateSheet = useUpdateCostSheet();
  const deleteSheet = useDeleteCostSheet();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const enquiryMap = Object.fromEntries((enquiries ?? []).map((e) => [e.id, e.clientName + (e.clientCompany ? ` — ${e.clientCompany}` : "")]));

  const ctl = useTableControls<NonNullable<typeof sheets>[0], "title" | "createdAt" | "enquiry", "linked">({
    data: sheets,
    searchFields: (s) => [s.title, s.notes, s.enquiryId ? enquiryMap[s.enquiryId] : null],
    sortAccessors: {
      title: (s) => s.title,
      createdAt: (s) => new Date(s.createdAt),
      enquiry: (s) => s.enquiryId ? (enquiryMap[s.enquiryId] ?? "") : "",
    },
    defaultSort: { key: "createdAt", dir: "desc" },
    filterAccessors: { linked: (s) => s.enquiryId ? "yes" : "no" },
    pageSize: 25,
  });

  function openCreate() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(s: NonNullable<typeof sheets>[0]) {
    setEditingId(s.id);
    setForm({ title: s.title, enquiryId: s.enquiryId ? String(s.enquiryId) : "", notes: s.notes ?? "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { title: form.title, enquiryId: form.enquiryId ? parseInt(form.enquiryId, 10) : null, notes: form.notes || null };
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

  async function handleDelete(id: number) {
    await deleteSheet.mutateAsync({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetsQueryKey() }); toast({ title: "Deleted" }); setDeleteId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const hasFilters = !!ctl.filters.linked && ctl.filters.linked !== "all";

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
        searchPlaceholder="Search by title, notes or client…"
        totalCount={ctl.totalCount}
        filteredCount={ctl.filteredCount}
        hasActiveFilters={hasFilters}
        onClearFilters={ctl.clearFilters}
      >
        <FilterSelect
          value={ctl.filters.linked}
          onChange={(v) => ctl.setFilter("linked", v)}
          options={[{ value: "yes", label: "Linked to enquiry" }, { value: "no", label: "Not linked" }]}
          placeholder="All sheets"
        />
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
                  <SortHeader label="Title" sortKey="title" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "title")} />
                  <SortHeader label="Linked Enquiry" sortKey="enquiry" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "enquiry")} className="hidden md:table-cell" />
                  <SortHeader label="Created" sortKey="createdAt" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "createdAt")} className="hidden lg:table-cell" />
                  <th className="px-3 py-2.5 w-24 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ctl.rows.map((s) => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors group" data-testid={`row-cost-sheet-${s.id}`}>
                    <td className="px-3 py-2.5">
                      <Link href={`/cost-sheets/${s.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{s.title}</Link>
                      {s.notes && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{s.notes}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-sm hidden md:table-cell">
                      {s.enquiryId && enquiryMap[s.enquiryId] ? (
                        <Link href={`/enquiries/${s.enquiryId}`} className="hover:text-primary transition-colors">{enquiryMap[s.enquiryId]}</Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs whitespace-nowrap hidden lg:table-cell">{new Date(s.createdAt).toLocaleDateString()}</td>
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
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="e.g. iCAUR Launch — Cost Sheet" data-testid="input-cost-sheet-title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Link to Enquiry</Label>
              <Select value={form.enquiryId} onValueChange={(v) => setForm((f) => ({ ...f, enquiryId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-cost-sheet-enquiry"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(enquiries ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.clientName} — {e.subject}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-cost-sheet-notes" />
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
