'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => (await api.get(`/purchase-orders/${id}`)).data,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/purchase-orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  });

  const canApprove = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!po) return <p>Not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchase-orders" className="text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{po.orderNumber}</h1>
            <p className="text-gray-500">{po.vendor?.name}</p>
          </div>
        </div>
        <Link href={`/dashboard/purchase-orders/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg">
          <Edit className="w-4 h-4" /> Edit
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6 grid md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-gray-500">Status</span><p className="font-medium">{po.status}</p></div>
        <div><span className="text-gray-500">Order date</span><p>{formatDate(po.orderDate)}</p></div>
        <div><span className="text-gray-500">Subtotal</span><p>{formatCurrency(po.subtotal)}</p></div>
        <div><span className="text-gray-500">Total</span><p className="font-bold">{formatCurrency(po.totalAmount)}</p></div>
      </div>

      {po.status === 'DRAFT' && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => statusMutation.mutate('SUBMITTED')}
            disabled={statusMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Submit for approval
          </button>
        </div>
      )}

      {canApprove && po.status === 'SUBMITTED' && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => statusMutation.mutate('APPROVED')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
          >
            Approve
          </button>
          <button
            onClick={() => statusMutation.mutate('CANCELLED')}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Item</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Description</th>
              <th className="px-4 py-2 text-right text-xs text-gray-500">Qty</th>
              <th className="px-4 py-2 text-right text-xs text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {po.items?.map((item: { id: string; itemNumber: string; description: string; quantity: number; totalPrice: number }) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.itemNumber}</td>
                <td className="px-4 py-2">{item.description}</td>
                <td className="px-4 py-2 text-right">{item.quantity}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
