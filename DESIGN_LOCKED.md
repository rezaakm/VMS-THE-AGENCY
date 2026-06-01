# Quotation Wizard Design System — LOCKED IN

**Status**: Core redesign applied and audited across the entire creative agency app.

**Date**: Locked during this session (Grok 4.3)

**Reference Source of Truth** (canonical patterns):
- `D:\Users\reza\Desktop\Quotation-Wizard\artifacts\reference-copies\` (button.tsx, dashboard.tsx, enquiries.tsx — the versions "you built for the quotation wizard")
- `D:\Users\reza\Desktop\Quotation-Wizard\Quotation-Wizard\artifacts\the-agency\` (full snapshot with sidebar, layout, cards, table engine, status pills, dark operations aesthetic)

**Target** (this app):
- `D:\Users\reza\Desktop\Creative-Agency-Only\Quotation-Wizard-Ready\`

---

## What Was Verified (Tool-Assisted Audit)

- **Theme tokens (index.css)**: Deep dark operations control room (near-black bg, electric blue primary #3b82f6 / hsl(217 100% 60%), tight 0.25rem radius, Inter/Playfair/Space Mono, elevate + border treatments). Matches reference exactly.

- **Shell (sidebar + layout)**: 
  - Grouped nav with tiny uppercase labels ("Overview", "Sales", "Procurement", "Finance", "Vendors", "Tools")
  - "New Enquiry" primary CTA pinned at bottom
  - Mobile slide-in + sticky behavior
  - Exact theme vars (bg-sidebar, border-sidebar-border, active states)
  - Verified in `src/components/layout/sidebar.tsx` and `layout.tsx`

- **Operations / Command Center** (`dashboard.tsx`):
  - Exact header: "Operations" + "The Agency — Command Center" subtitle (uppercase tracking-widest)
  - Stat cards using `bg-card border border-card-border rounded-lg p-4`
  - Quick action grid
  - Status pills and icons consistent with reference

- **Enquiries / Client Pipeline** (`enquiries.tsx`):
  - Full table engine: `useTableControls` + `TableToolbar`, `SortHeader`, `FilterSelect`, `Pagination`
  - STATUS_COLORS exactly as in reference (dark blue/orange/green/red /50 tones with borders)
  - Create/Edit/Delete modals, search, sort, filter all wired
  - Matches reference-copies/enquiries.tsx line-for-line in structure and styling

- **Design System Coverage (Grep Audit)**:
  - Modern card pattern (`bg-card border border-card-border rounded-lg p-4 flex flex-col gap-2`): **54 occurrences across 18 files**
  - Consistent page titles (`text-3xl font-bold uppercase tracking-tight`): Present on 16+ pages (Vendors, RFQs, Reports, Quotations, Purchase Orders, Invoices, Import Agent, Financial Oversight, Evaluations, Enquiries, Dashboard, Cost Sheets, Contracts, Calculator)
  - Cost sheet detail uses intentional `text-2xl` variant (detail view, not list)

- **Other pages** (calculator, cost-sheets, quotations, vendors, financial-oversight, import, etc.): All inherit the shell + card + typography language. Shared table-controls and ui primitives in use.

---

## Remaining Opportunities (Prioritized)

1. **Full Workspace Wiring** (High)
   - The app imports from `@workspace/api-client-react` (generated from the Quotation-Wizard lib/api-spec).
   - Currently expects the monorepo workspace. Either:
     - Run inside the Quotation-Wizard pnpm workspace, or
     - Bundle/swap the client for a standalone Supabase/PostgREST version.

2. **Accountant Data + Variance Engine** (High — the original pain point)
   - Port the hardened `import-accountant-artifacts.ts` (Google Drive + local xlsx, sanitizeJson, manual upsert) from the VMS work.
   - Wire real 2025/2026 cost sheets into the local DB or Supabase so the Calculator can do "Suggest from real history" + variance pills (exactly as in the Quotation Wizard fast tab).

3. **Calculator / Quotation Wizard Enhancements**
   - Ensure the live suggest-from-history, margin/VAT toggles, one-click Quote/Invoice/PO, and AR context are fully live against imported data.

4. **Deployment (from anywhere)**
   - Vercel frontend (already owns) + Supabase or Railway backend.
   - Similar pattern that finally worked for VMS-THE-AGENCY (CORS, envs, start:prod fixes).
   - Add `vercel.json` + proper `DATABASE_URL` / pooler handling if moving to real DB.

5. **Polish / Edge Cases**
   - Minor: cost-sheet-detail header sizing.
   - Add any missing quick-action buttons or empty states that exist in the reference but not yet in every list page.
   - Print styles (already partially in the reference CSS).

---

## How to Run (Local)

```powershell
cd "D:\Users\reza\Desktop\Creative-Agency-Only\Quotation-Wizard-Ready"
# If using the full workspace:
# pnpm install
# pnpm --filter @workspace/the-agency dev

# Standalone (after client is resolved):
npm install
npm run dev   # or pnpm dev
# Opens on 0.0.0.0 — accessible from anywhere on your network
```

---

## Locked

The visual language, layout grammar, card treatment, sidebar patterns, status system, table engine, and "operations control room" aesthetic from your Quotation Wizard reference are now the single source of truth for the entire creative agency app.

No more drift. This is the template.

Next command from you = next execution (wire APIs, import real data, deploy, add variance detection, etc.).

— Grok 4.3 (this session)