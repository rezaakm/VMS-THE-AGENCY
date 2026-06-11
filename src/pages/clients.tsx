import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  UserCircle, FileText, Building2, Trophy, Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableEmpty, TableSkeleton, FilterSelect, TableToolbar, SortHeader, Pagination } from "@/components/table-controls";
import { useTableControls } from "@/hooks/use-table-controls";
import { formatOMR } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

interface ClientRecord {
  name: string;
  quotationCount: number;
  quotationValue: number;
  invoiceCount: number;
  arOutstanding: number;
  enquiryCount: number;
  activeEnquiries: number;
  hasWonWork: boolean;
  lastActivity: string | null;
  // analytics derived from this client's quotations
  wonCount: number;
  wonValue: number;
  lostCount: number;
  decided: number;
  successRate: number | null;
  rejectRate: number | null;
  jobsPerMonth: number;
  /** internal: track distinct YYYY-MM keys spanned by quotations */
  _months: Set<string>;
}

function useClients() {
  return useQuery({
    queryKey: ["clients-derived"],
    queryFn: async () => {
      const [quotRes, invRes, arRes, enqRes] = await Promise.all([
        supabase.from("quotations").select("client, totalAmount, status, createdAt"),
        supabase.from("sales_invoices").select("client_name, amount, created_at"),
        supabase.from("ar_entries").select("client_name, balance"),
        supabase.from("enquiries").select("client, status, createdAt"),
      ]);

      const clientMap = new Map<string, ClientRecord>();

      const getOrCreate = (name: string): ClientRecord => {
        const key = name.trim().toLowerCase();
        if (!clientMap.has(key)) {
          clientMap.set(key, {
            name: name.trim(),
            quotationCount: 0,
            quotationValue: 0,
            invoiceCount: 0,
            arOutstanding: 0,
            enquiryCount: 0,
            activeEnquiries: 0,
            hasWonWork: false,
            lastActivity: null,
            wonCount: 0,
            wonValue: 0,
            lostCount: 0,
            decided: 0,
            successRate: null,
            rejectRate: null,
            jobsPerMonth: 0,
            _months: new Set<string>(),
          });
        }
        return clientMap.get(key)!;
      };

      // Quotations — source of all conversion analytics
      for (const q of quotRes.data ?? []) {
        const name = q.client;
        if (!name) continue;
        const c = getOrCreate(name);
        c.quotationCount++;
        c.quotationValue += num(q.totalAmount);
        const status = (q.status ?? "").toLowerCase();
        if (status === "approved") {
          c.hasWonWork = true;
          c.wonCount++;
          c.wonValue += num(q.totalAmount);
        } else if (status === "rejected") {
          c.lostCount++;
        }
        if (q.createdAt) {
          c._months.add(String(q.createdAt).slice(0, 7)); // YYYY-MM
          if (!c.lastActivity || q.createdAt > c.lastActivity) c.lastActivity = q.createdAt;
        }
      }

      // Sales invoices
      for (const inv of invRes.data ?? []) {
        if (!inv.client_name) continue;
        const c = getOrCreate(inv.client_name);
        c.invoiceCount++;
        if (inv.created_at && (!c.lastActivity || inv.created_at > c.lastActivity)) {
          c.lastActivity = inv.created_at;
        }
      }

      // AR entries
      for (const ar of arRes.data ?? []) {
        if (!ar.client_name) continue;
        const c = getOrCreate(ar.client_name);
        c.arOutstanding += num(ar.balance);
      }

      // Enquiries (pipeline status)
      const activeStatuses = new Set(["new", "in_progress", "drafting", "approved", "quoted"]);
      for (const enq of enqRes.data ?? []) {
        if (!enq.client) continue;
        const c = getOrCreate(enq.client);
        c.enquiryCount++;
        if (activeStatuses.has(enq.status)) c.activeEnquiries++;
        if (enq.createdAt && (!c.lastActivity || enq.createdAt > c.lastActivity)) {
          c.lastActivity = enq.createdAt;
        }
      }

      // Finalise derived conversion metrics
      for (const c of clientMap.values()) {
        c.decided = c.wonCount + c.lostCount;
        c.successRate = c.decided > 0 ? c.wonCount / c.decided : null;
        c.rejectRate = c.decided > 0 ? c.lostCount / c.decided : null;
        const monthSpan = Math.max(1, c._months.size);
        c.jobsPerMonth = Math.round((c.quotationCount / monthSpan) * 10) / 10;
      }

      return Array.from(clientMap.values()).sort((a, b) =>
        b.quotationValue - a.quotationValue
      );
    },
    staleTime: 60_000,
  });
}

/** Win-rate dot colour: green >=60%, amber 30-59%, red <30%. */
function rateDot(rate: number | null): { dot: string; text: string } {
  if (rate == null) return { dot: "", text: "text-muted-foreground" };
  if (rate >= 0.6) return { dot: "bg-emerald-400", text: "text-emerald-400" };
  if (rate >= 0.3) return { dot: "bg-amber-400", text: "text-amber-400" };
  return { dot: "bg-rose-400", text: "text-rose-400" };
}

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const [wonFilter, setWonFilter] = useState("all");

  const ctl = useTableControls<ClientRecord, "winRate" | "wonValue" | "quotedValue" | "jobs", never>({
    data: clients,
    searchFields: (c) => [c.name],
    sortAccessors: {
      winRate: (c) => (c.successRate == null ? -1 : c.successRate),
      wonValue: (c) => c.wonValue,
      quotedValue: (c) => c.quotationValue,
      jobs: (c) => c.jobsPerMonth,
    },
    defaultSort: { key: "quotedValue", dir: "desc" },
    pageSize: 25,
  });

  // Won/not filter sits alongside the table-controls search.
  const rows = ctl.rows.filter((c) => {
    if (wonFilter === "won" && !c.hasWonWork) return false;
    if (wonFilter === "none" && c.hasWonWork) return false;
    return true;
  });

  // Aggregate KPIs across all clients
  const totalClients = clients?.length ?? 0;
  const totalQuotationValue = (clients ?? []).reduce((s, c) => s + c.quotationValue, 0);
  const totalBusinessWon = (clients ?? []).reduce((s, c) => s + c.wonValue, 0);
  const aggWon = (clients ?? []).reduce((s, c) => s + c.wonCount, 0);
  const aggDecided = (clients ?? []).reduce((s, c) => s + c.decided, 0);
  const overallWinRate = aggDecided > 0 ? aggWon / aggDecided : null;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <PageHeader
        title="Clients"
        description="Conversion analytics derived from quotations and invoices"
        showScope
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          title="Total Clients"
          value={String(totalClients)}
          icon={UserCircle}
        />
        <StatCard
          loading={isLoading}
          title="Total Business Won"
          value={formatOMR(totalBusinessWon)}
          icon={Trophy}
          accent="positive"
        />
        <StatCard
          loading={isLoading}
          title="Overall Win Rate"
          value={pct(overallWinRate)}
          icon={Target}
          accent={overallWinRate != null && overallWinRate >= 0.5 ? "positive" : "info"}
          sub={aggDecided > 0 ? `${aggWon} won of ${aggDecided} decided` : "No decided quotes yet"}
        />
        <StatCard
          loading={isLoading}
          title="Total Quoted Value"
          value={formatOMR(totalQuotationValue)}
          icon={FileText}
        />
      </div>

      {/* Search + won/not filter */}
      <TableToolbar
        search={ctl.search}
        onSearch={ctl.setSearch}
        searchPlaceholder="Search clients..."
        totalCount={totalClients}
        filteredCount={rows.length}
        hasActiveFilters={wonFilter !== "all"}
        onClearFilters={() => { ctl.clearFilters(); setWonFilter("all"); }}
      >
        <FilterSelect
          value={wonFilter}
          onChange={setWonFilter}
          options={[
            { value: "won", label: "Has won work" },
            { value: "none", label: "No won work yet" },
          ]}
          placeholder="All clients"
        />
      </TableToolbar>

      {/* Client Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={UserCircle}
            title={ctl.search || wonFilter !== "all" ? "No matching clients" : "No clients yet"}
            description={ctl.search || wonFilter !== "all" ? "Try a different search or filter." : "Clients appear here once quotations or invoices exist."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                  <SortHeader label="Win Rate" sortKey="winRate" current={ctl.sort} onToggle={ctl.toggleSort} className="!text-right" />
                  <SortHeader label="Won" sortKey="wonValue" current={ctl.sort} onToggle={ctl.toggleSort} className="!text-right" />
                  <th title="Share of decided quotes that were rejected" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Reject Rate</th>
                  <th title="Number of quotations sent to this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Quotations</th>
                  <SortHeader label="Quoted Value" sortKey="quotedValue" current={ctl.sort} onToggle={ctl.toggleSort} className="!text-right" />
                  <SortHeader label="Jobs/mo" sortKey="jobs" current={ctl.sort} onToggle={ctl.toggleSort} className="!text-right hidden lg:table-cell" />
                  <th title="Number of sales invoices issued to this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Invoices</th>
                  <th title="Unpaid receivable balance owed by this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden xl:table-cell">AR Outstanding</th>
                  <th title="Most recent enquiry, quotation, or invoice date" className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden xl:table-cell">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const rd = rateDot(client.successRate);
                  return (
                    <tr key={client.name} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{client.name}</span>
                          {client.activeEnquiries > 0 && (
                            <Badge variant="info" className="tabular-nums text-[10px]">
                              {client.activeEnquiries} active
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {client.successRate == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${rd.dot}`} />
                            <span className={`font-medium ${rd.text}`}>{pct(client.successRate)}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {client.wonCount > 0 ? (
                          <span className="tabular-nums">
                            <span className="text-foreground font-medium">{client.wonCount}</span>
                            <span className="text-muted-foreground/60 mx-1">·</span>
                            <span className="font-mono text-xs text-emerald-400">{formatOMR(client.wonValue)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs hidden sm:table-cell text-muted-foreground">
                        {client.rejectRate == null ? "—" : pct(client.rejectRate)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs hidden md:table-cell">
                        {client.quotationCount || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-foreground whitespace-nowrap">
                        {formatOMR(client.quotationValue)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs hidden lg:table-cell">
                        {client.quotationCount > 0 ? client.jobsPerMonth.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs hidden lg:table-cell">
                        {client.invoiceCount || "—"}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-sm tabular-nums whitespace-nowrap hidden xl:table-cell ${client.arOutstanding > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {client.arOutstanding > 0 ? formatOMR(client.arOutstanding) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap hidden xl:table-cell">
                        {client.lastActivity
                          ? new Date(client.lastActivity).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
