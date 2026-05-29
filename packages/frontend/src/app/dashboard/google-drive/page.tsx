'use client';

import { Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { GoogleDriveFolderCard } from '@/components/google-drive-folder-card';
import { useAuth } from '@/hooks/use-auth';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  category: string;
  size: number | null;
  modifiedTime: string;
  subfolderPath: string | null;
  driveUrl: string;
  costSheet?: {
    jobNumber: string;
    client: string;
    event: string;
  } | null;
};

function GoogleDriveContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const canManage =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'BUYER';

  useEffect(() => {
    const drive = searchParams.get('drive');
    const token = searchParams.get('token');
    if (drive === 'connected' && token) {
      setBanner(
        `Connected. Add to packages/backend/.env: GOOGLE_REFRESH_TOKEN=${decodeURIComponent(token)} then restart the backend.`,
      );
    } else if (drive === 'error') {
      setBanner(
        `Connection failed: ${searchParams.get('message') || 'unknown error'}`,
      );
    }
  }, [searchParams]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['google-drive-files', search, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const q = params.toString();
      return (await api.get(`/google-drive/files${q ? `?${q}` : ''}`)).data;
    },
  });

  const sync = useMutation({
    mutationFn: () => api.post('/google-drive/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['google-drive-config'] });
      refetch();
    },
  });

  const files: DriveFile[] = data?.files || [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Google Drive files</h1>
          <p className="text-gray-500 mt-1">
            Files from your assigned folder, stored in the VMS database for search
            and cost sheet import.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${sync.isPending ? 'animate-spin' : ''}`}
            />
            {sync.isPending ? 'Syncing…' : 'Sync folder now'}
          </button>
        )}
      </div>

      {banner && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded px-3 py-2 break-all">
          {banner}
        </p>
      )}

      {sync.data?.data && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded px-3 py-2">
          Synced {sync.data.data.cataloged} files (
          {sync.data.data.filesProcessed} spreadsheets parsed).
        </p>
      )}

      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
        <GoogleDriveFolderCard />
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search file name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="SPREADSHEET">Spreadsheets</option>
            <option value="PDF">PDF</option>
            <option value="DOCUMENT">Documents</option>
            <option value="IMAGE">Images</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-sm py-8 text-center">Loading files…</p>
        ) : !data?.folder ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No folder assigned yet. An admin can set the folder ID above or in
            Settings.
          </p>
        ) : files.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No files cataloged. Run sync after assigning a folder.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Modified</th>
                  <th className="py-2 pr-4">Cost sheet</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 pr-4 max-w-xs truncate">{f.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{f.category}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">
                      {f.subfolderPath || '—'}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs">
                      {new Date(f.modifiedTime).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {f.costSheet
                        ? `${f.costSheet.jobNumber} — ${f.costSheet.client}`
                        : '—'}
                    </td>
                    <td className="py-2">
                      <a
                        href={f.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoogleDrivePage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <GoogleDriveContent />
    </Suspense>
  );
}
