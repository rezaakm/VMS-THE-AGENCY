import { ArrowUp, ArrowDown, ArrowUpDown, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    <th aria-sort={ariaSort} className={`text-left px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium ${className}`}>
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
