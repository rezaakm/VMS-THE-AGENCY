import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import {
  UserCircle, FileText, ArrowDownLeft, Search,
  ChevronRight, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

interface ClientRecord {
  name: string;
  quotationCount: number;
  quotationValue: number;
  invoiceCount: number;
  arOutstanding: number;
  enquiryCount: number;
  activeEnquiries: number;
  lastActivity: string | null;
}

function useClients() {
  return useQuery({
    queryKey: ["clients-derived"],
    queryFn: async () => {
      const [quotRes, invRes, arRes, enqRes] = await Promise.all([
        supabase.from("quotations").select("client, totalAmount, createdAt"),
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
            lastActivity: null,
          });
        }
        return clientMap.get(key)!;
      };

      // Quotations
      for (const q of quotRes.data ?? []) {
        const name = q.client || q.clientName;
        if (!name) continue;
        const c = getOrCreate(name);
        c.quotationCount++;
        c.quotationValue += num(q.totalAmount);
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

  const filtered = (clients ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalClients = clients?.length ?? 0;
  const totalQuotationValue = (clients ?? []).reduce((s, c) => s + c.quotationValue, 0);
  const totalAR = (clients ?? []).reduce((s, c) => s + c.arOutstanding, 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <PageHeader
        title="Clients"
        description="Derived from quotations and invoices"
        showScope
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
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
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Client Table */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">
            Client Directory
            {!isLoading && <span className="text-muted-foreground font-normal text-sm ml-2">({filtered.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={UserCircle}
              title={search ? "No matching clients" : "No clients yet"}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Enquiries</TableHead>
                    <TableHead className="text-right">Quotations</TableHead>
                    <TableHead className="text-right">Quoted Value</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Invoices</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">AR Outstanding</TableHead>
                    <TableHead className="hidden md:table-cell">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.name} className="cursor-pointer hover:bg-accent/20">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {client.activeEnquiries > 0 ? (
                          <Badge className="tabular-nums bg-blue-600/20 text-blue-400 border-blue-700 text-[10px]">
                            {client.activeEnquiries} active
                          </Badge>
                        ) : client.enquiryCount > 0 ? (
                          <span className="text-muted-foreground text-xs">{client.enquiryCount}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">
                          {client.quotationCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatOMR(client.quotationValue)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <Badge variant="outline" className="tabular-nums">
                          {client.invoiceCount}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm hidden sm:table-cell ${client.arOutstanding > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {client.arOutstanding > 0 ? formatOMR(client.arOutstanding) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                        {client.lastActivity
                          ? new Date(client.lastActivity).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
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
