'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

export default function NewContractPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [description, setDescription] = useState('');

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get('/vendors')).data,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/contracts', {
        vendorId,
        title,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        contractValue: contractValue ? parseFloat(contractValue) : undefined,
        currency,
        description: description || undefined,
      }),
    onSuccess: (res) => router.push(`/dashboard/contracts/${res.data.id}`),
  });

  const field = 'w-full px-3 py-2 border rounded-lg';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/contracts" className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold">New Contract</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 grid md:grid-cols-2 gap-4 max-w-3xl"
      >
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Vendor *</label>
          <select className={field} value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Select vendor</option>
            {vendors?.map((v: { id: string; name: string }) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start date *</label>
          <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End date *</label>
          <input type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Value</label>
          <input type="number" className={field} value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <input className={field} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg" disabled={mutation.isPending}>
            Create Contract
          </button>
        </div>
      </form>
    </div>
  );
}
