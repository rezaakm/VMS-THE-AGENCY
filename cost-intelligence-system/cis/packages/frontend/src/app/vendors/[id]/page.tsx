'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, formatOMR, formatPct } from '@/lib/api';
import Link from 'next/link';

export default function VendorDetailPage() {
  const params = useParams();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) api.vendor(params.id as string).then(setVendor).catch(console.error).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!vendor) return <div className="text-red-500">Vendor not found</div>;

  return (
    <div>
      <Link href="/vendors" className="text-sm text-brand-500 hover:underline mb-4 inline-block">&larr; Back to Vendors</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          {vendor.aliases?.length > 0 && <p className="text-sm text-gray-400 mt-1">Also known as: {vendor.aliases.join(', ')}</p>}
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(star => (
            <svg key={star} className={`w-5 h-5 ${star <= (vendor.reliabilityScore || 3) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><span className="stat-value">{vendor.financials?._count || 0}</span><span className="stat-label">Total Items</span></div>
        <div className="stat-card"><span className="stat-value">{formatOMR(vendor.financials?._sum?.totalCost || 0)}</span><span className="stat-label">Total Cost Value</span></div>
        <div className="stat-card"><span className="stat-value">{formatOMR(vendor.financials?._avg?.unitCost || 0)}</span><span className="stat-label">Avg Unit Cost</span></div>
        <div className="stat-card"><span className="stat-value">{formatPct(vendor.financials?._avg?.marginPct || 0)}</span><span className="stat-label">Avg Margin</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <div className="card card-body">
          <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {vendor.categories?.map((cat: any) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-gray-400">{cat.itemCount} items</p>
                </div>
                <span className="text-sm font-medium">{formatOMR(cat.avgUnitCost)}</span>
              </div>
            ))}
            {(!vendor.categories || vendor.categories.length === 0) && (
              <p className="text-sm text-gray-400">No category data</p>
            )}
          </div>
        </div>

        {/* Recent Items */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="card-body pb-0">
            <h2 className="text-lg font-semibold mb-4">Recent Items</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Description</th>
                <th className="table-header">Client</th>
                <th className="table-header text-right">Unit Cost</th>
                <th className="table-header text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendor.recentItems?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="table-cell max-w-xs truncate text-sm">{item.description}</td>
                  <td className="table-cell text-sm text-gray-500">{item.project?.client?.name}</td>
                  <td className="table-cell text-right text-sm">{formatOMR(item.unitCost)}</td>
                  <td className="table-cell text-right"><span className={`text-xs font-medium ${item.marginPct >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>{formatPct(item.marginPct)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
