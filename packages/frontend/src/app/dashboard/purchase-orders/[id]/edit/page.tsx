'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => (await api.get(`/purchase-orders/${id}`)).data,
  });

  useEffect(() => {
    if (po) {
      setDescription(po.description || '');
      setNotes(po.notes || '');
    }
  }, [po]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${id}`, { description, notes }),
    onSuccess: () => router.push(`/dashboard/purchase-orders/${id}`),
  });

  if (isLoading || !po) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (po.status !== 'DRAFT') {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg">
        <p>Only draft purchase orders can be edited. Current status: {po.status}</p>
        <Link href={`/dashboard/purchase-orders/${id}`} className="text-primary mt-2 inline-block">
          Back to PO
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/purchase-orders/${id}`} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold">Edit {po.orderNumber}</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className="w-full border rounded-lg px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea className="w-full border rounded-lg px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">
          Save
        </button>
      </form>
    </div>
  );
}
