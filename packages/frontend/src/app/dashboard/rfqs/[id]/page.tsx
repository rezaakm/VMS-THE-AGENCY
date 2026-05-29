'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Send, Award, Copy, MessageCircle, Mail, ExternalLink, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

interface RFQDetail {
  id: string;
  rfqNumber: string;
  title: string;
  description: string | null;
  category: string | null;
  deadline: string;
  deliveryDate: string | null;
  status: string;
  notes: string | null;
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  items: Array<{ id: string; itemNumber: number; description: string; quantity: number; unit: string; specs: string | null }>;
  vendorBids: Array<{
    id: string;
    token: string;
    status: string;
    totalAmount: number | null;
    notes: string | null;
    validityDays: number | null;
    submittedAt: string | null;
    vendor: { id: string; name: string; code: string; email: string | null; phone: string | null };
    items: Array<{ rfqItemId: string; unitPrice: number; totalPrice: number; notes: string | null }>;
  }>;
}

interface CompareData {
  rfq: { id: string; rfqNumber: string; title: string };
  comparison: Array<{
    itemId: string; itemNumber: number; description: string; quantity: number; unit: string;
    prices: Array<{ vendorId: string; vendorName: string; unitPrice: number | null; totalPrice: number | null; notes: string | null }>;
    lowestUnitPrice: number | null;
  }>;
  vendorTotals: Array<{
    vendorId: string; vendorName: string; totalAmount: number | null;
    submittedAt: string | null; validityDays: number | null; notes: string | null;
  }>;
}

interface Vendor {
  id: string;
  name: string;
  code: string;
}

export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendVendorIds, setSendVendorIds] = useState<string[]>([]);
  const [sendResult, setSendResult] = useState<any>(null);

  const { data: rfq, isLoading } = useQuery<RFQDetail>({
    queryKey: ['rfq', id],
    queryFn: async () => { const res = await api.get(`/rfqs/${id}`); return res.data; },
  });

  const { data: comparison } = useQuery<CompareData>({
    queryKey: ['rfq-compare', id],
    queryFn: async () => { const res = await api.get(`/rfqs/${id}/compare`); return res.data; },
    enabled: !!rfq && rfq.vendorBids.some(b => b.status === 'SUBMITTED'),
  });

  const { data: allVendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const res = await api.get('/vendors'); return res.data; },
    enabled: showSendModal,
  });

  const sendMutation = useMutation({
    mutationFn: async (vendorIds: string[]) => {
      const res = await api.post(`/rfqs/${id}/send`, { vendorIds });
      return res.data;
    },
    onSuccess: (data) => {
      setSendResult(data);
      queryClient.invalidateQueries({ queryKey: ['rfq', id] });
    },
  });

  const awardMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const res = await api.post(`/rfqs/${id}/award/${bidId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq', id] });
      queryClient.invalidateQueries({ queryKey: ['rfq-compare', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await api.delete(`/rfqs/${id}`); },
    onSuccess: () => router.push('/dashboard/rfqs'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'CLOSED': return 'bg-yellow-100 text-yellow-800';
      case 'AWARDED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rfq) return <div className="text-center py-12 text-gray-500">RFQ not found</div>;

  const submittedBids = rfq.vendorBids.filter(b => b.status === 'SUBMITTED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/rfqs" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{rfq.rfqNumber}</h1>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rfq.status)}`}>{rfq.status}</span>
            </div>
            <p className="text-gray-600">{rfq.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {rfq.status === 'DRAFT' && (
            <button
              onClick={() => deleteMutation.mutate()}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {rfq.status !== 'AWARDED' && rfq.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Send className="w-4 h-4" /> Send to Vendors
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Deadline</p>
          <p className="text-lg font-semibold text-gray-900">{formatDate(rfq.deadline)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Category</p>
          <p className="text-lg font-semibold text-gray-900">{rfq.category || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Vendors Invited</p>
          <p className="text-lg font-semibold text-gray-900">{rfq.vendorBids.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Bids Received</p>
          <p className="text-lg font-semibold text-gray-900">{submittedBids.length}</p>
        </div>
      </div>

      {rfq.description && (
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500 mb-1">Description</p>
          <p className="text-sm text-gray-700">{rfq.description}</p>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Items ({rfq.items.length})</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rfq.items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-sm text-gray-500">{item.itemNumber}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{item.description}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{item.quantity}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{item.unit}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{item.specs || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor Bids */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Vendor Bids</h2>
        </div>
        {rfq.vendorBids.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No vendors invited yet. Click Send to Vendors to get started.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rfq.vendorBids.map((bid) => (
              <div key={bid.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{bid.vendor.name}</span>
                    <span className="text-xs text-gray-400">{bid.vendor.code}</span>
                    <span className={`px-2 text-xs font-semibold rounded-full ${getStatusColor(bid.status)}`}>{bid.status}</span>
                  </div>
                  {bid.totalAmount && <p className="text-sm text-gray-600 mt-1">Total: {formatCurrency(bid.totalAmount)}</p>}
                  {bid.submittedAt && <p className="text-xs text-gray-400">Submitted: {formatDate(bid.submittedAt)}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/bid/${bid.token}`)}
                    title="Copy bid link"
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {bid.vendor.email && (
                    <a
                      href={`mailto:${bid.vendor.email}?subject=RFQ ${rfq.rfqNumber}: ${rfq.title}&body=Please submit your bid at: ${window.location.origin}/bid/${bid.token}`}
                      title="Send email"
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {bid.status === 'SUBMITTED' && rfq.status !== 'AWARDED' && (
                    <button
                      onClick={() => { if (confirm(`Award this RFQ to ${bid.vendor.name}?`)) awardMutation.mutate(bid.id); }}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Award className="w-3 h-3" /> Award
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bid Comparison */}
      {comparison && comparison.comparison.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Bid Comparison</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                {comparison.vendorTotals.map(v => (
                  <th key={v.vendorId} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{v.vendorName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comparison.comparison.map((item) => (
                <tr key={item.itemId}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.quantity} {item.unit}</td>
                  {item.prices.map((price) => (
                    <td key={price.vendorId} className={`px-4 py-3 text-sm ${price.unitPrice === item.lowestUnitPrice ? 'text-green-700 font-bold bg-green-50' : 'text-gray-900'}`}>
                      {price.unitPrice !== null ? (
                        <div>
                          <div>{formatCurrency(price.unitPrice)}/unit</div>
                          <div className="text-xs text-gray-400">{formatCurrency(price.totalPrice!)}</div>
                        </div>
                      ) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-900" colSpan={2}>Total</td>
                {comparison.vendorTotals.map(v => (
                  <td key={v.vendorId} className="px-4 py-3 text-sm text-gray-900">
                    {v.totalAmount !== null ? formatCurrency(v.totalAmount) : '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Send RFQ to Vendors</h2>

            {sendResult ? (
              <div className="space-y-4">
                <p className="text-green-600 font-medium">RFQ sent successfully!</p>
                <div className="space-y-3">
                  {sendResult.sendLinks.map((link: any) => (
                    <div key={link.vendorId} className="p-3 border rounded-lg">
                      <p className="font-medium text-gray-900">{link.vendorName}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => copyToClipboard(link.bidUrl)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                        >
                          <Copy className="w-3 h-3" /> Copy Link
                        </button>
                        {link.vendorEmail && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Mail className="w-3 h-3" /> Email sent
                          </span>
                        )}
                        {link.whatsappUrl && (
                          <a href={link.whatsappUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setShowSendModal(false); setSendResult(null); }}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                  Done
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">Select vendors to receive this RFQ:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {allVendors?.map((vendor) => {
                    const alreadyInvited = rfq.vendorBids.some(b => b.vendor.id === vendor.id);
                    return (
                      <label key={vendor.id} className={`flex items-center gap-2 p-2 rounded ${alreadyInvited ? 'bg-gray-50' : 'hover:bg-gray-50'} cursor-pointer`}>
                        <input
                          type="checkbox"
                          checked={sendVendorIds.includes(vendor.id) || alreadyInvited}
                          disabled={alreadyInvited}
                          onChange={() => {
                            if (!alreadyInvited) {
                              setSendVendorIds(prev => prev.includes(vendor.id) ? prev.filter(x => x !== vendor.id) : [...prev, vendor.id]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{vendor.name} <span className="text-gray-400">({vendor.code})</span></span>
                        {alreadyInvited && <span className="text-xs text-gray-400 ml-auto">Already invited</span>}
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const idsToSend = [...new Set([...rfq.vendorBids.map(b => b.vendor.id), ...sendVendorIds])];
                      sendMutation.mutate(idsToSend);
                    }}
                    disabled={sendMutation.isPending}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {sendMutation.isPending ? 'Sending...' : 'Send'}
                  </button>
                  <button onClick={() => setShowSendModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
