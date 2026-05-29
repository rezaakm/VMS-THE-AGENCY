'use client';

export default function FlagsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Financial Flags</h1>
      <p className="text-muted-foreground mb-6">List of all audit flags with A-F response forms (work in progress on clean branch)</p>

      <div className="border rounded p-6 bg-muted/30">
        <p>This page will show the 12 real flags from the April 2026 audit with full response and grading UI.</p>
        <p className="mt-2 text-sm">Backend is ready. Frontend implementation continuing.</p>
      </div>
    </div>
  );
}
