'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';

type DriveConfig = {
  configured: boolean;
  activeFolder: {
    id: string;
    folderId: string;
    name: string | null;
    lastSyncedAt: string | null;
  } | null;
  envFolderId: string | null;
  fileCount: number;
};

export function GoogleDriveFolderCard() {
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');

  const { data: config, isLoading } = useQuery<DriveConfig>({
    queryKey: ['google-drive-config'],
    queryFn: async () => (await api.get('/google-drive/config')).data,
  });

  const assignFolder = useMutation({
    mutationFn: (payload: { folderId: string; name?: string }) =>
      api.put('/google-drive/folder', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-config'] });
      queryClient.invalidateQueries({ queryKey: ['google-drive-files'] });
    },
  });

  const connectDrive = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ authUrl: string }>('/google-drive/auth');
      window.open(data.authUrl, '_blank');
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-500">
        Loading Google Drive settings…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Google Drive folder</h2>
        <p className="text-sm text-gray-500 mt-1">
          Assign a Drive folder. All files inside (including subfolders) are
          cataloged in the database. Excel cost sheets are parsed automatically
          on sync.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span
          className={`text-xs font-mono px-2 py-1 rounded ${
            config?.configured
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {config?.configured ? 'API connected' : 'OAuth not configured'}
        </span>
        {config?.activeFolder && (
          <span className="text-xs text-gray-500">
            {config.fileCount} files in catalog
          </span>
        )}
      </div>

      {!config?.configured && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Set <code className="text-xs bg-gray-100 px-1">GOOGLE_CLIENT_ID</code> and{' '}
            <code className="text-xs bg-gray-100 px-1">GOOGLE_CLIENT_SECRET</code> in backend
            .env, then connect your account.
          </p>
          <button
            type="button"
            onClick={() => connectDrive.mutate()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
          >
            Connect Google account
          </button>
        </div>
      )}

      {config?.activeFolder && (
        <dl className="text-sm border rounded p-3 bg-gray-50 space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Active folder</dt>
            <dd className="text-right">{config.activeFolder.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Folder ID</dt>
            <dd className="font-mono text-xs break-all">{config.activeFolder.folderId}</dd>
          </div>
          {config.activeFolder.lastSyncedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Last sync</dt>
              <dd>{new Date(config.activeFolder.lastSyncedAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">Assign or change folder</p>
        <p className="text-xs text-gray-500">
          Open the folder in Google Drive and copy the ID from the URL:{' '}
          <code className="bg-gray-100 px-1">drive.google.com/drive/folders/ID</code>
        </p>
        <input
          type="text"
          placeholder="Folder ID"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Display name (optional)"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!folderId.trim() || assignFolder.isPending}
          onClick={() =>
            assignFolder.mutate({
              folderId: folderId.trim(),
              name: folderName.trim() || undefined,
            })
          }
          className="px-4 py-2 bg-primary text-white text-sm rounded disabled:opacity-50"
        >
          Save folder assignment
        </button>
        {config?.envFolderId && !config.activeFolder && (
          <p className="text-xs text-amber-700">
            Env has GOOGLE_DRIVE_FOLDER_ID; it will be used on first sync if no
            folder is saved here.
          </p>
        )}
      </div>
    </div>
  );
}
