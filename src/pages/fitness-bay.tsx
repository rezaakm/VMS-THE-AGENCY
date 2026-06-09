import { useQuery } from "@tanstack/react-query";
import {
  Dumbbell, TrendingUp, TrendingDown, DollarSign, Landmark,
  ArrowDownLeft, ArrowUpRight, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
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
import { supabase } from "@/lib/supabase";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

const PARTNER_SPLIT = { reza: 0.7, mahsa: 0.3 };
const CUMULATIVE_NET = 8491; // per spec

function useFitnessBayData() {
  return useQuery({
    queryKey: ["fitness-bay"],
    queryFn: async () => {
      const [snapRes, txnRes] = await Promise.all([
        supabase
          .from("monthly_financial_snapshots")
          .select("*")
          .eq("entity", "fitnessbay")
          .order("month", { ascending: true }),
        supabase
          .from("bank_transactions")
          .select("*")
          .eq("entity", "fitnessbay")
          .order("transaction_date", { ascending: false }),
      ]);

      const snapshots = snapRes.data ?? [];
      const transactions = txnRes.data ?? [];

      // P&L aggregates
      const year = new Date().getFullYear();
      const ytdSnaps = snapshots.filter((r) => r.month?.startsWith(String(year)));
      const ytdRevenue = ytdSnaps.reduce((s, r) => s + num(r.revenue), 0);
      const ytdExpenses = ytdSnaps.reduce((s, r) => s + num(r.expenses), 0);
      const ytdNet = ytdSnaps.reduce((s, r) => s + num(r.net_income), 0);

      // All-time totals
      const allRevenue = snapshots.reduce((s, r) => s + num(r.revenue), 0);
      const allExpenses = snapshots.reduce((s, r) => s + num(r.expenses), 0);
      const allNet = snapshots.reduce((s, r) => s + num(r.net_income), 0);

      // Monthly chart data
      const chartData = snapshots.map((r) => ({
        month: r.month?.slice(0, 7) ?? "",
        revenue: num(r.revenue),
        expenses: num(r.expenses),
        net: num(r.net_income),
      }));

      // Virtual bank: money in / out / retained
      const moneyIn = transactions
        .filter((t) => num(t.amount) > 0)
        .reduce((s, t) => s + num(t.amount), 0);
      const moneyOut = transactions
        .filter((t) => num(t.amount) < 0)
        .reduce((s, t) => s + Math.abs(num(t.amount)), 0);
      const retained = moneyIn - moneyOut;

      // Partner split on cumulative net
      const cumulativeNet = allNet || CUMULATIVE_NET;
      const rezaShare = cumulativeNet * PARTNER_SPLIT.reza;
      const mahsaShare = cumulativeNet * PARTNER_SPLIT.mahsa;

      return {
        ytdRevenue,
        ytdExpenses,
        ytdNet,
        allNet,
        chartData,
        transactions,
        moneyIn,
        moneyOut,
        retained,
        cumulativeNet,
        rezaShare,
        mahsaShare,
        transactionCount: transactions.length,
      };
    },
    staleTime: 60_000,
  });
}

export default function FitnessBay() {
  const { data, isLoading } = useFitnessBayData();
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Dumbbell className="w-7 h-7 text-primary" />
        <PageHeader
          title="Fitness Bay"
          description="P&L, Virtual Bank, and Partner Split"
        />
      </div>

      {/* P&L KPIs */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Profit & Loss ({year} YTD)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard loading={isLoading} title="YTD Revenue" value={formatOMR(data?.ytdRevenue)} icon={TrendingUp} trend="up" />
          <StatCard loading={isLoading} title="YTD Expenses" value={formatOMR(data?.ytdExpenses)} icon={TrendingDown} trend="down" />
          <StatCard
            loading={isLoading}
            title="YTD Net Income"
            value={formatOMR(data?.ytdNet)}
            icon={DollarSign}
            trend={data && data.ytdNet >= 0 ? "up" : "down"}
          />
        </div>
      </section>

      {/* Revenue vs Expenses Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue & Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data?.chartData.length ? (
            <EmptyState title="No financial data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.chartData} barGap={2}>
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

      {/* Virtual Bank + Partner Split side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Virtual Bank */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Virtual Bank (Gym Slice)
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Money In</span>
              </div>
              {isLoading ? <Skeleton className="h-6 w-20" /> : (
                <span className="text-lg font-bold tabular-nums text-emerald-400">{formatOMR(data?.moneyIn)}</span>
              )}
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Money Out</span>
              </div>
              {isLoading ? <Skeleton className="h-6 w-20" /> : (
                <span className="text-lg font-bold tabular-nums text-rose-400">{formatOMR(data?.moneyOut)}</span>
              )}
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Retained</span>
              </div>
              {isLoading ? <Skeleton className="h-6 w-20" /> : (
                <span className={`text-lg font-bold tabular-nums ${(data?.retained ?? 0) >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                  {formatOMR(data?.retained)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Partner Split */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Partner Split (Cumulative Net)
          </h2>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cumulative Net Income</span>
                {isLoading ? <Skeleton className="h-6 w-24" /> : (
                  <span className="text-lg font-bold tabular-nums">{formatOMR(data?.cumulativeNet)}</span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Reza</span>
                    <Badge variant="outline" className="text-[10px]">70%</Badge>
                  </div>
                  {isLoading ? <Skeleton className="h-5 w-20" /> : (
                    <span className="font-bold tabular-nums text-emerald-400">{formatOMR(data?.rezaShare)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Mahsa</span>
                    <Badge variant="outline" className="text-[10px]">30%</Badge>
                  </div>
                  {isLoading ? <Skeleton className="h-5 w-20" /> : (
                    <span className="font-bold tabular-nums text-emerald-400">{formatOMR(data?.mahsaShare)}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Net Income Trend */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Net Income Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !data?.chartData.length ? (
            <EmptyState title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.chartData}>
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

      {/* Recent Transactions */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">
            Recent Transactions
            {!isLoading && <span className="text-muted-foreground font-normal text-sm ml-2">({data?.transactionCount})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.transactions.length ? (
            <EmptyState title="No Fitness Bay transactions yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.slice(0, 50).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">
                        {t.transaction_date
                          ? new Date(t.transaction_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{t.description ?? "-"}</TableCell>
                      <TableCell className={`text-right font-mono ${num(t.amount) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
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
