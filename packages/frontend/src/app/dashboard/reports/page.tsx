'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Download } from 'lucide-react';

import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();

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

  const { data: arAging } = useQuery({
    queryKey: ['reports', 'ar-aging'],
    queryFn: async () => (await api.get('/reports/ar-aging')).data,
  });

  const { data: plSummary } = useQuery({
    queryKey: ['reports', 'monthly-pl'],
    queryFn: async () => (await api.get('/reports/monthly-pl-summary')).data,
  });

  const downloadCsv = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/reports/export/spend-by-vendor.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spend-by-vendor.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (lv) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
        >
          <Download className="w-4 h-4" /> Export vendor spend (CSV)
        </button>
      </div>

      {plSummary && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">
            Monthly summary — {plSummary.period}
          </h2>
          <p className="text-xs text-gray-500 mb-4">{plSummary.note}</p>
          <dl className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Procurement spend (completed POs)</dt>
              <dd className="text-xl font-semibold">
                {formatCurrency(plSummary.procurementSpendCompleted)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Vendor payments recorded</dt>
              <dd className="text-xl font-semibold">
                {formatCurrency(plSummary.vendorPaymentsRecorded)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Outstanding receivables (AR)</dt>
              <dd className="text-xl font-semibold text-amber-700">
                {formatCurrency(plSummary.outstandingReceivables)}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {arAging && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">AR aging (client receivables)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Total outstanding: {formatCurrency(arAging.buckets.total)}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 text-sm">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-gray-500">Current</p>
              <p className="font-semibold">{formatCurrency(arAging.buckets.current)}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded">
              <p className="text-gray-500">1–30 days</p>
              <p className="font-semibold">{formatCurrency(arAging.buckets.days1_30)}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded">
              <p className="text-gray-500">31–60 days</p>
              <p className="font-semibold">{formatCurrency(arAging.buckets.days31_60)}</p>
            </div>
            <div className="p-3 bg-red-50 rounded">
              <p className="text-gray-500">61–90 days</p>
              <p className="font-semibold">{formatCurrency(arAging.buckets.days61_90)}</p>
            </div>
            <div className="p-3 bg-red-100 rounded">
              <p className="text-gray-500">90+ days</p>
              <p className="font-semibold">{formatCurrency(arAging.buckets.days90_plus)}</p>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Client</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Due</th>
                <th className="py-2 text-right">Outstanding</th>
                <th className="py-2 text-right">Days past due</th>
              </tr>
            </thead>
            <tbody>
              {(arAging.details || []).map(
                (row: {
                  id: string;
                  clientName: string;
                  reference?: string;
                  dueDate: string;
                  outstanding: number;
                  daysPast: number;
                }) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">{row.clientName}</td>
                    <td className="py-2">{row.reference || '—'}</td>
                    <td className="py-2">{formatDate(row.dueDate)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.outstanding)}</td>
                    <td className="py-2 text-right">{row.daysPast}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
      )}

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
            {(spendByVendor || []).map(
              (row: { vendorName: string; totalSpent: number; orderCount: number }, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{row.vendorName}</td>
                  <td className="py-2 text-right">{formatCurrency(row.totalSpent)}</td>
                  <td className="py-2 text-right">{row.orderCount}</td>
                </tr>
              ),
            )}
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
