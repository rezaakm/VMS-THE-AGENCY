'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

const statusColors: Record<string, string> = {
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  EXPORTED: 'bg-purple-100 text-purple-800',
};

const confidenceColor = (c: number) => {
  if (c >= 0.7) return 'text-green-600';
  if (c >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
};

export default function BoqDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [boq, setBoq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [repricing, setRepricing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit: 'piece', section: '', unitCost: 0, unitSelling: 0 });

  const loadBoq = useCallback(async () => {
    try {
      const { data } = await api.get(`/boq/${id}`);
      setBoq(data);
    } catch {
      router.push('/dashboard/boq');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadBoq();
    // Poll while processing
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/boq/${id}`);
        setBoq(data);
        if (data.status !== 'PROCESSING') clearInterval(interval);
      } catch { clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, loadBoq]);

  async function handleSaveItem() {
    if (!editingItem) return;
    try {
      await api.patch(`/boq/items/${editingItem}`, editForm);
      setEditingItem(null);
      loadBoq();
    } catch (err) {
      console.error('Failed to update item', err);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Remove this item?')) return;
    await api.delete(`/boq/items/${itemId}`);
    loadBoq();
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/boq/${id}/items`, newItem);
    setShowAddItem(false);
    setNewItem({ description: '', quantity: 1, unit: 'piece', section: '', unitCost: 0, unitSelling: 0 });
    loadBoq();
  }

  async function handleReprice() {
    setRepricing(true);
    try {
      const { data } = await api.post(`/boq/${id}/reprice`);
      alert(`Re-priced ${data.updated} of ${data.total} items from cost sheets & vendor data`);
      loadBoq();
    } finally {
      setRepricing(false);
    }
  }

  async function handleSyncAndReprice() {
    setSyncing(true);
    try {
      const { data } = await api.post(`/boq/${id}/sync-reprice`);
      const syncMsg = data.sync?.filesProcessed !== undefined
        ? `Synced ${data.sync.filesProcessed} cost sheets from Drive. `
        : 'Using existing data. ';
      alert(`${syncMsg}Re-priced ${data.reprice.updated} of ${data.reprice.total} items.`);
      loadBoq();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    await api.patch(`/boq/${id}/status`, { status: newStatus });
    loadBoq();
  }

  async function handleDelete() {
    if (!confirm('Delete this BOQ?')) return;
    await api.delete(`/boq/${id}`);
    router.push('/dashboard/boq');
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Loading...</div>;
  if (!boq) return null;

  // Group items by section
  const sections: Record<string, any[]> = {};
  boq.items?.forEach((item: any) => {
    const sec = item.section || 'General';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  });

  const unpricedCount = boq.items?.filter((i: any) => i.unitCost === 0).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{boq.title}</h1>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[boq.status]}`}>
              {boq.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1 font-mono">{boq.boqNumber}</p>
          {boq.projectName && <p className="text-gray-600 mt-1">Project: {boq.projectName}</p>}
          {boq.clientName && <p className="text-gray-600">Client: {boq.clientName}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAndReprice}
            disabled={syncing || boq.status === 'PROCESSING'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {syncing ? 'Syncing Drive...' : 'Sync Drive & Re-price'}
          </button>
          <button
            onClick={handleReprice}
            disabled={repricing || boq.status === 'PROCESSING'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {repricing ? 'Re-pricing...' : 'Re-price from Cost Sheets'}
          </button>
          {boq.status === 'DRAFT' && (
            <button onClick={() => handleStatusChange('REVIEWED')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Mark Reviewed
            </button>
          )}
          {boq.status === 'REVIEWED' && (
            <button onClick={() => handleStatusChange('APPROVED')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
              Approve
            </button>
          )}
          <button onClick={handleDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm">
            Delete
          </button>
        </div>
      </div>

      {/* Processing indicator */}
      {boq.status === 'PROCESSING' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2 animate-pulse">🔍</div>
          <h3 className="text-lg font-medium text-yellow-800">Analyzing Drawings...</h3>
          <p className="text-yellow-700 mt-1">AI is extracting quantities from your {boq.drawingCount} drawing(s). This may take a minute.</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Items</p>
          <p className="text-2xl font-bold">{boq.items?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Drawings</p>
          <p className="text-2xl font-bold">{boq.drawingCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold">{boq.totalCost?.toFixed(2)} <span className="text-sm font-normal">OMR</span></p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Selling Price</p>
          <p className="text-2xl font-bold">{boq.totalSelling?.toFixed(2)} <span className="text-sm font-normal">OMR</span></p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Margin</p>
          <p className={`text-2xl font-bold ${boq.margin !== null && boq.margin >= 25 ? 'text-green-600' : 'text-red-600'}`}>
            {boq.margin !== null ? `${boq.margin}%` : '-'}
          </p>
        </div>
      </div>

      {unpricedCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          {unpricedCount} item(s) have no pricing. Use "Re-price from Cost Sheets" or edit manually.
        </div>
      )}

      {/* Drawings */}
      {boq.drawings?.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Uploaded Drawings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {boq.drawings.map((d: any) => (
              <div key={d.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <span className="text-2xl">{d.mimeType === 'application/pdf' ? '📄' : '🖼️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.fileName}</p>
                  {d.aiNotes && <p className="text-xs text-gray-500 truncate">{d.aiNotes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOQ Items Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bill of Quantities</h2>
          <button
            onClick={() => setShowAddItem(true)}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm"
          >
            + Add Item
          </button>
        </div>

        {/* Add Item Form */}
        {showAddItem && (
          <form onSubmit={handleAddItem} className="px-6 py-4 bg-blue-50 border-b flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-600">Description</label>
              <input
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
                required
              />
            </div>
            <div className="w-20">
              <label className="text-xs text-gray-600">Qty</label>
              <input
                type="number"
                step="0.01"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-600">Unit</label>
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                {['piece', 'sqm', 'lm', 'metre', 'kg', 'set', 'lot', 'hour', 'day', 'm3', 'roll', 'panel'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="text-xs text-gray-600">Unit Cost</label>
              <input
                type="number"
                step="0.01"
                value={newItem.unitCost}
                onChange={(e) => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-gray-600">Unit Selling</label>
              <input
                type="number"
                step="0.01"
                value={newItem.unitSelling}
                onChange={(e) => setNewItem({ ...newItem, unitSelling: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Add</button>
              <button type="button" onClick={() => setShowAddItem(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
            </div>
          </form>
        )}

        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            <div className="px-6 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">{sectionName}</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-6 py-2 text-left w-12">#</th>
                  <th className="px-6 py-2 text-left">Description</th>
                  <th className="px-6 py-2 text-right w-20">Qty</th>
                  <th className="px-6 py-2 text-left w-16">Unit</th>
                  <th className="px-6 py-2 text-right w-28">Unit Cost</th>
                  <th className="px-6 py-2 text-right w-28">Total Cost</th>
                  <th className="px-6 py-2 text-right w-28">Unit Sell</th>
                  <th className="px-6 py-2 text-right w-28">Total Sell</th>
                  <th className="px-6 py-2 text-center w-16">Source</th>
                  <th className="px-6 py-2 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item: any) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.unitCost === 0 ? 'bg-red-50/30' : ''}`}>
                    {editingItem === item.id ? (
                      <>
                        <td className="px-6 py-2 text-sm">{item.itemNumber}</td>
                        <td className="px-6 py-2">
                          <input
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.quantity || 0}
                            onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-6 py-2 text-sm">{item.unit}</td>
                        <td className="px-6 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.unitCost || 0}
                            onChange={(e) => setEditForm({ ...editForm, unitCost: parseFloat(e.target.value) || 0 })}
                            className="w-24 px-2 py-1 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-6 py-2 text-sm text-right text-gray-400">-</td>
                        <td className="px-6 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.unitSelling || 0}
                            onChange={(e) => setEditForm({ ...editForm, unitSelling: parseFloat(e.target.value) || 0 })}
                            className="w-24 px-2 py-1 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-6 py-2 text-sm text-right text-gray-400">-</td>
                        <td className="px-6 py-2"></td>
                        <td className="px-6 py-2 text-center">
                          <button onClick={handleSaveItem} className="text-green-600 hover:text-green-800 text-xs mr-2">Save</button>
                          <button onClick={() => setEditingItem(null)} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-2 text-sm text-gray-500">{item.itemNumber}</td>
                        <td className="px-6 py-2 text-sm text-gray-900">
                          {item.description}
                          {item.specs && <span className="block text-xs text-gray-400">{item.specs}</span>}
                        </td>
                        <td className="px-6 py-2 text-sm text-right">{item.quantity}</td>
                        <td className="px-6 py-2 text-sm text-gray-500">{item.unit}</td>
                        <td className="px-6 py-2 text-sm text-right font-mono">{item.unitCost.toFixed(2)}</td>
                        <td className="px-6 py-2 text-sm text-right font-mono font-medium">{item.totalCost.toFixed(2)}</td>
                        <td className="px-6 py-2 text-sm text-right font-mono">{item.unitSelling.toFixed(2)}</td>
                        <td className="px-6 py-2 text-sm text-right font-mono font-medium">{item.totalSelling.toFixed(2)}</td>
                        <td className="px-6 py-2 text-center">
                          <span className={`text-xs font-medium ${confidenceColor(item.priceConfidence)}`} title={`${item.priceSource} (${Math.round(item.priceConfidence * 100)}%)`}>
                            {item.priceSource === 'NONE' ? '⚠️' : item.priceSource?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-2 text-center">
                          <button
                            onClick={() => { setEditingItem(item.id); setEditForm({ description: item.description, quantity: item.quantity, unitCost: item.unitCost, unitSelling: item.unitSelling }); }}
                            className="text-blue-600 hover:text-blue-800 text-xs mr-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Del
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Totals row */}
        {boq.items?.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-12">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Total Cost</p>
              <p className="text-lg font-bold">{boq.totalCost?.toFixed(2)} OMR</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Total Selling</p>
              <p className="text-lg font-bold">{boq.totalSelling?.toFixed(2)} OMR</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Margin</p>
              <p className={`text-lg font-bold ${boq.margin >= 25 ? 'text-green-600' : 'text-red-600'}`}>
                {boq.margin !== null ? `${boq.margin}%` : '-'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
