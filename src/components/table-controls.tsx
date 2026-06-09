import { ArrowUp, ArrowDown, ArrowUpDown, Search, X, ChevronLeft, ChevronRight, Inbox, AlertTriangle } from "lucide-react";
import { type ElementType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Quiet icon row-action button: low-contrast until row/hover. */
export function RowAction({
  icon: Icon,
  label,
  onClick,
  destructive,
  href,
}: {
  icon: ElementType;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  href?: string;
}) {
  const cls = `inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground ${destructive ? "hover:text-rose-400" : ""}`;
  if (href) {
    return (
      <a href={href} className={cls} aria-label={label} title={label}>
        <Icon className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label} title={label}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Unified loading / empty / error states for table bodies. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-12" : c === 1 ? "w-40 flex-1" : "w-20"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TableEmpty({
  icon: Icon = Inbox,
  title = "No records",
  description,
  children,
}: {
  icon?: ElementType;
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted/50 border border-border/40 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function TableError({ message = "Failed to load data." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">Something went wrong</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: string;
  current?: { key: string; dir: "asc" | "desc" };
  onToggle: (key: string) => void;
  className?: string;
}

export function SortHeader({ label, sortKey, current, onToggle, className = "" }: SortHeaderProps) {
  const active = current?.key === sortKey;
  const ariaSort: "ascending" | "descending" | "none" = active ? (current!.dir === "asc" ? "ascending" : "descending") : "none";
  const nextDirLabel = !active ? "ascending" : current!.dir === "asc" ? "descending" : "none";
  return (
    <th aria-sort={ariaSort} className={`text-left px-3 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        aria-label={`Sort by ${label}, currently ${ariaSort}. Click to sort ${nextDirLabel}.`}
        className={`inline-flex items-center gap-1.5 hover:text-foreground transition-colors ${active ? "text-primary" : ""}`}
      >
        {label}
        {!active && <ArrowUpDown aria-hidden="true" className="w-3 h-3 opacity-40" />}
        {active && current?.dir === "asc" && <ArrowUp aria-hidden="true" className="w-3 h-3" />}
        {active && current?.dir === "desc" && <ArrowDown aria-hidden="true" className="w-3 h-3" />}
      </button>
    </th>
  );
}

interface FilterSelectProps {
  value: string | undefined;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  width?: string;
}

export function FilterSelect({ value, onChange, options, placeholder = "All", width = "w-44" }: FilterSelectProps) {
  return (
    <Select value={value ?? "all"} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface TableToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  totalCount: number;
  filteredCount: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  children?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function TableToolbar({ search, onSearch, searchPlaceholder = "Search...", totalCount, filteredCount, hasActiveFilters, onClearFilters, children, rightSlot }: TableToolbarProps) {
  const filtered = filteredCount !== totalCount;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={searchPlaceholder} value={search} onChange={(e) => onSearch(e.target.value)} className="pl-10" />
        </div>
        {children}
        {(hasActiveFilters || filtered) && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
        {rightSlot}
      </div>
      <div className="text-xs text-muted-foreground">
        {filtered ? `${filteredCount.toLocaleString()} of ${totalCount.toLocaleString()}` : `${totalCount.toLocaleString()} total`}
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  filteredCount: number;
}

export function Pagination({ page, totalPages, onPage, pageSize, onPageSize, filteredCount }: PaginationProps) {
  if (filteredCount === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2">
      <div className="text-xs text-muted-foreground">
        Showing <span className="text-foreground font-medium">{start.toLocaleString()}</span>–<span className="text-foreground font-medium">{end.toLocaleString()}</span> of <span className="text-foreground font-medium">{filteredCount.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100, 250].map(n => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-2" aria-live="polite">
          Page <span className="text-foreground font-medium">{page}</span> of {totalPages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight aria-hidden="true" className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
