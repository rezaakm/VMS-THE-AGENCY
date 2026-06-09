import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export default function PnlPanel() {
  const { entityFilter, scope } = useEntityScope();

  const snapshotsQ = useQuery({
    queryKey: ["pnl-snapshots", scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_financial_snapshots")
        .select("*")
        .order("month", { ascending: true });
      if (error) throw error;

      const filtered = entityFilter
        ? (data ?? []).filter((r) => r.entity === entityFilter)
        : (data ?? []);

      return filtered;
    },
  });

  const rows = snapshotsQ.data ?? [];
  const year = new Date().getFullYear();
  const ytdRows = rows.filter((r) => r.month?.startsWith(String(year)));

  const totalRevenue = ytdRows.reduce((s, r) => s + num(r.revenue), 0);
  const totalExpenses = ytdRows.reduce((s, r) => s + num(r.expenses), 0);
  const totalNet = ytdRows.reduce((s, r) => s + num(r.net_income), 0);

  // Aggregate by month for chart (handle group mode where multiple entities per month)
  const monthMap = new Map<string, { revenue: number; expenses: number; net: number }>();
  for (const r of rows) {
    const m = r.month?.slice(0, 7) ?? "unknown";
    const cur = monthMap.get(m) ?? { revenue: 0, expenses: 0, net: 0 };
    cur.revenue += num(r.revenue);
    cur.expenses += num(r.expenses);
    cur.net += num(r.net_income);
    monthMap.set(m, cur);
  }
  const chartData = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description={`Monthly P&L — ${ENTITY_LABELS[scope]}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Revenue (${year})`}
          value={formatOMR(totalRevenue)}
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Expenses (${year})`}
          value={formatOMR(totalExpenses)}
          icon={TrendingDown}
          trend="down"
        />
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Net Income (${year})`}
          value={formatOMR(totalNet)}
          icon={DollarSign}
          trend={totalNet >= 0 ? "up" : "down"}
        />
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No financial data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Net Income Trend */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Net Income Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsQ.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} name="Net Income" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : chartData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Income</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row) => {
                    const margin = row.revenue > 0 ? (row.net / row.revenue) * 100 : 0;
                    return (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-400">{formatOMR(row.revenue)}</TableCell>
                        <TableCell className="text-right font-mono text-rose-400">{formatOMR(row.expenses)}</TableCell>
                        <TableCell className={`text-right font-mono ${row.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatOMR(row.net)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {margin.toFixed(1)}%
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
