'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ContractDetailPage() {
  const id = useParams().id as string;
  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => (await api.get(`/contracts/${id}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contract) return <p>Not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contracts" className="text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{contract.title}</h1>
            <p className="text-gray-500 font-mono">{contract.contractNumber}</p>
          </div>
        </div>
        <Link href={`/dashboard/contracts/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg">
          <Edit className="w-4 h-4" /> Edit
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow p-6 grid md:grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Vendor</span><p>{contract.vendor?.name}</p></div>
        <div><span className="text-gray-500">Status</span><p>{contract.status}</p></div>
        <div><span className="text-gray-500">Start</span><p>{formatDate(contract.startDate)}</p></div>
        <div><span className="text-gray-500">End</span><p>{formatDate(contract.endDate)}</p></div>
        <div><span className="text-gray-500">Value</span><p>{contract.contractValue != null ? formatCurrency(contract.contractValue) : '—'}</p></div>
        <div><span className="text-gray-500">Currency</span><p>{contract.currency}</p></div>
        {contract.description && (
          <div className="md:col-span-2"><span className="text-gray-500">Description</span><p>{contract.description}</p></div>
        )}
      </div>
    </div>
  );
}
