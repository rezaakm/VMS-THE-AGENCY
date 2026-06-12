# Architecture Boundaries — The Agency Systems

This repo is the **primary operating system** for Modern Lifestyle LLC. It consolidates commercial workflows AND finance views into one app.

| System | Repo | Role | Status |
|---|---|---|---|
| **Agency OS** | VMS-THE-AGENCY | All modules: quotes, POs, invoices, AR/AP, bank, P&L, payroll, clients, Fitness Bay | **Primary — daily driver** |
| Finance Center | the-agency-finance | Ledger, bank rec, AR/AP, payroll, P&L (same Supabase data) | **Read-only backup** — not for daily use |
| NEO | Theagencyagents | AI orchestration, agents, automation, approvals | Active — owns AI stack |

## Data spine
One shared Supabase schema (`rmdztasccsnrqqgqvgyy`) is the single source of truth.
- Agency OS reads and writes commercial events + reads finance tables
- Finance Center reads/writes the same finance tables (kept as backup, not daily)
- NEO reads everything, writes only agent/automation data

## Entity model
- `entity = 'agency'` — The Agency subsidiary
- `entity = 'fitnessbay'` — Fitness Bay subsidiary
- Group view = both combined (no entity filter)

## Working rules
- One tool per repo per session (Claude Code).
- Pull before edit. One feature branch per phase. Small commits.
- `npm run build` must pass before every commit.
- Secrets in `.env.local` / Supabase secrets only — never in code or chat.
- Every money transaction carries a job number (ML/26/xxx or 4xxx).
- No selling prices in client-facing output.
- Procurement items > 300 OMR need >= 2 quotes.
- Book of record is Supabase. NO Zoho. No external accounting system.
- If code changes but docs do not, the task is incomplete.
