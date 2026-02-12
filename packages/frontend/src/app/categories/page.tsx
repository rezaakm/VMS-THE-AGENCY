'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR, formatPct } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.categories().then(setCategories).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <p className="text-gray-400">Loading...</p>;

  const maxItems = Math.max(...categories.map(c => c.itemCount), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Categories</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="card card-body">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold">{cat.name}</h3>
              <span className="badge-blue">{cat.itemCount} items</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
              <div className="bg-brand-400 h-2 rounded-full" style={{ width: `${(cat.itemCount / maxItems) * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><p className="text-gray-500">Min</p><p className="font-medium">{formatOMR(cat.minUnitCost)}</p></div>
              <div><p className="text-gray-500">Avg</p><p className="font-medium">{formatOMR(cat.avgUnitCost)}</p></div>
              <div><p className="text-gray-500">Max</p><p className="font-medium">{formatOMR(cat.maxUnitCost)}</p></div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Avg Margin: {formatPct(cat.avgMarginPct)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
