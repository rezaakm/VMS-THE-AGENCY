'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [initialized, setInitialized] = useState(false);

  async function handleInitialize() {
    try {
      await api.initialize();
      setInitialized(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleImport() {
    if (files.length === 0) return;

    setImporting(true);
    setResults([]);

    if (!initialized) await handleInitialize();

    const newResults: any[] = [];
    for (const file of files) {
      try {
        const result = await api.importFile(file, year);
        newResults.push({ file: file.name, ...result });
      } catch (err: any) {
        newResults.push({ file: file.name, success: false, error: err.message });
      }
    }

    setResults(newResults);
    setImporting(false);
  }

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Cost Sheets</h1>
        <p className="text-sm text-gray-500 mt-1">Upload Excel (.xlsx) cost sheets to add to the database</p>
      </div>

      <div className="card card-body max-w-2xl">
        {/* Year Select */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="input w-40">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost Sheet Files</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-400 transition-colors">
            <input
              type="file"
              multiple
              accept=".xlsx,.xls"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm text-gray-500">Click to select Excel files</p>
              <p className="text-xs text-gray-400 mt-1">Supports .xlsx format</p>
            </label>
          </div>
          {files.length > 0 && (
            <p className="text-sm text-brand-600 mt-2">{files.length} file(s) selected</p>
          )}
        </div>

        <button
          onClick={handleImport}
          disabled={files.length === 0 || importing}
          className="btn-primary w-full"
        >
          {importing ? `Importing... (${results.length}/${files.length})` : `Import ${files.length} File(s)`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 max-w-2xl">
          <div className="flex gap-3 mb-4">
            <span className="badge-green">{successCount} imported</span>
            {errorCount > 0 && <span className="badge-red">{errorCount} errors</span>}
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">File</th>
                  <th className="table-header">Job #</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="table-cell text-sm truncate max-w-xs">{r.file}</td>
                    <td className="table-cell font-mono text-sm">{r.jobNumber || '—'}</td>
                    <td className="table-cell">
                      {r.success ? (
                        <span className="badge-green">Imported</span>
                      ) : (
                        <span className="badge-red">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
