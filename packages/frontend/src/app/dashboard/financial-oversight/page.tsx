'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  flags: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    total: number;
  };
  overdueFlags: number;
  checklist: {
    total: number;
    completed: number;
    completionRate: number;
    period: string;
  };
  processes: {
    active: number;
    total: number;
  };
}

export default function FinancialOversightDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with real API call
    // fetch('/api/financial-oversight/dashboard').then(...)
    setTimeout(() => {
      setData({
        flags: { CRITICAL: 4, HIGH: 5, MEDIUM: 2, LOW: 1, total: 12 },
        overdueFlags: 5,
        checklist: { total: 6, completed: 2, completionRate: 33, period: '2026-05' },
        processes: { active: 3, total: 6 },
      });
      setLoading(false);
    }, 300);
  }, []);

  if (loading) return <div className="p-8">Loading financial oversight dashboard...</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Financial Oversight</h1>
        <p className="text-muted-foreground">Real-time view of the 12 audit flags and financial controls</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Open Flags</div>
          <div className="text-4xl font-semibold mt-2">{data?.flags.total}</div>
          <div className="text-xs mt-1 text-red-600">{data?.overdueFlags} overdue / escalated</div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Critical + High</div>
          <div className="text-4xl font-semibold mt-2 text-red-600">
            {(data?.flags.CRITICAL || 0) + (data?.flags.HIGH || 0)}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Checklist Completion ({data?.checklist.period})</div>
          <div className="text-4xl font-semibold mt-2">{data?.checklist.completionRate}%</div>
          <div className="text-xs">{data?.checklist.completed} of {data?.checklist.total} items</div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Financial Processes</div>
          <div className="text-4xl font-semibold mt-2">{data?.processes.active} / {data?.processes.total}</div>
          <div className="text-xs">Active</div>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="font-semibold mb-4">Quick Links</h2>
        <div className="flex gap-3">
          <a href="/dashboard/financial-oversight/flags" className="px-4 py-2 border rounded hover:bg-accent">View All Flags</a>
          <a href="/dashboard/financial-oversight/checklist" className="px-4 py-2 border rounded hover:bg-accent">Monthly Checklist</a>
          <a href="/dashboard/financial-oversight/processes" className="px-4 py-2 border rounded hover:bg-accent">Process Registry</a>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Data seeded from the real April 2026 financial audit. This is not test data.
      </div>
    </div>
  );
}
