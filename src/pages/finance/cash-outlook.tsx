import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

export default function CashOutlookPanel() {
  const metricsQ = useQuery({
    queryKey: ["overview-metrics"],
    queryFn: getOverviewMetrics,
  });

  const bankQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: getBankAccounts,
  });

  const m = metricsQ.data;
  const bankTotal = (bankQ.data ?? []).reduce(
    (s, a) => s + (a.balance ?? 0),
    0
  );

  // Build a simple cash flow overview
  const chartData = m
    ? [
        { label: "Bank Balance", inflow: bankTotal, outflow: 0 },
        { label: "AR Expected", inflow: m.totalAR, outflow: 0 },
        { label: "AP Due", inflow: 0, outflow: m.totalAP },
        {
          label: "Projected",
          inflow: bankTotal + m.totalAR,
          outflow: m.totalAP,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Outlook" description="Cash flow projection" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={bankQ.isLoading}
          title="Bank Balance"
          value={formatOMR(bankTotal)}
          icon={Landmark}
        />
        <StatCard
          loading={metricsQ.isLoading}
          title="AR Expected"
          value={formatOMR(m?.totalAR)}
          icon={ArrowDownLeft}
          trend="up"
        />
        <StatCard
          loading={metricsQ.isLoading}
          title="AP Due"
          value={formatOMR(m?.totalAP)}
          icon={ArrowUpRight}
          trend="down"
        />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    `${(v / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={{
                    borderRadius: "0.625rem",
                    border: "1px solid rgba(226,232,240,0.7)",
                    fontSize: "0.8125rem",
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(12px) saturate(1.4)",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.06)",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="inflow"
                  name="Inflow"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="outflow"
                  name="Outflow"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
