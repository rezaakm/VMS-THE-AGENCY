import { useState, useMemo } from "react";
import { useListVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, getListVendorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Phone, Mail, Tag, Building2, LayoutGrid, List } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { useTableControls } from "@/hooks/use-table-controls";
import { TableToolbar, FilterSelect, SortHeader, Pagination, RowAction, TableEmpty } from "@/components/table-controls";

interface VendorFormData {
  name: string; company: string; email: string; phone: string; specialty: string; notes: string;
}

const emptyForm: VendorFormData = { name: "", company: "", email: "", phone: "", specialty: "", notes: "" };

export default function Vendors() {
  const { data: vendors, isLoading } = useListVendors();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VendorFormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: "", company: "", phone: "", specialty: "" });
  const [view, setView] = useState<"grid" | "list">("grid");


  const specialtyOptions = useMemo(() => {
    const set = new Set<string>();
    (vendors ?? []).forEach(v => { if (v.specialty) set.add(v.specialty); });
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [vendors]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    (vendors ?? []).forEach(v => { if (v.status) set.add(v.status); });
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [vendors]);

  const ctl = useTableControls<NonNullable<typeof vendors>[0], "name" | "company" | "specialty", "specialty" | "status">({
    data: vendors,
    searchFields: (v) => [v.name, v.company, v.specialty, v.email, v.phone],
    sortAccessors: { name: (v) => v.name, company: (v) => v.company, specialty: (v) => v.specialty },
    defaultSort: { key: "name", dir: "asc" },
    filterAccessors: { specialty: (v) => v.specialty, status: (v) => v.status },
    pageSize: 24,
  });

  function openCreate() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(v: NonNullable<typeof vendors>[0]) {
    setEditingId(v.id);
    setForm({ name: v.name, company: v.company, email: v.email ?? "", phone: v.phone ?? "", specialty: v.specialty ?? "", notes: v.notes ?? "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, email: form.email || null, phone: form.phone || null, specialty: form.specialty || null, notes: form.notes || null };
    if (editingId) {
      await updateVendor.mutateAsync({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() }); toast({ title: "Vendor updated" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error updating vendor", variant: "destructive" }),
      });
    } else {
      await createVendor.mutateAsync({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() }); toast({ title: "Vendor created" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error creating vendor", variant: "destructive" }),
      });
    }
  }

  async function handleDelete(id: number) {
    await deleteVendor.mutateAsync({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() }); toast({ title: "Vendor deleted" }); setDeleteConfirmId(null); },
      onError: () => toast({ title: "Error deleting vendor", variant: "destructive" }),
    });
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickForm.name.trim() || !quickForm.company.trim()) return;
    await createVendor.mutateAsync({
      data: { name: quickForm.name.trim(), company: quickForm.company.trim(), phone: quickForm.phone.trim() || null, specialty: quickForm.specialty.trim() || null, email: null, notes: null }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        toast({ title: "Vendor added" });
        setQuickForm({ name: "", company: "", phone: "", specialty: "" });
        setQuickAddOpen(false);
      },
      onError: () => toast({ title: "Error adding vendor", variant: "destructive" }),
    });
  }

  const hasFilters =
    (!!ctl.filters.specialty && ctl.filters.specialty !== "all") ||
    (!!ctl.filters.status && ctl.filters.status !== "all");

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <PageHeader title="Vendors" description="Supplier contact directory">
        <Button variant="outline" size="sm" onClick={() => { setQuickAddOpen((o) => !o); setQuickForm({ name: "", company: "", phone: "", specialty: "" }); }} className="gap-1.5 text-xs font-semibold" data-testid="button-quick-add-vendor">
          <Plus className="w-4 h-4" /> Quick Add
        </Button>
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold" data-testid="button-create-vendor">
          <Plus className="w-4 h-4" /> Full Form
        </Button>
      </PageHeader>

      {quickAddOpen && (
        <form onSubmit={handleQuickAdd} className="bg-card border border-primary/30 rounded-lg p-4 animate-in fade-in duration-150">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Quick Add Vendor</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="flex flex-col gap-1"><label className="text-xs text-muted-foreground">Name *</label><Input placeholder="Contact name" value={quickForm.name} onChange={(e) => setQuickForm((f) => ({ ...f, name: e.target.value }))} required autoFocus data-testid="input-quick-vendor-name" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs text-muted-foreground">Company *</label><Input placeholder="Company name" value={quickForm.company} onChange={(e) => setQuickForm((f) => ({ ...f, company: e.target.value }))} required data-testid="input-quick-vendor-company" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs text-muted-foreground">Phone</label><Input placeholder="+968 ..." value={quickForm.phone} onChange={(e) => setQuickForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-quick-vendor-phone" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs text-muted-foreground">Specialty</label><Input placeholder="e.g. Audio Visual" value={quickForm.specialty} onChange={(e) => setQuickForm((f) => ({ ...f, specialty: e.target.value }))} data-testid="input-quick-vendor-specialty" /></div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={createVendor.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold gap-2" data-testid="button-submit-quick-vendor"><Plus className="w-3.5 h-3.5" /> {createVendor.isPending ? "Saving…" : "Save Vendor"}</Button>
            <Button type="button" variant="ghost" onClick={() => setQuickAddOpen(false)} className="uppercase tracking-wider text-xs">Cancel</Button>
          </div>
        </form>
      )}

      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search by name, company, specialty, email…"
        totalCount={ctl.totalCount}
        filteredCount={ctl.filteredCount}
        hasActiveFilters={hasFilters}
        onClearFilters={ctl.clearFilters}
        rightSlot={
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button type="button" onClick={() => { setView("grid"); if (!ctl.sort) ctl.setSort({ key: "name", dir: "asc" }); }} aria-label="Grid view" aria-pressed={view === "grid"} className={`px-2.5 py-2 ${view === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} data-testid="button-view-grid" title="Grid view"><LayoutGrid aria-hidden="true" className="w-4 h-4" /></button>
            <button type="button" onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"} className={`px-2.5 py-2 ${view === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} data-testid="button-view-list" title="List view"><List aria-hidden="true" className="w-4 h-4" /></button>
          </div>
        }
      >
        <FilterSelect value={ctl.filters.specialty} onChange={(v) => ctl.setFilter("specialty", v)} options={specialtyOptions} placeholder="All specialties" />
        {statusOptions.length > 0 && (
          <FilterSelect value={ctl.filters.status} onChange={(v) => ctl.setFilter("status", v)} options={statusOptions} placeholder="All statuses" />
        )}
        {view === "grid" && (
          <Select
            value={ctl.sort ? `${ctl.sort.key}:${ctl.sort.dir}` : "name:asc"}
            onValueChange={(v) => {
              const [key, dir] = v.split(":") as ["name" | "company" | "specialty", "asc" | "desc"];
              ctl.setSort({ key, dir });
            }}
          >
            <SelectTrigger className="w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name:asc">Name A→Z</SelectItem>
              <SelectItem value="name:desc">Name Z→A</SelectItem>
              <SelectItem value="company:asc">Company A→Z</SelectItem>
              <SelectItem value="company:desc">Company Z→A</SelectItem>
              <SelectItem value="specialty:asc">Specialty A→Z</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableToolbar>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      ) : ctl.rows.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg">
          <TableEmpty
            icon={Building2}
            title={ctl.totalCount === 0 ? "No vendors yet" : "No matches found"}
            description={ctl.totalCount === 0 ? "Add a vendor to get started." : "Try adjusting your search or filters."}
          />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ctl.rows.map((v) => (
            <div key={v.id} className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors" data-testid={`card-vendor-${v.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground text-base">{v.name}</div>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5"><Building2 className="w-3 h-3" />{v.company}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)} data-testid={`button-edit-vendor-${v.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(v.id)} data-testid={`button-delete-vendor-${v.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {v.specialty && <div className="flex items-center gap-1.5 text-xs text-primary"><Tag className="w-3 h-3" />{v.specialty}</div>}
              <div className="flex flex-col gap-1.5 text-sm">
                {v.phone && <a href={`tel:${v.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"><Phone className="w-3.5 h-3.5" /> {v.phone}</a>}
                {v.email && <a href={`mailto:${v.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors truncate"><Mail className="w-3.5 h-3.5" /> {v.email}</a>}
              </div>
              {v.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{v.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <SortHeader label="Name" sortKey="name" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "name")} />
                  <SortHeader label="Company" sortKey="company" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "company")} />
                  <SortHeader label="Specialty" sortKey="specialty" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "specialty")} className="hidden md:table-cell" />
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Contact</th>
                  <th className="px-3 py-2.5 w-20 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ctl.rows.map((v) => (
                  <tr key={v.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors group" data-testid={`row-vendor-${v.id}`}>
                    <td className="px-3 py-2.5 font-medium text-foreground">{v.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{v.company}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell">{v.specialty && <span className="text-primary text-xs">{v.specialty}</span>}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden lg:table-cell">
                      {v.phone && <div>{v.phone}</div>}
                      {v.email && <div className="truncate max-w-[180px]">{v.email}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <RowAction icon={Pencil} label="Edit" onClick={() => openEdit(v)} />
                        <RowAction icon={Trash2} label="Delete" destructive onClick={() => setDeleteConfirmId(v.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={ctl.page} totalPages={ctl.totalPages} onPage={ctl.setPage} pageSize={ctl.pageSize} onPageSize={ctl.setPageSize} filteredCount={ctl.filteredCount} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="name">Name *</Label><Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required data-testid="input-vendor-name" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="company">Company *</Label><Input id="company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} required data-testid="input-vendor-company" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-vendor-email" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-vendor-phone" /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="specialty">Specialty</Label><Input id="specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="e.g. Audio Visual, Catering, Fabrication" data-testid="input-vendor-specialty" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} data-testid="input-vendor-notes" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-vendor">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Vendor?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteVendor.isPending} data-testid="button-confirm-delete-vendor">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
