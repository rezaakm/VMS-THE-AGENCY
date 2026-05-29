'use client';

import { useAuth } from '@/hooks/use-auth';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        {user ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>{user.firstName} {user.lastName}</dd>
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
    </div>
  );
}
