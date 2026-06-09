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
import { formatOMR, CHART_TOOLTIP } from "@/lib/utils";
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

      <Card chart>
        <CardHeader>
          <CardTitle className="t-card-title">Cash Flow Projection</CardTitle>
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
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={CHART_TOOLTIP}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inflow" name="Inflow" fill="hsl(158 64% 52%)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                <Bar dataKey="outflow" name="Outflow" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
