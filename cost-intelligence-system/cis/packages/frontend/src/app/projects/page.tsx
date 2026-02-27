'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR, formatPct, getMarginBadge } from '@/lib/api';
import Link from 'next/link';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any>(null);
  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.projectYears().then(setYears).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page) };
    if (selectedYear) params.year = selectedYear;
    api.projects(params).then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, [page, selectedYear]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects?.total || 0} cost sheets imported</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
            className="input w-40"
          >
            <option value="">All Years</option>
            {years.map((y: any) => (
              <option key={y.year} value={y.year}>{y.year} ({y.count})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading projects...</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Job #</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Subject</th>
                  <th className="table-header">Year</th>
                  <th className="table-header text-right">Cost</th>
                  <th className="table-header text-right">Selling</th>
                  <th className="table-header text-right">Margin</th>
                  <th className="table-header text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects?.items?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="table-cell font-mono text-brand-600 font-medium">
                      <Link href={`/projects/${p.id}`}>{p.jobNumber}</Link>
                    </td>
                    <td className="table-cell font-medium">{p.client?.name}</td>
                    <td className="table-cell text-gray-600 max-w-xs truncate">{p.subject}</td>
                    <td className="table-cell">{p.year}</td>
                    <td className="table-cell text-right">{formatOMR(p.totalCost)}</td>
                    <td className="table-cell text-right font-medium">{formatOMR(p.totalSell)}</td>
                    <td className="table-cell text-right">
                      <span className={getMarginBadge(p.marginPct)}>{formatPct(p.marginPct)}</span>
                    </td>
                    <td className="table-cell text-right text-gray-500">{p._count?.lineItems || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {projects?.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Page {projects.page} of {projects.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary">Previous</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= projects.totalPages} className="btn-secondary">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
