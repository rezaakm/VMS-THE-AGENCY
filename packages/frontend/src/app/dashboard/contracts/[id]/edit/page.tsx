'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

export default function EditContractPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [contractValue, setContractValue] = useState('');
  const [description, setDescription] = useState('');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => (await api.get(`/contracts/${id}`)).data,
  });

  useEffect(() => {
    if (contract) {
      setTitle(contract.title);
      setStatus(contract.status);
      setContractValue(contract.contractValue != null ? String(contract.contractValue) : '');
      setDescription(contract.description || '');
    }
  }, [contract]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/contracts/${id}`, {
        title,
        status,
        contractValue: contractValue ? parseFloat(contractValue) : undefined,
        description: description || undefined,
      }),
    onSuccess: () => router.push(`/dashboard/contracts/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const field = 'w-full px-3 py-2 border rounded-lg';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/contracts/${id}`} className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold">Edit Contract</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Value</label>
          <input type="number" className={field} value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">Save</button>
      </form>
    </div>
  );
}
