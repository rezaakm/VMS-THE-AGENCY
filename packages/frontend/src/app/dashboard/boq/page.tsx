'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

const statusColors: Record<string, string> = {
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  EXPORTED: 'bg-purple-100 text-purple-800',
};

export default function BoqListPage() {
  const [boqs, setBoqs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoqs();
  }, [search, status]);

  async function loadBoqs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const { data } = await api.get(`/boq?${params}`);
      setBoqs(data);
    } catch (err) {
      console.error('Failed to load BOQs', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BOQ Builder</h1>
          <p className="text-gray-600 mt-1">Create Bills of Quantities from drawings</p>
        </div>
        <Link
          href="/dashboard/boq/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New BOQ from Drawing
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search BOQs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="PROCESSING">Processing</option>
          <option value="DRAFT">Draft</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="APPROVED">Approved</option>
          <option value="EXPORTED">Exported</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : boqs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No BOQs found. Upload drawings to create your first BOQ.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BOQ #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drawings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {boqs.map((boq) => (
                <tr key={boq.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/dashboard/boq/${boq.id}`}>
                  <td className="px-6 py-4 text-sm font-mono text-blue-600">{boq.boqNumber}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{boq.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{boq.clientName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{boq._count?.drawings || boq.drawingCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{boq._count?.items || 0}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">{boq.totalCost?.toFixed(2)} OMR</td>
                  <td className="px-6 py-4 text-sm text-right">
                    {boq.margin !== null ? (
                      <span className={boq.margin >= 25 ? 'text-green-600' : 'text-red-600'}>
                        {boq.margin}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[boq.status] || 'bg-gray-100'}`}>
                      {boq.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
