'use client';

import { useState } from 'react';

export default function FinanceImportPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

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

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Finance Document Import</h1>
      <p className="text-muted-foreground mb-6">
        Upload historical reports from the old accountant (P&L PDFs, Monthly Finance Packs, etc.).
        The system will extract data and feed the AI Finance Controller.
      </p>

      <form onSubmit={uploadPLReport} className="space-y-4 border p-6 rounded-xl">
        <div>
          <label className="block mb-1 font-medium">Period (e.g. 2025-12)</label>
          <input name="period" type="text" defaultValue="2025-12" className="border p-2 w-full rounded" required />
        </div>

        <div>
          <label className="block mb-1 font-medium">P&L PDF or Monthly Pack</label>
          <input name="file" type="file" accept=".pdf,.xlsx,.xls" className="block" required />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {uploading ? 'Uploading & Processing...' : 'Upload & Start AI Extraction'}
        </button>
      </form>

      {message && <div className="mt-4 p-4 bg-muted rounded">{message}</div>}

      <div className="mt-8 text-sm text-muted-foreground">
        Supported for now: Monthly Finance Packs (Excel) and regular P&L reports (PDF).
        The AI will attempt to structure revenue, direct costs, margins, and flag issues.
      </div>
    </div>
  );
}
