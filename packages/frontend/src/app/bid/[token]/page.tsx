'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/lib/get-api-url';

const publicApi = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
});

interface BidData {
  id: string;
  token: string;
  status: string;
  vendor: { id: string; name: string };
  rfq: {
    id: string;
    rfqNumber: string;
    title: string;
    description: string | null;
    deadline: string;
    items: Array<{ id: string; itemNumber: number; description: string; quantity: number; unit: string; specs: string | null }>;
  };
  items: Array<{ rfqItemId: string; unitPrice: number; totalPrice: number; notes: string | null }>;
}

export default function BidFormPage() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [validityDays, setValidityDays] = useState(30);

  const { data: bid, isLoading, error } = useQuery<BidData>({
    queryKey: ['bid', token],
    queryFn: async () => {
      const res = await publicApi.get(`/rfqs/bid/${token}`);
      return res.data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await publicApi.post(`/rfqs/bid/${token}`, data);
      return res.data;
    },
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bid) return;

    const items = bid.rfq.items.map(item => ({
      rfqItemId: item.id,
      unitPrice: prices[item.id] || 0,
      notes: itemNotes[item.id] || undefined,
    })).filter(i => i.unitPrice > 0);

    if (items.length === 0) {
      alert('Please enter at least one price');
      return;
    }

    submitMutation.mutate({
      items,
      notes: notes || undefined,
      validityDays,
    });
  };

  const getTotal = () => {
    if (!bid) return 0;
    return bid.rfq.items.reduce((sum, item) => {
      return sum + (prices[item.id] || 0) * item.quantity;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !bid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">This bid link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const isExpired = new Date() > new Date(bid.rfq.deadline);
  const isAlreadyProcessed = bid.status === 'ACCEPTED' || bid.status === 'REJECTED';

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bid Submitted!</h1>
          <p className="text-gray-500 mb-4">Thank you for your quotation for {bid.rfq.title}. We will review all submissions and get back to you.</p>
          <p className="text-sm text-gray-400">RFQ: {bid.rfq.rfqNumber}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request for Quotation</h1>
              <p className="text-sm text-gray-500 mt-1">{bid.rfq.rfqNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Vendor</p>
              <p className="font-semibold text-gray-900">{bid.vendor.name}</p>
            </div>
          </div>
          <h2 className="text-lg font-medium text-gray-800">{bid.rfq.title}</h2>
          {bid.rfq.description && <p className="text-sm text-gray-600 mt-2">{bid.rfq.description}</p>}
          <div className="flex items-center gap-2 mt-4 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className={isExpired ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Deadline: {new Date(bid.rfq.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {isExpired && ' (EXPIRED)'}
            </span>
          </div>
        </div>

        {isAlreadyProcessed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">This bid has already been {bid.status.toLowerCase()}.</p>
          </div>
        )}

        {isExpired && !isAlreadyProcessed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">The deadline for this RFQ has passed. Submissions are no longer accepted.</p>
          </div>
        )}

        {/* Bid Form */}
        {!isExpired && !isAlreadyProcessed && (
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Enter Your Pricing</h3>
                <p className="text-sm text-gray-500">Please provide unit prices for each item below.</p>
              </div>
              <div className="divide-y divide-gray-200">
                {bid.rfq.items.map((item) => {
                  const unitPrice = prices[item.id] || 0;
                  const lineTotal = unitPrice * item.quantity;
                  return (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{item.itemNumber}. {item.description}</span>
                          {item.specs && <p className="text-xs text-gray-400">Specs: {item.specs}</p>}
                        </div>
                        <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={prices[item.id] || ''}
                            onChange={(e) => setPrices({ ...prices, [item.id]: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <div className="w-32 text-right">
                          <label className="block text-xs text-gray-500 mb-1">Line Total</label>
                          <p className="text-sm font-medium text-gray-900 py-2">{lineTotal.toFixed(2)}</p>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Notes for this item (optional)"
                        value={itemNotes[item.id] || ''}
                        onChange={(e) => setItemNotes({ ...itemNotes, [item.id]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center rounded-b-lg">
                <span className="text-lg font-semibold text-gray-900">Grand Total</span>
                <span className="text-xl font-bold text-gray-900">{getTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional terms, conditions, or notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quote Validity (days)</label>
                <input
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Quotation'}
            </button>

            {submitMutation.isError && (
              <p className="text-red-600 text-sm mt-2 text-center">
                Failed to submit. {(submitMutation.error as any)?.response?.data?.message || 'Please try again.'}
              </p>
            )}
          </form>
        )}

        {/* Previously submitted */}
        {bid.status === 'SUBMITTED' && bid.items.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium mb-2">You have already submitted a bid. You can resubmit to update your pricing.</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          The Agency Oman - Vendor Management System
        </p>
      </div>
    </div>
  );
}
