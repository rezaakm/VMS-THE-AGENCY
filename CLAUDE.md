# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server (hot reload, binds 0.0.0.0)
npm run build    # Vite production build (no separate tsc step)
```

No linter or test runner is configured. `npm run build` is the primary validation step.

## Architecture

This is **VMS (Vendor Management System)** — The Agency's operational hub for enquiries, cost sheets, quotations, RFQs, purchase orders, contracts, invoices, and vendor evaluations. It is one of three federated repos (see ARCHITECTURE-BOUNDARIES.md):

- **VMS** (this repo) — commercial workflows: quotes, POs, invoices, vendor management
- **Finance Center** (the-agency-finance) — ledger, AR/AP, bank reconciliation, payroll, P&L
- **NEO** (Theagencyagents) — AI orchestration, agents, automation

All three share a single Supabase schema. VMS writes commercial events; Finance owns the ledger; NEO reads everything but only writes agent/automation data.

### App structure

```
App.tsx           → QueryClientProvider > AuthProvider > AuthGate > Layout > wouter Switch
Layout            → Sidebar (grouped nav) + main content area
```

**Routing**: `wouter` with all routes declared in `src/App.tsx`. Pages are eagerly imported (not lazy-loaded).

**Data flow**: Direct-to-Supabase via `src/lib/api-client.tsx`, which wraps TanStack Query hooks around Supabase calls. It maintains a `COLUMNS` whitelist per table — writes are filtered to known columns so stray form fields never reach the database. The legacy `@workspace/api-client-react` import is re-exported from this file (`setBaseUrl` is a no-op).

**Auth**: Supabase email/password auth via `AuthProvider` + `AuthGate` pattern. Dark mode is force-applied on mount (`document.documentElement.classList.add("dark")`) — there is no light mode toggle.

### Sidebar navigation groups

Overview (Dashboard, Reports) → Sales (Enquiries, Cost Sheets, Quotations, Quote Wizard) → Procurement (RFQs, Purchase Orders, Contracts) → Finance (Invoices) → Vendors (Vendors, Evaluations) → Tools (Calculator, AI Assistant, Import Data)

### Key directories

- `src/pages/` — one file per route, including detail pages (e.g. `enquiry-detail.tsx`, `cost-sheet-detail.tsx`)
- `src/components/ui/` — full shadcn/ui component set (Radix + CVA + tailwind-merge)
- `src/components/layout/` — Layout shell, Sidebar, AuthGate, LoginPage
- `src/components/table-controls.tsx` — shared TableToolbar, FilterSelect, SortHeader, Pagination
- `src/lib/api-client.tsx` — Supabase data layer with column-whitelisted CRUD hooks
- `src/lib/supabase.ts` — Supabase client init
- `src/hooks/` — `useAuth`, `use-toast`, `use-table-controls` (search/sort/filter/pagination)

### Supabase tables

`enquiries`, `cost_sheets`, `cost_sheet_items`, `quotations`, `quotation_items`, `vendors`, `rfqs`, `rfq_items`, `purchase_orders`, `po_items`, `invoices`, `contracts`, `evaluations`, `openai_conversations`, `openai_messages`

## Conventions

- **Currency**: OMR (Omani Rial) — formatted as `OMR X,XXX.XXX` (3 decimal places)
- **Styling**: Tailwind CSS v4 with CSS-based config in `src/index.css` (HSL variables, no tailwind.config file). Always-dark theme. Fonts: Inter (sans), Playfair Display (serif), Space Mono (mono).
- **UI components**: shadcn/ui pattern — Radix primitives + CVA + tailwind-merge
- **Path alias**: `@/*` maps to `./src/*`
- **Icons**: `lucide-react` + `react-icons`
- **Job numbers**: Format `ML/26/xxx` or `4xxx` — every money transaction must carry one
- **Table pattern**: Pages use `useTableControls` hook for search/sort/filter/pagination, rendered via shared `TableToolbar`, `FilterSelect`, `SortHeader`, `Pagination` components

## Boundaries

- VMS owns commercial workflows only. It does NOT own the ledger or book of record (that's Finance Center).
- Do not build a second AI stack here — NEO/Theagencyagents owns all AI orchestration.
- No selling prices in client-facing output. Procurement items > 300 OMR need >= 2 quotes.
- Book of record is Finance Center on Supabase. NO Zoho. No external accounting system.
- Secrets in `.env.local` only (needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
