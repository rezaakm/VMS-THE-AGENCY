# ROADMAP.md — The Agency VMS Delivery Roadmap

## Guiding Rule

Do not build features because they are interesting.
Build only what improves procurement control, financial visibility, vendor accountability, or audit readiness.

---

## Phase 0 — Foundation (COMPLETED)

### Goal
Stand up the core VMS with vendor management and procurement.

### Deliverables
- [x] NestJS + Prisma backend with PostgreSQL
- [x] Next.js 14 frontend with Tailwind CSS
- [x] JWT authentication with role-based access
- [x] Vendor management (CRUD, contacts, documents)
- [x] Purchase order lifecycle (draft → approved → completed)
- [x] Contract management
- [x] Vendor evaluations and performance scoring
- [x] Cost sheets (Excel upload, vendor comparison)
- [x] Dashboard with spend analytics
- [x] Docker deployment support
- [x] README and setup documentation

### Exit Criteria
- VMS is functional for basic vendor and procurement operations.
- Authentication works with role separation.
- Data model is stable and migrated.

---

## Phase 1 — RFQ System + Cost Engine (COMPLETED)

### Goal
Add structured procurement through RFQs and AI-powered cost intelligence.

### Deliverables
- [x] RFQ creation and management
- [x] Vendor bid submission (public bid portal with token auth)
- [x] Bid comparison and evaluation
- [x] Cost Engine with AI-powered analysis (OpenAI GPT-4o-mini)
- [x] Cost Intelligence System (CIS) — standalone search and benchmarking
- [x] Prisma migrations for RFQ and cost engine tables

### Exit Criteria
- RFQ workflow works end-to-end: create → invite vendors → receive bids → compare → award.
- Cost engine provides meaningful analysis on uploaded cost sheets.

---

## Phase 2 — Financial Oversight Module (IN PROGRESS)

### Goal
Add financial controls born from the real April 2026 audit.

### Scope
- [ ] Financial flags (audit issues with severity, assignment, deadlines)
- [ ] Flag response system (A-F template: acknowledge, root cause, status, action, evidence, date)
- [ ] Response grading (Adequate / Partial / Inadequate)
- [ ] Auto-escalation of overdue flags
- [ ] Monthly financial checklist (bank recon, P&L, AR aging, owner account)
- [ ] Checklist completion tracking by period
- [ ] Financial process registry (SOPs with ownership and status)
- [ ] Financial oversight dashboard (open flags, checklist progress, process status)
- [ ] Prisma migration and seed data with the 12 real flags from the audit

### Success Criteria
- All 12 flags from the April 2026 audit are trackable in the system.
- Monthly checklist generates automatically and tracks completion.
- Overdue items are visible on the dashboard within 24 hours of deadline.
- Dinesh can submit responses through the system instead of email/PDF.
- Reza can grade responses and track resolution from the dashboard.

### Seed Data
The module ships with real data from The Agency's financial audit:
- 12 financial flags (budget conflicts, revenue forecasting, direct costs, AR collections, staff settlements, bank reconciliation, financial statements, etc.)
- Standard monthly checklist items (bank recon by 5th, owner account by 5th, P&L by 10th, AR aging weekly)
- 6 financial processes (cash flow forecast, client profitability, job-type profitability, depreciation schedule, PO system, owner account reconciliation)

---

## Phase 3 — Reporting & Analytics Enhancement

### Goal
Transform raw data into actionable business intelligence.

### Scope
- [ ] Spend analytics by vendor, category, and period
- [ ] Vendor performance trending over time
- [ ] Cost variance reports (budget vs actual)
- [ ] AR aging dashboard with collection tracking
- [ ] Client profitability view (revenue minus direct cost per client)
- [ ] Monthly financial summary (P&L format)
- [ ] Export to PDF/Excel for board reporting

### Success Criteria
- Reza can pull a monthly financial summary without asking Dinesh.
- Vendor spend trends are visible without manual Excel work.
- Client profitability is calculable from system data.

---

## Phase 4 — Integration Layer

### Goal
Connect VMS to external systems for automated data flow.

### Scope
- [ ] Zoho Books integration (chart of accounts, journal entries)
- [ ] Bank statement import (CSV/PDF from Bank Muscat)
- [ ] Automated bank reconciliation matching
- [ ] Email notifications for flag deadlines and overdue items
- [ ] ClickUp integration for task routing (from Theagencyagents)
- [ ] Webhook endpoints for external triggers

### Success Criteria
- Bank reconciliation runs monthly with minimal manual effort.
- Financial data flows between VMS and Zoho without re-entry.
- Deadline reminders are sent automatically.

---

## Phase 5 — Audit & Compliance Hardening

### Goal
Make the system audit-ready for external review.

### Scope
- [ ] Complete audit trail for all financial actions
- [ ] Document retention and versioning
- [ ] Approval workflows for POs above threshold
- [ ] Segregation of duties enforcement
- [ ] Compliance dashboard (checklist pass rates, flag resolution times)
- [ ] Annual audit package generation

### Success Criteria
- External auditor can review procurement and financial decisions from system data alone.
- No material action happens without an audit log entry.
- Average flag resolution time is trackable and trending downward.

---

## Do Not Build (Yet)

- Mobile app (web works fine for office use)
- Multi-tenant SaaS (this is single-company)
- AI-generated financial statements (too risky without validation)
- Automated payment execution (manual approval required)
- Blockchain anything (solve real problems first)
