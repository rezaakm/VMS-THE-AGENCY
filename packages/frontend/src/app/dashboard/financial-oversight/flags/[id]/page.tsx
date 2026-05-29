'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

export default function FinancialFlagDetailPage() {
  const id = useParams().id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canGrade = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [acknowledgement, setAcknowledgement] = useState('YES');
  const [rootCause, setRootCause] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const { data: flag, isLoading } = useQuery({
    queryKey: ['financial-flag', id],
    queryFn: async () => (await api.get(`/financial-oversight/flags/${id}`)).data,
  });

  const responseMutation = useMutation({
    mutationFn: () =>
      api.post(`/financial-oversight/flags/${id}/responses`, {
        acknowledgement,
        rootCause,
        currentStatus,
        correctiveAction,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-flag', id] });
      setRootCause('');
      setCurrentStatus('');
      setCorrectiveAction('');
    },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ responseId, grade }: { responseId: string; grade: string }) =>
      api.patch(`/financial-oversight/responses/${responseId}/grade`, {
        grade,
        reviewerNotes: 'Reviewed from dashboard',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-flag', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!flag) return <p>Flag not found</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/financial-oversight/flags" className="text-sm text-primary hover:underline">
        ← All flags
      </Link>
      <div>
        <span className="text-sm text-gray-500">Flag #{flag.flagNumber}</span>
        <h1 className="text-2xl font-bold">{flag.title}</h1>
        <p className="text-gray-600 mt-2">{flag.description}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <span>{flag.severity}</span>
          <span>{flag.status}</span>
          <span>Assigned: {flag.assignedTo || '—'}</span>
          {flag.deadline && <span>Due: {formatDate(flag.deadline)}</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-4">Responses (A–F template)</h2>
        {flag.responses?.length ? (
          <ul className="space-y-4">
            {flag.responses.map((r: {
              id: string;
              submittedAt: string;
              acknowledgement?: string;
              rootCause?: string;
              grade?: string;
            }) => (
              <li key={r.id} className="border rounded-lg p-4 text-sm">
                <p className="text-gray-500">Submitted {formatDate(r.submittedAt)}</p>
                <p><strong>Ack:</strong> {r.acknowledgement}</p>
                <p><strong>Root cause:</strong> {r.rootCause}</p>
                <p><strong>Grade:</strong> {r.grade || 'Pending'}</p>
                {canGrade && !r.grade && (
                  <div className="mt-2 flex gap-2">
                    {['ADEQUATE', 'PARTIAL', 'INADEQUATE'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => gradeMutation.mutate({ responseId: r.id, grade: g })}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No responses yet.</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          responseMutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 space-y-4"
      >
        <h2 className="font-semibold">Submit response</h2>
        <div>
          <label className="block text-sm mb-1">Acknowledgement</label>
          <select className="w-full border rounded-lg px-3 py-2" value={acknowledgement} onChange={(e) => setAcknowledgement(e.target.value)}>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
            <option value="PARTIALLY">Partially</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Root cause</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Current status</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Corrective action</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} required />
        </div>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg" disabled={responseMutation.isPending}>
          Submit response
        </button>
      </form>
    </div>
  );
}
