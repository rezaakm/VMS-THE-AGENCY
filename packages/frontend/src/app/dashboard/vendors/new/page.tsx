'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import VendorForm, { emptyVendorForm, formToVendorPayload } from '@/components/vendor-form';

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyVendorForm);

  const mutation = useMutation({
    mutationFn: () => api.post('/vendors', formToVendorPayload(form)),
    onSuccess: (res) => router.push(`/dashboard/vendors/${res.data.id}`),
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/vendors" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Vendor</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="bg-white rounded-lg shadow p-6 space-y-6"
      >
        <VendorForm form={form} onChange={setForm} />
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/vendors" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Create Vendor'}
          </button>
        </div>
      </form>
    </div>
  );
}
