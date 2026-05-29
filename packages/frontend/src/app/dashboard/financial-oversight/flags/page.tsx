'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

const severityColor: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
};

export default function FinancialFlagsPage() {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['financial-flags'],
    queryFn: async () => (await api.get('/financial-oversight/flags')).data,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/financial-oversight" className="text-sm text-primary hover:underline">
            ← Oversight
          </Link>
          <h1 className="text-3xl font-bold mt-1">Financial flags</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {flags?.map((flag: {
              id: string;
              flagNumber: number;
              title: string;
              severity: string;
              status: string;
              deadline?: string;
            }) => (
              <tr key={flag.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{flag.flagNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/financial-oversight/flags/${flag.id}`} className="text-primary hover:underline font-medium">
                    {flag.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColor[flag.severity] || ''}`}>
                    {flag.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{flag.status}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {flag.deadline ? formatDate(flag.deadline) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
