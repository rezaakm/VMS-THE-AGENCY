import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Banknote, CreditCard, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { formatOMR } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getApSummary, getApEntries } from "@/lib/queries/ap";
import { useEntityScope } from "@/hooks/use-entity-scope";

/** Derive a payment status from the amounts (the DB has no status column). */
function deriveApStatus(originalAmount: number, balance: number): string {
  if (balance <= 0) return "paid";
  if (balance < originalAmount) return "partial";
  return "open";
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function RecordPaymentDialog({
  open, onOpenChange, entry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: { id: string; balance: number; vendorName: string } | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const balance = entry?.balance ?? 0;

  // Initial amount defaults to the full outstanding balance. The parent
  // remounts this component per entry (via key) so these defaults stay fresh.
  const [amount, setAmount] = useState<string>(entry ? String(entry.balance ?? "") : "");
  const [date, setDate] = useState<string>(todayISO());
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const numAmount = Number(amount);
      const { data, error: rpcError } = await supabase.rpc("record_vendor_payment", {
        p_ap_id: entry!.id,
        p_amount: numAmount,
        p_date: date,
        p_account_id: null,
        p_note: note.trim() ? note.trim() : null,
      });
      if (rpcError) throw rpcError;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: `${formatOMR(Number(amount))} paid to ${entry?.vendorName ?? "vendor"}.`,
      });
      // Refresh this page's queries AND broadly (bank / dashboard balances).
      queryClient.invalidateQueries({ queryKey: ["ap-entries"] });
      queryClient.invalidateQueries({ queryKey: ["ap-summary"] });
      queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to record payment";
      setError(message);
    },
  });

  function handleSubmit() {
    setError(null);
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (numAmount > balance) {
      setError(`Amount cannot exceed the outstanding balance (${formatOMR(balance)}).`);
      return;
    }
    if (!date) {
      setError("Please select a payment date.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry?.vendorName ?? "Record Payment"}</DialogTitle>
          <DialogDescription>
            Outstanding balance:{" "}
            <span className="font-mono tabular-nums text-foreground">{formatOMR(balance)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={balance}
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right font-mono tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Date</Label>
            <Input
              id="payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reference, cheque no., etc."
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400" role="alert">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PayablesPanel() {
  const { entityFilter, scope } = useEntityScope();

  const summaryQ = useQuery({
    queryKey: ["ap-summary", scope],
    queryFn: () => getApSummary(entityFilter),
  });

  const entriesQ = useQuery({
    queryKey: ["ap-entries", scope],
    queryFn: () => getApEntries(entityFilter),
  });

  const s = summaryQ.data;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<
    { id: string; balance: number; vendorName: string } | null
  >(null);

  function openPaymentDialog(entry: { id: string; balance: number; vendorName: string }) {
    setActiveEntry(entry);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables"
        description="Vendor invoices and payments"
        showScope
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard loading={summaryQ.isLoading} title="Total Outstanding" value={formatOMR(s?.totalOutstanding)} icon={Banknote} />
        <StatCard loading={summaryQ.isLoading} title="Total Payable" value={formatOMR(s?.totalPayable)} icon={CreditCard} />
        <StatCard loading={summaryQ.isLoading} title="Entries Count" value={String(s?.count ?? 0)} icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">AP Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (entriesQ.data ?? []).length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entriesQ.data ?? []).map((entry) => {
                    const original = entry.original_amount ?? 0;
                    const balance = entry.balance ?? 0;
                    const vendorName = entry.vendors?.name ?? "-";
                    const status = deriveApStatus(original, balance);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{vendorName}</TableCell>
                        <TableCell>{entry.invoices?.invoice_number ?? "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatOMR(original)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatOMR(balance)}</TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entry.created_at ? format(new Date(entry.created_at), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {balance > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openPaymentDialog({
                                  id: entry.id,
                                  balance,
                                  vendorName: vendorName === "-" ? "Vendor" : vendorName,
                                })
                              }
                            >
                              Record Payment
                            </Button>
                          )}
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

      <RecordPaymentDialog
        key={activeEntry?.id ?? "none"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={activeEntry}
      />
    </div>
  );
}
