'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

type ZohoStatus = {
  configured: boolean;
  connected: boolean;
  organizationId?: string;
  organizationName?: string;
  expiresAt?: string;
  dataCenter?: string;
  needsOrganization?: boolean;
};

type ZohoOrg = {
  organization_id: string;
  name: string;
  currency_code: string;
};

export function ZohoIntegrationCard() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  useEffect(() => {
    const zoho = searchParams.get('zoho');
    if (zoho === 'connected') {
      setBanner('Zoho Books connected successfully. Select your organization if prompted.');
    } else if (zoho === 'error') {
      const message = searchParams.get('message') || 'Connection failed';
      setBanner(`Zoho connection failed: ${message}`);
    }
  }, [searchParams]);

  const { data: status, isLoading } = useQuery<ZohoStatus>({
    queryKey: ['zoho-status'],
    queryFn: async () => (await api.get('/zoho/status')).data,
  });

  const { data: organizations } = useQuery<ZohoOrg[]>({
    queryKey: ['zoho-organizations'],
    queryFn: async () => (await api.get('/zoho/organizations')).data,
    enabled: !!status?.connected && !!status?.needsOrganization,
  });

  const { data: syncMappings } = useQuery({
    queryKey: ['zoho-sync-mappings'],
    queryFn: async () => (await api.get('/zoho/sync-mappings')).data,
    enabled: !!status?.connected && !status?.needsOrganization,
  });

  const connectOAuth = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ url: string }>('/zoho/auth/url');
      window.location.href = data.url;
    },
  });

  const connectEnv = useMutation({
    mutationFn: () => api.post('/zoho/connect/env'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoho-status'] });
      setBanner('Connected using environment refresh token.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setBanner(
        err.response?.data?.message ||
          'Env connect failed. Set ZOHO_REFRESH_TOKEN and ZOHO_ORGANIZATION_ID.',
      );
    },
  });

  const disconnect = useMutation({
    mutationFn: () => api.post('/zoho/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoho-status'] });
      setBanner('Zoho Books disconnected.');
    },
  });

  const setOrganization = useMutation({
    mutationFn: (payload: { organizationId: string; organizationName?: string }) =>
      api.post('/zoho/organization', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoho-status'] });
      setBanner('Zoho organization saved.');
    },
  });

  const fetchPnL = useMutation({
    mutationFn: async () => (await api.get('/zoho/reports/profit-and-loss')).data,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-sm">Loading Zoho integration…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Zoho Books</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sync vendors and purchase orders to Zoho Books for bills, chart of
            accounts, and P&amp;L reporting (OMR).
          </p>
        </div>
        <span
          className={`text-xs font-mono px-2 py-1 rounded ${
            status?.connected
              ? 'bg-green-100 text-green-800'
              : status?.configured
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {status?.connected
            ? 'Connected'
            : status?.configured
              ? 'Not connected'
              : 'Not configured'}
        </span>
      </div>

      {banner && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          {banner}
        </p>
      )}

      {!status?.configured && (
        <p className="text-sm text-gray-600">
          Add <code className="text-xs bg-gray-100 px-1">ZOHO_CLIENT_ID</code> and{' '}
          <code className="text-xs bg-gray-100 px-1">ZOHO_CLIENT_SECRET</code> to{' '}
          <code className="text-xs bg-gray-100 px-1">packages/backend/.env</code>.
          For Oman, use data center <code className="text-xs bg-gray-100 px-1">sa</code>.
          Register redirect URI:{' '}
          <code className="text-xs bg-gray-100 px-1 break-all">
            http://localhost:3001/zoho/auth/callback
          </code>
        </p>
      )}

      {status?.configured && (
        <div className="flex flex-wrap gap-2">
          {!status.connected && (
            <>
              <button
                type="button"
                onClick={() => connectOAuth.mutate()}
                disabled={connectOAuth.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Connect with Zoho
              </button>
              <button
                type="button"
                onClick={() => connectEnv.mutate()}
                disabled={connectEnv.isPending}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Connect from .env token
              </button>
            </>
          )}
          {status.connected && (
            <>
              <button
                type="button"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="px-4 py-2 border border-red-200 text-red-700 text-sm rounded hover:bg-red-50 disabled:opacity-50"
              >
                Disconnect
              </button>
              <button
                type="button"
                onClick={() => fetchPnL.mutate()}
                disabled={fetchPnL.isPending || status.needsOrganization}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {fetchPnL.isPending ? 'Loading P&L…' : 'Test P&L report'}
              </button>
            </>
          )}
        </div>
      )}

      {status?.connected && (
        <dl className="text-sm space-y-1 border-t pt-4">
          <div className="flex justify-between">
            <dt className="text-gray-500">Organization</dt>
            <dd>
              {status.organizationName || status.organizationId || '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Data center</dt>
            <dd className="font-mono">{status.dataCenter}</dd>
          </div>
          {status.expiresAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Token expires</dt>
              <dd>{new Date(status.expiresAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}

      {status?.connected && status.needsOrganization && organizations && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">Select organization</p>
          <div className="flex gap-2 flex-wrap">
            <select
              className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <option value="">Choose…</option>
              {organizations.map((org) => (
                <option key={org.organization_id} value={org.organization_id}>
                  {org.name} ({org.currency_code})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedOrgId || setOrganization.isPending}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded disabled:opacity-50"
              onClick={() => {
                const org = organizations.find(
                  (o) => o.organization_id === selectedOrgId,
                );
                setOrganization.mutate({
                  organizationId: selectedOrgId,
                  organizationName: org?.name,
                });
              }}
            >
              Save organization
            </button>
          </div>
        </div>
      )}

      {status?.connected && !status.needsOrganization && syncMappings && (
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Recent sync mappings</p>
          {syncMappings.length === 0 ? (
            <p className="text-xs text-gray-500">
              No entities synced yet. Use vendor or PO detail actions to push to
              Zoho.
            </p>
          ) : (
            <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {syncMappings.slice(0, 8).map(
                (m: {
                  id: string;
                  entityType: string;
                  localId: string;
                  zohoId: string;
                  zohoEntity: string;
                  lastSyncedAt: string;
                }) => (
                  <li key={m.id} className="font-mono text-gray-600">
                    {m.entityType} → {m.zohoEntity} {m.zohoId.slice(0, 12)}…
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}

      {fetchPnL.data && (
        <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto max-h-48">
          {JSON.stringify(fetchPnL.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
