'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const { data: spendByVendor, isLoading: lv } = useQuery({
    queryKey: ['reports', 'spend-by-vendor'],
    queryFn: async () => (await api.get('/reports/spend-by-vendor')).data,
  });

  const { data: spendByCategory } = useQuery({
    queryKey: ['reports', 'spend-by-category'],
    queryFn: async () => (await api.get('/reports/spend-by-category')).data,
  });

  const { data: monthlySpend } = useQuery({
    queryKey: ['reports', 'monthly-spend'],
    queryFn: async () => (await api.get('/reports/monthly-spend?months=6')).data,
  });

  const { data: vendorPerformance } = useQuery({
    queryKey: ['reports', 'vendor-performance'],
    queryFn: async () => (await api.get('/reports/vendor-performance')).data,
  });

  if (lv) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Reports</h1>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Spend by vendor</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Vendor</th>
              <th className="py-2 text-right">Total spend</th>
              <th className="py-2 text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {(spendByVendor || []).map((row: { vendorName: string; totalSpent: number; orderCount: number }, i: number) => (
              <tr key={i} className="border-b">
                <td className="py-2">{row.vendorName}</td>
                <td className="py-2 text-right">{formatCurrency(row.totalSpent)}</td>
                <td className="py-2 text-right">{row.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Spend by category</h2>
        <ul className="space-y-2 text-sm">
          {(spendByCategory || []).map((row: { category: string; totalSpent: number }, i: number) => (
            <li key={i} className="flex justify-between border-b py-2">
              <span>{row.category}</span>
              <span className="font-medium">{formatCurrency(row.totalSpent)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Monthly spend (last 6 months)</h2>
        <ul className="space-y-2 text-sm">
          {(monthlySpend || []).map((row: { month: string; totalSpent: number }, i: number) => (
            <li key={i} className="flex justify-between border-b py-2">
              <span>{row.month}</span>
              <span className="font-medium">{formatCurrency(row.totalSpent)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Vendor performance</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">Vendor</th>
              <th className="py-2 text-right">Score</th>
              <th className="py-2 text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {(vendorPerformance || []).map(
              (row: { name: string; performanceScore: number; totalOrders: number }, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-right">{row.performanceScore?.toFixed(1) ?? '—'}</td>
                  <td className="py-2 text-right">{row.totalOrders}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
