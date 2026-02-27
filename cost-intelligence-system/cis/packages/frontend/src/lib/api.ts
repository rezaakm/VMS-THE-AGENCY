const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  // Search
  search: (q: string, limit = 50) => fetchAPI(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  benchmark: (q: string) => fetchAPI(`/api/search/benchmark?q=${encodeURIComponent(q)}`),
  recommendVendors: (q: string) => fetchAPI(`/api/search/recommend-vendors?q=${encodeURIComponent(q)}`),
  dashboard: () => fetchAPI('/api/search/dashboard'),

  // Projects
  projects: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/api/projects${qs}`);
  },
  project: (id: string) => fetchAPI(`/api/projects/${id}`),
  projectYears: () => fetchAPI('/api/projects/years'),

  // Vendors
  vendors: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/api/vendors${qs}`);
  },
  vendor: (id: string) => fetchAPI(`/api/vendors/${id}`),

  // Clients
  clients: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/api/clients${qs}`);
  },
  client: (id: string) => fetchAPI(`/api/clients/${id}`),

  // Categories
  categories: () => fetchAPI('/api/categories'),
  category: (id: string) => fetchAPI(`/api/categories/${id}`),

  // Import
  initialize: () => fetchAPI('/api/import/initialize', { method: 'POST' }),
  importFile: async (file: File, year: number) => {
    const form = new FormData();
    form.append('file', file);
    form.append('year', String(year));
    const res = await fetch(`${API_URL}/api/import/file`, { method: 'POST', body: form });
    return res.json();
  },
};

export function formatOMR(value: number): string {
  return `OMR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getMarginColor(pct: number): string {
  if (pct >= 30) return 'text-green-600';
  if (pct >= 15) return 'text-yellow-600';
  return 'text-red-600';
}

export function getMarginBadge(pct: number): string {
  if (pct >= 30) return 'badge-green';
  if (pct >= 15) return 'badge-yellow';
  return 'badge-red';
}
