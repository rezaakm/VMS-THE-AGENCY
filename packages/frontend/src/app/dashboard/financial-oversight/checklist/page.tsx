'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

export default function FinancialChecklistPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const period = new Date().toISOString().slice(0, 7);

  const { data: items, isLoading } = useQuery({
    queryKey: ['financial-checklist', period],
    queryFn: async () => (await api.get(`/financial-oversight/checklist?period=${period}`)).data,
  });

  const completeMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.post(`/financial-oversight/checklist/${itemId}/complete`, {
        period,
        completedBy: user ? `${user.firstName} ${user.lastName}` : 'User',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-checklist', period] }),
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
      <h1 className="text-3xl font-bold mt-2 mb-2">Monthly checklist</h1>
      <p className="text-gray-500 mb-6">Period: {period}</p>

      <div className="space-y-3">
        {items?.map((item: {
          id: string;
          name: string;
          description?: string;
          owner: string;
          dueDay?: number;
          completions: { status: string }[];
        }) => {
          const status = item.completions?.[0]?.status;
          const done = status === 'COMPLETED';
          const overdue = status === 'OVERDUE';
          return (
            <div key={item.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
                <p className="text-xs text-gray-400 mt-1">Owner: {item.owner} · Due day: {item.dueDay ?? '—'}</p>
              </div>
              {done ? (
                <span className="text-green-600 text-sm font-semibold">Completed</span>
              ) : overdue ? (
                <span className="text-red-600 text-sm font-semibold">Overdue</span>
              ) : (
                <button
                  type="button"
                  onClick={() => completeMutation.mutate(item.id)}
                  className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg"
                >
                  Mark complete
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
