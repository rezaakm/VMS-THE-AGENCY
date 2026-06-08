import { useGetEnquiryStats, useGetRecentQuotations } from "@workspace/api-client-react";
import { Link } from "wouter";
import { FileText, Users, FileSpreadsheet, Calculator, Bot, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-200",
  sent: "bg-blue-900 text-blue-200",
  approved: "bg-green-900 text-green-200",
  rejected: "bg-red-900 text-red-200",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  rejected: "Rejected",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetEnquiryStats();
  const { data: recentQuotations, isLoading: quotationsLoading } = useGetRecentQuotations();

  const statCards = [
    { label: "Total Enquiries", value: stats?.total ?? 0, icon: FileText, color: "text-primary" },
    { label: "New", value: stats?.new ?? 0, icon: AlertCircle, color: "text-blue-400" },
    { label: "In Progress", value: stats?.inProgress ?? 0, icon: Clock, color: "text-blue-400" },
    { label: "Quoted", value: stats?.quoted ?? 0, icon: TrendingUp, color: "text-orange-400" },
    { label: "Won", value: stats?.won ?? 0, icon: CheckCircle, color: "text-green-400" },
    { label: "Lost", value: stats?.lost ?? 0, icon: XCircle, color: "text-red-400" },
  ];

  const quickLinks = [
    { href: "/enquiries", label: "New Enquiry", icon: FileText, desc: "Log a client enquiry" },
    { href: "/cost-sheets", label: "Cost Sheet", icon: FileSpreadsheet, desc: "Build a cost sheet" },
    { href: "/quotations", label: "Quotation", icon: TrendingUp, desc: "Create a quotation" },
    { href: "/vendors", label: "Vendors", icon: Users, desc: "Manage vendor contacts" },
    { href: "/calculator", label: "Calculator", icon: Calculator, desc: "Quick calculations" },
    { href: "/assistant", label: "AI Assistant", icon: Bot, desc: "Ask anything" },
  ];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground" data-testid="text-dashboard-title">
          Operations
        </h1>
        <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest">The Agency — Command Center</p>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Enquiry Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-2 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                data-testid={`card-stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</span>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group" data-testid={`link-quick-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Icon className="w-6 h-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Quotations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Recent Quotations</h2>
          <Link href="/quotations">
            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider text-primary hover:text-primary">
              View All
            </Button>
          </Link>
        </div>
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          {quotationsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !recentQuotations || recentQuotations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No quotations yet. <Link href="/quotations" className="text-primary hover:underline">Create one</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">S.N.</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Subject</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotations.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-card-border/50 hover:bg-accent/20 transition-colors cursor-pointer"
                    data-testid={`row-quotation-${q.id}`}
                  >
                    <td className="px-6 py-3">
                      <Link href={`/quotations/${q.id}`} className="text-primary font-mono text-xs hover:underline">{q.serialNumber}</Link>
                    </td>
                    <td className="px-6 py-3 text-foreground font-medium">{q.clientName}</td>
                    <td className="px-6 py-3 text-muted-foreground truncate max-w-[200px]">{q.subject}</td>
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{q.quotationDate}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${statusColors[q.status] ?? "bg-zinc-700 text-zinc-200"}`}>
                        {statusLabel[q.status] ?? q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
