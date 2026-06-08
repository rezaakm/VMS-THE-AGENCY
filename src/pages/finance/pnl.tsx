import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getLedgerEntries } from "@/lib/queries/ledger";

export default function PnlPanel() {
  const ledgerQ = useQuery({
    queryKey: ["ledger-entries"],
    queryFn: getLedgerEntries,
  });

  const entries = ledgerQ.data ?? [];

  const totalDebits = entries.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredits = entries.reduce((s, e) => s + (e.credit ?? 0), 0);
  const netIncome = totalCredits - totalDebits;

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Loss" description="Revenue and expense tracking" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={ledgerQ.isLoading}
          title="Total Credits (Revenue)"
          value={formatOMR(totalCredits)}
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          loading={ledgerQ.isLoading}
          title="Total Debits (Expenses)"
          value={formatOMR(totalDebits)}
          icon={TrendingDown}
          trend="down"
        />
        <StatCard
          loading={ledgerQ.isLoading}
          title="Net Income"
          value={formatOMR(netIncome)}
          icon={DollarSign}
          trend={netIncome >= 0 ? "up" : "down"}
        />
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.account_name ?? e.account_code ?? "-"}
                      </TableCell>
                      <TableCell>{e.description ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {e.debit ? formatOMR(e.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {e.credit ? formatOMR(e.credit) : "-"}
                      </TableCell>
                      <TableCell>
                        {e.posted_at
                          ? format(new Date(e.posted_at), "dd MMM yyyy")
                          : "-"}
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
