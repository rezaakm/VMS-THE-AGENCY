import { useEffect, useState } from "react";
import {
  Activity, ShieldCheck, ShieldAlert, Database, CheckCircle2,
  XCircle, Clock, CalendarClock, Landmark,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Key tables to probe. A failed select here usually means a missing GRANT or
// RLS policy — the exact class of bug that produced the recent 403.
const KEY_TABLES = [
  "quotations", "quotation_items", "cost_sheets", "cost_sheet_items",
  "monthly_financial_snapshots", "ar_entries", "ap_entries", "sales_invoices",
  "bank_accounts", "bank_transactions", "vendors", "enquiries",
  "payroll_entries", "contracts", "rfqs", "invoices",
] as const;

type TableCheck = {
  table: string;
  status: "loading" | "ok" | "blocked";
  count: number | null;
  errorCode?: string;
  errorMessage?: string;
};

type Freshness = {
  loading: boolean;
  latestSnapshot: string | null;
  latestQuotation: string | null;
  latestBankTxn: string | null;
};

function hostFromUrl(url?: string): string {
  if (!url) return "—";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default function SystemHealth() {
  const { user, session, loading: authLoading } = useAuth();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const clientInitialized = typeof supabase?.from === "function";

  const [checks, setChecks] = useState<TableCheck[]>(() =>
    KEY_TABLES.map((t) => ({ table: t, status: "loading", count: null })),
  );

  const [freshness, setFreshness] = useState<Freshness>({
    loading: true,
    latestSnapshot: null,
    latestQuotation: null,
    latestBankTxn: null,
  });

  // Table access probes — read-only head/count, run in parallel, render as they
  // resolve. Each probe is isolated so one failure never breaks the page.
  useEffect(() => {
    let cancelled = false;

    KEY_TABLES.forEach(async (table) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (cancelled) return;

        setChecks((prev) =>
          prev.map((c) =>
            c.table === table
              ? error
                ? {
                    table,
                    status: "blocked",
                    count: null,
                    errorCode: (error as { code?: string }).code,
                    errorMessage: error.message,
                  }
                : { table, status: "ok", count: count ?? 0 }
              : c,
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setChecks((prev) =>
          prev.map((c) =>
            c.table === table
              ? {
                  table,
                  status: "blocked",
                  count: null,
                  errorMessage: err instanceof Error ? err.message : String(err),
                }
              : c,
          ),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Data freshness — newest record per source. All read-only with limit 1.
  // Errors are swallowed (left as null) so a blocked table never breaks this.
  useEffect(() => {
    let cancelled = false;

    // Supabase query builders are thenables (not real Promises), so wrap each
    // in a resolved Promise to get a real .catch and isolate failures.
    const safe = <T,>(p: PromiseLike<{ data: T | null }>) =>
      Promise.resolve(p).catch(() => ({ data: null as T | null }));

    async function loadFreshness() {
      const [snapRes, quoteRes, bankRes] = await Promise.all([
        safe<{ period?: string }[]>(
          supabase
            .from("monthly_financial_snapshots")
            .select("period")
            .limit(1000),
        ),
        safe<{ createdAt?: string }[]>(
          supabase
            .from("quotations")
            .select("createdAt")
            .order("createdAt", { ascending: false })
            .limit(1),
        ),
        safe<{ transaction_date?: string }[]>(
          supabase
            .from("bank_transactions")
            .select("transaction_date")
            .order("transaction_date", { ascending: false })
            .limit(1),
        ),
      ]);

      if (cancelled) return;

      // period is text like "January-2026" — pick the most recent by parsed date.
      const periods = (snapRes.data as { period?: string }[] | null) ?? [];
      let latestSnapshot: string | null = null;
      let latestSnapshotTime = -Infinity;
      for (const row of periods) {
        const p = row.period;
        if (!p) continue;
        const t = new Date(p.replace("-", " ")).getTime();
        if (Number.isFinite(t) && t > latestSnapshotTime) {
          latestSnapshotTime = t;
          latestSnapshot = p;
        }
      }

      const quoteRow = (quoteRes.data as { createdAt?: string }[] | null)?.[0];
      const bankRow = (bankRes.data as { transaction_date?: string }[] | null)?.[0];

      setFreshness({
        loading: false,
        latestSnapshot,
        latestQuotation: quoteRow?.createdAt ?? null,
        latestBankTxn: bankRow?.transaction_date ?? null,
      });
    }

    loadFreshness();

    return () => {
      cancelled = true;
    };
  }, []);

  const blocked = checks.filter((c) => c.status === "blocked");
  const stillLoading = checks.some((c) => c.status === "loading");
  const allOk = !stillLoading && blocked.length === 0;

  const fmtDate = (v: string | null) => {
    if (!v) return "—";
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? format(new Date(v), "dd MMM yyyy") : v;
  };

  const sessionExpiry = session?.expires_at
    ? format(new Date(session.expires_at * 1000), "dd MMM yyyy, HH:mm")
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Internal read-only diagnostics — connection, table access, and data freshness"
      />

      {/* Warnings / all-clear banner */}
      {stillLoading ? (
        <Card className="border-border/60">
          <div className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 shrink-0 animate-pulse text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Running diagnostics…</p>
              <p className="text-xs text-muted-foreground">
                Probing {KEY_TABLES.length} tables for read access.
              </p>
            </div>
          </div>
        </Card>
      ) : allOk ? (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.06]">
          <div className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-300">All systems nominal</p>
              <p className="text-xs text-muted-foreground">
                Every key table is readable and the Supabase client is connected.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-rose-500/40 bg-rose-500/[0.07]">
          <div className="flex items-start gap-3 p-4">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-300">
                {blocked.length} table{blocked.length === 1 ? "" : "s"} blocked
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The following returned an access error, which usually indicates a
                missing GRANT or an RLS policy that denies the current role:{" "}
                <span className="font-medium text-foreground">
                  {blocked.map((b) => b.table).join(", ")}
                </span>
                .
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Connection & Auth */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Connection &amp; Auth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
              <dt className="text-xs text-muted-foreground">Supabase host</dt>
              <dd className="text-sm font-medium tabular-nums truncate">
                {hostFromUrl(supabaseUrl)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
              <dt className="text-xs text-muted-foreground">Client initialized</dt>
              <dd>
                {clientInitialized ? (
                  <Badge variant="success" className="text-[10px] uppercase tracking-wider">
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="danger" className="text-[10px] uppercase tracking-wider">
                    No
                  </Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
              <dt className="text-xs text-muted-foreground">Auth status</dt>
              <dd>
                {authLoading ? (
                  <Badge variant="neutral" className="text-[10px] uppercase tracking-wider">
                    Checking
                  </Badge>
                ) : session ? (
                  <Badge variant="success" className="text-[10px] uppercase tracking-wider">
                    Signed in
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-[10px] uppercase tracking-wider">
                    Signed out
                  </Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
              <dt className="text-xs text-muted-foreground">User</dt>
              <dd className="text-sm font-medium truncate">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 sm:border-b-0">
              <dt className="text-xs text-muted-foreground">Session expires</dt>
              <dd className="text-sm font-medium tabular-nums">{sessionExpiry ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Table access checks — the key feature */}
      <Card>
        <CardHeader>
          <CardTitle className="t-card-title flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Table Access Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.table}>
                  <TableCell className="font-mono text-xs">{c.table}</TableCell>
                  <TableCell>
                    {c.status === "loading" ? (
                      <Skeleton className="h-4 w-16 rounded" />
                    ) : c.status === "ok" ? (
                      <Badge variant="success" className="gap-1 text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="gap-1 text-[10px] uppercase tracking-wider">
                        <XCircle className="h-3 w-3" />
                        Blocked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {c.status === "loading" ? (
                      <Skeleton className="ml-auto h-4 w-10 rounded" />
                    ) : c.count === null ? (
                      "—"
                    ) : (
                      c.count.toLocaleString()
                    )}
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-xs text-muted-foreground">
                    {c.status === "blocked"
                      ? [c.errorCode, c.errorMessage].filter(Boolean).join(" · ")
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Data freshness */}
      <div>
        <h2 className="t-card-title mb-3 flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Data Freshness
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            title="Latest Snapshot Period"
            value={freshness.latestSnapshot ?? "—"}
            icon={CalendarClock}
            loading={freshness.loading}
          />
          <StatCard
            title="Latest Quotation"
            value={fmtDate(freshness.latestQuotation)}
            icon={Activity}
            loading={freshness.loading}
          />
          <StatCard
            title="Latest Bank Transaction"
            value={fmtDate(freshness.latestBankTxn)}
            icon={Landmark}
            loading={freshness.loading}
          />
        </div>
      </div>
    </div>
  );
}
