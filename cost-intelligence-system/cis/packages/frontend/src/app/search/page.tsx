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
    setSearched(true);
    try {
      const [searchData, vendorData] = await Promise.all([
        api.search(query.trim()),
        api.recommendVendors(query.trim()),
      ]);
      setResults(searchData.results || []);
      setBenchmark(searchData.benchmark || null);
      setVendors(vendorData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const quickSearches = [
    'LED screen rental', 'MDF photo wall', 'vinyl branding',
    'tent rental', 'hostess', 'photography videography',
    'car branding', 'banner printing', 'event management',
    'catering', 'transportation', 'giveaways',
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-sm text-gray-500 mt-1">Search 3,245+ historical line items with smart matching</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items... (e.g. MDF backdrop, LED screen, vinyl banner)"
              className="input pl-11 text-base"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary px-6" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Quick Searches */}
      {!searched && (
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-3">Quick searches:</p>
          <div className="flex flex-wrap gap-2">
            {quickSearches.map((qs) => (
              <button
                key={qs}
                onClick={() => { setQuery(qs); setTimeout(() => handleSearch(), 50); }}
                className="px-3 py-1.5 text-sm bg-brand-50 text-brand-600 rounded-full hover:bg-brand-100 transition-colors"
              >
                {qs}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Results */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{results.length} Results</h2>
              {results.length > 0 && <span className="text-sm text-gray-400">Sorted by relevance</span>}
            </div>

            {results.length === 0 && !loading && (
              <div className="card card-body text-center py-12">
                <p className="text-gray-400">No items found for "{query}"</p>
                <p className="text-sm text-gray-300 mt-1">Try different keywords or check spelling</p>
              </div>
            )}

            <div className="space-y-3">
              {results.map((item: any) => (
                <div key={item.id} className="card hover:shadow-md transition-shadow">
                  <div className="card-body">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{item.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {item.categoryName && <span className="badge-blue">{item.categoryName}</span>}
                          <span className="text-xs text-gray-400">Job #{item.jobNumber}</span>
                          <span className="text-xs text-gray-400">{item.clientName}</span>
                          <span className="text-xs text-gray-400">{item.projectYear}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatOMR(item.unitCost)}<span className="text-xs text-gray-400 font-normal">/unit</span></p>
                        <p className="text-xs text-gray-500">Sell: {formatOMR(item.unitSelling)}</p>
                        <span className={`text-xs font-medium ${item.marginPct >= 20 ? 'text-green-600' : item.marginPct >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {formatPct(item.marginPct)} margin
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      <span>Qty: {item.quantity}</span>
                      <span>Total Cost: {formatOMR(item.totalCost)}</span>
                      <span>Total Sell: {formatOMR(item.totalSelling)}</span>
                      {item.vendorName && <span className="text-brand-600 font-medium">Vendor: {item.vendorName}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar: Benchmark + Vendor Recs */}
          <div className="space-y-6">
            {/* Benchmark */}
            {benchmark && (
              <div className="card">
                <div className="card-body">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Price Benchmark
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Category</span>
                      <span className="font-medium">{benchmark.categoryName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Unit Cost</span>
                      <span className="font-bold text-brand-500">{formatOMR(benchmark.avgUnitCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price Range</span>
                      <span className="font-medium">{benchmark.priceRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Median</span>
                      <span>{formatOMR(benchmark.medianUnitCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Based on</span>
                      <span>{benchmark.itemCount} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Margin</span>
                      <span className={benchmark.avgMarginPct >= 20 ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                        {formatPct(benchmark.avgMarginPct)}
                      </span>
                    </div>
                  </div>

                  {/* Price range visual */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">Historical price distribution</p>
                    <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 bg-green-200 rounded-full" style={{
                        left: `${((benchmark.minUnitCost / benchmark.maxUnitCost) * 80)}%`,
                        right: `${100 - 95}%`,
                      }} />
                      <div className="absolute inset-y-0 w-0.5 bg-brand-500" style={{
                        left: `${(benchmark.avgUnitCost / benchmark.maxUnitCost) * 95}%`,
                      }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{formatOMR(benchmark.minUnitCost)}</span>
                      <span>{formatOMR(benchmark.maxUnitCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vendor Recommendations */}
            {vendors.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Recommended Vendors
                  </h3>
                  <div className="space-y-3">
                    {vendors.slice(0, 5).map((v: any, i: number) => (
                      <div key={v.vendorId} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.vendorName}</p>
                          <p className="text-xs text-gray-400">{v.itemCount} items | Avg: {formatOMR(v.avgUnitCost)}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(star => (
                              <svg key={star} className={`w-3 h-3 ${star <= v.reliabilityScore ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
