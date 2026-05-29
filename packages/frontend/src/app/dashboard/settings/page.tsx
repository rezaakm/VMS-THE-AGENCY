'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';
import { ZohoIntegrationCard } from '@/components/zoho-integration-card';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canViewAudit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get('/audit-logs?limit=30')).data,
    enabled: !!canViewAudit,
  });

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        {user ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-mono">{user.role}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-gray-500">Loading profile...</p>
        )}
        <p className="text-xs text-gray-400 pt-4 border-t">
          API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
        </p>
      </div>

      {isAdmin && (
        <Suspense
          fallback={
            <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-500">
              Loading integrations…
            </div>
          }
        >
          <ZohoIntegrationCard />
        </Suspense>
      )}

      {canViewAudit && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent audit trail</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditLogs?.map(
                  (log: {
                    id: string;
                    createdAt: string;
                    user: { email: string };
                    action: string;
                    entity: string;
                    entityId: string;
                  }) => (
                    <tr key={log.id}>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-2 pr-4">{log.user?.email}</td>
                      <td className="py-2 pr-4 font-mono">{log.action}</td>
                      <td className="py-2 pr-4">
                        {log.entity}{' '}
                        <span className="text-gray-400">
                          {log.entityId.slice(0, 8)}…
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {(!auditLogs || auditLogs.length === 0) && (
              <p className="text-gray-500 py-4">No audit entries yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
