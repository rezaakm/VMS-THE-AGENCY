'use client';

import { useEffect, useState } from 'react';

interface Flag {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  dueDate: string | null;
  responses: any[];
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [responseForm, setResponseForm] = useState({
    acknowledge: '',
    rootCause: '',
    currentStatus: '',
    actionPlan: '',
    evidence: '',
    completionDate: '',
  });
  const [grading, setGrading] = useState({ grade: 'ADEQUATE', notes: '' });

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async function loadFlags() {
    try {
      const res = await fetch(`${API}/financial-oversight/flags`);
      const data = await res.json();
      setFlags(data);
    } catch (e) {
      console.error('Failed to load flags', e);
      // Fallback demo data if backend not running
      setFlags([
        {
          id: 'demo-1',
          title: 'Budget conflict between two major proposals',
          description: 'Two competing proposals for the same project were approved with conflicting budget allocations.',
          severity: 'CRITICAL',
          category: 'BUDGET',
          status: 'OPEN',
          dueDate: '2026-06-01',
          responses: [],
        },
        {
          id: 'demo-2',
          title: 'AR collections stuck at OMR 57,100 over 90 days',
          description: 'Significant receivables over 90 days old with no formal collection process.',
          severity: 'CRITICAL',
          category: 'AR_COLLECTIONS',
          status: 'OPEN',
          dueDate: null,
          responses: [],
        },
      ]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadFlags();
  }, []);

  async function submitResponse() {
    if (!selectedFlag) return;

    try {
      await fetch(`${API}/financial-oversight/flags/${selectedFlag.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseForm),
      });
      alert('Response submitted successfully');
      setSelectedFlag(null);
      setResponseForm({ acknowledge: '', rootCause: '', currentStatus: '', actionPlan: '', evidence: '', completionDate: '' });
      loadFlags();
    } catch (e) {
      alert('Failed to submit response (backend may not be running)');
    }
  }

  async function gradeResponse(responseId: string) {
    try {
      await fetch(`${API}/financial-oversight/responses/${responseId}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grading),
      });
      alert('Graded successfully');
      setSelectedFlag(null);
      loadFlags();
    } catch (e) {
      alert('Grading failed');
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Financial Flags</h1>
      <p className="text-muted-foreground mb-6">The 12 real issues from the April 2026 audit. This is the heart of the system.</p>

      {loading ? (
        <div>Loading flags...</div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <div key={flag.id} className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer" onClick={() => setSelectedFlag(flag)}>
              <div className="flex justify-between">
                <div>
                  <span className={`px-2 py-0.5 text-xs rounded mr-2 ${flag.severity === 'CRITICAL' ? 'bg-red-600 text-white' : flag.severity === 'HIGH' ? 'bg-orange-500 text-white' : 'bg-yellow-500'}`}>
                    {flag.severity}
                  </span>
                  <span className="font-medium">{flag.title}</span>
                </div>
                <span className="text-sm text-muted-foreground">{flag.status}</span>
              </div>
              <p className="text-sm mt-1 line-clamp-2">{flag.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detail + Response Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedFlag(null)}>
          <div className="bg-background rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-semibold mb-2">{selectedFlag.title}</h2>
            <p className="mb-4 text-muted-foreground">{selectedFlag.description}</p>

            <div className="mb-6">
              <h3 className="font-medium mb-2">A-F Response</h3>
              <div className="space-y-3">
                {['acknowledge','rootCause','currentStatus','actionPlan','evidence','completionDate'].map((field) => (
                  <div key={field}>
                    <label className="text-sm block mb-1 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                    <textarea
                      className="w-full border rounded p-2 text-sm"
                      rows={2}
                      value={(responseForm as any)[field] || ''}
                      onChange={(e) => setResponseForm({ ...responseForm, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <button onClick={submitResponse} className="mt-3 bg-black text-white px-4 py-2 rounded">Submit Response</button>
            </div>

            {selectedFlag.responses?.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Responses & Grading</h3>
                {selectedFlag.responses.map((r: any, i: number) => (
                  <div key={i} className="border p-3 rounded mb-2">
                    <div className="text-sm">Submitted: {new Date(r.submittedAt).toLocaleDateString()}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Acknowledge:</strong> {r.acknowledge}</div>
                      <div><strong>Root Cause:</strong> {r.rootCause}</div>
                    </div>

                    {!r.grade ? (
                      <div className="mt-3 border-t pt-3">
                        <div className="flex gap-2">
                          <select value={grading.grade} onChange={e => setGrading({...grading, grade: e.target.value})} className="border p-1">
                            <option value="ADEQUATE">ADEQUATE</option>
                            <option value="PARTIAL">PARTIAL</option>
                            <option value="INADEQUATE">INADEQUATE</option>
                          </select>
                          <input
                            placeholder="Grader notes"
                            className="flex-1 border p-1"
                            value={grading.notes}
                            onChange={e => setGrading({...grading, notes: e.target.value})}
                          />
                          <button onClick={() => gradeResponse(r.id)} className="bg-black text-white px-3 py-1 rounded text-sm">Grade</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">Grade: <strong>{r.grade}</strong> by manager</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setSelectedFlag(null)} className="mt-4 text-sm underline">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
