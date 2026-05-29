'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { AlertTriangle, CheckSquare, FileWarning } from 'lucide-react';

export default function FinancialOversightDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['financial-oversight', 'dashboard'],
    queryFn: async () => (await api.get('/financial-oversight/dashboard')).data,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Financial Oversight</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/dashboard/financial-oversight/flags" className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Flags
          </Link>
          <Link href="/dashboard/financial-oversight/checklist" className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Checklist
          </Link>
          <Link href="/dashboard/financial-oversight/processes" className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Processes
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileWarning className="w-8 h-8 text-red-500" />
            <h2 className="font-semibold">Open flags</h2>
          </div>
          <p className="text-3xl font-bold">{data?.flags?.total ?? 0}</p>
          <ul className="mt-3 text-sm text-gray-600 space-y-1">
            <li>Critical: {data?.flags?.CRITICAL ?? 0}</li>
            <li>High: {data?.flags?.HIGH ?? 0}</li>
            <li>Medium: {data?.flags?.MEDIUM ?? 0}</li>
            <li>Low: {data?.flags?.LOW ?? 0}</li>
          </ul>
          {data?.overdueFlags > 0 && (
            <p className="mt-2 text-red-600 text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {data.overdueFlags} overdue
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckSquare className="w-8 h-8 text-blue-500" />
            <h2 className="font-semibold">Monthly checklist</h2>
          </div>
          <p className="text-3xl font-bold">{data?.checklist?.completionRate ?? 0}%</p>
          <p className="text-sm text-gray-500 mt-2">
            {data?.checklist?.completed ?? 0} / {data?.checklist?.total ?? 0} — {data?.checklist?.period}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <h2 className="font-semibold">Financial processes</h2>
          </div>
          <p className="text-sm text-gray-600">
            Active: {data?.processes?.active ?? 0} · In development: {data?.processes?.inDevelopment ?? 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Not started: {data?.processes?.notStarted ?? 0} / {data?.processes?.total ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}
