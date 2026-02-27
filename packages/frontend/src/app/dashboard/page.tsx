'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Users, ShoppingCart, FileText, TrendingUp } from 'lucide-react';

interface DashboardStats {
  vendors: {
    total: number;
    active: number;
  };
  purchaseOrders: {
    total: number;
    active: number;
  };
  contracts: {
    total: number;
    active: number;
    expiring: number;
  };
  spend: {
    total: number;
  };
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Vendors',
      value: stats?.vendors.total || 0,
      subtitle: `${stats?.vendors.active || 0} active`,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Purchase Orders',
      value: stats?.purchaseOrders.total || 0,
      subtitle: `${stats?.purchaseOrders.active || 0} active`,
      icon: ShoppingCart,
      color: 'bg-green-500',
    },
    {
      title: 'Contracts',
      value: stats?.contracts.total || 0,
      subtitle: `${stats?.contracts.active || 0} active, ${stats?.contracts.expiring || 0} expiring`,
      icon: FileText,
      color: 'bg-purple-500',
    },
    {
      title: 'Total Spend',
      value: formatCurrency(stats?.spend.total || 0),
      subtitle: 'All time',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {card.subtitle}
                  </p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <p className="text-gray-500">Activity feed coming soon...</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <a
              href="/dashboard/vendors/new"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Add New Vendor
            </a>
            <a
              href="/dashboard/purchase-orders/new"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Create Purchase Order
            </a>
            <a
              href="/dashboard/contracts/new"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              New Contract
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

