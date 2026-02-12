'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page) };
    if (search) params.search = search;
    api.vendors(params).then(setVendors).catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vendors</h1>
      <input type="text" placeholder="Search vendors..." value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input max-w-md mb-6" />

      {loading ? <p className="text-gray-400">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors?.items?.map((v: any) => (
            <Link key={v.id} href={`/vendors/${v.id}`} className="card card-body hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{v.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{v._count.lineItems} items supplied</p>
                </div>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} className={`w-4 h-4 ${i <= Math.round(v.reliabilityScore || 3) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <span className={`mt-2 ${v.isActive ? 'badge-green' : 'badge-red'}`}>{v.isActive ? 'Active' : 'Inactive'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
