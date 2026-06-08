import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { getBankAccounts, getBankTransactions } from "@/lib/queries/bank";

export default function BankLoansPanel() {
  const accountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: getBankAccounts,
  });

  const txnQ = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: getBankTransactions,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Bank & Loans" description="Account balances and transactions" />

      {/* Accounts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accountsQ.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-2 h-7 w-32" />
                </CardContent>
              </Card>
            ))
          : (accountsQ.data ?? []).length === 0
          ? (
            <Card className="col-span-full hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <EmptyState title="No bank accounts yet" />
              </CardContent>
            </Card>
          )
          : (accountsQ.data ?? []).map((acct) => (
              <Card key={acct.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {acct.name}
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {formatOMR(acct.balance)}
                  </p>
                  {acct.bank_name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {acct.bank_name}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Transactions */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txnQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (txnQ.data ?? []).length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(txnQ.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {t.transaction_date
                          ? format(
                              new Date(t.transaction_date),
                              "dd MMM yyyy"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>{t.bank_accounts?.name ?? "-"}</TableCell>
                      <TableCell>{t.description ?? "-"}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          (t.amount ?? 0) < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {formatOMR(t.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.type ?? "-"}</Badge>
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
