# Spec: Enquiry → Quote Automation Pipeline (VMS / The Agency)

**For:** Claude Code, run inside `C:\Users\reza\agency\VMS-THE-AGENCY` (and `Theagencyagents` for the inbox scan).
**Goal:** Automate inquiry → cost sheet → confidence-scored pricing → human approval → quotation → send, with a human gate before anything reaches a client.

---

## 0. Hard rules (do not break)
- **NEVER send any email/quotation to a client without Reza's explicit per-item approval.** The "send" step is always one click by a human. No silent sends. No auto-send cron.
- Reads are free; writes that leave the system (emails) are gated.
- Only use the existing Supabase project `rmdztasccsnrqqgqvgyy`. Don't create a parallel DB.
- Build on a branch, run `npm run build` before every commit, push (Vercel auto-deploys).
- Reuse what exists below — do NOT rebuild it.

## 1. Existing building blocks (REUSE, don't recreate)
- **Pricing brain:** Supabase view `pricing_reference` (item_label, typical_cost, typical_sell, usual_vendor, times_used) + RPC `match_pricing(q text)` returning `{item_label, typical_cost, typical_sell, usual_vendor, times_used, match_type('exact'|'fuzzy'), score}`.
- **High Mark rate card:** view `high_mark_rate_card`.
- **Quote Wizard:** `src/pages/quote-wizard.tsx` — already does line-item → match_pricing → margin tiers (25/30/35/40) → generates Quote / Tax Invoice / Cost Sheet in the agency format (logo, To/Date/S.N/Subject/Scope, terms, IBAN OM110270323021625490018, SWIFT BMUSOMRXXXX, 7-day validity). It also imports a filled cost-sheet xlsx.
- **Tables:** `cost_sheets`, `cost_sheet_items`, `quotations`, `quotation_items`, `enquiries`, `vendors`, `sales_invoices`, `purchase_orders`. All have RLS authenticated policies; id auto-gen.
- **Data layer:** `src/lib/api-client.tsx` (Supabase-backed hooks). `src/lib/supabase.ts` (client). Auth gate in `src/components/layout/AuthGate.tsx`.
- **Team owners (fixed):** Reza, Zara, Vijesh, Jithu, Mahsa, Behrang, Dinesh.
- **Inbox scan (manual today):** `inbox_tasks` table in the same Supabase; the Matrix (`Theagencyagents`) dashboard reads it.

## 2. The pipeline (target behavior)
**Stage 1 — Intake (hourly):** scan Gmail (inbox, primary, last hour). For each thread that looks like a job/RFQ/quote request, create an `enquiries` row (status `new`, source `email`, client, title, description from the email, assignedToId by simple routing) and an `inbox_tasks` row. Skip newsletters/receipts/notifications. Dedupe on `source_email_id`.

**Stage 2 — Draft cost sheet:** for a `new` enquiry the user clicks "Build", OR it auto-drafts: parse the enquiry into candidate line items; for each, call `match_pricing`; create a draft `cost_sheets` + `cost_sheet_items` with cost/sell from history.

**Stage 3 — Confidence score:** per line, compute confidence from match: `exact` → High (90–100%), `fuzzy` score ≥0.6 → Medium (60–89%), `fuzzy` <0.6 or no match → Low (needs manual price). Show an overall sheet confidence = weighted avg. Flag Low lines clearly.

**Stage 4 — Manager review (GATE):** Reza sees the draft cost sheet with confidence per line + overall. He edits prices, sets margin, and clicks **Approve** (or Reject). Nothing proceeds without Approve.

**Stage 5 — Quote + send:** on Approve, generate the quotation in the agency format (reuse Quote Wizard's generator) as a `quotations` + `quotation_items` record and a PDF. Then present a **"Send to {account owner}"** button — a Gmail draft is created/opened pre-filled to the account contact; **the human clicks send.** Log the send.

## 3. Data model additions
- `cost_sheets`: add `status` ('draft'|'approved'|'rejected'|'quoted'), `confidence` numeric, `enquiry_id`, `approved_by`, `approved_at`.
- `cost_sheet_items`: add `match_type`, `confidence` numeric, `price_source` (e.g. 'history:exact', 'manual').
- `enquiries`: ensure `source_email_id`, `status` lifecycle (new→drafting→approved→quoted→sent).
- `quotations`: add `cost_sheet_id`, `sent_at`, `sent_to`, `account_owner`.
- Add migrations via Supabase; keep RLS authenticated policies on new columns/tables.

## 4. Build phases (do in order, each ends green + pushed)
1. **Schema migrations** (section 3). Verify with a query.
2. **Confidence in the lookup:** extend `match_pricing` (or a wrapper) to return a confidence bucket; surface it in the Quote Wizard per line (colored chip: green/amber/red).
3. **Enquiry → draft cost sheet:** "Build from enquiry" action that creates a draft cost sheet auto-priced from history with confidence.
4. **Approval gate UI:** a Review screen listing draft cost sheets with confidence; Approve/Reject; on Approve set status + stamp approver.
5. **Approve → quotation:** generate the `quotations` record + agency-format PDF from the approved cost sheet (reuse the Quote Wizard generator).
6. **Send step:** create a Gmail draft to the account owner with the quote attached; surface a Send button; never auto-send; log `sent_at`/`sent_to`.
7. **Hourly intake:** a scheduled job (Supabase edge function on cron, or a scheduled task) that scans Gmail and creates enquiries + inbox_tasks. READS + internal writes only — it must NOT send anything.

## 5. Confidence scoring (exact)
```
exact match              -> 95%
fuzzy score >= 0.75      -> 85%
fuzzy score 0.6–0.75     -> 70%
fuzzy score 0.45–0.6     -> 55% (review)
< 0.45 or no match       -> 0%  (manual price required)
sheet confidence = sum(line_total * line_conf) / sum(line_total)
```
Show overall as a badge; block "Approve → quote" if any line is 0% until Reza prices it.

## 6. Acceptance criteria
- A test enquiry produces a draft cost sheet with per-line confidence and an overall %.
- Reza can approve; approval creates a quotation in the exact agency format (logo, To/Date/S.N/Subject/Scope, terms, IBAN, 7-day validity).
- A send produces a Gmail draft to the account owner — and requires a human click to actually send.
- Hourly scan creates enquiries from real emails and never sends anything.
- `npm run build` passes; deployed on Vercel.

## 7. Guardrails for Claude Code
- Branch `feat/quote-pipeline`. Small commits. Build before each commit.
- Don't touch finance tables (`ar_entries`, `ap_entries`, `monthly_financial_snapshots`, `bank_transactions`) — that's the Finance Center's domain.
- Use the `frontend-design` skill for any new UI; `systematic-debugging` if something breaks.
- If a deployed page goes blank, read the browser console error and fix the root cause (don't guess).
