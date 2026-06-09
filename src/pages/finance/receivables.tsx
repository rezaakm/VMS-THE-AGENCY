import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { differenceInDays, format } from "date-fns";
import { Banknote, Receipt, Target } from "lucide-react";
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
import { getArSummary, getArAging, getSalesInvoices } from "@/lib/queries/ar";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";

export default function ReceivablesPanel() {
  const { entityFilter, scope } = useEntityScope();

  const summaryQ = useQuery({
    queryKey: ["ar-summary", scope],
    queryFn: () => getArSummary(entityFilter),
  });

  const agingQ = useQuery({
    queryKey: ["ar-aging", scope],
    queryFn: () => getArAging(entityFilter),
  });

  const invoicesQ = useQuery({
    queryKey: ["sales-invoices", scope],
    queryFn: () => getSalesInvoices(entityFilter),
  });

  const s = summaryQ.data;

  const agingBuckets = (agingQ.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const bucket = row.aging_bucket ?? "Unknown";
    acc[bucket] = (acc[bucket] ?? 0) + (row.balance ?? 0);
    return acc;
  }, {});
  const agingChartData = Object.entries(agingBuckets).map(
    ([bucket, amount]) => ({ bucket, amount })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables"
        description={`Outstanding invoices and aging — ${ENTITY_LABELS[scope]}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={summaryQ.isLoading}
          title="Total Outstanding"
          value={formatOMR(s?.totalOutstanding)}
          icon={Banknote}
        />
        <StatCard
          loading={summaryQ.isLoading}
          title="Total Invoiced"
          value={formatOMR(s?.totalInvoiced)}
          icon={Receipt}
        />
        <StatCard
          loading={summaryQ.isLoading}
          title="Collection Rate"
          value={s ? `${s.collectionRate.toFixed(1)}%` : undefined}
          icon={Target}
        />
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Aging Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {agingQ.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : agingChartData.length === 0 ? (
            <EmptyState title="No aging data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={agingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Sales Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (invoicesQ.data ?? []).length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Days Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoicesQ.data ?? []).map((inv) => {
                    const daysOut = inv.due_date
                      ? differenceInDays(new Date(), new Date(inv.due_date))
                      : 0;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client_name}</TableCell>
                        <TableCell className="text-right font-mono">{formatOMR(inv.amount)}</TableCell>
                        <TableCell>
                          {inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {daysOut > 0 ? daysOut : "-"}
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
    </div>
  );
}
