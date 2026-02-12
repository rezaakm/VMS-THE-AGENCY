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

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (!vendor) return <p className="text-red-500">Vendor not found</p>;

  return (
    <div>
      <Link href="/vendors" className="text-sm text-brand-500 hover:underline mb-4 block">← Back to Vendors</Link>
      <h1 className="text-2xl font-bold mb-1">{vendor.name}</h1>
      <p className="text-gray-500 mb-6">{vendor._count.lineItems} items | Reliability: {vendor.reliabilityScore}/5</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><span className="stat-value">{vendor.financials._count}</span><span className="stat-label">Total Items</span></div>
        <div className="stat-card"><span className="stat-value">{formatOMR(vendor.financials._sum.totalCost || 0)}</span><span className="stat-label">Total Cost</span></div>
        <div className="stat-card"><span className="stat-value">{formatPct(vendor.financials._avg.marginPct || 0)}</span><span className="stat-label">Avg Margin</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card card-body">
          <h2 className="font-semibold mb-3">Category Breakdown</h2>
          <div className="space-y-2">
            {vendor.categories.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-sm text-gray-500">{c.itemCount} items | Avg: {formatOMR(c.avgUnitCost)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-body">
          <h2 className="font-semibold mb-3">Recent Items</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {vendor.recentItems.map((item: any) => (
              <div key={item.id} className="p-2 bg-gray-50 rounded text-sm">
                <p className="font-medium truncate">{item.description}</p>
                <p className="text-gray-500 text-xs">{item.project.client.name} | {formatOMR(item.unitCost)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
