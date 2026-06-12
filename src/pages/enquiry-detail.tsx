import { useParams, Link, useLocation } from "wouter";
import { useGetEnquiry, useUpdateEnquiry, useListCostSheets, useListQuotations, getGetEnquiryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileSpreadsheet, FileText, Plus } from "lucide-react";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = { new: "New", in_progress: "In Progress", quoted: "Quoted", won: "Won", lost: "Lost" };
const STATUS_COLORS: Record<string, string> = {
  new: "text-blue-300", in_progress: "text-blue-400", quoted: "text-orange-400", won: "text-green-400", lost: "text-red-400",
};

export default function EnquiryDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { data: enquiry, isLoading } = useGetEnquiry(id, { query: { enabled: !!id, queryKey: getGetEnquiryQueryKey(id) } });
  const { data: costSheets } = useListCostSheets({ enquiryId: id });
  const { data: quotations } = useListQuotations();
  const updateEnquiry = useUpdateEnquiry();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const linkedQuotations = (quotations ?? []).filter((q) => q.enquiryId === id);

  async function handleStatusChange(status: string) {
    setUpdatingStatus(true);
    await updateEnquiry.mutateAsync({ id, data: { status: status as "new" | "in_progress" | "quoted" | "won" | "lost" } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetEnquiryQueryKey(id) }); toast({ title: "Status updated" }); },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
    });
    setUpdatingStatus(false);
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (!enquiry) {
    return <div className="text-muted-foreground py-20 text-center">Enquiry not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/enquiries")} data-testid="button-back-enquiries">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight" data-testid="text-enquiry-name">{enquiry.clientName}</h1>
          {enquiry.clientCompany && <p className="text-muted-foreground text-sm">{enquiry.clientCompany}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Enquiry Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Subject</dt>
                <dd className="text-sm text-foreground font-medium" data-testid="text-enquiry-subject">{enquiry.subject}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Event Date</dt>
                <dd className="text-sm text-foreground font-mono">{enquiry.eventDate ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</dt>
                <dd className="text-sm text-foreground">{enquiry.clientEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</dt>
                <dd className="text-sm text-foreground">{enquiry.clientPhone ?? "—"}</dd>
              </div>
              {enquiry.scopeOfWork && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Scope of Work</dt>
                  <dd className="text-sm text-foreground whitespace-pre-wrap">{enquiry.scopeOfWork}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Cost Sheets */}
          <div className="bg-card border border-card-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Cost Sheets</h2>
              <Link href={`/cost-sheets`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs uppercase tracking-wider text-primary" data-testid="button-new-cost-sheet">
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </Link>
            </div>
            {!costSheets || costSheets.length === 0 ? (
              <p className="text-muted-foreground text-sm">No cost sheets linked yet.</p>
            ) : (
              <div className="space-y-2">
                {costSheets.map((cs) => (
                  <Link key={cs.id} href={`/cost-sheets/${cs.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/30 transition-colors cursor-pointer" data-testid={`link-cost-sheet-${cs.id}`}>
                      <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{cs.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quotations */}
          <div className="bg-card border border-card-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Quotations</h2>
              <Link href="/quotations">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs uppercase tracking-wider text-primary" data-testid="button-new-quotation">
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </Link>
            </div>
            {linkedQuotations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No quotations linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedQuotations.map((q) => (
                  <Link key={q.id} href={`/quotations/${q.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/30 transition-colors cursor-pointer" data-testid={`link-quotation-${q.id}`}>
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-foreground">{q.serialNumber}</span>
                        <span className="text-xs text-muted-foreground ml-2">{q.subject}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status sidebar */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Status</h2>
            <div className={`text-lg font-bold uppercase tracking-wider mb-4 ${STATUS_COLORS[enquiry.status]}`} data-testid="text-enquiry-status">
              {STATUS_LABELS[enquiry.status] ?? enquiry.status}
            </div>
            <Select value={enquiry.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger data-testid="select-enquiry-status-update"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-6 text-xs text-muted-foreground space-y-2">
            <div>Created <span className="text-foreground font-mono">{new Date(enquiry.createdAt).toLocaleDateString()}</span></div>
            <div>Updated <span className="text-foreground font-mono">{new Date(enquiry.updatedAt).toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
