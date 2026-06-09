import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, DollarSign, FileText,
  PieChart as PieChartIcon, Activity,
} from "lucide-react";
import { format } from "date-fns";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getOverviewMetrics, getRecentActivity } from "@/lib/queries/overview";
import { getArAging } from "@/lib/queries/ar";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";

const AGING_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444", "#8b5cf6"];

export default function OverviewPanel() {
  const { entityFilter, scope } = useEntityScope();

  const metricsQ = useQuery({
    queryKey: ["overview-metrics", scope],
    queryFn: () => getOverviewMetrics(entityFilter),
  });

  const activityQ = useQuery({
    queryKey: ["recent-activity"],
    queryFn: getRecentActivity,
  });

  const agingQ = useQuery({
    queryKey: ["ar-aging", scope],
    queryFn: () => getArAging(entityFilter),
  });

  const m = metricsQ.data;

  const agingBuckets = (agingQ.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const bucket = row.aging_bucket ?? "Unknown";
    acc[bucket] = (acc[bucket] ?? 0) + (row.balance ?? 0);
    return acc;
  }, {});
  const agingChartData = Object.entries(agingBuckets).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description={`Financial summary — ${ENTITY_LABELS[scope]}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="AR Outstanding" value={m ? formatOMR(m.totalAR) : undefined} icon={ArrowDownLeft} loading={metricsQ.isLoading} />
        <StatCard title="AP Outstanding" value={m ? formatOMR(m.totalAP) : undefined} icon={ArrowUpRight} loading={metricsQ.isLoading} trend="down" />
        <StatCard title="Net Cash Position" value={m ? formatOMR(m.netPosition) : undefined} icon={DollarSign} loading={metricsQ.isLoading} trend={m ? (m.netPosition >= 0 ? "up" : "down") : undefined} />
        <StatCard title="Open Journals" value={m ? String(m.openJournals) : undefined} icon={FileText} loading={metricsQ.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AR Aging Donut */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">AR Aging Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {agingQ.isLoading ? (
              <Skeleton className="mx-auto h-48 w-48 rounded-full" />
            ) : agingChartData.length === 0 ? (
              <EmptyState icon={PieChartIcon} title="No aging data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={agingChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                      {agingChartData.map((_, i) => (
                        <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatOMR(val)}
                      contentStyle={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap gap-4 justify-center text-xs">
                  {agingChartData.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AGING_COLORS[i % AGING_COLORS.length] }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(activityQ.data?.recentInvoices ?? []).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-2.5 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Invoice {inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{inv.client_name} &middot; {inv.created_at ? format(new Date(inv.created_at), "dd MMM yyyy") : ""}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{formatOMR(inv.amount)}</span>
                  </div>
                ))}
                {(activityQ.data?.recentJournals ?? []).map((je) => (
                  <div key={je.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-2.5 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{je.description || "Journal Entry"}</p>
                      <p className="text-xs text-muted-foreground">{je.created_at ? format(new Date(je.created_at), "dd MMM yyyy") : ""}</p>
                    </div>
                    <Badge variant={je.status === "POSTED" ? "success" : "secondary"}>{je.status}</Badge>
                  </div>
                ))}
                {(activityQ.data?.recentInvoices ?? []).length === 0 &&
                  (activityQ.data?.recentJournals ?? []).length === 0 && (
                    <EmptyState icon={Activity} title="No recent activity" />
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
