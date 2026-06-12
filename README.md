# The Agency OS

> **One app, one URL** — the single operating system for Modern Lifestyle LLC and its two subsidiaries (The Agency + Fitness Bay).

## What this is

This app consolidates all operational modules into a single Vite + React + Tailwind dashboard backed by Supabase. It replaces the need to switch between separate apps for commercial workflows, finance, and subsidiary management.

## Modules

| Module | Route | Data source |
|---|---|---|
| Dashboard | `/` | bank_accounts, ar_entries, ap_entries, monthly_financial_snapshots, quotations |
| Enquiries | `/enquiries` | enquiries |
| Cost Sheets | `/cost-sheets` | cost_sheets, cost_sheet_items |
| Quotations | `/quotations` | quotations, quotation_items |
| Quote Wizard | `/quote-wizard` | quotations, pricing_reference |
| Clients | `/clients` | Derived from quotations + sales_invoices + ar_entries |
| Receivables | `/finance/receivables` | ar_entries, ar_aging, sales_invoices |
| Payables | `/finance/payables` | ap_entries, invoices, vendors |
| Bank | `/finance/bank` | bank_accounts, bank_transactions |
| P&L | `/finance/pnl` | monthly_financial_snapshots |
| HR / Payroll | `/finance/payroll` | payroll_entries |
| Cash Outlook | `/finance/cash-outlook` | bank_accounts, ar_entries, ap_entries |
| Fitness Bay | `/fitness-bay` | monthly_financial_snapshots (fitnessbay), bank_transactions (fitnessbay) |
| Vendors | `/vendors` | vendors |
| RFQs | `/rfqs` | rfqs |
| Purchase Orders | `/purchase-orders` | purchase_orders |
| Contracts | `/contracts` | contracts |

## Corporate structure

- **Modern Lifestyle LLC** = parent / holding company
- **The Agency** = subsidiary (entity: `agency`)
- **Fitness Bay** = subsidiary (entity: `fitnessbay`)
- Shared Bank Muscat account; each subsidiary's slice tracked via `entity` tag
- Top-of-sidebar scope switcher: **Group (consolidated)** / **The Agency** / **Fitness Bay**

## Commands

```bash
npm run dev      # Vite dev server (hot reload)
npm run build    # Production build (validates before deploy)
```

## Deployment

Vercel auto-deploys from `main`. Push to `main` = live.

## Boundaries

- **Finance Center** (`the-agency-finance`) stays as read-only backup — this app is now the daily driver
- **NEO** (`Theagencyagents`) owns AI orchestration — no AI stack in this repo
- Book of record is Supabase. No Zoho. No external accounting system.
- Secrets in `.env.local` only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
