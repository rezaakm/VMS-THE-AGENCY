'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';

export default function FinancialProcessesPage() {
  const { data: processes, isLoading } = useQuery({
    queryKey: ['financial-processes'],
    queryFn: async () => (await api.get('/financial-oversight/processes')).data,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/financial-oversight" className="text-sm text-primary hover:underline">
        ← Oversight
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-6">Financial process registry</h1>

      <div className="grid gap-4">
        {processes?.map((p: {
          id: string;
          name: string;
          description?: string;
          owner: string;
          frequency: string;
          status: string;
        }) => (
          <div key={p.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between">
              <h3 className="font-medium">{p.name}</h3>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">{p.status}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{p.description}</p>
            <p className="text-xs text-gray-400 mt-2">
              Owner: {p.owner} · {p.frequency}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
