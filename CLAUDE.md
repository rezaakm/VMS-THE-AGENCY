# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server (hot reload, binds 0.0.0.0)
npm run build    # Vite production build (no separate tsc step)
```

No linter or test runner is configured. `npm run build` is the primary validation step.

## Architecture

This is **Agency OS** — the single operating system for Modern Lifestyle LLC, consolidating commercial workflows (quotes, POs, vendors) and finance (AR/AP, bank, P&L, payroll) into one app.

### Related repos (do not duplicate their work here)
- **Finance Center** (`the-agency-finance`) — read-only backup of finance views (same Supabase data)
- **NEO** (`Theagencyagents`) — AI orchestration, agents, automation

All share a single Supabase schema. This app reads and writes commercial events; reads finance tables.

### App structure

```
App.tsx           → QueryClientProvider > AuthProvider > EntityScopeProvider > AuthGate > Layout > wouter Switch
Layout            → Sidebar (scope switcher + grouped nav) + main content area
```

**Entity Scope**: `EntityScopeProvider` manages the Group / Agency / Fitness Bay switcher. Use `useEntityScope()` to get the current `entityFilter` (null for group, "agency" or "fitnessbay" for subsidiaries).

**Routing**: `wouter` with all routes declared in `src/App.tsx`. Pages are eagerly imported.

**Data flow**: Direct-to-Supabase via `src/lib/api-client.tsx` (CRUD hooks with column whitelists) and `src/lib/queries/` (finance-specific queries with entity filtering).

**Auth**: Supabase email/password auth via `AuthProvider` + `AuthGate`. Dark mode is force-applied on mount.

### Sidebar navigation groups

Overview (Dashboard, Reports) → Sales (Enquiries, Cost Sheets, Quotations, Quote Wizard) → Procurement (RFQs, Purchase Orders, Contracts) → Accounts (Clients, Receivables, Payables, Invoices) → Finance (Bank, P&L, HR/Payroll, Cash Outlook, Pending) → Fitness Bay → Vendors (Vendors, Evaluations) → Tools (Calculator, AI Assistant, Import Data)

### Key directories

- `src/pages/` — one file per route, including `finance/` subdirectory and `fitness-bay.tsx`
- `src/pages/finance/` — receivables, payables, bank, pnl, payroll, cash-outlook, pending, overview
- `src/components/ui/` — full shadcn/ui component set (Radix + CVA + tailwind-merge)
- `src/components/layout/` — Layout shell, Sidebar (with scope switcher), AuthGate, LoginPage
- `src/components/table-controls.tsx` — shared TableToolbar, FilterSelect, SortHeader, Pagination
- `src/lib/api-client.tsx` — Supabase CRUD layer with column-whitelisted hooks
- `src/lib/queries/` — finance query functions (ar, ap, bank, payroll, ledger, overview) — all accept optional entity filter
- `src/hooks/use-entity-scope.tsx` — EntityScopeProvider + useEntityScope hook
- `src/hooks/` — `useAuth`, `use-toast`, `use-table-controls`

### Supabase tables

**Commercial**: `enquiries`, `cost_sheets`, `cost_sheet_items`, `quotations`, `quotation_items`, `vendors`, `rfqs`, `rfq_items`, `purchase_orders`, `po_items`, `invoices`, `contracts`, `evaluations`

**Finance**: `ar_entries`, `ar_aging`, `ap_entries`, `sales_invoices`, `bank_accounts`, `bank_transactions`, `payroll_entries`, `monthly_financial_snapshots`, `journal_entries`, `ledger_entries`

**AI**: `openai_conversations`, `openai_messages`

## Conventions

- **Currency**: OMR (Omani Rial) — formatted as `OMR X,XXX.XXX` (3 decimal places)
- **Entity model**: `entity` column on finance tables: `agency` | `fitnessbay`. Always filter by scope; never blend except in Group view.
- **Styling**: Tailwind CSS v4 with CSS-based config in `src/index.css` (HSL variables). Always-dark theme. Fonts: Inter (sans), Playfair Display (serif), Space Mono (mono).
- **UI components**: shadcn/ui pattern — Radix primitives + CVA + tailwind-merge
- **Path alias**: `@/*` maps to `./src/*`
- **Icons**: `lucide-react` + `react-icons`
- **Job numbers**: Format `ML/26/xxx` or `4xxx`
- **Table pattern**: Pages use `useTableControls` hook for search/sort/filter/pagination

## Boundaries

- This app is the daily driver. Finance Center is read-only backup.
- Do not build a second AI stack here — NEO owns all AI orchestration.
- No selling prices in client-facing output. Procurement items > 300 OMR need >= 2 quotes.
- Book of record is Supabase. NO Zoho. No external accounting system.
- Secrets in `.env.local` only (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
