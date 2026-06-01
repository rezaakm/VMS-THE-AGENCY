import { useGetReportsOverview, useGetSpendByVendor, useGetMonthlySpend } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ShoppingCart, Receipt, ShieldAlert, FileSignature, ClipboardList, Users, AlertTriangle, TrendingUp, Star } from "lucide-react";

function fmtOMR(v: number) { return `OMR ${v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`; }
function fmtCount(n: number) { return n.toLocaleString("en-US"); }

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger" | "success" | "warning";
  sub?: string;
}
function StatCard({ label, value, icon: Icon, tone = "default", sub }: StatCardProps) {
  const colors = {
    default: "text-primary",
    danger: "text-red-400",
    success: "text-emerald-400",
    warning: "text-yellow-400",
  };
  return (
    <div className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold ${colors[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function ReportsPage() {
  const { data: overview, isLoading } = useGetReportsOverview();
  const { data: spend } = useGetSpendByVendor();
  const { data: monthly } = useGetMonthlySpend();

  if (isLoading || !overview) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      </div>
    );
  }

  const maxMonthly = Math.max(...(monthly ?? []).map(m => Math.max(m.invoiced, m.spend)), 1);
  const maxSpend = Math.max(...(spend ?? []).map(s => s.totalSpend), 1);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Cross-system analytics & financial health</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Quotations" value={fmtCount(overview.totalQuotations)} icon={FileText} sub={fmtOMR(overview.totalQuotationValue)} />
        <StatCard label="Purchase Orders" value={fmtCount(overview.totalPurchaseOrders)} icon={ShoppingCart} sub={fmtOMR(overview.totalPurchaseOrderValue)} />
        <StatCard label="Invoices" value={fmtCount(overview.totalInvoices)} icon={Receipt} sub={fmtOMR(overview.invoicedAmount)} />
        <StatCard label="Outstanding" value={fmtOMR(overview.outstandingAmount)} icon={TrendingUp} tone="warning" sub={`Paid ${fmtOMR(overview.paidAmount)}`} />
        <StatCard label="Active Contracts" value={fmtCount(overview.activeContracts)} icon={FileSignature} tone="success" sub={overview.expiringContracts > 0 ? `${overview.expiringContracts} expiring soon` : "All current"} />
        <StatCard label="Active RFQs" value={fmtCount(overview.activeRfqs)} icon={ClipboardList} />
        <StatCard label="Open Flags" value={fmtCount(overview.openFlags)} icon={ShieldAlert} tone={overview.criticalFlags > 0 ? "danger" : "warning"} sub={overview.criticalFlags > 0 ? `${overview.criticalFlags} critical` : undefined} />
        <StatCard label="Vendors" value={fmtCount(overview.vendorsCount)} icon={Users} />
      </div>

      {overview.criticalFlags > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm">
            <strong className="text-red-400">{overview.criticalFlags} critical financial flag{overview.criticalFlags === 1 ? "" : "s"}</strong>
            <span className="text-muted-foreground"> need attention in Financial Oversight.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-sm font-bold uppercase tracking-wider mb-4">Monthly Cash Flow (Invoices)</div>
          {(monthly ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No invoice data yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {(monthly ?? []).map(m => (
                <div key={m.month} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{m.month}</span>
                    <span className="text-emerald-400">In {fmtOMR(m.invoiced)}</span>
                    <span className="text-red-400">Out {fmtOMR(m.spend)}</span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div className="bg-emerald-500/40 rounded-l" style={{ width: `${(m.invoiced / maxMonthly) * 50}%` }} />
                    <div className="bg-red-500/40 rounded-r" style={{ width: `${(m.spend / maxMonthly) * 50}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-sm font-bold uppercase tracking-wider mb-4">Top Vendor Spend (PO Value)</div>
          {(spend ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No purchase orders yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(spend ?? []).slice(0, 10).map(s => (
                <div key={s.vendorId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold truncate">{s.company}</span>
                    <span className="text-primary font-bold ml-2 shrink-0">{fmtOMR(s.totalSpend)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(s.totalSpend / maxSpend) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.poCount} order{s.poCount === 1 ? "" : "s"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-5">
        <div className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Top Vendors by Evaluation</div>
        {overview.topVendorsByEvalScore.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No evaluations yet. Rate vendors after completed jobs to populate this leaderboard.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.topVendorsByEvalScore.map((v, idx) => (
              <div key={v.vendorId} className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
                <div className="text-2xl font-bold text-primary w-8 text-center">#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{v.company}</div>
                  <div className="text-xs text-muted-foreground">{v.evalCount} evaluation{v.evalCount === 1 ? "" : "s"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">{v.avgScore.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">/ 5</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
