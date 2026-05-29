'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await api.get(`/vendors/${id}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!vendor) return <p className="text-gray-500">Vendor not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/vendors" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
            <p className="text-gray-500 font-mono">{vendor.code}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/vendors/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg"
        >
          <Edit className="w-4 h-4" /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Email</dt><dd>{vendor.email}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd>{vendor.phone}</dd></div>
            <div><dt className="text-gray-500">Status</dt><dd>{vendor.status}</dd></div>
            <div><dt className="text-gray-500">Category</dt><dd>{vendor.category}</dd></div>
            <div><dt className="text-gray-500">Performance</dt><dd>{vendor.performanceScore ?? '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">Business</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Total spent</dt><dd>{formatCurrency(vendor.totalSpent)}</dd></div>
            <div><dt className="text-gray-500">Total orders</dt><dd>{vendor.totalOrders}</dd></div>
            <div><dt className="text-gray-500">Currency</dt><dd>{vendor.currency}</dd></div>
            <div><dt className="text-gray-500">Address</dt><dd>{vendor.address}, {vendor.city}, {vendor.country}</dd></div>
          </dl>
        </div>
      </div>

      {vendor.purchaseOrders?.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">Recent purchase orders</h2>
          <ul className="divide-y text-sm">
            {vendor.purchaseOrders.map((po: { id: string; orderNumber: string; totalAmount: number; orderDate: string }) => (
              <li key={po.id} className="py-2 flex justify-between">
                <Link href={`/dashboard/purchase-orders/${po.id}`} className="text-primary hover:underline">
                  {po.orderNumber}
                </Link>
                <span>{formatCurrency(po.totalAmount)} · {formatDate(po.orderDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
