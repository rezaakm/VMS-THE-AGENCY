const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export const api = {
  dashboard: () => fetchApi('/api/search/dashboard'),
  search: (q: string, limit = 50) => fetchApi(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  benchmark: (q: string) => fetchApi(`/api/search/benchmark?q=${encodeURIComponent(q)}`),
  recommendVendors: (q: string) => fetchApi(`/api/search/recommend-vendors?q=${encodeURIComponent(q)}`),
  projects: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi(`/api/projects${qs}`);
  },
  projectYears: () => fetchApi('/api/projects/years'),
  project: (id: string) => fetchApi(`/api/projects/${id}`),
  vendors: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi(`/api/vendors${qs}`);
  },
  vendor: (id: string) => fetchApi(`/api/vendors/${id}`),
  categories: () => fetchApi('/api/categories'),
  category: (id: string) => fetchApi(`/api/categories/${id}`),
  importInit: () => fetchApi('/api/import/initialize', { method: 'POST' }),
  importFile: async (file: File, year: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('year', String(year));
    const res = await fetch(`${API_BASE}/api/import/file`, { method: 'POST', body: formData });
    return res.json();
  },
};

export const formatOMR = (val: number) => `OMR ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatPct = (val: number) => `${val.toFixed(1)}%`;
export const getMarginBadge = (pct: number) => pct >= 25 ? 'badge-green' : pct >= 15 ? 'badge-yellow' : 'badge-red';
