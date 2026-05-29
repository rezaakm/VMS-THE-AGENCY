'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function EvaluationsPage() {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [qualityScore, setQualityScore] = useState(4);
  const [deliveryScore, setDeliveryScore] = useState(4);
  const [pricingScore, setPricingScore] = useState(4);
  const [serviceScore, setServiceScore] = useState(4);
  const [comments, setComments] = useState('');
  const [period, setPeriod] = useState('');

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get('/vendors')).data,
  });

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => (await api.get('/evaluations')).data,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/evaluations', {
        vendorId,
        qualityScore,
        deliveryScore,
        pricingScore,
        serviceScore,
        comments: comments || undefined,
        period: period || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setComments('');
      setPeriod('');
    },
  });

  const field = 'w-full px-3 py-2 border rounded-lg';

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900">Vendor evaluations</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 space-y-4"
      >
        <h2 className="font-semibold">New evaluation</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Vendor *</label>
          <select
            className={field}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            required
          >
            <option value="">Select vendor</option>
            {vendors?.map((v: { id: string; name: string; code: string }) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-1">Quality (1–5)</label>
            <input type="number" min={1} max={5} step={0.5} className={field} value={qualityScore} onChange={(e) => setQualityScore(parseFloat(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Delivery (1–5)</label>
            <input type="number" min={1} max={5} step={0.5} className={field} value={deliveryScore} onChange={(e) => setDeliveryScore(parseFloat(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Pricing (1–5)</label>
            <input type="number" min={1} max={5} step={0.5} className={field} value={pricingScore} onChange={(e) => setPricingScore(parseFloat(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Service (1–5)</label>
            <input type="number" min={1} max={5} step={0.5} className={field} value={serviceScore} onChange={(e) => setServiceScore(parseFloat(e.target.value))} required />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Period (e.g. Q1 2026)</label>
          <input className={field} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Comments</label>
          <textarea className={field} rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !vendorId}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
        >
          Submit evaluation
        </button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="font-semibold p-6 pb-0">Recent evaluations</h2>
        {isLoading ? (
          <p className="p-6 text-gray-500">Loading...</p>
        ) : (
          <table className="min-w-full text-sm mt-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500">Vendor</th>
                <th className="px-4 py-2 text-right text-gray-500">Overall</th>
                <th className="px-4 py-2 text-left text-gray-500">Period</th>
                <th className="px-4 py-2 text-left text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {evaluations?.map(
                (ev: {
                  id: string;
                  vendor: { name: string };
                  overallScore: number;
                  period?: string;
                  evaluationDate: string;
                }) => (
                  <tr key={ev.id}>
                    <td className="px-4 py-2">{ev.vendor?.name}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {ev.overallScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">{ev.period || '—'}</td>
                    <td className="px-4 py-2">{formatDate(ev.evaluationDate)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
