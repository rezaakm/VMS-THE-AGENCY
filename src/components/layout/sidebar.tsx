import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, FileSpreadsheet, Users, Calculator, Bot,
  Menu, X, Plus, Upload, ShoppingCart, Receipt, FileSignature,
  ClipboardList, Star, BarChart3, Wand2, TrendingUp, Landmark,
  ArrowDownLeft, ArrowUpRight, Wallet, Clock, Dumbbell,
  UserCircle, Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useEntityScope,
  type EntityScope,
} from "@/hooks/use-entity-scope";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; group: string };

// Grouped nav — Home, Sales, Pipeline, Finance, Procurement, Admin/Tools
const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Home" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Home" },

  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "Sales" },
  { href: "/cost-sheets", label: "Cost Sheets", icon: FileSpreadsheet, group: "Sales" },
  { href: "/quotations", label: "Quotations", icon: FileText, group: "Sales" },
  { href: "/clients", label: "Clients", icon: UserCircle, group: "Sales" },

  { href: "/quote-wizard", label: "Quote Wizard", icon: Wand2, group: "Pipeline" },
  { href: "/pipeline", label: "Quote Pipeline", icon: Zap, group: "Pipeline" },

  { href: "/finance/receivables", label: "Receivables", icon: ArrowDownLeft, group: "Finance" },
  { href: "/finance/payables", label: "Payables", icon: ArrowUpRight, group: "Finance" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "Finance" },
  { href: "/finance/bank", label: "Bank", icon: Landmark, group: "Finance" },
  { href: "/finance/pnl", label: "P&L", icon: TrendingUp, group: "Finance" },
  { href: "/finance/payroll", label: "HR / Payroll", icon: Users, group: "Finance" },
  { href: "/finance/cash-outlook", label: "Cash Outlook", icon: Wallet, group: "Finance" },
  { href: "/finance/pending", label: "Pending", icon: Clock, group: "Finance" },
  { href: "/fitness-bay", label: "Fitness Bay", icon: Dumbbell, group: "Finance" },

  { href: "/rfqs", label: "RFQs", icon: ClipboardList, group: "Procurement" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, group: "Procurement" },
  { href: "/contracts", label: "Contracts", icon: FileSignature, group: "Procurement" },
  { href: "/vendors", label: "Vendors", icon: Users, group: "Procurement" },
  { href: "/evaluations", label: "Evaluations", icon: Star, group: "Procurement" },

  { href: "/calculator", label: "Calculator", icon: Calculator, group: "Admin / Tools" },
  { href: "/assistant", label: "AI Assistant", icon: Bot, group: "Admin / Tools" },
  { href: "/import", label: "Import Data", icon: Upload, group: "Admin / Tools" },
];

const GROUP_ORDER = ["Home", "Sales", "Pipeline", "Finance", "Procurement", "Admin / Tools"];

// Segmented scope control — wired to existing EntityScope context (logic unchanged)
const SCOPE_SEGMENTS: { value: EntityScope; short: string }[] = [
  { value: "group", short: "Group" },
  { value: "agency", short: "Agency" },
  { value: "fitnessbay", short: "Fitness" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scope, setScope } = useEntityScope();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

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
        w-60 h-[100dvh]
        bg-sidebar border-r border-sidebar-border
        flex flex-col
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0 mt-16 md:mt-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="px-4 py-4 hidden md:flex items-center">
          <img src="/logo.png" alt="Modern Lifestyle" className="h-11 w-auto object-contain" />
        </div>

        {/* Scope Switcher — segmented control */}
        <div className="px-3 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-1 mb-1.5">
            Entity Scope
          </div>
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 border border-border/50 p-0.5">
            {SCOPE_SEGMENTS.map((seg) => {
              const active = scope === seg.value;
              return (
                <button
                  key={seg.value}
                  onClick={() => setScope(seg.value)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors
                    ${active
                      ? "bg-primary/90 text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                >
                  {seg.short}
                </button>
              );
            })}
          </div>
        </div>

        <nav className="flex-1 px-3 py-1 overflow-y-auto">
          {GROUP_ORDER.map(group => (
            <div key={group} className="mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold px-2 mb-1">{group}</div>
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
                        relative flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-md text-[13px] font-medium transition-colors
                        ${active
                          ? "bg-primary/10 text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground"
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Link href="/enquiries" className="w-full">
            <Button className="w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-9">
              <Plus className="w-4 h-4" />
              New Enquiry
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
