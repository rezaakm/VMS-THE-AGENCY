import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle, XCircle, FileSpreadsheet, FileText, AlertTriangle,
  ChevronRight, Wand2, Send, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatOMR } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  computeLineConfidence,
  computeSheetConfidence,
  CONFIDENCE_COLORS,
  CONFIDENCE_DOT_COLORS,
  type ConfidenceBucket,
} from "@/lib/confidence";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/* ─── Data hooks ─── */

function usePipelineEnquiries() {
  return useQuery({
    queryKey: ["pipeline-enquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .in("status", ["new", "in_progress", "drafting", "approved", "quoted"])
        .order("createdAt", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useDraftCostSheets() {
  return useQuery({
    queryKey: ["pipeline-cost-sheets"],
    queryFn: async () => {
      // Get cost sheets that are drafts or pending approval
      const { data: sheets, error } = await supabase
        .from("cost_sheets")
        .select("*")
        .in("status", ["draft", "approved", "rejected"])
        .order("createdAt", { ascending: false });
      if (error) throw error;

      // For each sheet, get its items
      const results = [];
      for (const sheet of sheets ?? []) {
        const { data: items } = await supabase
          .from("cost_sheet_items")
          .select("*")
          .eq("costSheetId", sheet.id)
          .order("itemNumber", { ascending: true });

        const lineItems = (items ?? []).map((item) => {
          const conf = computeLineConfidence(item.match_type, item.confidence);
          const total = r3((item.totalSellingPrice ?? item.totalCost ?? 0));
          return { ...item, conf, total };
        });

        const sheetConfidence = computeSheetConfidence(
          lineItems.map((l) => ({ total: l.total, confidence: l.conf.score }))
        );

        results.push({ ...sheet, items: lineItems, sheetConfidence });
      }

      return results;
    },
  });
}

/* ─── Build cost sheet from enquiry ─── */

function useBuildCostSheet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enquiry: any) => {
      // Parse description into candidate line items (split by newline/semicolon/bullet)
      const desc = enquiry.description || enquiry.scopeOfWork || enquiry.title || "";
      const rawLines = desc
        .split(/[\n;•·\-]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 3);

      if (rawLines.length === 0) {
        rawLines.push(enquiry.title || "Service item");
      }

      // Create draft cost sheet
      const { data: sheet, error: sheetErr } = await supabase
        .from("cost_sheets")
        .insert({
          jobNumber: enquiry.enquiryNumber || `ENQ-${enquiry.id}`,
          client: enquiry.client || enquiry.clientName || "",
          event: enquiry.title || "",
          date: new Date().toISOString().slice(0, 10),
          status: "draft",
          enquiry_id: enquiry.id,
        })
        .select()
        .single();
      if (sheetErr) throw sheetErr;

      // For each line, call match_pricing and create cost_sheet_items
      const items = [];
      for (let i = 0; i < rawLines.length; i++) {
        const q = rawLines[i];
        const { data: matches } = await supabase.rpc("match_pricing", { q });
        const best = matches?.[0];

        const conf = computeLineConfidence(best?.match_type, best?.score);
        const cost = best ? r3(best.typical_cost ?? best.typical_sell ?? 0) : 0;
        const sell = best ? r3(best.typical_sell ?? best.typical_cost ?? 0) : 0;

        const { data: item, error: itemErr } = await supabase
          .from("cost_sheet_items")
          .insert({
            costSheetId: sheet.id,
            itemNumber: i + 1,
            description: best?.item_label || q,
            vendor: best?.usual_vendor || "",
            days: 1,
            unitCost: cost,
            totalCost: cost,
            unitSellingPrice: sell,
            totalSellingPrice: sell,
            match_type: best?.match_type || null,
            confidence: conf.score,
            price_source: best ? `history:${best.match_type}` : "manual",
          })
          .select()
          .single();
        if (!itemErr && item) items.push(item);
      }

      // Update enquiry status
      await supabase
        .from("enquiries")
        .update({ status: "drafting" })
        .eq("id", enquiry.id);

      return { sheet, items };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cost-sheets"] });
      toast({ title: "Draft cost sheet created", description: "Review and approve the pricing." });
    },
    onError: (err: any) => {
      toast({ title: "Error building cost sheet", description: err.message, variant: "destructive" });
    },
  });
}

/* ─── Approve / Reject cost sheet ─── */

function useApproveCostSheet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sheetId, action }: { sheetId: number; action: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("cost_sheets")
        .update({
          status: action,
          approved_by: "reza",
          approved_at: new Date().toISOString(),
        })
        .eq("id", sheetId);
      if (error) throw error;

      if (action === "approved") {
        // Get the sheet + items to create a quotation
        const { data: sheet } = await supabase
          .from("cost_sheets")
          .select("*")
          .eq("id", sheetId)
          .single();
        const { data: items } = await supabase
          .from("cost_sheet_items")
          .select("*")
          .eq("costSheetId", sheetId)
          .order("itemNumber", { ascending: true });

        if (sheet && items) {
          const subtotal = r3((items ?? []).reduce((s, it) => s + (it.totalSellingPrice ?? 0), 0));
          const taxAmount = r3(subtotal * 0.05);
          const totalAmount = r3(subtotal + taxAmount);

          const { data: quotation, error: qErr } = await supabase
            .from("quotations")
            .insert({
              quotationNumber: sheet.jobNumber,
              client: sheet.client,
              title: sheet.event,
              status: "draft",
              subtotal,
              taxAmount,
              totalAmount,
              notes: `Auto-generated from cost sheet #${sheetId}`,
              cost_sheet_id: sheetId,
            })
            .select()
            .single();
          if (qErr) throw qErr;

          // Create quotation items
          for (const item of items ?? []) {
            await supabase.from("quotation_items").insert({
              quotationId: quotation.id,
              itemNumber: item.itemNumber,
              description: item.description,
              quantity: item.days ?? 1,
              unitPrice: item.unitSellingPrice ?? 0,
              totalPrice: item.totalSellingPrice ?? 0,
            });
          }

          // Update enquiry status if linked
          if (sheet.enquiry_id) {
            await supabase
              .from("enquiries")
              .update({ status: "quoted" })
              .eq("id", sheet.enquiry_id);
          }

          return { quotation };
        }
      }

      return { quotation: null };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-cost-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      if (vars.action === "approved" && data.quotation) {
        toast({ title: "Approved — Quotation created", description: `Quotation #${data.quotation.id} is ready.` });
      } else if (vars.action === "rejected") {
        toast({ title: "Cost sheet rejected" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

/* ─── Page ─── */

export default function Pipeline() {
  const enquiriesQ = usePipelineEnquiries();
  const sheetsQ = useDraftCostSheets();
  const buildMutation = useBuildCostSheet();
  const approveMutation = useApproveCostSheet();
  const [reviewSheet, setReviewSheet] = useState<any | null>(null);

  const newEnquiries = (enquiriesQ.data ?? []).filter((e) => e.status === "new");
  const draftSheets = (sheetsQ.data ?? []).filter((s) => s.status === "draft");
  const approvedSheets = (sheetsQ.data ?? []).filter((s) => s.status === "approved");

  const confBucket = (score: number): ConfidenceBucket =>
    score >= 80 ? "high" : score >= 50 ? "medium" : score > 0 ? "low" : "none";

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <PageHeader
        title="Quote Pipeline"
        description="Enquiry to quotation automation"
      />

      {/* Pipeline Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-blue-400">{newEnquiries.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">New Enquiries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-amber-400">{draftSheets.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Drafts to Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-400">{approvedSheets.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Approved / Quoted</div>
          </CardContent>
        </Card>
      </div>

      {/* Stage 1: New Enquiries → Build */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            New Enquiries — Ready to Build
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enquiriesQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : newEnquiries.length === 0 ? (
            <EmptyState icon={FileText} title="No new enquiries" description="New enquiries will appear here for auto-pricing" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enquiry</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newEnquiries.map((enq) => (
                    <TableRow key={enq.id}>
                      <TableCell className="font-mono text-xs">{enq.enquiryNumber || `#${enq.id}`}</TableCell>
                      <TableCell className="font-medium">{enq.client || enq.clientName || "—"}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{enq.title || enq.subject || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{enq.source || "manual"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => buildMutation.mutate(enq)}
                          disabled={buildMutation.isPending}
                          className="text-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                          {buildMutation.isPending ? "Building..." : "Build Cost Sheet"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage 2: Draft Cost Sheets → Review & Approve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            Draft Cost Sheets — Review & Approve
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sheetsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : draftSheets.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No drafts pending" description="Build from an enquiry above to create a draft" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftSheets.map((sheet) => {
                    const bucket = confBucket(sheet.sheetConfidence);
                    const hasZero = sheet.items.some((it: any) => it.conf.score === 0 && (it.unitCost ?? 0) === 0);
                    return (
                      <TableRow key={sheet.id}>
                        <TableCell className="font-mono text-xs">{sheet.jobNumber}</TableCell>
                        <TableCell className="font-medium">{sheet.client || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{sheet.event || "—"}</TableCell>
                        <TableCell>{sheet.items.length}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_COLORS[bucket]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT_COLORS[bucket]}`} />
                            {sheet.sheetConfidence}%
                          </span>
                          {hasZero && <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline ml-1.5" />}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReviewSheet(sheet)} className="text-xs">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Review
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate({ sheetId: sheet.id, action: "approved" })}
                              disabled={approveMutation.isPending || hasZero}
                              className="text-xs bg-emerald-600 hover:bg-emerald-500"
                              title={hasZero ? "Price all lines before approving" : "Approve and generate quotation"}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => approveMutation.mutate({ sheetId: sheet.id, action: "rejected" })}
                              disabled={approveMutation.isPending}
                              className="text-xs"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage 3: Approved — Quotations ready */}
      {approvedSheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              Approved — Quotations Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedSheets.map((sheet) => (
                    <TableRow key={sheet.id}>
                      <TableCell className="font-mono text-xs">{sheet.jobNumber}</TableCell>
                      <TableCell className="font-medium">{sheet.client || "—"}</TableCell>
                      <TableCell>{sheet.event || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-[10px]">{sheet.sheetConfidence}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href="/quotations">
                          <Button size="sm" variant="outline" className="text-xs">
                            <FileText className="w-3.5 h-3.5 mr-1" /> View Quotation
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewSheet} onOpenChange={() => setReviewSheet(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review: {reviewSheet?.jobNumber} — {reviewSheet?.client}</DialogTitle>
          </DialogHeader>
          {reviewSheet && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Sheet Confidence:</span>
                {(() => {
                  const bucket = confBucket(reviewSheet.sheetConfidence);
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${CONFIDENCE_COLORS[bucket]}`}>
                      <span className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT_COLORS[bucket]}`} />
                      {reviewSheet.sheetConfidence}%
                    </span>
                  );
                })()}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewSheet.items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{item.itemNumber}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.description}</TableCell>
                      <TableCell className="text-sm">{item.vendor || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatOMR(item.unitCost)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatOMR(item.unitSellingPrice)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_COLORS[item.conf.bucket]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT_COLORS[item.conf.bucket]}`} />
                          {item.conf.score}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewSheet(null)}>Close</Button>
            {reviewSheet?.status === "draft" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => { approveMutation.mutate({ sheetId: reviewSheet.id, action: "rejected" }); setReviewSheet(null); }}
                >
                  Reject
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500"
                  disabled={reviewSheet.items.some((it: any) => it.conf.score === 0 && (it.unitCost ?? 0) === 0)}
                  onClick={() => { approveMutation.mutate({ sheetId: reviewSheet.id, action: "approved" }); setReviewSheet(null); }}
                >
                  Approve & Generate Quote
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
