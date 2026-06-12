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
import { formatOMR, CHART_TOOLTIP } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useEntityScope } from "@/hooks/use-entity-scope";
import {
  snapRevenue, snapNet, snapExpenses, snapYear, snapMonthKey, snapMonthLabel,
} from "@/lib/snap";

export default function PnlPanel() {
  const { entityFilter, scope } = useEntityScope();

  const snapshotsQ = useQuery({
    queryKey: ["pnl-snapshots", scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_financial_snapshots")
        .select("*");
      if (error) throw error;

      const filtered = entityFilter
        ? (data ?? []).filter((r) => r.entity === entityFilter)
        : (data ?? []);

      // Sort client-side by parsed period (no created_at column on this table).
      return [...filtered].sort((a, b) =>
        snapMonthKey(a).localeCompare(snapMonthKey(b)),
      );
    },
  });

  const rows = snapshotsQ.data ?? [];
  const year = new Date().getFullYear();
  const ytdRows = rows.filter((r) => snapYear(r) === String(year));

  const totalRevenue = ytdRows.reduce((s, r) => s + snapRevenue(r), 0);
  const totalExpenses = ytdRows.reduce((s, r) => s + snapExpenses(r), 0);
  const totalNet = ytdRows.reduce((s, r) => s + snapNet(r), 0);

  // Aggregate by month for chart (handle group mode where multiple entities per month)
  const monthMap = new Map<string, { key: string; month: string; revenue: number; expenses: number; net: number }>();
  for (const r of rows) {
    const key = snapMonthKey(r);
    const cur = monthMap.get(key) ?? { key, month: snapMonthLabel(r), revenue: 0, expenses: 0, net: 0 };
    cur.revenue += snapRevenue(r);
    cur.expenses += snapExpenses(r);
    cur.net += snapNet(r);
    monthMap.set(key, cur);
  }
  const chartData = Array.from(monthMap.values())
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Monthly P&L"
        showScope
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Revenue (${year})`}
          value={formatOMR(totalRevenue)}
          icon={TrendingUp}
          accent="info"
        />
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Expenses (${year})`}
          value={formatOMR(totalExpenses)}
          icon={TrendingDown}
          accent="negative"
        />
        <StatCard
          loading={snapshotsQ.isLoading}
          title={`YTD Net Income (${year})`}
          value={formatOMR(totalNet)}
          icon={DollarSign}
          accent={totalNet >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No financial data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={CHART_TOOLTIP}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} name="Revenue" maxBarSize={32} />
                <Bar dataKey="expenses" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} name="Expenses" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Net Income Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Net Income Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsQ.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={CHART_TOOLTIP}
                />
                <Line type="monotone" dataKey="net" stroke="hsl(158 64% 52%)" strokeWidth={2} dot={{ fill: "hsl(158 64% 52%)", r: 3 }} name="Net Income" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Monthly Breakdown</CardTitle>
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
                      <TableRow key={row.key}>
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
