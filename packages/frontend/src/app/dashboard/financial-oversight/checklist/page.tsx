'use client';

export default function ChecklistPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Monthly Financial Checklist</h1>
      <p className="text-muted-foreground mb-6">Track completion of critical recurring financial controls.</p>

      <div className="border rounded p-6 bg-muted/30">
        <p>Checklist items + completion tracking for the current period will live here.</p>
        <p className="mt-2 text-sm">Seeded with real audit-derived items (bank rec, owner account, P&amp;L review, etc.).</p>
      </div>
    </div>
  );
}
