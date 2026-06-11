import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dumbbell, TrendingUp, TrendingDown, DollarSign,
  Users, Plus, PiggyBank,
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
