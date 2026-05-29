'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface Vendor {
  id: string;
  name: string;
  code: string;
}

interface LineItem {
  itemNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState('');
  const [description, setDescription] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [items, setItems] = useState<LineItem[]>([
    { itemNumber: '1', description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 },
  ]);

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get('/vendors')).data,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/purchase-orders', {
        vendorId,
        description: description || undefined,
        shippingCost,
        items,
      }),
    onSuccess: (res) => router.push(`/dashboard/purchase-orders/${res.data.id}`),
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/purchase-orders" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">New Purchase Order</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-6"
      >
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
            >
              <option value="">Select vendor</option>
              {vendors?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping (OMR)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg"
              value={shippingCost}
              onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Line items</h2>
            <button
              type="button"
              onClick={() =>
                setItems([
                  ...items,
                  {
                    itemNumber: String(items.length + 1),
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    discount: 0,
                    taxRate: 0,
                  },
                ])
              }
              className="text-sm text-primary flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add line
            </button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 mb-3 items-end">
              <input
                className="px-2 py-2 border rounded text-sm"
                placeholder="Item #"
                value={item.itemNumber}
                onChange={(e) => {
                  const next = [...items];
                  next[i].itemNumber = e.target.value;
                  setItems(next);
                }}
              />
              <input
                className="col-span-2 px-2 py-2 border rounded text-sm"
                placeholder="Description *"
                value={item.description}
                onChange={(e) => {
                  const next = [...items];
                  next[i].description = e.target.value;
                  setItems(next);
                }}
                required
              />
              <input
                type="number"
                className="px-2 py-2 border rounded text-sm"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => {
                  const next = [...items];
                  next[i].quantity = parseFloat(e.target.value) || 0;
                  setItems(next);
                }}
              />
              <input
                type="number"
                className="px-2 py-2 border rounded text-sm"
                placeholder="Unit price"
                value={item.unitPrice}
                onChange={(e) => {
                  const next = [...items];
                  next[i].unitPrice = parseFloat(e.target.value) || 0;
                  setItems(next);
                }}
              />
              <button
                type="button"
                onClick={() => items.length > 1 && setItems(items.filter((_, j) => j !== i))}
                className="text-red-500 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/purchase-orders" className="px-4 py-2 border rounded-lg">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !vendorId}
            className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
          >
            Create PO
          </button>
        </div>
      </form>
    </div>
  );
}
