import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Landmark, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getOverviewMetrics } from "@/lib/queries/overview";
import { getBankAccounts } from "@/lib/queries/bank";
import { useEntityScope } from "@/hooks/use-entity-scope";

export default function CashOutlookPanel() {
  const { entityFilter, scope } = useEntityScope();

  const metricsQ = useQuery({
    queryKey: ["overview-metrics", scope],
    queryFn: () => getOverviewMetrics(entityFilter),
  });

  const bankQ = useQuery({
    queryKey: ["bank-accounts", scope],
    queryFn: () => getBankAccounts(entityFilter),
  });

  const m = metricsQ.data;
  const bankTotal = (bankQ.data ?? []).reduce(
    (s, a) => s + (a.current_balance ?? a.balance ?? 0),
    0
  );

  const chartData = m
    ? [
        { label: "Bank Balance", inflow: bankTotal, outflow: 0 },
        { label: "AR Expected", inflow: m.totalAR, outflow: 0 },
        { label: "AP Due", inflow: 0, outflow: m.totalAP },
        { label: "Projected", inflow: bankTotal + m.totalAR, outflow: m.totalAP },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Outlook" description="Cash flow projection" showScope />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard loading={bankQ.isLoading} title="Bank Balance" value={formatOMR(bankTotal)} icon={Landmark} />
        <StatCard loading={metricsQ.isLoading} title="AR Expected" value={formatOMR(m?.totalAR)} icon={ArrowDownLeft} trend="up" />
        <StatCard loading={metricsQ.isLoading} title="AP Due" value={formatOMR(m?.totalAP)} icon={ArrowUpRight} trend="down" />
      </div>

      <Card chart className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Cash Flow Projection</CardTitle>
        </CardHeader>
        <CardContent>
          {metricsQ.isLoading || bankQ.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#888" }} />
                <YAxis tick={{ fontSize: 12, fill: "#888" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend />
                <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="outflow" name="Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
