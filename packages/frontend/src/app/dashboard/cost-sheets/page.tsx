'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Upload, TrendingUp, DownloadCloud, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
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

interface LookupItem {
  id: string;
  description: string;
  vendor: string | null;
  days: number | null;
  unitCost: number | null;
  totalCost: number | null;
  unitSellingPrice: number | null;
  totalSellingPrice: number | null;
  costSheet: {
    jobNumber: string;
    client: string;
    event: string;
    date: string | null;
    driveUrl: string | null;
    fileName: string | null;
  };
}

interface LookupResult {
  keyword: string;
  totalMatches: number;
  jobsFound: number;
  pricing: {
    avgUnitCost: number | null;
    minUnitCost: number | null;
    maxUnitCost: number | null;
    avgSellingPrice: number | null;
    dataPoints: number;
  };
  items: LookupItem[];
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
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [compareV1, setCompareV1] = useState('');
  const [compareV2, setCompareV2] = useState('');
  const [comparison, setComparison] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getAuthHeader = (): Record<string, string> => {
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
      const params = new URLSearchParams({ q: searchTerm, limit: '20' });
      if (vendorFilter) params.append('vendor', vendorFilter);

      const res = await fetch(`${API_URL}/cost-sheets/lookup?${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setLookupResult(await res.json());
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
      const params = new URLSearchParams({ q: searchTerm, limit: '20' });
      const res = await fetch(`${API_URL}/cost-sheets/lookup?${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setLookupResult(data);
        toast({ title: 'Search', description: `Found ${data.totalMatches} items across ${data.jobsFound} jobs` });
      }
    } catch (error) {
      toast({ title: 'Search failed', variant: 'destructive' });
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

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return '-';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
            <DownloadCloud className="h-4 w-4 mr-2" />
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
            <p className="text-xs text-muted-foreground mb-2">Auto-syncs every hour when Google Drive is connected.</p>
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
              placeholder="Search items (e.g., 'backdrop', 'LED screen', 'reception desk')"
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
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </div>

          {/* Pricing Summary */}
          {lookupResult && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <span className="text-sm text-muted-foreground">Results</span>
                  <p className="font-semibold">{lookupResult.totalMatches} items across {lookupResult.jobsFound} jobs</p>
                </div>
                {lookupResult.pricing.avgUnitCost != null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Avg Unit Cost</span>
                    <p className="font-semibold text-lg">{formatCurrency(lookupResult.pricing.avgUnitCost)} OMR</p>
                  </div>
                )}
                {lookupResult.pricing.minUnitCost != null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Range</span>
                    <p className="font-semibold">{formatCurrency(lookupResult.pricing.minUnitCost)} - {formatCurrency(lookupResult.pricing.maxUnitCost)} OMR</p>
                  </div>
                )}
                {lookupResult.pricing.avgSellingPrice != null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Avg Selling Price</span>
                    <p className="font-semibold text-green-600">{formatCurrency(lookupResult.pricing.avgSellingPrice)} OMR</p>
                  </div>
                )}
                {lookupResult.pricing.avgUnitCost != null && lookupResult.pricing.avgSellingPrice != null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Avg Margin</span>
                    <p className="font-semibold text-blue-600">
                      {(((lookupResult.pricing.avgSellingPrice - lookupResult.pricing.avgUnitCost) / lookupResult.pricing.avgSellingPrice) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Table */}
          {lookupResult && lookupResult.items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Vendor</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-left">Job / Client</th>
                    <th className="p-3 text-center">File</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResult.items.map((item, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        <div className="font-medium">{item.description}</div>
                        {item.days && <span className="text-xs text-muted-foreground">{item.days} days</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">{item.vendor || '-'}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unitCost)}</td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(item.unitSellingPrice)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                      <td className="p-3 text-sm">
                        <div className="font-medium">{item.costSheet.jobNumber}</div>
                        <div className="text-muted-foreground">{item.costSheet.client}</div>
                        {item.costSheet.date && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.costSheet.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.costSheet.driveUrl ? (
                          <a
                            href={item.costSheet.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                            title={item.costSheet.fileName || 'Open in Google Drive'}
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="hidden lg:inline">Open</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lookupResult && lookupResult.items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items found for &quot;{lookupResult.keyword}&quot;. Try syncing more cost sheets from Google Drive.
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
