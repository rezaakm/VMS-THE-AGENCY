'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR, formatPct } from '@/lib/api';

interface DashboardData {
  totalProjects: number;
  totalItems: number;
  totalClients: number;
  totalVendors: number;
  totalRevenue: number;
  totalCost: number;
  overallMargin: number;
  recentAlerts: any[];
  yearlyStats: { year: number; projects: number; totalCost: number; totalRevenue: number; margin: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading dashboard...</div></div>;
  if (!data) return <div className="text-red-500">Failed to load dashboard. Is the backend running?</div>;

  const stats = [
    { label: 'Total Projects', value: data.totalProjects.toLocaleString(), color: 'text-brand-500' },
    { label: 'Line Items', value: data.totalItems.toLocaleString(), color: 'text-brand-500' },
    { label: 'Clients', value: data.totalClients.toLocaleString(), color: 'text-brand-500' },
    { label: 'Vendors', value: data.totalVendors.toLocaleString(), color: 'text-brand-500' },
    { label: 'Total Revenue', value: formatOMR(data.totalRevenue), color: 'text-green-600' },
    { label: 'Total Cost', value: formatOMR(data.totalCost), color: 'text-red-600' },
    { label: 'Overall Margin', value: formatPct(data.overallMargin), color: data.overallMargin >= 20 ? 'text-green-600' : 'text-yellow-600' },
    { label: 'Profit', value: formatOMR(data.totalRevenue - data.totalCost), color: 'text-green-600' },
  ];

  const maxRevenue = Math.max(...data.yearlyStats.map(y => y.totalRevenue));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Procurement intelligence overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <span className={`stat-value ${stat.color}`}>{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Yearly Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-4">Revenue by Year</h2>
            <div className="space-y-3">
              {data.yearlyStats.map((year) => (
                <div key={year.year}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{year.year}</span>
                    <span className="text-gray-500">{formatOMR(year.totalRevenue)} ({year.projects} projects)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-brand-400 h-3 rounded-full transition-all"
                      style={{ width: `${(year.totalRevenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>Cost: {formatOMR(year.totalCost)}</span>
                    <span>Margin: {formatPct(year.margin)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
            {data.recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">No unresolved alerts. Import cost sheets to generate price alerts.</p>
            ) : (
              <div className="space-y-3">
                {data.recentAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800">{alert.message}</p>
                      <p className="text-xs text-red-600 mt-1">{alert.clientName} — {alert.projectName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
