# ROADMAP.md — The Agency VMS Delivery Roadmap

> Maintained honestly. Phase status reflects verified working software, not aspirations.

## Guiding Rule

Do not build features because they are interesting.
Build only what improves procurement control, financial visibility, vendor accountability, or audit readiness.

---

## Phase 0 — Foundation (COMPLETED)

- [x] Core VMS (vendors, POs, contracts, evaluations, cost sheets)
- [x] NestJS + Prisma + Next.js 14 + Tailwind
- [x] JWT + role-based auth (ADMIN, MANAGER, BUYER, VIEWER)
- [x] Docker support

## Phase 1 — RFQ + Cost Engine + CIS (COMPLETED)

- [x] Full RFQ workflow with vendor bid portal
- [x] AI Cost Engine
- [x] Standalone Cost Intelligence System (CIS)

---

## Phase 2 — Financial Oversight (IN PROGRESS — Clean Rebuild)

**Current work happening on `feature/vms-honest-completion` branch**

**Completed so far (verified):**
- [x] Prisma models for FinancialFlag, FlagResponse (A-F), Checklist, Processes
- [x] Clean service layer (refactored, maintainable)
- [x] Controller with proper RBAC (RolesGuard + @Roles)
- [x] Daily scheduler for overdue escalation
- [x] Email service foundation

**Remaining for Phase 2:**
- [ ] Real email delivery
- [ ] Seed the actual 12 April 2026 audit flags
- [ ] Full frontend (flags with A-F form, checklist UI, processes, dashboard)
- [ ] Tests + documentation finalization

**Success Criteria (non-negotiable):**
- The 12 real audit flags are usable in the live system
- Overdue flags automatically escalate and notify
- Dinesh and managers can use the UI daily

---

## Phase 3 — Reporting & Analytics (NOT STARTED)

## Phase 4 — Integrations (NOT STARTED)

## Phase 5 — Audit & Compliance Hardening (NOT STARTED)

---

## Do Not Build (Yet)

- Features that bypass accountability
- Anything before Phase 2 is actually complete and seeded with real data
