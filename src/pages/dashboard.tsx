import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Landmark, ArrowDownLeft, ArrowUpRight, TrendingUp, FileText,
  Users, DollarSign, BarChart3, Dumbbell, Building2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";
import { supabase } from "@/lib/supabase";
import { formatOMR } from "@/lib/utils";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function useDashboardData() {
  const { entityFilter, scope } = useEntityScope();

  return useQuery({
    queryKey: ["dashboard", scope],
    queryFn: async () => {
      // Bank balance — table has no entity column, so fetch all and never entity-filter
      const { data: bankRows } = await supabase
        .from("bank_accounts")
        .select("*");
      const bankBalance = (bankRows ?? []).reduce(
        (s, r) => s + num(r.current_balance),
        0,
      );

      // AR — has entity column
      const { data: arRows } = await supabase
        .from("ar_entries")
        .select("*");
      const filteredAr = entityFilter
        ? (arRows ?? []).filter((r) => r.entity === entityFilter)
        : (arRows ?? []);
      const totalAR = filteredAr.reduce((s, r) => s + num(r.balance), 0);

      // AP — has entity column
      const { data: apRows } = await supabase
        .from("ap_entries")
        .select("*");
      const filteredAp = entityFilter
        ? (apRows ?? []).filter((r) => r.entity === entityFilter)
        : (apRows ?? []);
      const totalAP = filteredAp.reduce((s, r) => s + num(r.balance), 0);

      // Net position = bank + AR - AP
      const netPosition = bankBalance + totalAR - totalAP;

      // Quotations count + value — table has no entity column
      const { data: qRows } = await supabase
        .from("quotations")
        .select("*");
      const quotationCount = qRows?.length ?? 0;
      const quotationValue = (qRows ?? []).reduce(
        (s, r) => s + num(r.totalAmount),
        0,
      );

      // Monthly financial snapshots for YTD revenue + chart
      const year = new Date().getFullYear();
      const { data: snapRows } = await supabase
        .from("monthly_financial_snapshots")
        .select("*")
        .order("month", { ascending: true });
      const allSnaps = snapRows ?? [];
      // Entity filter only for non-group scopes (snapshots DO have entity column)
      const entitySnaps = entityFilter
        ? allSnaps.filter((r) => r.entity === entityFilter)
        : allSnaps;
      // Then filter to current year
      const filteredSnaps = entitySnaps.filter((r) =>
        r.month?.startsWith(String(year)),
      );

      const ytdRevenue = filteredSnaps.reduce((s, r) => s + num(r.revenue), 0);
      const ytdNet = filteredSnaps.reduce((s, r) => s + num(r.net_income), 0);

      // Aggregate by month for chart
      const monthMap = new Map<string, { revenue: number; expenses: number; net: number }>();
      for (const r of filteredSnaps) {
        const m = r.month?.slice(0, 7) ?? "unknown";
        const cur = monthMap.get(m) ?? { revenue: 0, expenses: 0, net: 0 };
        cur.revenue += num(r.revenue);
        cur.expenses += num(r.expenses);
        cur.net += num(r.net_income);
        monthMap.set(m, cur);
      }
      const monthlyChart = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({
          month: month.slice(5), // "01", "02", etc.
          revenue: v.revenue,
          expenses: v.expenses,
          net: v.net,
        }));

      // Vendors count
      const { count: vendorCount } = await supabase
        .from("vendors")
        .select("id", { count: "exact", head: true });

      return {
        bankBalance,
        totalAR,
        totalAP,
        netPosition,
        quotationCount,
        quotationValue,
        ytdRevenue,
        ytdNet,
        monthlyChart,
        vendorCount: vendorCount ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

export default function Dashboard() {
  const { scope } = useEntityScope();
  const { data, isLoading } = useDashboardData();

  const kpis = [
    {
      label: "Net Position",
      value: data ? formatOMR(data.netPosition) : null,
      icon: DollarSign,
      color: "text-emerald-400",
      desc: "Bank + AR - AP",
    },
    {
      label: "Bank Balance",
      value: data ? formatOMR(data.bankBalance) : null,
      icon: Landmark,
      color: "text-blue-400",
      desc: "Current balance",
    },
    {
      label: "Receivables (AR)",
      value: data ? formatOMR(data.totalAR) : null,
      icon: ArrowDownLeft,
      color: "text-amber-400",
      desc: "Outstanding",
    },
    {
      label: "Payables (AP)",
      value: data ? formatOMR(data.totalAP) : null,
      icon: ArrowUpRight,
      color: "text-rose-400",
      desc: "Outstanding",
    },
    {
      label: "YTD Revenue",
      value: data ? formatOMR(data.ytdRevenue) : null,
      icon: TrendingUp,
      color: "text-emerald-400",
      desc: `${new Date().getFullYear()} total`,
    },
    {
      label: "YTD Net Income",
      value: data ? formatOMR(data.ytdNet) : null,
      icon: BarChart3,
      color: data && data.ytdNet >= 0 ? "text-emerald-400" : "text-rose-400",
      desc: "Revenue - Expenses",
    },
  ];

  const quickStats = [
    {
      label: "Quotations",
      value: data?.quotationCount ?? 0,
      sub: data ? formatOMR(data.quotationValue) : "—",
      icon: FileText,
      href: "/quotations",
    },
    {
      label: "Vendors",
      value: data?.vendorCount ?? 0,
      sub: "Active suppliers",
      icon: Users,
      href: "/vendors",
    },
  ];

  const ScopeIcon = scope === "fitnessbay" ? Dumbbell : Building2;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScopeIcon className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest">
            {ENTITY_LABELS[scope]} — Command Center
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Financial Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-1.5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(217_100%_60%/0.1)] animate-card-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    {kpi.label}
                  </span>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span className={`text-lg font-bold tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/60">{kpi.desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Stats Row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <div className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 transition-all cursor-pointer group">
                <Icon className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {isLoading ? <Skeleton className="h-7 w-12" /> : s.value}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                <div className="text-[10px] text-muted-foreground/60">{s.sub}</div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Revenue / Expenses Chart */}
      <section className="grid lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Monthly Revenue & Expenses ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.monthlyChart.length ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                No financial snapshot data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthlyChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: number) => formatOMR(val)}
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Net Income Trend ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.monthlyChart.length ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                No financial snapshot data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: number) => formatOMR(val)}
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6", r: 3 }}
                    name="Net Income"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick Navigation */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { href: "/finance/receivables", label: "Receivables", icon: ArrowDownLeft },
            { href: "/finance/payables", label: "Payables", icon: ArrowUpRight },
            { href: "/finance/bank", label: "Bank", icon: Landmark },
            { href: "/finance/pnl", label: "P&L", icon: TrendingUp },
            { href: "/finance/payroll", label: "HR / Payroll", icon: Users },
            { href: "/fitness-bay", label: "Fitness Bay", icon: Dumbbell },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group">
                  <Icon className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
