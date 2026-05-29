'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import VendorForm, { vendorToForm, formToVendorPayload } from '@/components/vendor-form';

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState(vendorToForm({}));

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await api.get(`/vendors/${id}`)).data,
  });

  useEffect(() => {
    if (vendor) setForm(vendorToForm(vendor));
  }, [vendor]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/vendors/${id}`, formToVendorPayload(form)),
    onSuccess: () => router.push(`/dashboard/vendors/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/vendors/${id}`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Vendor</h1>
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
          <Link href={`/dashboard/vendors/${id}`} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
