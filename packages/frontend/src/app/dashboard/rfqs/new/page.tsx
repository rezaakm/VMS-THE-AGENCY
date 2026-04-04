'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Vendor {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface RfqItem {
  description: string;
  quantity: number;
  unit: string;
  specs: string;
}

export default function NewRfqPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [items, setItems] = useState<RfqItem[]>([
    { description: '', quantity: 1, unit: 'piece', specs: '' },
  ]);

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await api.get('/vendors');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/rfqs', data);
      return res.data;
    },
    onSuccess: (data) => {
      router.push(`/dashboard/rfqs/${data.id}`);
    },
  });

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit: 'piece', specs: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RfqItem, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const toggleVendor = (vendorId: string) => {
    setSelectedVendors(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      description: description || undefined,
      category: category || undefined,
      deadline: new Date(deadline).toISOString(),
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
      notes: notes || undefined,
      items: items.filter(i => i.description.trim()),
      vendorIds: selectedVendors.length > 0 ? selectedVendors : undefined,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/rfqs" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">New RFQ</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">RFQ Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. AV Equipment for Conference"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. AV Equipment, Printing, Staging"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Additional details about this RFQ..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Internal notes..."
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <span className="text-sm text-gray-400 mt-2 w-6">{idx + 1}.</span>
                <input
                  type="text"
                  required
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <select
                  value={item.unit}
                  onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="piece">Piece</option>
                  <option value="sqm">Sqm</option>
                  <option value="lm">LM</option>
                  <option value="day">Day</option>
                  <option value="hour">Hour</option>
                  <option value="set">Set</option>
                  <option value="lot">Lot</option>
                  <option value="kg">Kg</option>
                </select>
                <input
                  type="text"
                  placeholder="Specs (optional)"
                  value={item.specs}
                  onChange={(e) => updateItem(idx, 'specs', e.target.value)}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 mt-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Vendors (optional)</h2>
          <p className="text-sm text-gray-500 mb-3">Select vendors to invite. You can also add more vendors later when sending.</p>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {vendors?.map((vendor) => (
              <label key={vendor.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedVendors.includes(vendor.id)}
                  onChange={() => toggleVendor(vendor.id)}
                  className="rounded border-gray-300 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-gray-700">{vendor.name}</span>
                <span className="text-xs text-gray-400">{vendor.code}</span>
              </label>
            ))}
            {(!vendors || vendors.length === 0) && (
              <p className="text-sm text-gray-400 col-span-2">No vendors available. Add vendors first.</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create RFQ'}
          </button>
          <Link
            href="/dashboard/rfqs"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>

        {createMutation.isError && (
          <p className="text-red-600 text-sm">Failed to create RFQ. Please check all fields and try again.</p>
        )}
      </form>
    </div>
  );
}
