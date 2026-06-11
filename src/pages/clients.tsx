import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  UserCircle, FileText, ArrowDownLeft, Search, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableEmpty, TableSkeleton, FilterSelect } from "@/components/table-controls";
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
          });
        }
        return clientMap.get(key)!;
      };

      // Quotations
      for (const q of quotRes.data ?? []) {
        const name = q.client;
        if (!name) continue;
        const c = getOrCreate(name);
        c.quotationCount++;
        c.quotationValue += num(q.totalAmount);
        if ((q.status ?? "").toLowerCase() === "approved") c.hasWonWork = true;
        if (q.createdAt && (!c.lastActivity || q.createdAt > c.lastActivity)) {
          c.lastActivity = q.createdAt;
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

      return Array.from(clientMap.values()).sort((a, b) =>
        b.quotationValue - a.quotationValue
      );
    },
    staleTime: 60_000,
  });
}

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const [search, setSearch] = useState("");
  const [wonFilter, setWonFilter] = useState("all");

  const filtered = (clients ?? []).filter((c) => {
    if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (wonFilter === "won" && !c.hasWonWork) return false;
    if (wonFilter === "none" && c.hasWonWork) return false;
    return true;
  });

  const totalClients = clients?.length ?? 0;
  const totalQuotationValue = (clients ?? []).reduce((s, c) => s + c.quotationValue, 0);
  const totalAR = (clients ?? []).reduce((s, c) => s + c.arOutstanding, 0);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <PageHeader
        title="Clients"
        description="Account list derived from quotations and invoices"
        showScope
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          loading={isLoading}
          title="Total Clients"
          value={String(totalClients)}
          icon={UserCircle}
        />
        <StatCard
          loading={isLoading}
          title="Total Quoted Value"
          value={formatOMR(totalQuotationValue)}
          icon={FileText}
        />
        <StatCard
          loading={isLoading}
          title="Total AR Outstanding"
          value={formatOMR(totalAR)}
          icon={ArrowDownLeft}
          accent={totalAR > 0 ? "negative" : "default"}
        />
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect
          value={wonFilter}
          onChange={setWonFilter}
          options={[
            { value: "won", label: "Has won work" },
            { value: "none", label: "No won work yet" },
          ]}
          placeholder="All clients"
        />
      </div>

      {/* Client Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <TableEmpty
            icon={UserCircle}
            title={search ? "No matching clients" : "No clients yet"}
            description={search ? "Try a different search term." : "Clients appear here once quotations or invoices exist."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                  <th title="Active enquiries in the pipeline (total enquiries on hover badge)" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Enquiries</th>
                  <th title="Number of quotations sent to this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Quotations</th>
                  <th title="Sum of this client's quotation totals" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Quoted Value</th>
                  <th title="Number of sales invoices issued to this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Invoices</th>
                  <th title="Unpaid receivable balance owed by this client" className="text-right px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">AR Outstanding</th>
                  <th title="Most recent enquiry, quotation, or invoice date" className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.name} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {client.activeEnquiries > 0 ? (
                        <Badge variant="info" className="tabular-nums text-[10px]">
                          {client.activeEnquiries} active
                        </Badge>
                      ) : client.enquiryCount > 0 ? (
                        <span className="text-muted-foreground text-xs tabular-nums">{client.enquiryCount}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs">
                      {client.quotationCount || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-foreground whitespace-nowrap">
                      {formatOMR(client.quotationValue)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums text-xs hidden sm:table-cell">
                      {client.invoiceCount || "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-sm tabular-nums whitespace-nowrap hidden sm:table-cell ${client.arOutstanding > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {client.arOutstanding > 0 ? formatOMR(client.arOutstanding) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">
                      {client.lastActivity
                        ? new Date(client.lastActivity).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
