'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { Plus, Eye, Send, Award } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface RFQ {
  id: string;
  rfqNumber: string;
  title: string;
  category: string | null;
  status: string;
  deadline: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
  _count: { vendorBids: number; items: number };
  vendorBids: Array<{ status: string }>;
}

const statusOptions = ['', 'DRAFT', 'SENT', 'CLOSED', 'AWARDED', 'CANCELLED'];

export default function RfqsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rfqs, isLoading } = useQuery<RFQ[]>({
    queryKey: ['rfqs', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      const response = await api.get(`/rfqs?${params.toString()}`);
      return response.data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'CLOSED': return 'bg-yellow-100 text-yellow-800';
      case 'AWARDED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBidCount = (rfq: RFQ) => {
    const submitted = rfq.vendorBids.filter(b => b.status === 'SUBMITTED').length;
    return `${submitted}/${rfq._count.vendorBids}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">RFQs</h1>
        <Link
          href="/dashboard/rfqs/new"
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New RFQ</span>
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search RFQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Statuses</option>
          {statusOptions.filter(Boolean).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RFQ #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bids</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rfqs?.map((rfq) => (
              <tr key={rfq.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{rfq.rfqNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{rfq.title}</div>
                  <div className="text-sm text-gray-500">by {rfq.createdBy.firstName} {rfq.createdBy.lastName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rfq.category || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(rfq.deadline)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rfq._count.items}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getBidCount(rfq)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(rfq.status)}`}>
                    {rfq.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/dashboard/rfqs/${rfq.id}`} className="text-blue-600 hover:text-blue-900">
                    <Eye className="w-4 h-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!rfqs || rfqs.length === 0) && (
          <div className="text-center py-12">
            <p className="text-gray-500">No RFQs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
