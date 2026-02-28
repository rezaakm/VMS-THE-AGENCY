'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Upload, TrendingUp, CloudDownload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  filesFound: number;
  filesProcessed: number;
  filesSkipped: number;
  errors: string[];
  details: Array<{
    fileName: string;
    driveFileId: string;
    rowsInserted: number;
    rowsSkipped: number;
    error?: string;
  }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CostSheetItem {
  id: string;
  description: string;
  vendor: string | null;
  totalCost: number | null;
  unitCost: number | null;
  days: number | null;
  costSheet?: {
    jobNumber: string;
    client: string;
    event: string;
  };
}

interface Stats {
  totalSheets: number;
  totalItems: number;
  totalVendors: number;
  totalValue: number;
}

export default function CostSheetsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [results, setResults] = useState<CostSheetItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [compareV1, setCompareV1] = useState('');
  const [compareV2, setCompareV2] = useState('');
  const [comparison, setComparison] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/cost-sheets/stats`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ description: searchTerm });
      if (vendorFilter) params.append('vendor', vendorFilter);
      
      const res = await fetch(`${API_URL}/cost-sheets/search?${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (error) {
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAISearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/cost-sheets/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ query: searchTerm }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.items);
        toast({ title: 'AI Search', description: `Found ${data.items.length} items` });
      }
    } catch (error) {
      toast({ title: 'AI Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareV1 || !compareV2) return;
    try {
      const res = await fetch(`${API_URL}/cost-sheets/compare?v1=${compareV1}&v2=${compareV2}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setComparison(await res.json());
      }
    } catch (error) {
      toast({ title: 'Comparison failed', variant: 'destructive' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/cost-sheets/upload`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        toast({
          title: 'Upload Complete',
          description: `Inserted ${result.rowsInserted} items`,
        });
        fetchStats();
      }
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const handleDriveSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_URL}/cost-sheets/drive/sync`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      const result: SyncResult = await res.json();
      setSyncResult(result);
      if (result.success && result.filesProcessed > 0) {
        toast({
          title: 'Drive Sync Complete',
          description: `Processed ${result.filesProcessed} of ${result.filesFound} files`,
        });
        fetchStats();
      } else if (!result.success) {
        toast({
          title: 'Drive Sync Failed',
          description: result.errors[0] || 'Unknown error',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Drive Sync', description: 'No new files to process' });
      }
    } catch {
      toast({ title: 'Drive Sync Error', description: 'Could not connect to server', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDriveConnect = async () => {
    try {
      const res = await fetch(`${API_URL}/cost-sheets/drive/auth`, {
        headers: getAuthHeader(),
      });
      const { authUrl } = await res.json();
      window.open(authUrl, '_blank');
    } catch {
      toast({ title: 'Error', description: 'Could not generate Google auth URL. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in backend .env', variant: 'destructive' });
    }
  };

  // Load stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Cost Sheet Search</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleUpload}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
          <Button variant="outline" onClick={handleDriveConnect} title="Connect your Google account to allow Drive sync">
            <CloudDownload className="h-4 w-4 mr-2" />
            Connect Drive
          </Button>
          <Button onClick={handleDriveSync} disabled={syncing}>
            {syncing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing Drive...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Sync from Drive</>
            )}
          </Button>
        </div>
      </div>

      {/* Drive Sync Result */}
      {syncResult && (
        <Card className={syncResult.success ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              {syncResult.success
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-red-600" />}
              <span className="font-semibold">
                Drive Sync {syncResult.success ? 'Complete' : 'Failed'} — {syncResult.filesFound} files found, {syncResult.filesProcessed} processed, {syncResult.filesSkipped} skipped
              </span>
            </div>
            {syncResult.errors.length > 0 && (
              <div className="text-sm text-red-600 mb-2 space-y-1">
                {syncResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {syncResult.details.length > 0 && (
              <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                {syncResult.details.map((d) => (
                  <div key={d.driveFileId} className="flex justify-between items-center">
                    <span className="truncate max-w-xs text-muted-foreground">{d.fileName}</span>
                    {d.error
                      ? <span className="text-red-500 text-xs">{d.error}</span>
                      : <span className="text-green-600 text-xs">{d.rowsInserted} rows imported</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Cost Sheets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSheets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalItems.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVendors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'OMR' })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Search Cost Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search items (e.g., 'LED screen 4x3m')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Input
              placeholder="Vendor filter"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={handleAISearch} variant="secondary" disabled={loading}>
              ✨ AI Search
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Vendor</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-left">Job/Client</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map((item) => (
                    <tr key={item.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-muted-foreground">{item.vendor || '-'}</td>
                      <td className="p-3 text-right">
                        {item.unitCost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '-'}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {item.totalCost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '-'}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {item.costSheet?.jobNumber} - {item.costSheet?.client}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.length > 50 && (
                <div className="p-3 text-center text-muted-foreground">
                  Showing 50 of {results.length} results
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Vendor Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Vendor 1"
              value={compareV1}
              onChange={(e) => setCompareV1(e.target.value)}
            />
            <Input
              placeholder="Vendor 2"
              value={compareV2}
              onChange={(e) => setCompareV2(e.target.value)}
            />
            <Button onClick={handleCompare}>Compare</Button>
          </div>

          {comparison && (
            <div className="grid grid-cols-2 gap-4">
              {['v1', 'v2'].map((key) => {
                const v = comparison[key];
                return (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle>{v.vendor}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Unit Cost:</span>
                        <span className="font-medium">{v.avgUnitCost.toFixed(2)} OMR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Total Cost:</span>
                        <span className="font-medium">{v.avgTotalCost.toFixed(2)} OMR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Jobs:</span>
                        <span className="font-medium">{v.totalJobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Items Count:</span>
                        <span className="font-medium">{v.itemCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
