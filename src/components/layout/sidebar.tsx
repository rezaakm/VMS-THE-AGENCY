import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, FileSpreadsheet, Users, Calculator, Bot, Menu, X, Plus, Upload, ShoppingCart, Receipt, FileSignature, ClipboardList, Star, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Overview" },
  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "Sales" },
  { href: "/cost-sheets", label: "Cost Sheets", icon: FileSpreadsheet, group: "Sales" },
  { href: "/quotations", label: "Quotations", icon: FileText, group: "Sales" },
  { href: "/rfqs", label: "RFQs", icon: ClipboardList, group: "Procurement" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, group: "Procurement" },
  { href: "/contracts", label: "Contracts", icon: FileSignature, group: "Procurement" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "Finance" },
  { href: "/vendors", label: "Vendors", icon: Users, group: "Vendors" },
  { href: "/evaluations", label: "Evaluations", icon: Star, group: "Vendors" },
  { href: "/calculator", label: "Calculator", icon: Calculator, group: "Tools" },
  { href: "/assistant", label: "AI Assistant", icon: Bot, group: "Tools" },
  { href: "/import", label: "Import Data", icon: Upload, group: "Tools" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/" && location !== "/") return false;
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
        w-64 h-[100dvh]
        bg-sidebar border-r border-sidebar-border
        flex flex-col
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0 mt-16 md:mt-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="px-4 py-5 hidden md:flex items-center">
          <img src="/logo.png" alt="The Agency" className="h-14 w-auto object-contain" />
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          {Array.from(new Set(navItems.map(i => i.group))).map(group => (
            <div key={group} className="mb-4">
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
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
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
            <Button className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider text-xs">
              <Plus className="w-4 h-4" />
              New Enquiry
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}