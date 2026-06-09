import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getBankAccounts, getBankTransactions } from "@/lib/queries/bank";
import { useEntityScope } from "@/hooks/use-entity-scope";

export default function BankPanel() {
  const { entityFilter, scope } = useEntityScope();

  const accountsQ = useQuery({
    queryKey: ["bank-accounts", scope],
    queryFn: () => getBankAccounts(entityFilter),
  });

  const txnQ = useQuery({
    queryKey: ["bank-transactions", scope],
    queryFn: () => getBankTransactions(entityFilter),
  });

  const totalBalance = (accountsQ.data ?? []).reduce(
    (s, a) => s + (a.current_balance ?? a.balance ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank"
        description="Account balances and transactions"
        showScope
      />

      {/* Total Balance Card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          loading={accountsQ.isLoading}
          title="Total Balance"
          value={formatOMR(totalBalance)}
          icon={Landmark}
        />
      </div>

      {/* Account Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accountsQ.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-24" /><Skeleton className="mt-2 h-7 w-32" /></CardContent></Card>
            ))
          : (accountsQ.data ?? []).length === 0
          ? (
            <Card className="col-span-full"><CardContent className="p-5"><EmptyState title="No bank accounts" /></CardContent></Card>
          )
          : (accountsQ.data ?? []).map((acct) => (
              <Card key={acct.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground">{acct.name}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatOMR(acct.current_balance ?? acct.balance)}</p>
                  <div className="flex gap-2 mt-2">
                    {acct.bank_name && <span className="text-[10px] text-muted-foreground">{acct.bank_name}</span>}
                    {acct.entity && (
                      <Badge variant="outline" className="text-[10px]">{acct.entity}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Transaction Ledger */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Transaction Ledger</CardTitle>
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
                    <TableHead>Reconciled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(txnQ.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell>{t.bank_accounts?.name ?? "-"}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{t.description ?? "-"}</TableCell>
                      <TableCell className={`text-right font-mono ${(t.amount ?? 0) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {formatOMR(t.amount)}
                      </TableCell>
                      <TableCell><Badge variant="outline">{t.type ?? "-"}</Badge></TableCell>
                      <TableCell>
                        {t.reconciled ? (
                          <Badge variant="success" className="text-[10px]">Yes</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">No</Badge>
                        )}
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
