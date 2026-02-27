'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, formatOMR, formatPct, getMarginBadge } from '@/lib/api';
import Link from 'next/link';

export default function ProjectDetailPage() {
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      api.project(params.id as string).then(setProject).catch(console.error).finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!project) return <div className="text-red-500">Project not found</div>;

  const alertCount = project.lineItems?.reduce((sum: number, li: any) => sum + (li.alerts?.length || 0), 0) || 0;

  return (
    <div>
      <Link href="/projects" className="text-sm text-brand-500 hover:underline mb-4 inline-block">&larr; Back to Projects</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job #{project.jobNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">{project.client?.name} — {project.subject}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">{project.date ? new Date(project.date).toLocaleDateString() : project.year}</p>
          {alertCount > 0 && <span className="badge-red mt-1">{alertCount} alerts</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><span className="stat-value">{formatOMR(project.totalCost)}</span><span className="stat-label">Total Cost</span></div>
        <div className="stat-card"><span className="stat-value text-green-600">{formatOMR(project.totalSell)}</span><span className="stat-label">Total Selling</span></div>
        <div className="stat-card"><span className="stat-value text-green-600">{formatOMR(project.totalSell - project.totalCost)}</span><span className="stat-label">Profit</span></div>
        <div className="stat-card"><span className={`stat-value ${project.marginPct >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>{formatPct(project.marginPct)}</span><span className="stat-label">Margin</span></div>
      </div>

      {/* Line Items Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header w-8">#</th>
              <th className="table-header">Description</th>
              <th className="table-header">Category</th>
              <th className="table-header text-right">Qty</th>
              <th className="table-header text-right">Unit Cost</th>
              <th className="table-header text-right">Unit Sell</th>
              <th className="table-header text-right">Total Sell</th>
              <th className="table-header text-right">Margin</th>
              <th className="table-header">Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {project.lineItems?.map((li: any) => (
              <tr key={li.id} className={`${li.alerts?.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                <td className="table-cell text-gray-400 text-xs">{li.itemNumber}</td>
                <td className="table-cell max-w-sm">
                  <p className="text-sm leading-snug">{li.description}</p>
                  {li.alerts?.map((a: any) => (
                    <p key={a.id} className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {a.message}
                    </p>
                  ))}
                </td>
                <td className="table-cell"><span className="badge-blue text-xs">{li.category?.name || '—'}</span></td>
                <td className="table-cell text-right">{li.quantity}</td>
                <td className="table-cell text-right">{formatOMR(li.unitCost)}</td>
                <td className="table-cell text-right">{formatOMR(li.unitSelling)}</td>
                <td className="table-cell text-right font-medium">{formatOMR(li.totalSelling)}</td>
                <td className="table-cell text-right"><span className={getMarginBadge(li.marginPct)}>{formatPct(li.marginPct)}</span></td>
                <td className="table-cell text-sm text-brand-600">{li.vendor?.name || li.vendorRaw || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
