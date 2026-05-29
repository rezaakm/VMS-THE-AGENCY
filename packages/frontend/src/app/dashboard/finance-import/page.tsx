'use client';

import { useState } from 'react';

export default function FinanceImportPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [masterFolderId, setMasterFolderId] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async function uploadPLReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const periodInput = form.elements.namedItem('period') as HTMLInputElement;

    if (!fileInput.files?.length) return;

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('period', periodInput.value);

    try {
      const res = await fetch(`${API}/finance-import/pl-report`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setMessage(`Success: ${data.message} (Document ID: ${data.documentId})`);
    } catch (err) {
      setMessage('Upload failed. Is the backend running?');
    } finally {
      setUploading(false);
    }
  }

  async function syncCostSheetMasterFromDrive() {
    if (!masterFolderId) {
      setMessage('Please enter the Google Drive folder ID for your Cost Sheet-Master');
      return;
    }

    setUploading(true);
    setMessage('Starting historical Cost Sheet Master sync from Google Drive (2023+)... This may take a while for large archives.');

    try {
      const res = await fetch(`${API}/cost-sheets/drive/sync-cost-sheet-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterFolderId }),
      });
      const data = await res.json();
      setMessage(`Historical sync complete: ${data.filesProcessed || 0} new cost sheets processed, ${data.filesSkipped || 0} skipped. Check backend logs for full details.`);
    } catch (err) {
      setMessage('Sync failed. Make sure Google Drive is configured (GOOGLE_REFRESH_TOKEN + folder permissions) and you have the correct folder ID.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Finance Document Import</h1>
      <p className="text-muted-foreground mb-6">
        Upload historical reports from the old accountant (P&L PDFs, Monthly Finance Packs, Cost Sheets, etc.).
        The system will extract data and feed the AI Finance Controller.
      </p>

      {/* P&L / General Upload */}
      <form onSubmit={uploadPLReport} className="space-y-4 border p-6 rounded-xl mb-8">
        <h2 className="font-semibold">Upload P&L or Monthly Pack</h2>
        <div>
          <label className="block mb-1 font-medium">Period (e.g. 2025-12)</label>
          <input name="period" type="text" defaultValue="2025-12" className="border p-2 w-full rounded" required />
        </div>
        <div>
          <label className="block mb-1 font-medium">File (PDF or Excel)</label>
          <input name="file" type="file" accept=".pdf,.xlsx,.xls" className="block" required />
        </div>
        <button type="submit" disabled={uploading} className="bg-black text-white px-6 py-2 rounded disabled:opacity-50">
          {uploading ? 'Uploading...' : 'Upload & Start AI Extraction'}
        </button>
      </form>

      {/* Google Drive Historical Sync - Cost Sheet Master (2023+) */}
      <div className="border-2 border-blue-600 p-6 rounded-xl mb-8 bg-blue-50">
        <h2 className="font-semibold mb-2 text-blue-900">Sync Your Full Historical Cost Sheet Archive from Google Drive (2023+)</h2>
        <p className="text-sm text-blue-800 mb-4">
          You mentioned you uploaded everything (including your Cost Sheet-Master folder with data from 2023) to Google Drive.
          Use this to bulk import all your detailed historical cost sheets. This will massively power the AI pricing intelligence tools.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block mb-1 font-medium text-sm">Google Drive Folder ID of your "Cost Sheet-Master"</label>
            <input
              type="text"
              value={masterFolderId}
              onChange={(e) => setMasterFolderId(e.target.value)}
              placeholder="Paste the folder ID from the Drive URL"
              className="border p-2 w-full rounded text-sm"
            />
            <p className="text-xs text-blue-700 mt-1">From the URL https://drive.google.com/drive/folders/1AbCdEf... use just 1AbCdEf...</p>
          </div>

          <button
            onClick={syncCostSheetMasterFromDrive}
            disabled={uploading || !masterFolderId}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded disabled:opacity-50 text-sm font-medium"
          >
            {uploading ? 'Syncing 2023+ historical archive from Drive...' : 'Sync Full Historical Cost Sheet Master from Google Drive'}
          </button>
        </div>
      </div>

      {message && <div className="mt-4 p-4 bg-muted rounded whitespace-pre-wrap">{message}</div>}

      <div className="mt-8 text-sm text-muted-foreground">
        After syncing your Cost Sheet-Master from 2023+, the AI Finance Controller will become significantly smarter at pricing trends, vendor analysis, and margin intelligence across years of real job data.
      </div>
    </div>
  );
}
