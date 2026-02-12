'use client';
import { useState } from 'react';
import { api, formatOMR, formatPct, getMarginBadge } from '@/lib/api';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const [searchData, vendorData] = await Promise.all([
        api.search(query), api.recommendVendors(query),
      ]);
      setResults(searchData.results || []);
      setBenchmark(searchData.benchmark);
      setVendors(vendorData || []);
      setSearched(true);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Smart Search</h1>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder='Search items (e.g. "MDF photo wall", "vinyl sticker", "tent rental")...'
          className="input flex-1 text-base" autoFocus />
        <button type="submit" disabled={loading} className="btn-primary px-6">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searched && (
        <div className="flex gap-6">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-3">{results.length} results</p>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr>
                  <th className="table-header">Description</th>
                  <th className="table-header">Client</th>
                  <th className="table-header text-right">Unit Cost</th>
                  <th className="table-header text-right">Unit Sell</th>
                  <th className="table-header text-right">Margin</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Year</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium max-w-xs truncate">
                        <Link href={`/projects/${r.projectId}`} className="hover:text-brand-500">{r.description}</Link>
                      </td>
                      <td className="table-cell text-gray-500">{r.clientName}</td>
                      <td className="table-cell text-right">{formatOMR(r.unitCost)}</td>
                      <td className="table-cell text-right">{formatOMR(r.unitSelling)}</td>
                      <td className="table-cell text-right"><span className={getMarginBadge(r.marginPct)}>{formatPct(r.marginPct)}</span></td>
                      <td className="table-cell text-gray-500">{r.vendorName || '—'}</td>
                      <td className="table-cell">{r.projectYear}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-80 shrink-0 space-y-4">
            {benchmark && (
              <div className="card card-body">
                <h3 className="font-semibold mb-3">Price Benchmark</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Category</span><span>{benchmark.categoryName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Avg Cost</span><span className="font-medium">{formatOMR(benchmark.avgUnitCost)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Range</span><span>{benchmark.priceRange}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Median</span><span>{formatOMR(benchmark.medianUnitCost)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Avg Margin</span><span>{formatPct(benchmark.avgMarginPct)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Data Points</span><span>{benchmark.itemCount}</span></div>
                </div>
              </div>
            )}

            {vendors.length > 0 && (
              <div className="card card-body">
                <h3 className="font-semibold mb-3">Recommended Vendors</h3>
                <div className="space-y-3">
                  {vendors.slice(0, 5).map((v: any) => (
                    <div key={v.vendorId} className="p-2 bg-gray-50 rounded-lg">
                      <Link href={`/vendors/${v.vendorId}`} className="font-medium text-sm hover:text-brand-500">{v.vendorName}</Link>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Avg: {formatOMR(v.avgUnitCost)}</span>
                        <span>{v.itemCount} items</span>
                      </div>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => (
                          <svg key={i} className={`w-3 h-3 ${i <= Math.round(v.reliabilityScore) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
