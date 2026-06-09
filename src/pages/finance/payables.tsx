import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Banknote, CreditCard, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getApSummary, getApEntries } from "@/lib/queries/ap";
import { useEntityScope } from "@/hooks/use-entity-scope";

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entriesQ.data ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.vendors?.name ?? "-"}</TableCell>
                      <TableCell>{entry.invoices?.invoice_number ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatOMR(entry.original_amount)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatOMR(entry.balance)}</TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {entry.created_at ? format(new Date(entry.created_at), "dd MMM yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
