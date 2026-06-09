import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, FileSpreadsheet, Users, Calculator, Bot,
  Menu, X, Plus, Upload, ShoppingCart, Receipt, FileSignature,
  ClipboardList, Star, BarChart3, Wand2, TrendingUp, Landmark,
  ArrowDownLeft, ArrowUpRight, Wallet, Clock, Building2, Dumbbell,
  ChevronsUpDown, UserCircle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  useEntityScope,
  ENTITY_LABELS,
  type EntityScope,
} from "@/hooks/use-entity-scope";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Overview" },
  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "Sales" },
  { href: "/cost-sheets", label: "Cost Sheets", icon: FileSpreadsheet, group: "Sales" },
  { href: "/quotations", label: "Quotations", icon: FileText, group: "Sales" },
  { href: "/quote-wizard", label: "Quote Wizard", icon: Wand2, group: "Sales" },
  { href: "/rfqs", label: "RFQs", icon: ClipboardList, group: "Procurement" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, group: "Procurement" },
  { href: "/contracts", label: "Contracts", icon: FileSignature, group: "Procurement" },
  { href: "/clients", label: "Clients", icon: UserCircle, group: "Accounts" },
  { href: "/finance/receivables", label: "Receivables", icon: ArrowDownLeft, group: "Accounts" },
  { href: "/finance/payables", label: "Payables", icon: ArrowUpRight, group: "Accounts" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "Accounts" },
  { href: "/finance/bank", label: "Bank", icon: Landmark, group: "Finance" },
  { href: "/finance/pnl", label: "P&L", icon: TrendingUp, group: "Finance" },
  { href: "/finance/payroll", label: "HR / Payroll", icon: Users, group: "Finance" },
  { href: "/finance/cash-outlook", label: "Cash Outlook", icon: Wallet, group: "Finance" },
  { href: "/finance/pending", label: "Pending", icon: Clock, group: "Finance" },
  { href: "/fitness-bay", label: "Fitness Bay", icon: Dumbbell, group: "Fitness Bay" },
  { href: "/vendors", label: "Vendors", icon: Users, group: "Vendors" },
  { href: "/evaluations", label: "Evaluations", icon: Star, group: "Vendors" },
  { href: "/calculator", label: "Calculator", icon: Calculator, group: "Tools" },
  { href: "/assistant", label: "AI Assistant", icon: Bot, group: "Tools" },
  { href: "/import", label: "Import Data", icon: Upload, group: "Tools" },
];

const SCOPE_OPTIONS: EntityScope[] = ["group", "agency", "fitnessbay"];
const SCOPE_ICONS: Record<EntityScope, typeof Building2> = {
  group: Building2,
  agency: Building2,
  fitnessbay: Dumbbell,
};

export function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const { scope, setScope } = useEntityScope();

  // Close scope dropdown on outside click
  useEffect(() => {
    if (!scopeOpen) return;
    const handler = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) {
        setScopeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [scopeOpen]);

  const isActive = (href: string) => {
    if (href === "/" && location !== "/") return false;
    if (href === "/finance") return location === "/finance";
    return location.startsWith(href);
  };

  const ScopeIcon = SCOPE_ICONS[scope];

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-background z-50 flex items-center justify-between px-4">
        <img src="/logo.png" alt="The Agency" className="h-9 w-auto object-contain" />
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar Content */}
      <div className={`
        fixed md:sticky top-0 left-0 z-40
        w-64 h-[100dvh]
        bg-sidebar border-r border-sidebar-border
        flex flex-col
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0 mt-16 md:mt-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Gradient shine at top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent pointer-events-none" />

        <div className="px-4 py-5 hidden md:flex items-center relative z-10">
          <img src="/logo.png" alt="Modern Lifestyle" className="h-14 w-auto object-contain" />
        </div>

        {/* Scope Switcher */}
        <div className="px-4 pb-3 relative z-10" ref={scopeRef}>
          <button
            onClick={() => setScopeOpen(!scopeOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors text-sm"
          >
            <ScopeIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1 text-left font-medium text-foreground truncate">
              {ENTITY_LABELS[scope]}
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </button>
          {scopeOpen && (
            <div className="absolute left-4 right-4 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {SCOPE_OPTIONS.map((s) => {
                const Icon = SCOPE_ICONS[s];
                return (
                  <button
                    key={s}
                    onClick={() => { setScope(s); setScopeOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/50
                      ${s === scope ? "bg-primary/10 text-primary font-medium" : "text-foreground"}
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {ENTITY_LABELS[s]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          {Array.from(new Set(navItems.map(i => i.group))).map(group => (
            <div key={group} className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold px-3 mb-1">{group}</div>
              <div className="space-y-0.5">
                {navItems.filter(i => i.group === group).map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${active
                          ? "bg-primary/15 text-sidebar-accent-foreground border-l-2 border-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/enquiries" className="w-full">
            <Button className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider text-xs" style={{ animation: "pulse-glow 3s ease-in-out infinite" }}>
              <Plus className="w-4 h-4" />
              New Enquiry
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
