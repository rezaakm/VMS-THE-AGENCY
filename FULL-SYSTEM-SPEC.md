# Spec: The Agency OS — the FULL system (one company, one app)

**Run in Claude Code inside** `C:\Users\reza\agency\VMS-THE-AGENCY`.
**Goal:** Turn the VMS into THE single operating system for the whole company — clients, quotations, cost sheets, vendors, accounts, bank, HR/salaries, P&L, dashboard — all in ONE app, ONE URL. No separate Finance Center / Matrix in the user's face.

**Corporate structure (model this exactly):**
- **Modern Lifestyle LLC** = the parent / holding company.
- **The Agency** and **Fitness Bay** = its two **subsidiaries**, each with its own P&L and books.
- They share ONE Bank Muscat account (the parent's) — track each subsidiary's slice via the `entity` tag (`agency` | `fitnessbay`).
- Top-of-app **scope switcher: Group (consolidated) · The Agency · Fitness Bay.**
  - **Group** = consolidated: both subsidiaries combined (total bank, combined revenue/P&L, group net position).
  - **The Agency** / **Fitness Bay** = that subsidiary's own books only.
- Never blend the two subsidiaries except in the explicit Group view.

Everything lives in the one Supabase project `rmdztasccsnrqqgqvgyy`. This is assembly + UI, NOT new data — the data already exists (see table map). Reuse the existing VMS app, auth, and data layer.

## Hard rules
- One unified app. Every module is a left-nav item in this same VMS app.
- Use the existing Supabase project + auth gate. Don't create new DBs or auth.
- Build on branch `feat/full-system`. `npm run build` must pass before every commit. Push (Vercel auto-deploys).
- Use the **frontend-design** skill for all UI (modern, cohesive, no AI-slop) and **systematic-debugging** if anything breaks. If a deployed page goes blank, read the browser console and fix the root cause.
- Money in OMR (3 decimals). Two entities exist: `agency` and `fitnessbay` (column `entity` on finance tables) — show an entity switcher where relevant; never blend them.

## The modules + exact data sources (all in Supabase)
1. **Dashboard (home):** KPI cards (net position = bank + AR − AP, YTD revenue/net, quotations count/value, members) + charts. Sources: `bank_accounts.current_balance`, `ar_entries`, `ap_entries`, `monthly_financial_snapshots`, `quotations`.
2. **Clients:** list/CRUD. Source: derive from `sales_invoices.client_name` + `quotations.client` (create a `clients` table if cleaner; seed from those). 
3. **Quotations:** already built — list (544 rows), detail, create via Quote Wizard. Source: `quotations`, `quotation_items`, `match_pricing` RPC, `pricing_reference`.
4. **Cost Sheets:** already built. Source: `cost_sheets` (1,162), `cost_sheet_items` (7,278).
5. **Vendors:** already built (334). Source: `vendors`, plus `evaluations`.
6. **Receivables (AR):** by client + aging + due dates. Source: `ar_entries` ⋈ `sales_invoices`.
7. **Payables (AP):** by vendor. Source: `ap_entries` ⋈ `vendors` ⋈ `invoices`.
8. **Bank:** account + transaction ledger + reconciliation flag. Source: `bank_accounts`, `bank_transactions` (593 rows). Add an entity filter (agency vs fitnessbay).
9. **HR / Payroll:** staff + monthly salaries. Source: `payroll_entries`. (Seed full team: Reza, Zara, Vijesh, Jithu, Mahsa, Behrang + others.)
10. **P&L / Finance:** monthly P&L per entity, trend. Source: `monthly_financial_snapshots` (entity = agency | fitnessbay).
11. **Fitness Bay:** its own section — P&L, members, **Virtual Bank** (gym slice of the shared account: money in/out/retained), partner split (Reza 70% / Mahsa 30% of cumulative net 8,491). Source: `monthly_financial_snapshots where entity='fitnessbay'`, `bank_transactions where entity='fitnessbay'`.
12. **(later) Enquiries + the auto-quote pipeline** — see `PIPELINE-SPEC.md`.

## Build phases (in order; build+push after each)
1. **Nav + Dashboard:** add all modules to the sidebar; build the home dashboard reading live data.
2. **Finance modules into VMS:** Receivables, Payables, Bank, P&L, HR/Payroll pages (read the finance tables that the Finance Center already uses — same Supabase).
3. **Clients module:** clients list from sales_invoices/quotations; link to their quotations + AR.
4. **Fitness Bay section:** P&L + Virtual Bank + partner split + members, entity-filtered.
5. **Design pass:** run the `frontend-design` skill across every page — one cohesive look, loading/empty states, mobile, dark theme.
6. **Retire the separate apps from daily use:** this VMS app is now the single front door. (Finance Center stays as backup; don't delete.)

## Acceptance
- One deployed URL where Reza can see and manage clients, quotations, cost sheets, vendors, AR, AP, bank, payroll, and P&L — for both entities.
- Net position, AR (97,516), AP (22,639), bank (107,881), 544 quotations all render live.
- `npm run build` green; deployed on Vercel; login works.
