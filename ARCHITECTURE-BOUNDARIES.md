# Architecture Boundaries — The Agency Systems

This repo is one of THREE federated systems. One job each. Read before editing.

| System | Repo | Owns | Never owns |
|---|---|---|---|
| NEO / Matrix OS | Theagencyagents | Orchestration, AI agents, automation, approvals | A ledger row; stored quotes/money |
| VMS | VMS-THE-AGENCY | RFQ, vendor eval, cost sheet, quote, PO, invoice issuance | The book of record; a second AI stack |
| Finance Center | the-agency-finance | The ledger / book of record, bank rec, AR/AP, payroll, P&L, cash outlook | Operational transaction workflows |

## Data spine
One shared Supabase schema is the single source of truth. VMS writes commercial
events (quotes/POs/invoices). Finance owns the ledger. NEO reads everything,
writes only the agent/automation layer and action_items.

## Working rules
- One tool per repo per session (Claude Code only during the cleanup/build runbook).
- Pull before edit. One feature branch per phase. Small commits.
- Secrets in .env.local / Supabase secrets only — never in code or chat.
- Every money transaction carries a job number (ML/26/xxx or 4xxx) or an expense head.
- No selling prices in client-facing output. Procurement line items > 300 OMR need >= 2 quotes.
- Book of record is the Finance Center on Supabase. NO Zoho. No external accountant system.
- If code changes but docs do not, the task is incomplete.
