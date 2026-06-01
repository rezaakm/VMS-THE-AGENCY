import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

type Primitive = string | number | Date | null | undefined;

export interface TableControlsOptions<T, SortKey extends string, FilterKey extends string> {
  data: T[] | undefined;
  searchFields?: (item: T) => Array<string | null | undefined>;
  sortAccessors?: Record<SortKey, (item: T) => Primitive>;
  defaultSort?: SortState<SortKey>;
  filterAccessors?: Record<FilterKey, (item: T) => string | null | undefined>;
  pageSize?: number;
}

export function useTableControls<T, SortKey extends string = string, FilterKey extends string = string>(
  opts: TableControlsOptions<T, SortKey, FilterKey>
) {
  const { data, searchFields, sortAccessors, defaultSort, filterAccessors, pageSize = 25 } = opts;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<SortKey> | undefined>(defaultSort);
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  const filtered = useMemo(() => {
    let out = data ?? [];
    if (search.trim() && searchFields) {
      const q = search.trim().toLowerCase();
      out = out.filter((item) => searchFields(item).some((v) => (v ?? "").toString().toLowerCase().includes(q)));
    }
    if (filterAccessors) {
      for (const [k, v] of Object.entries(filters) as Array<[FilterKey, string | undefined]>) {
        if (v && v !== "all") {
          const accessor = filterAccessors[k];
          out = out.filter((item) => (accessor(item) ?? "") === v);
        }
      }
    }
    if (sort && sortAccessors) {
      const accessor = sortAccessors[sort.key];
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const va = accessor(a), vb = accessor(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va instanceof Date && vb instanceof Date) return (va.getTime() - vb.getTime()) * dir;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" }) * dir;
      });
    }
    return out;
  }, [data, search, filters, sort, searchFields, sortAccessors, filterAccessors]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => filtered.slice((safePage - 1) * size, safePage * size), [filtered, safePage, size]);

  function toggleSort(key: SortKey) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return undefined;
    });
    setPage(1);
  }

  function setFilter(key: FilterKey, value: string) {
    setFilters((cur) => ({ ...cur, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({});
    setSearch("");
    setPage(1);
  }

  return {
    search, setSearch: (v: string) => { setSearch(v); setPage(1); },
    sort, toggleSort, setSort: (s: SortState<SortKey> | undefined) => { setSort(s); setPage(1); },
    filters, setFilter, clearFilters,
    page: safePage, setPage, totalPages, pageSize: size, setPageSize: (n: number) => { setSize(n); setPage(1); },
    filteredCount: filtered.length,
    totalCount: (data ?? []).length,
    rows: paged,
    allFiltered: filtered,
  };
}
