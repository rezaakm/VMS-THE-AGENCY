'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR, formatPct } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.categories().then(setCategories).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const maxItems = Math.max(...categories.map(c => c.itemCount || 0));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-sm text-gray-500 mt-1">{categories.length} service categories with pricing benchmarks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat: any) => (
          <div key={cat.id} className="card card-body">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                <p className="text-sm text-gray-400">{cat.itemCount} items</p>
              </div>
              <span className="text-lg font-bold text-brand-500">{formatOMR(cat.avgUnitCost)}</span>
            </div>

            {/* Volume bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
              <div className="bg-brand-300 h-2 rounded-full" style={{ width: `${(cat.itemCount / maxItems) * 100}%` }} />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Min</p>
                <p className="text-sm font-medium">{formatOMR(cat.minUnitCost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Avg</p>
                <p className="text-sm font-bold text-brand-500">{formatOMR(cat.avgUnitCost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Max</p>
                <p className="text-sm font-medium">{formatOMR(cat.maxUnitCost)}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Avg Margin: <span className={cat.avgMarginPct >= 20 ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>{formatPct(cat.avgMarginPct)}</span></span>
              <span className="text-gray-300">{cat.keywords?.slice(0, 3).join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
