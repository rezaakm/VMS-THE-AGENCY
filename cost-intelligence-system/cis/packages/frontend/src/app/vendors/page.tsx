'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR } from '@/lib/api';
import Link from 'next/link';

export default function VendorsPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    api.vendors(params).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total || 0} vendors in database</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors..."
          className="input w-64"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items?.map((v: any) => (
            <Link key={v.id} href={`/vendors/${v.id}`}>
              <div className="card card-body hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{v.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{v._count?.lineItems || 0} line items</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <svg key={star} className={`w-3.5 h-3.5 ${star <= (v.reliabilityScore || 3) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                {v.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {v.categories.slice(0, 3).map((cat: string) => (
                      <span key={cat} className="badge-blue text-xs">{cat}</span>
                    ))}
                    {v.categories.length > 3 && <span className="text-xs text-gray-400">+{v.categories.length - 3}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className={`text-xs ${v.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {v.aliases?.length > 0 && <span className="text-xs text-gray-300">{v.aliases.length} aliases</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
