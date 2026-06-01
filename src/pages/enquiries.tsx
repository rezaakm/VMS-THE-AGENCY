import { useState } from "react";
import { useListEnquiries, useCreateEnquiry, useUpdateEnquiry, useDeleteEnquiry, getListEnquiriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronRight, Pencil } from "lucide-react";
import { useTableControls } from "@/hooks/use-table-controls";
import { TableToolbar, FilterSelect, SortHeader, Pagination } from "@/components/table-controls";

const STATUS_LABELS: Record<string, string> = {
  new: "New", in_progress: "In Progress", quoted: "Quoted", won: "Won", lost: "Lost",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-900/50 text-blue-300 border-blue-800",
  in_progress: "bg-blue-900/50 text-blue-300 border-blue-800",
  quoted: "bg-orange-900/50 text-orange-300 border-orange-800",
  won: "bg-green-900/50 text-green-300 border-green-800",
  lost: "bg-red-900/50 text-red-300 border-red-800",
};

type Status = "new" | "in_progress" | "quoted" | "won" | "lost";

interface FormData {
  clientName: string; clientCompany: string; clientEmail: string; clientPhone: string;
  subject: string; scopeOfWork: string; eventDate: string; status: Status;
}

const emptyForm: FormData = {
  clientName: "", clientCompany: "", clientEmail: "", clientPhone: "",
  subject: "", scopeOfWork: "", eventDate: "", status: "new",
};

const STATUS_ORDER: Record<string, number> = { new: 0, in_progress: 1, quoted: 2, won: 3, lost: 4 };

export default function Enquiries() {
  const { data: enquiries, isLoading } = useListEnquiries();
  const createEnquiry = useCreateEnquiry();
  const updateEnquiry = useUpdateEnquiry();
  const deleteEnquiry = useDeleteEnquiry();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const ctl = useTableControls<NonNullable<typeof enquiries>[0], "client" | "subject" | "eventDate" | "status", "status">({
    data: enquiries,
    searchFields: (e) => [e.clientName, e.clientCompany, e.subject, e.clientEmail, e.scopeOfWork],
    sortAccessors: {
      client: (e) => e.clientName,
      subject: (e) => e.subject,
      eventDate: (e) => e.eventDate ? new Date(e.eventDate) : null,
      status: (e) => STATUS_ORDER[e.status] ?? 99,
    },
    defaultSort: { key: "eventDate", dir: "desc" },
    filterAccessors: { status: (e) => e.status },
    pageSize: 25,
  });

  function openCreate() { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(e: NonNullable<typeof enquiries>[0]) {
    setEditingId(e.id);
    setForm({
      clientName: e.clientName, clientCompany: e.clientCompany ?? "", clientEmail: e.clientEmail ?? "", clientPhone: e.clientPhone ?? "",
      subject: e.subject, scopeOfWork: e.scopeOfWork ?? "", eventDate: e.eventDate ?? "", status: e.status as Status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    const payload = {
      ...form,
      clientCompany: form.clientCompany || null, clientEmail: form.clientEmail || null, clientPhone: form.clientPhone || null,
      scopeOfWork: form.scopeOfWork || null, eventDate: form.eventDate || null,
    };
    if (editingId) {
      await updateEnquiry.mutateAsync({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() }); toast({ title: "Enquiry updated" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error updating enquiry", variant: "destructive" }),
      });
    } else {
      await createEnquiry.mutateAsync({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() }); toast({ title: "Enquiry created" }); setDialogOpen(false); setForm(emptyForm); },
        onError: () => toast({ title: "Error creating enquiry", variant: "destructive" }),
      });
    }
  }

  async function handleDelete(id: number) {
    await deleteEnquiry.mutateAsync({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() }); toast({ title: "Enquiry deleted" }); setDeleteConfirmId(null); },
      onError: () => toast({ title: "Error deleting enquiry", variant: "destructive" }),
    });
  }

  async function quickSetStatus(id: number, status: Status) {
    await updateEnquiry.mutateAsync({ id, data: { status } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() }); toast({ title: `Marked ${STATUS_LABELS[status]}` }); },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  }

  const hasFilters = !!ctl.filters.status && ctl.filters.status !== "all";

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" data-testid="text-enquiries-title">Enquiries</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Client Pipeline</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-create-enquiry">
          <Plus className="w-4 h-4" /> New Enquiry
        </Button>
      </div>

      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search by client, subject, scope…"
        totalCount={ctl.totalCount}
        filteredCount={ctl.filteredCount}
        hasActiveFilters={hasFilters}
        onClearFilters={ctl.clearFilters}
      >
        <FilterSelect
          value={ctl.filters.status}
          onChange={(v) => ctl.setFilter("status", v)}
          options={Object.entries(STATUS_LABELS).map(([k, l]) => ({ value: k, label: l }))}
          placeholder="All statuses"
        />
      </TableToolbar>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : ctl.rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">{ctl.totalCount === 0 ? "No enquiries yet. Create one above." : "No matches found."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border">
                <SortHeader label="Client" sortKey="client" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "client")} />
                <SortHeader label="Subject" sortKey="subject" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "subject")} className="hidden md:table-cell" />
                <SortHeader label="Event Date" sortKey="eventDate" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "eventDate")} className="hidden lg:table-cell" />
                <SortHeader label="Status" sortKey="status" current={ctl.sort} onToggle={(k) => ctl.toggleSort(k as "status")} />
                <th className="px-6 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {ctl.rows.map((e) => (
                <tr key={e.id} className="border-b border-card-border/50 hover:bg-accent/20 transition-colors" data-testid={`row-enquiry-${e.id}`}>
                  <td className="px-6 py-4">
                    <Link href={`/enquiries/${e.id}`} className="hover:text-primary transition-colors">
                      <div className="font-semibold text-foreground">{e.clientName}</div>
                      {e.clientCompany && <div className="text-xs text-muted-foreground mt-0.5">{e.clientCompany}</div>}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground hidden md:table-cell max-w-[220px] truncate">{e.subject}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs hidden lg:table-cell">{e.eventDate ?? "—"}</td>
                  <td className="px-6 py-4">
                    <Select value={e.status} onValueChange={(v) => quickSetStatus(e.id, v as Status)}>
                      <SelectTrigger className={`h-7 px-2 py-1 text-xs font-medium border ${STATUS_COLORS[e.status] ?? ""}`} data-testid={`select-status-${e.id}`}>
                        <SelectValue>{STATUS_LABELS[e.status] ?? e.status}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Link href={`/enquiries/${e.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-view-enquiry-${e.id}`}><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} data-testid={`button-edit-enquiry-${e.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(e.id)} data-testid={`button-delete-enquiry-${e.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={ctl.page} totalPages={ctl.totalPages} onPage={ctl.setPage} pageSize={ctl.pageSize} onPageSize={ctl.setPageSize} filteredCount={ctl.filteredCount} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingId ? "Edit Enquiry" : "New Enquiry"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Client Name *</Label><Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} required data-testid="input-enquiry-client-name" /></div>
              <div className="flex flex-col gap-1.5"><Label>Company</Label><Input value={form.clientCompany} onChange={(e) => setForm((f) => ({ ...f, clientCompany: e.target.value }))} data-testid="input-enquiry-company" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Email</Label><Input type="email" value={form.clientEmail} onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))} data-testid="input-enquiry-email" /></div>
              <div className="flex flex-col gap-1.5"><Label>Phone</Label><Input value={form.clientPhone} onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))} data-testid="input-enquiry-phone" /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required data-testid="input-enquiry-subject" /></div>
            <div className="flex flex-col gap-1.5"><Label>Scope of Work</Label><Textarea rows={3} value={form.scopeOfWork} onChange={(e) => setForm((f) => ({ ...f, scopeOfWork: e.target.value }))} data-testid="input-enquiry-scope" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><Label>Event Date</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} data-testid="input-enquiry-event-date" /></div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}>
                  <SelectTrigger data-testid="select-enquiry-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEnquiry.isPending || updateEnquiry.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-enquiry">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Enquiry?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This will permanently delete the enquiry.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteEnquiry.isPending} data-testid="button-confirm-delete-enquiry">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
