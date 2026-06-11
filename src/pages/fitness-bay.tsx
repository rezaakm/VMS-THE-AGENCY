import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import {
  Dumbbell, TrendingUp, TrendingDown, DollarSign,
  Users, Plus, PiggyBank, UserCheck, UserPlus, CalendarClock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  TableEmpty, TableSkeleton, FilterSelect, TableToolbar, SortHeader, Pagination,
} from "@/components/table-controls";
import { useTableControls } from "@/hooks/use-table-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatOMR, CHART_TOOLTIP } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  snapRevenue, snapNet, snapExpenses, snapYear, snapMonthKey, snapMonthLabel,
} from "@/lib/snap";

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
          .eq("entity", "fitnessbay"),
        supabase
          .from("bank_transactions")
          .select("*")
          .eq("entity", "fitnessbay")
          .order("transaction_date", { ascending: false }),
      ]);

      // Sort snapshots client-side by parsed period (no created_at column).
      const snapshots = [...(snapRes.data ?? [])].sort((a, b) =>
        snapMonthKey(a).localeCompare(snapMonthKey(b)),
      );
      const transactions = txnRes.data ?? [];

      // bank_transactions has debit/credit, not a signed `amount`.
      const txnAmount = (t: any): number => num(t.credit) - num(t.debit);

      // P&L aggregates
      const year = new Date().getFullYear();
      const ytdSnaps = snapshots.filter((r) => snapYear(r) === String(year));
      const ytdRevenue = ytdSnaps.reduce((s, r) => s + snapRevenue(r), 0);
      const ytdExpenses = ytdSnaps.reduce((s, r) => s + snapExpenses(r), 0);
      const ytdNet = ytdSnaps.reduce((s, r) => s + snapNet(r), 0);

      // All-time totals
      const allNet = snapshots.reduce((s, r) => s + snapNet(r), 0);

      // Monthly chart data
      const chartData = snapshots.map((r) => ({
        month: snapMonthLabel(r),
        revenue: snapRevenue(r),
        expenses: snapExpenses(r),
        net: snapNet(r),
      }));

      // Virtual bank: money in / out / retained
      const moneyIn = transactions
        .filter((t) => txnAmount(t) > 0)
        .reduce((s, t) => s + txnAmount(t), 0);
      const moneyOut = transactions
        .filter((t) => txnAmount(t) < 0)
        .reduce((s, t) => s + Math.abs(txnAmount(t)), 0);
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

// Owner's Draw: cumulative gross profit, each partner's share, and the ledger
// of draws taken. Balance = share − drawn; business retained = gross − Σ draws.
const PARTNERS = [
  { key: "reza", label: "Reza (You)", pct: 70 },
  { key: "mahsa", label: "Mahsa", pct: 30 },
] as const;

function useOwnerDrawData() {
  return useQuery({
    queryKey: ["fitness-owner-draws"],
    queryFn: async () => {
      const [shareRes, drawsRes] = await Promise.all([
        supabase.from("fitness_profit_share").select("*").single(),
        supabase.from("owner_draws").select("*"),
      ]);
      const share = shareRes.data;
      const draws = drawsRes.data ?? [];

      const grossProfit = num(share?.gross_profit);
      const asOf = (share?.as_of as string) ?? "";
      const shareByPartner: Record<string, number> = {
        reza: num(share?.reza_share),
        mahsa: num(share?.mahsa_share),
      };

      const drawnByPartner: Record<string, number> = {};
      for (const d of draws) {
        const p = String(d.partner ?? "").toLowerCase();
        drawnByPartner[p] = (drawnByPartner[p] ?? 0) + num(d.amount);
      }
      const totalDrawn = draws.reduce((s, d) => s + num(d.amount), 0);
      const retained = grossProfit - totalDrawn;

      // Newest first.
      const ledger = [...draws].sort((a, b) => {
        const da = a.draw_date ? new Date(a.draw_date).getTime() : 0;
        const db = b.draw_date ? new Date(b.draw_date).getTime() : 0;
        return db - da;
      });

      return { grossProfit, asOf, shareByPartner, drawnByPartner, totalDrawn, retained, ledger };
    },
    staleTime: 60_000,
  });
}

const drawToday = () => new Date().toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

interface MemberRecord {
  id?: string | number;
  name: string | null;
  plan_period: string | null;
  start_date: string | null;
  end_date: string | null;
  months_active: number | null;
  total_amount: number | null;
  is_active: boolean | null;
  category: string | null;
}

/** Parse a date column (YYYY-MM-DD) into a Date, or null if missing/invalid. */
function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = parseISO(String(v));
  return isValid(d) ? d : null;
}

/** Format a date column as "dd MMM yyyy", guarding nulls. */
function fmtDate(v: string | null | undefined): string {
  const d = parseDate(v);
  return d ? format(d, "dd MMM yyyy") : "—";
}

function useFitnessMembers() {
  return useQuery({
    queryKey: ["fitness-members"],
    queryFn: async () => {
      const { data } = await supabase.from("fitness_members").select("*");
      const members = (data ?? []) as MemberRecord[];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusive
      const renewalCutoff = new Date(now);
      renewalCutoff.setDate(renewalCutoff.getDate() + 45);

      const active = members.filter((m) => m.is_active === true);

      const activeCount = active.length;
      const totalCount = members.length;
      const activeValue = active.reduce((s, m) => s + num(m.total_amount), 0);

      const newThisMonth = members.filter((m) => {
        const sd = parseDate(m.start_date);
        return sd != null && sd >= monthStart && sd < monthEnd;
      }).length;

      // Renewals due: active members whose end_date falls in [today, today+45d].
      const renewals = active
        .filter((m) => {
          const ed = parseDate(m.end_date);
          return ed != null && ed >= now && ed <= renewalCutoff;
        })
        .sort((a, b) => {
          const ea = parseDate(a.end_date)!.getTime();
          const eb = parseDate(b.end_date)!.getTime();
          return ea - eb;
        });

      return { members, activeCount, totalCount, activeValue, newThisMonth, renewals };
    },
    staleTime: 60_000,
  });
}

function MembersSection() {
  const { data, isLoading } = useFitnessMembers();
  const [statusFilter, setStatusFilter] = useState("active");

  const ctl = useTableControls<MemberRecord, "name" | "end", never>({
    data: data?.members,
    searchFields: (m) => [m.name],
    sortAccessors: {
      name: (m) => m.name ?? "",
      end: (m) => parseDate(m.end_date),
    },
    defaultSort: { key: "end", dir: "asc" },
    pageSize: 25,
  });

  // Status filter sits alongside table-controls search (default: Active only).
  const rows = ctl.rows.filter((m) => {
    if (statusFilter === "active") return m.is_active === true;
    if (statusFilter === "ended") return m.is_active !== true;
    return true;
  });
  const filteredTotal = ctl.allFiltered.filter((m) => {
    if (statusFilter === "active") return m.is_active === true;
    if (statusFilter === "ended") return m.is_active !== true;
    return true;
  }).length;

  return (
    <section>
      <h2 className="t-section-title text-muted-foreground mb-3">Members</h2>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <StatCard
          loading={isLoading}
          title="Active Members"
          value={String(data?.activeCount ?? 0)}
          icon={UserCheck}
          accent="positive"
          sub="Currently active memberships"
        />
        <StatCard
          loading={isLoading}
          title="Total Members"
          value={String(data?.totalCount ?? 0)}
          icon={Users}
          sub="All-time records"
        />
        <StatCard
          loading={isLoading}
          title="Active Membership Value"
          value={formatOMR(data?.activeValue)}
          icon={DollarSign}
          accent="info"
          sub="Sum of active memberships"
        />
        <StatCard
          loading={isLoading}
          title="New This Month"
          value={String(data?.newThisMonth ?? 0)}
          icon={UserPlus}
          sub="Started this calendar month"
        />
      </div>

      {/* Renewals due soon */}
      <Card className="mb-3">
        <CardHeader>
          <CardTitle className="t-card-title flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-400" />
            Renewals Due Soon
            {!isLoading && (
              <span className="text-muted-foreground font-normal text-xs ml-1">
                (next 45 days · {data?.renewals.length ?? 0})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : !data?.renewals.length ? (
            <EmptyState
              title="No renewals due in the next 45 days"
              description="Active memberships ending soon will appear here so you can chase renewals."
            />
          ) : (
            <ul className="divide-y divide-border/40">
              {data.renewals.map((m, i) => (
                <li key={m.id ?? `${m.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-medium text-foreground truncate">{m.name ?? "—"}</span>
                    <span className="text-muted-foreground/60 shrink-0">·</span>
                    <span className="text-xs text-muted-foreground truncate">{m.plan_period ?? "—"}</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-400 whitespace-nowrap shrink-0">
                    {fmtDate(m.end_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Members table: searchable, filterable, sortable, paginated */}
      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search members by name..."
        totalCount={data?.totalCount ?? 0}
        filteredCount={filteredTotal}
        hasActiveFilters={statusFilter !== "active"}
        onClearFilters={() => { ctl.clearFilters(); setStatusFilter("active"); }}
      >
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: "Active only" },
            { value: "ended", label: "Ended" },
          ]}
          placeholder="All members"
        />
      </TableToolbar>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden mt-3">
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={Users}
            title={ctl.search || statusFilter !== "active" ? "No matching members" : "No members yet"}
            description={ctl.search || statusFilter !== "active" ? "Try a different search or filter." : "Members appear here once the roster is loaded."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <SortHeader label="Name" sortKey="name" current={ctl.sort} onToggle={ctl.toggleSort} />
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Plan</th>
                  <th className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Start</th>
                  <SortHeader label="End" sortKey="end" current={ctl.sort} onToggle={ctl.toggleSort} className="!text-right" />
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id ?? `${m.name}-${i}`} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground">{m.name ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.plan_period ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {fmtDate(m.start_date)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground whitespace-nowrap">
                      {fmtDate(m.end_date)}
                    </td>
                    <td className="px-3 py-2.5">
                      {m.is_active === true ? (
                        <StatusBadge status="active" />
                      ) : (
                        <Badge variant="neutral" className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5">Ended</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && rows.length > 0 && (
        <Pagination
          page={ctl.page}
          totalPages={ctl.totalPages}
          onPage={ctl.setPage}
          pageSize={ctl.pageSize}
          onPageSize={ctl.setPageSize}
          filteredCount={ctl.filteredCount}
        />
      )}
    </section>
  );
}

export default function FitnessBay() {
  const { data, isLoading } = useFitnessBayData();
  const { data: draw, isLoading: drawLoading } = useOwnerDrawData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const year = new Date().getFullYear();

  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [drawSaving, setDrawSaving] = useState(false);
  const [drawForm, setDrawForm] = useState({ partner: "reza", amount: "", date: drawToday(), note: "" });

  function openDrawDialog() {
    setDrawForm({ partner: "reza", amount: "", date: drawToday(), note: "" });
    setDrawDialogOpen(true);
  }

  async function handleRecordDraw(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(drawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setDrawSaving(true);
    const { error } = await supabase.from("owner_draws").insert({
      entity: "fitnessbay",
      partner: drawForm.partner,
      amount,
      draw_date: drawForm.date || drawToday(),
      note: drawForm.note || null,
    });
    setDrawSaving(false);
    if (error) {
      toast({ title: "Error recording draw", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["fitness-owner-draws"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    toast({ title: "Draw recorded" });
    setDrawDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 rounded-lg border-l-2 border-emerald-500/60 bg-card/40 pl-3 py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
          <Dumbbell className="w-4 h-4" />
        </div>
        <PageHeader
          title="Fitness Bay"
          description="P&L, Virtual Bank, and Partner Split"
        />
      </div>

      {/* P&L KPIs */}
      <section>
        <h2 className="t-section-title text-muted-foreground mb-3">
          Profit & Loss ({year} YTD)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
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
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Monthly Revenue & Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data?.chartData.length ? (
            <EmptyState title="No financial data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(val: number) => formatOMR(val)}
                  contentStyle={CHART_TOOLTIP}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="hsl(158 64% 52%)" radius={[3, 3, 0, 0]} name="Revenue" maxBarSize={32} />
                <Bar dataKey="expenses" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} name="Expenses" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Owner's Draw */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="t-section-title text-muted-foreground">Owner's Draw</h2>
          <Button onClick={openDrawDialog} size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold" data-testid="button-record-draw">
            <Plus className="w-4 h-4" /> Record Draw
          </Button>
        </div>

        {/* Cumulative gross profit + retained headline */}
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <div className="bg-card border border-card-border rounded-lg p-4 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <DollarSign className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="t-label text-muted-foreground truncate">Cumulative Gross Profit</span>
            </div>
            {drawLoading ? <Skeleton className="h-6 w-28" /> : (
              <>
                <span className="t-value block truncate tabular-nums text-emerald-400" title={formatOMR(draw?.grossProfit)}>{formatOMR(draw?.grossProfit)}</span>
                <span className="t-caption text-muted-foreground/70">{draw?.asOf}</span>
              </>
            )}
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <PiggyBank className="w-4 h-4 shrink-0 text-blue-400" />
              <span className="t-label text-muted-foreground truncate">Business Retained (undistributed)</span>
            </div>
            {drawLoading ? <Skeleton className="h-6 w-28" /> : (
              <>
                <span className="t-value block truncate tabular-nums text-blue-400" title={formatOMR(draw?.retained)}>{formatOMR(draw?.retained)}</span>
                <span className="t-caption text-muted-foreground/70">Gross profit − total draws</span>
              </>
            )}
          </div>
        </div>

        {/* Per-partner cards: share / taken / balance */}
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          {PARTNERS.map((p) => {
            const shareAmt = draw?.shareByPartner[p.key] ?? 0;
            const taken = draw?.drawnByPartner[p.key] ?? 0;
            const balance = shareAmt - taken;
            return (
              <div key={p.key} className="bg-card border border-card-border rounded-lg p-4 space-y-3" data-testid={`card-partner-${p.key}`}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0 text-primary" />
                  <span className="font-medium text-sm">{p.label}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{p.pct}%</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="t-label text-muted-foreground mb-0.5">Share</div>
                    {drawLoading ? <Skeleton className="h-5 w-full" /> : (
                      <div className="text-sm font-bold tabular-nums text-foreground">{formatOMR(shareAmt)}</div>
                    )}
                  </div>
                  <div>
                    <div className="t-label text-muted-foreground mb-0.5">Taken</div>
                    {drawLoading ? <Skeleton className="h-5 w-full" /> : (
                      <div className="text-sm font-bold tabular-nums text-rose-400">{formatOMR(taken)}</div>
                    )}
                  </div>
                  <div>
                    <div className="t-label text-muted-foreground mb-0.5">Balance</div>
                    {drawLoading ? <Skeleton className="h-5 w-full" /> : (
                      <div className="text-sm font-bold tabular-nums text-emerald-400">{formatOMR(balance)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Draws ledger */}
        <Card>
          <CardHeader>
            <CardTitle className="t-card-title">
              Draws Ledger
              {!drawLoading && <span className="text-muted-foreground font-normal text-xs ml-2">({draw?.ledger.length ?? 0})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drawLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !draw?.ledger.length ? (
              <EmptyState title="No draws recorded yet" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draw.ledger.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {d.draw_date
                            ? new Date(d.draw_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            : "-"}
                        </TableCell>
                        <TableCell className="capitalize">{d.partner ?? "-"}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-rose-400">{formatOMR(num(d.amount))}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">{d.note ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Members */}
      <MembersSection />

      {/* Net Income Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Net Income Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !data?.chartData.length ? (
            <EmptyState title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.chartData}>
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

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">
            Recent Transactions
            {!isLoading && <span className="text-muted-foreground font-normal text-xs ml-2">({data?.transactionCount})</span>}
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
                      <TableCell className="text-sm whitespace-nowrap">
                        {t.transaction_date
                          ? new Date(t.transaction_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{t.description ?? "-"}</TableCell>
                      <TableCell className={`text-right font-mono tabular-nums ${(num(t.credit) - num(t.debit)) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {formatOMR(num(t.credit) - num(t.debit))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{num(t.credit) - num(t.debit) >= 0 ? "Credit" : "Debit"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Draw dialog */}
      <Dialog open={drawDialogOpen} onOpenChange={setDrawDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">Record Owner's Draw</DialogTitle></DialogHeader>
          <form onSubmit={handleRecordDraw} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Partner *</Label>
                <Select value={drawForm.partner} onValueChange={(v) => setDrawForm((f) => ({ ...f, partner: v }))}>
                  <SelectTrigger data-testid="select-draw-partner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARTNERS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Date *</Label>
                <Input type="date" value={drawForm.date} onChange={(e) => setDrawForm((f) => ({ ...f, date: e.target.value }))} required data-testid="input-draw-date" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount (OMR) *</Label>
              <Input type="number" step="0.001" min="0" value={drawForm.amount} onChange={(e) => setDrawForm((f) => ({ ...f, amount: e.target.value }))} required placeholder="e.g. 500.000" data-testid="input-draw-amount" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Note</Label>
              <Input value={drawForm.note} onChange={(e) => setDrawForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional" data-testid="input-draw-note" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDrawDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={drawSaving} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-draw">Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
