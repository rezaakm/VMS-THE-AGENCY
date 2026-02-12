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
    if (params.id) api.project(params.id as string).then(setProject).catch(console.error).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (!project) return <p className="text-red-500">Project not found</p>;

  return (
    <div>
      <Link href="/projects" className="text-sm text-brand-500 hover:underline mb-4 block">← Back to Projects</Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.subject}</h1>
          <p className="text-gray-500">{project.client.name} | Job #{project.jobNumber} | {project.year}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div><p className="text-sm text-gray-500">Revenue</p><p className="font-bold text-green-600">{formatOMR(project.totalSell)}</p></div>
          <div><p className="text-sm text-gray-500">Cost</p><p className="font-bold text-red-600">{formatOMR(project.totalCost)}</p></div>
          <div><p className="text-sm text-gray-500">Margin</p><p className={`font-bold ${project.marginPct >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>{formatPct(project.marginPct)}</p></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="table-header">#</th><th className="table-header">Description</th>
            <th className="table-header">Category</th><th className="table-header text-right">Qty</th>
            <th className="table-header text-right">Unit Cost</th><th className="table-header text-right">Unit Sell</th>
            <th className="table-header text-right">Total</th><th className="table-header text-right">Margin</th>
            <th className="table-header">Vendor</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {project.lineItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="table-cell text-gray-400">{item.itemNumber}</td>
                <td className="table-cell font-medium max-w-xs truncate">{item.description}</td>
                <td className="table-cell"><span className="badge-blue">{item.category?.name || '—'}</span></td>
                <td className="table-cell text-right">{item.quantity}</td>
                <td className="table-cell text-right">{formatOMR(item.unitCost)}</td>
                <td className="table-cell text-right">{formatOMR(item.unitSelling)}</td>
                <td className="table-cell text-right font-medium">{formatOMR(item.totalSelling)}</td>
                <td className="table-cell text-right"><span className={getMarginBadge(item.marginPct)}>{formatPct(item.marginPct)}</span></td>
                <td className="table-cell text-gray-500">{item.vendor?.name || item.vendorRaw || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
