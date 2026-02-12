'use client';
import { useEffect, useState } from 'react';
import { api, formatOMR, formatPct } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.dashboard().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

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
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <span className={`stat-value text-lg ${s.color}`}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card card-body">
          <h2 className="text-lg font-semibold mb-4">Yearly Performance</h2>
          <div className="space-y-3">
            {data.yearlyStats.map((y: any) => (
              <div key={y.year} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{y.year}</span>
                <span className="text-sm text-gray-500">{y.projects} projects</span>
                <span className="text-sm font-medium">{formatOMR(y.totalRevenue)}</span>
                <span className={`badge ${y.margin >= 20 ? 'badge-green' : 'badge-yellow'}`}>{formatPct(y.margin)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-body">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          {data.recentAlerts.length === 0 ? (
            <p className="text-sm text-gray-400">No unresolved alerts. Import cost sheets to generate price alerts.</p>
          ) : (
            <div className="space-y-3">
              {data.recentAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
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
  );
}
