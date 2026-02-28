'use client';

import { useState, useEffect } from 'react';
import {
  Calculator, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Loader2, Plus, BarChart3, Package, FileDown, FileText, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EstimateLine {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  source: string;
  confidence: number;
}

interface Estimate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  clientName?: string;
  materialCost: number;
  labourCost: number;
  overheadCost: number;
  totalCostPrice: number;
  sellingPrice?: number;
  margin?: number;
  confidenceScore: number;
  status: string;
  createdAt: string;
  atRisk?: boolean;
  targetMargin?: number;
  lines?: EstimateLine[];
}

interface MarginDashboard {
  estimates: Estimate[];
  summary: {
    total: number;
    atRisk: number;
    avgMargin: number;
    targetMargin: number;
  };
}

interface BOMLine {
  materialName: string;
  quantity: number;
  unit: string;
}

export default function CostEnginePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'dashboard' | 'new' | 'materials'>('dashboard');
  const [dashboard, setDashboard] = useState<MarginDashboard | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // New estimate form
  const [form, setForm] = useState({ title: '', description: '', category: '', clientName: '', sellingPrice: '' });
  const [dissecting, setDissecting] = useState(false);
  const [bomLines, setBomLines] = useState<BOMLine[]>([]);
  const [creating, setCreating] = useState(false);
  const [newEstimate, setNewEstimate] = useState<Estimate | null>(null);

  // New material price form
  const [matForm, setMatForm] = useState({ materialName: '', unit: '', unitPrice: '', source: 'MANUAL', vendorName: '', category: '' });
  const [addingPrice, setAddingPrice] = useState(false);

  const getAuthHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchDashboard = async () => {
    setLoadingDash(true);
    try {
      const res = await fetch(`${API_URL}/cost-engine/margin-dashboard`, { headers: getAuthHeader() });
      if (res.ok) setDashboard(await res.json());
    } catch { /* silent */ }
    finally { setLoadingDash(false); }
  };

  const fetchEstimates = async () => {
    const res = await fetch(`${API_URL}/cost-engine/estimates`, { headers: getAuthHeader() });
    if (res.ok) setEstimates(await res.json());
  };

  const fetchMaterials = async () => {
    const url = materialSearch
      ? `${API_URL}/cost-engine/materials?search=${encodeURIComponent(materialSearch)}`
      : `${API_URL}/cost-engine/materials`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (res.ok) setMaterials(await res.json());
  };

  useEffect(() => { fetchDashboard(); fetchEstimates(); }, []);
  useEffect(() => { if (tab === 'materials') fetchMaterials(); }, [tab, materialSearch]);

  const handleDissect = async () => {
    if (!form.description && !form.title) return;
    setDissecting(true);
    try {
      const res = await fetch(`${API_URL}/cost-engine/dissect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ description: form.description || form.title, category: form.category }),
      });
      const data = await res.json();
      setBomLines(data.lines || []);
      toast({ title: 'AI Dissection Complete', description: `${data.lines?.length || 0} BOM lines generated` });
    } catch {
      toast({ title: 'Dissection failed', variant: 'destructive' });
    } finally { setDissecting(false); }
  };

  const handleCreateEstimate = async () => {
    if (!form.title) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/cost-engine/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          ...form,
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
          bomLines: bomLines.length > 0 ? bomLines : undefined,
        }),
      });
      const data = await res.json();
      setNewEstimate(data);
      toast({ title: 'Estimate Created', description: `Confidence: ${data.confidenceScore}%` });
      fetchDashboard();
      fetchEstimates();
    } catch {
      toast({ title: 'Failed to create estimate', variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleAddPrice = async () => {
    if (!matForm.materialName || !matForm.unitPrice) return;
    setAddingPrice(true);
    try {
      await fetch(`${API_URL}/cost-engine/materials/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ ...matForm, unitPrice: parseFloat(matForm.unitPrice) }),
      });
      toast({ title: 'Price added to catalog' });
      setMatForm({ materialName: '', unit: '', unitPrice: '', source: 'MANUAL', vendorName: '', category: '' });
      fetchMaterials();
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    } finally { setAddingPrice(false); }
  };

  const downloadDocument = (id: string, type: string, ext: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const isExcel = ext === 'xlsx';
    const url = isExcel
      ? `${API_URL}/cost-engine/estimates/${id}/document/excel`
      : `${API_URL}/cost-engine/estimates/${id}/document?type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    // Pass token via URL for simplicity (backend could also accept it via query param)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `document.${ext}`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const downloadMarginReport = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    fetch(`${API_URL}/cost-engine/margin-report/excel`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `MarginReport-${new Date().toISOString().substring(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const handleUpdateSell = async (id: string, price: string) => {
    const res = await fetch(`${API_URL}/cost-engine/estimates/${id}/selling-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellingPrice: parseFloat(price) }),
    });
    if (res.ok) { fetchDashboard(); fetchEstimates(); }
  };

  const confidenceColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Cost Intelligence Engine</h1>
        <div className="flex gap-2">
          {(['dashboard', 'new', 'materials'] as const).map((t) => (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'outline'}
              onClick={() => setTab(t)}
            >
              {t === 'dashboard' && <><BarChart3 className="h-4 w-4 mr-2" />Margin Dashboard</>}
              {t === 'new' && <><Plus className="h-4 w-4 mr-2" />New Estimate</>}
              {t === 'materials' && <><Package className="h-4 w-4 mr-2" />Materials Catalog</>}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Margin Dashboard ─────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {dashboard?.summary && (
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Estimates</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{dashboard.summary.total}</div></CardContent>
              </Card>
              <Card className={dashboard.summary.atRisk > 0 ? 'border-red-300' : ''}>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">At Risk (below {dashboard.summary.targetMargin}%)</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl font-bold ${dashboard.summary.atRisk > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {dashboard.summary.atRisk}
                    </div>
                    {dashboard.summary.atRisk > 0 && <AlertTriangle className="h-5 w-5 text-red-600" />}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Margin</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${dashboard.summary.avgMargin >= dashboard.summary.targetMargin ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboard.summary.avgMargin.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Target Margin</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{dashboard.summary.targetMargin}%</div></CardContent>
              </Card>
            </div>
          )}

              <Button variant="outline" size="sm" onClick={downloadMarginReport}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>

      {loadingDash && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>}

          <div className="space-y-2">
            {(dashboard?.estimates || estimates).map((est) => (
              <Card key={est.id} className={est.atRisk ? 'border-red-200' : ''}>
                <CardContent className="pt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === est.id ? null : est.id)}
                  >
                    <div className="flex items-center gap-3">
                      {est.atRisk
                        ? <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        : <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                      <div>
                        <div className="font-semibold">{est.title}</div>
                        <div className="text-sm text-muted-foreground">{est.clientName || est.category || 'No category'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-muted-foreground">Cost Price</div>
                        <div className="font-medium">{est.totalCostPrice.toFixed(3)} OMR</div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">Sell Price</div>
                        <div className="font-medium">{est.sellingPrice ? `${est.sellingPrice.toFixed(3)} OMR` : '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">Margin</div>
                        <div className={`font-bold text-lg ${est.margin !== null && est.margin !== undefined ? (est.margin >= (est.targetMargin || 25) ? 'text-green-600' : 'text-red-600') : ''}`}>
                          {est.margin !== null && est.margin !== undefined ? `${est.margin.toFixed(1)}%` : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">Confidence</div>
                        <div className={`font-medium ${confidenceColor(est.confidenceScore)}`}>{est.confidenceScore}%</div>
                      </div>
                      {expandedId === est.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {expandedId === est.id && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Material Cost: </span><span className="font-medium">{est.materialCost.toFixed(3)} OMR</span></div>
                        <div><span className="text-muted-foreground">Labour: </span><span className="font-medium">{est.labourCost.toFixed(3)} OMR</span></div>
                        <div><span className="text-muted-foreground">Overhead: </span><span className="font-medium">{est.overheadCost.toFixed(3)} OMR</span></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Update Selling Price (OMR):</span>
                        <Input
                          type="number"
                          defaultValue={est.sellingPrice ?? ''}
                          className="w-36"
                          onBlur={(e) => e.target.value && handleUpdateSell(est.id, e.target.value)}
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground self-center">Generate document:</span>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(est.id, 'quotation', 'pdf')}>
                          <FileText className="h-3.5 w-3.5 mr-1" />Quotation (PDF)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(est.id, 'cost-sheet', 'pdf')}>
                          <FileText className="h-3.5 w-3.5 mr-1" />Cost Sheet (PDF)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(est.id, 'cost-sheet', 'xlsx')}>
                          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Cost Sheet (Excel)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(est.id, 'rfq', 'pdf')}>
                          <FileText className="h-3.5 w-3.5 mr-1" />RFQ (PDF)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(est.id, 'draft-po', 'pdf')}>
                          <FileDown className="h-3.5 w-3.5 mr-1" />Draft PO (PDF)
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {(dashboard?.estimates || estimates).length === 0 && !loadingDash && (
              <div className="text-center text-muted-foreground py-12">No estimates yet. Create one using the "New Estimate" tab.</div>
            )}
          </div>
        </div>
      )}

      {/* ── New Estimate ─────────────────────────────────────────────── */}
      {tab === 'new' && (
        <div className="space-y-4 max-w-3xl">
          <Card>
            <CardHeader><CardTitle>New Cost Estimate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Title *</label>
                  <Input placeholder="e.g. 6x4m Fabric Banner Stand" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Client</label>
                  <Input placeholder="Client name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description (for AI dissection)</label>
                  <Input placeholder="Describe materials and size" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Input placeholder="events / construction / goods" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Selling Price (OMR) — optional</label>
                  <Input type="number" placeholder="e.g. 500" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDissect} disabled={dissecting}>
                  {dissecting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Dissecting...</> : <>✨ AI Dissect into BOM</>}
                </Button>
                <Button onClick={handleCreateEstimate} disabled={creating || !form.title}>
                  {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculating...</> : <><Calculator className="h-4 w-4 mr-2" />Create Estimate</>}
                </Button>
              </div>

              {bomLines.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Bill of Materials ({bomLines.length} lines) — edit before calculating:</div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Material</th>
                          <th className="p-2 text-right w-24">Qty</th>
                          <th className="p-2 text-left w-24">Unit</th>
                          <th className="p-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomLines.map((line, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">
                              <Input
                                value={line.materialName}
                                onChange={(e) => setBomLines(bomLines.map((l, j) => j === i ? { ...l, materialName: e.target.value } : l))}
                                className="h-7 text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={line.quantity}
                                onChange={(e) => setBomLines(bomLines.map((l, j) => j === i ? { ...l, quantity: parseFloat(e.target.value) } : l))}
                                className="h-7 text-sm text-right"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={line.unit}
                                onChange={(e) => setBomLines(bomLines.map((l, j) => j === i ? { ...l, unit: e.target.value } : l))}
                                className="h-7 text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <button onClick={() => setBomLines(bomLines.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBomLines([...bomLines, { materialName: '', quantity: 1, unit: 'piece' }])}
                      >
                        + Add line
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {newEstimate && (
            <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  Estimate Created — Confidence: {newEstimate.confidenceScore}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><div className="text-sm text-muted-foreground">Material Cost</div><div className="font-semibold">{newEstimate.materialCost.toFixed(3)} OMR</div></div>
                  <div><div className="text-sm text-muted-foreground">Labour</div><div className="font-semibold">{newEstimate.labourCost.toFixed(3)} OMR</div></div>
                  <div><div className="text-sm text-muted-foreground">Overhead</div><div className="font-semibold">{newEstimate.overheadCost.toFixed(3)} OMR</div></div>
                  <div><div className="text-sm text-muted-foreground">Total Cost Price</div><div className="text-xl font-bold">{newEstimate.totalCostPrice.toFixed(3)} OMR</div></div>
                </div>
                {newEstimate.margin !== null && newEstimate.margin !== undefined && (
                  <div className={`text-lg font-bold ${newEstimate.margin >= 25 ? 'text-green-600' : 'text-red-600'}`}>
                    Margin: {newEstimate.margin.toFixed(1)}%
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-sm self-center font-medium">Generate:</span>
                  <Button size="sm" variant="outline" onClick={() => downloadDocument(newEstimate.id, 'quotation', 'pdf')}><FileText className="h-3.5 w-3.5 mr-1" />Quotation PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadDocument(newEstimate.id, 'cost-sheet', 'pdf')}><FileText className="h-3.5 w-3.5 mr-1" />Cost Sheet PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadDocument(newEstimate.id, 'cost-sheet', 'xlsx')}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Cost Sheet Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadDocument(newEstimate.id, 'rfq', 'pdf')}><FileText className="h-3.5 w-3.5 mr-1" />RFQ PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadDocument(newEstimate.id, 'draft-po', 'pdf')}><FileDown className="h-3.5 w-3.5 mr-1" />Draft PO PDF</Button>
                </div>

                {newEstimate.lines && newEstimate.lines.length > 0 && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted"><tr>
                        <th className="p-2 text-left">Material</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Source</th>
                        <th className="p-2 text-center">Confidence</th>
                      </tr></thead>
                      <tbody>
                        {newEstimate.lines.map((l) => (
                          <tr key={l.id} className="border-t">
                            <td className="p-2">{l.description}</td>
                            <td className="p-2 text-right">{l.quantity} {l.unit}</td>
                            <td className="p-2 text-right">{l.unitPrice.toFixed(3)}</td>
                            <td className="p-2 text-right font-medium">{l.totalPrice.toFixed(3)}</td>
                            <td className="p-2 text-center"><span className="text-xs bg-muted rounded px-1">{l.source}</span></td>
                            <td className={`p-2 text-center text-xs font-medium ${confidenceColor(l.confidence * 100)}`}>{Math.round(l.confidence * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Materials Catalog ────────────────────────────────────────── */}
      {tab === 'materials' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Price to Catalog</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Input placeholder="Material name *" value={matForm.materialName} onChange={(e) => setMatForm({ ...matForm, materialName: e.target.value })} />
                <Input placeholder="Unit (sqm, kg, piece…)" value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} />
                <Input type="number" placeholder="Unit price (OMR) *" value={matForm.unitPrice} onChange={(e) => setMatForm({ ...matForm, unitPrice: e.target.value })} />
                <Input placeholder="Vendor name" value={matForm.vendorName} onChange={(e) => setMatForm({ ...matForm, vendorName: e.target.value })} />
                <Input placeholder="Category (fabric, steel…)" value={matForm.category} onChange={(e) => setMatForm({ ...matForm, category: e.target.value })} />
                <select
                  className="border rounded px-3 py-2 text-sm bg-background"
                  value={matForm.source}
                  onChange={(e) => setMatForm({ ...matForm, source: e.target.value })}
                >
                  <option value="MANUAL">Manual Entry</option>
                  <option value="VENDOR_PO">Vendor / PO</option>
                  <option value="COST_SHEET">Cost Sheet</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <Button onClick={handleAddPrice} disabled={addingPrice}>
                {addingPrice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add to Catalog
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Input
              placeholder="Search materials…"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Material</th>
                  <th className="p-3 text-left">Unit</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Latest Price (OMR)</th>
                  <th className="p-3 text-center">Source</th>
                  <th className="p-3 text-right">Price Entries</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => {
                  const latestPrice = mat.prices?.[0];
                  return (
                    <tr key={mat.id} className="border-t hover:bg-muted/40">
                      <td className="p-3 font-medium">{mat.name}</td>
                      <td className="p-3 text-muted-foreground">{mat.unit}</td>
                      <td className="p-3 text-muted-foreground">{mat.category || '—'}</td>
                      <td className="p-3 text-right">{latestPrice ? latestPrice.unitPrice.toFixed(3) : '—'}</td>
                      <td className="p-3 text-center">
                        {latestPrice && <span className="text-xs bg-muted rounded px-2 py-0.5">{latestPrice.source}</span>}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{mat._count?.prices || 0}</td>
                    </tr>
                  );
                })}
                {materials.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No materials in catalog yet. Add prices above or sync from Google Drive.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
