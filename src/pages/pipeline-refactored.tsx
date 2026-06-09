import { useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle, XCircle, FileSpreadsheet, FileText, AlertTriangle,
  Wand2, Send, Eye,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PipelineStatsCards } from "@/components/pipeline/pipeline-stats-cards";
import { ConfidenceBadge } from "@/components/pipeline/confidence-badge";
import {
  usePipelineStats,
  useBuildCostSheet,
  useApproveCostSheet,
  useSendQuotation,
} from "@/hooks/use-pipeline";
import type { Enquiry, CostSheet } from "@/services/pipeline-service";

export default function Pipeline() {
  const {
    newEnquiries,
    draftSheets,
    approvedSheets,
    counts,
    isLoading,
  } = usePipelineStats();

  const buildMutation = useBuildCostSheet();
  const approveMutation = useApproveCostSheet();
  const sendMutation = useSendQuotation();

  const [reviewSheet, setReviewSheet] = useState<CostSheet | null>(null);
  const [sendSheet, setSendSheet] = useState<CostSheet | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendOwner, setSendOwner] = useState("");

  const handleBuildCostSheet = (enquiry: Enquiry) => {
    buildMutation.mutate({ enquiry });
  };

  const handleApproval = (sheetId: string, action: 'approved' | 'rejected') => {
    approveMutation.mutate({ sheetId, action });
  };

  const handleSendQuotation = () => {
    if (!sendSheet || !sendEmail) return;

    sendMutation.mutate({
      sheet: sendSheet,
      email: sendEmail,
      accountOwner: sendOwner,
    });
    setSendSheet(null);
    setSendEmail("");
    setSendOwner("");
  };

  const hasZeroConfidenceLines = (sheet: CostSheet) =>
    sheet.items.some((item) => item.confidence === 0 && (item.unitCost ?? 0) === 0);

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-5 sm:gap-8 animate-in fade-in duration-300">
        <PageHeader
          title="Quote Pipeline"
          description="Enquiry to quotation automation"
        />

        {/* Pipeline Stats */}
        <PipelineStatsCards
          newEnquiries={counts.newEnquiries}
          draftSheets={counts.draftSheets}
          approvedSheets={counts.approvedSheets}
        />

        {/* Stage 1: New Enquiries */}
        <NewEnquiriesSection
          enquiries={newEnquiries}
          isLoading={isLoading}
          onBuildCostSheet={handleBuildCostSheet}
          buildMutation={buildMutation}
        />

        {/* Stage 2: Draft Cost Sheets */}
        <DraftCostSheetsSection
          sheets={draftSheets}
          isLoading={isLoading}
          onReview={setReviewSheet}
          onApproval={handleApproval}
          approveMutation={approveMutation}
          hasZeroConfidenceLines={hasZeroConfidenceLines}
        />

        {/* Stage 3: Approved Sheets */}
        <ApprovedSheetsSection
          sheets={approvedSheets}
          onSend={setSendSheet}
        />

        {/* Review Dialog */}
        <ReviewDialog
          sheet={reviewSheet}
          onClose={() => setReviewSheet(null)}
          onApproval={handleApproval}
          approveMutation={approveMutation}
          hasZeroConfidenceLines={hasZeroConfidenceLines}
        />

        {/* Send Dialog */}
        <SendDialog
          sheet={sendSheet}
          email={sendEmail}
          owner={sendOwner}
          onEmailChange={setSendEmail}
          onOwnerChange={setSendOwner}
          onSend={handleSendQuotation}
          onClose={() => setSendSheet(null)}
          sendMutation={sendMutation}
        />
      </div>
    </ErrorBoundary>
  );
}

// Section Components

function NewEnquiriesSection({
  enquiries,
  isLoading,
  onBuildCostSheet,
  buildMutation,
}: {
  enquiries: Enquiry[];
  isLoading: boolean;
  onBuildCostSheet: (enquiry: Enquiry) => void;
  buildMutation: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          New Enquiries — Ready to Build
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : enquiries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No new enquiries"
            description="New enquiries will appear here for auto-pricing"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Enquiry</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Source</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enquiries.map((enquiry) => (
                  <TableRow key={enquiry.id}>
                    <TableCell className="font-mono text-xs hidden sm:table-cell">
                      {enquiry.enquiryNumber || `#${enquiry.id}`}
                    </TableCell>
                    <TableCell className="font-medium">
                      {enquiry.client || enquiry.clientName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {enquiry.title || enquiry.subject || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        {enquiry.source || "manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => onBuildCostSheet(enquiry)}
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
  );
}

function DraftCostSheetsSection({
  sheets,
  isLoading,
  onReview,
  onApproval,
  approveMutation,
  hasZeroConfidenceLines,
}: {
  sheets: CostSheet[];
  isLoading: boolean;
  onReview: (sheet: CostSheet) => void;
  onApproval: (sheetId: string, action: 'approved' | 'rejected') => void;
  approveMutation: any;
  hasZeroConfidenceLines: (sheet: CostSheet) => boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-400" />
          Draft Cost Sheets — Review & Approve
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sheets.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No drafts pending"
            description="Build from an enquiry above to create a draft"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Job #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Event</TableHead>
                  <TableHead className="hidden sm:table-cell">Lines</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => {
                  const hasZero = hasZeroConfidenceLines(sheet);
                  return (
                    <TableRow key={sheet.id}>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">
                        {sheet.jobNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sheet.client || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate hidden md:table-cell">
                        {sheet.event || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {sheet.items.length}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ConfidenceBadge score={sheet.sheetConfidence} size="sm" />
                          {hasZero && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onReview(sheet)}
                            className="text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline"> Review</span>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => onApproval(sheet.id, 'approved')}
                            disabled={approveMutation.isPending || hasZero}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500"
                            title={hasZero ? "Price all lines before approving" : "Approve and generate quotation"}
                          >
                            <CheckCircle className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline"> Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onApproval(sheet.id, 'rejected')}
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
  );
}

function ApprovedSheetsSection({
  sheets,
  onSend,
}: {
  sheets: CostSheet[];
  onSend: (sheet: CostSheet) => void;
}) {
  if (sheets.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-400" />
          Approved — Ready to Send
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
              {sheets.map((sheet) => (
                <TableRow key={sheet.id}>
                  <TableCell className="font-mono text-xs">{sheet.jobNumber}</TableCell>
                  <TableCell className="font-medium">{sheet.client || "—"}</TableCell>
                  <TableCell>{sheet.event || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px]">
                      {sheet.sheetConfidence}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href="/quotations">
                        <Button size="sm" variant="outline" className="text-xs">
                          <FileText className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        className="text-xs bg-blue-600 hover:bg-blue-500"
                        onClick={() => onSend(sheet)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" /> Send Quote
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Dialog Components

function ReviewDialog({
  sheet,
  onClose,
  onApproval,
  approveMutation,
  hasZeroConfidenceLines,
}: {
  sheet: CostSheet | null;
  onClose: () => void;
  onApproval: (sheetId: string, action: 'approved' | 'rejected') => void;
  approveMutation: any;
  hasZeroConfidenceLines: (sheet: CostSheet) => boolean;
}) {
  if (!sheet) return null;

  const hasZero = hasZeroConfidenceLines(sheet);

  return (
    <Dialog open={!!sheet} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review: {sheet.jobNumber} — {sheet.client}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Sheet Confidence:</span>
            <ConfidenceBadge score={sheet.sheetConfidence} />
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
              {sheet.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{item.itemNumber}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-sm">{item.vendor || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.unitCost?.toFixed(3) || "0.000"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.unitSellingPrice?.toFixed(3) || "0.000"}
                  </TableCell>
                  <TableCell>
                    <ConfidenceBadge score={item.confidence || 0} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {sheet.status === 'draft' && (
            <>
              <Button
                variant="destructive"
                onClick={() => { onApproval(sheet.id, 'rejected'); onClose(); }}
              >
                Reject
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500"
                disabled={hasZero}
                onClick={() => { onApproval(sheet.id, 'approved'); onClose(); }}
              >
                Approve & Generate Quote
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({
  sheet,
  email,
  owner,
  onEmailChange,
  onOwnerChange,
  onSend,
  onClose,
  sendMutation,
}: {
  sheet: CostSheet | null;
  email: string;
  owner: string;
  onEmailChange: (email: string) => void;
  onOwnerChange: (owner: string) => void;
  onSend: () => void;
  onClose: () => void;
  sendMutation: any;
}) {
  if (!sheet) return null;

  return (
    <Dialog open={!!sheet} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Quotation — {sheet.client}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This opens a Gmail compose window pre-filled with the quote details.
            <strong> You must click Send in Gmail</strong> — nothing is sent automatically.
          </p>
          <div className="space-y-2">
            <Label htmlFor="send-email">Recipient Email</Label>
            <Input
              id="send-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-owner">Account Owner</Label>
            <Input
              id="send-owner"
              placeholder="e.g. Reza, Zara, Vijesh…"
              value={owner}
              onChange={(e) => onOwnerChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            disabled={!email.includes("@") || sendMutation.isPending}
            onClick={onSend}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {sendMutation.isPending ? "Opening…" : "Open Gmail Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}