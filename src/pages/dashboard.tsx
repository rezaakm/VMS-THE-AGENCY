import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Landmark, ArrowDownLeft, ArrowUpRight, TrendingUp, FileText,
  Users, DollarSign, BarChart3, Dumbbell, Building2, Wallet, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";
import { supabase } from "@/lib/supabase";
import { formatOMR } from "@/lib/utils";
import {
  snapRevenue, snapNet, snapExpenses, snapYear, snapMonthKey, snapMonthLabel,
} from "@/lib/snap";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function useDashboardData() {
  const { entityFilter, scope } = useEntityScope();

  return useQuery({
    queryKey: ["dashboard", scope],
    queryFn: async () => {
      // Bank balance. The shared Bank Muscat account is one pot. Fitness Bay's
      // slice is its RETAINED (undistributed) value = cumulative gross profit
      // minus owner draws taken — a positive figure. The Agency slice is the
      // remainder, so the two slices always sum to the real total (Group scope).
      const { data: bankRows } = await supabase
        .from("bank_accounts")
        .select("*");
      const totalBank = (bankRows ?? []).reduce(
        (s, r) => s + num(r.current_balance),
        0,
      );
      // Fitness retained = gross_profit − Σ owner_draws (≈ 6,415.90, positive).
      const [profitShareRes, ownerDrawsRes] = await Promise.all([
        supabase.from("fitness_profit_share").select("*").single(),
        supabase.from("owner_draws").select("amount"),
      ]);
      const grossProfit = num(profitShareRes.data?.gross_profit);
      const totalDraws = (ownerDrawsRes.data ?? []).reduce(
        (s, r) => s + num(r.amount),
        0,
      );
      const fitnessRetained = grossProfit - totalDraws;
      const bankBalance =
        entityFilter === "fitnessbay"
          ? fitnessRetained
          : entityFilter === "agency"
            ? totalBank - fitnessRetained
            : totalBank;

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

      // Derive pipeline-by-status from already-fetched quotation rows (no new fetch)
      const statusAgg = new Map<string, { count: number; value: number }>();
      for (const r of qRows ?? []) {
        const key = String(r.status ?? "preparing").toLowerCase();
        const cur = statusAgg.get(key) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += num(r.totalAmount);
        statusAgg.set(key, cur);
      }
      // Canonical 6-stage quotation workflow. Surface any other status the data
      // contains so nothing silently disappears, but always show the six stages.
      const CORE_STATUSES = [
        "preparing", "sent", "follow_up", "waiting_approval", "approved", "rejected",
      ];
      const extraStatuses = Array.from(statusAgg.keys()).filter(
        (s) => !CORE_STATUSES.includes(s),
      );
      const quotationByStatus = [...CORE_STATUSES, ...extraStatuses].map((s) => ({
        status: s,
        count: statusAgg.get(s)?.count ?? 0,
        value: statusAgg.get(s)?.value ?? 0,
      }));

      // Monthly financial snapshots for YTD revenue + chart
      // Columns: id, entity, period (text like "January-2026"), revenueActual, netProfitActual, ...
      const year = new Date().getFullYear();
      const { data: snapRows } = await supabase
        .from("monthly_financial_snapshots")
        .select("*");
      const allSnaps = [...(snapRows ?? [])].sort((a, b) =>
        snapMonthKey(a).localeCompare(snapMonthKey(b)),
      );
      // Entity filter only for non-group scopes
      const entitySnaps = entityFilter
        ? allSnaps.filter((r) => r.entity === entityFilter)
        : allSnaps;
      // Filter to current year
      const filteredSnaps = entitySnaps.filter(
        (r) => snapYear(r) === String(year),
      );

      const ytdRevenue = filteredSnaps.reduce((s, r) => s + snapRevenue(r), 0);
      const ytdNet = filteredSnaps.reduce((s, r) => s + snapNet(r), 0);

      // Aggregate by month for chart
      const monthMap = new Map<string, { key: string; month: string; revenue: number; expenses: number; net: number }>();
      for (const r of filteredSnaps) {
        const key = snapMonthKey(r);
        const cur = monthMap.get(key) ?? { key, month: snapMonthLabel(r), revenue: 0, expenses: 0, net: 0 };
        cur.revenue += snapRevenue(r);
        cur.expenses += snapExpenses(r);
        cur.net += snapNet(r);
        monthMap.set(key, cur);
      }
      const monthlyChart = Array.from(monthMap.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((v) => ({
          month: v.month,
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
        quotationByStatus,
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

  const year = new Date().getFullYear();
  const kpis: {
    label: string;
    value: string | null;
    icon: typeof DollarSign;
    accent: "positive" | "negative" | "info" | "default";
    sub: string;
  }[] = [
    {
      label: "Cash / Bank",
      value: data ? formatOMR(data.bankBalance) : null,
      icon: Landmark,
      accent: "info",
      sub: "Current balance",
    },
    {
      label: "Receivables (AR)",
      value: data ? formatOMR(data.totalAR) : null,
      icon: ArrowDownLeft,
      accent: "default",
      sub: "Outstanding",
    },
    {
      label: "Payables (AP)",
      value: data ? formatOMR(data.totalAP) : null,
      icon: ArrowUpRight,
      accent: "default",
      sub: "Outstanding",
    },
    {
      label: "Net Position",
      value: data ? formatOMR(data.netPosition) : null,
      icon: Wallet,
      accent: data && data.netPosition >= 0 ? "positive" : "negative",
      sub: "Bank + AR − AP",
    },
    {
      label: "YTD Revenue",
      value: data ? formatOMR(data.ytdRevenue) : null,
      icon: TrendingUp,
      accent: "positive",
      sub: `${year} total`,
    },
    {
      label: "YTD Net",
      value: data ? formatOMR(data.ytdNet) : null,
      icon: BarChart3,
      accent: data && data.ytdNet >= 0 ? "positive" : "negative",
      sub: "Revenue − Expenses",
    },
  ];

  const ScopeIcon = scope === "fitnessbay" ? Dumbbell : Building2;

  const STATUS_TINT: Record<string, string> = {
    preparing: "text-amber-400",
    sent: "text-blue-400",
    follow_up: "text-violet-400",
    waiting_approval: "text-amber-400",
    approved: "text-emerald-400",
    rejected: "text-rose-400",
    // keep legacy statuses tinted sensibly if they ever appear
    draft: "text-amber-400",
    accepted: "text-emerald-400",
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ScopeIcon className="w-4 h-4" />
        </div>
        <div>
          <h1 className="t-page-title text-foreground">Command Center</h1>
          <p className="text-xs text-muted-foreground">{ENTITY_LABELS[scope]}</p>
        </div>
      </div>

      {/* TOP: KPI stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const valueColor =
            kpi.accent === "positive" ? "text-emerald-400"
            : kpi.accent === "negative" ? "text-rose-400"
            : kpi.accent === "info" ? "text-blue-400"
            : "text-foreground";
          return (
            <div
              key={kpi.label}
              className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-1 transition-colors hover:border-primary/25 min-w-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="t-label text-muted-foreground truncate">{kpi.label}</span>
                <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <span className={`t-value tabular-nums block truncate ${valueColor}`} title={kpi.value ?? undefined}>{kpi.value}</span>
              )}
              <span className="t-caption text-muted-foreground/60">{kpi.sub}</span>
            </div>
          );
        })}
      </section>

      {/* MIDDLE: revenue chart + quotation pipeline */}
      <section className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="t-card-title">Revenue & Net — {year}</CardTitle>
            <Link href="/finance/pnl" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              P&L <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-60 w-full" />
            ) : !data?.monthlyChart.length ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No financial snapshot data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthlyChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    formatter={(val: number) => formatOMR(val)}
                    contentStyle={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 15%)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} name="Revenue" maxBarSize={28} />
                  <Bar dataKey="net" fill="hsl(158 64% 52%)" radius={[3, 3, 0, 0]} name="Net" maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quotation Pipeline summary */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="t-card-title">Quotation Pipeline</CardTitle>
            <Link href="/quotations" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              View <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-border/40 pb-3">
              <span className="t-label text-muted-foreground">Total</span>
              <div className="text-right">
                <div className="t-value">{isLoading ? <Skeleton className="h-5 w-10 inline-block" /> : data?.quotationCount ?? 0}</div>
                <div className="t-caption text-muted-foreground">{data ? formatOMR(data.quotationValue) : "—"}</div>
              </div>
            </div>
            <div className="space-y-2">
              {(data?.quotationByStatus ?? [
                { status: "preparing", count: 0, value: 0 },
                { status: "sent", count: 0, value: 0 },
                { status: "follow_up", count: 0, value: 0 },
                { status: "waiting_approval", count: 0, value: 0 },
                { status: "approved", count: 0, value: 0 },
                { status: "rejected", count: 0, value: 0 },
              ]).map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <StatusBadge status={s.status} />
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-bold tabular-nums ${STATUS_TINT[s.status] ?? "text-foreground"}`}>{s.count}</span>
                    <span className="t-caption text-muted-foreground tabular-nums w-28 text-right">{formatOMR(s.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* BOTTOM: operational shortcuts */}
      <section>
        <h2 className="t-section-title text-muted-foreground/70 mb-2">Operations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: "/finance/receivables", label: "Receivables", icon: ArrowDownLeft },
            { href: "/finance/payables", label: "Payables", icon: ArrowUpRight },
            { href: "/finance/bank", label: "Bank", icon: Landmark },
            { href: "/finance/pnl", label: "P&L", icon: TrendingUp },
            { href: "/finance/payroll", label: "HR / Payroll", icon: Users },
            { href: "/vendors", label: "Vendors", icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className="bg-card border border-card-border rounded-lg px-3 py-3 flex items-center gap-2.5 hover:border-primary/40 transition-colors cursor-pointer">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div className="text-[13px] font-medium text-foreground">{item.label}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
