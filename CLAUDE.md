# CLAUDE.md — The Agency VMS Constitution

## 1) Project Identity

**Project Name**: VMS-THE-AGENCY
**Project Type**: Vendor Management System + Financial Controls Platform
**Primary Mission**: Build the operational backbone for The Agency's vendor management, procurement, cost intelligence, and financial oversight — replacing Excel-driven processes with a structured, auditable system.

**Core Principle**: This is not a demo or a feature showcase. It is the real financial and procurement operating system for an active Omani agency doing 500K+ OMR annually. Every feature must work reliably under real business conditions.

---

## 2) Constitutional Authority

This document is the highest authority for the project.

If any other markdown file, implementation note, or prompt conflicts with this constitution, **CLAUDE.md wins**.

Any material change to the doctrine, architecture rules, module boundaries, or coding standards must be:
1. justified explicitly,
2. implemented deliberately,
3. logged in `PROGRESS.md`.

---

## 3) Product Doctrine

VMS-THE-AGENCY exists to do the following well:
- manage vendor relationships and performance,
- control procurement through structured POs, RFQs, and contracts,
- provide cost intelligence through sheet analysis and benchmarking,
- enforce financial oversight through flags, checklists, and process tracking,
- maintain audit trails for all financial and procurement decisions.

Everything built must map to one of these business outcomes:
- reduce procurement cost,
- increase vendor accountability,
- improve financial visibility,
- enforce compliance and audit readiness,
- reduce manual admin overhead,
- protect the business from financial risk.

### Do not build:
- features that are interesting but operationally useless,
- vague dashboards with no actionable data,
- automations that bypass accountability or approval,
- integrations without clear workflow ownership.

---

## 4) Golden Rule

**Do not build features because they are exciting. Build only what improves financial control, procurement efficiency, or business visibility.**

---

## 5) Definition of Quality

A feature is only considered complete when it is:
- useful in a real Agency procurement or finance workflow,
- understandable by non-technical staff (Dinesh, Zara, office team),
- observable through logs and audit trails,
- safe under expected misuse,
- documented,
- testable,
- maintainable.

If it works only in a perfect scenario, it is not complete.

---

## 6) Core Architecture Doctrine

The system is a monorepo with two primary packages:

### A. Backend (NestJS + Prisma + PostgreSQL)
This is the real brain.
It owns:
- all business logic,
- data models and migrations,
- authentication and authorization,
- API endpoints,
- cost engine calculations,
- financial oversight logic,
- audit logging.

### B. Frontend (Next.js 14 + Tailwind CSS)
This is the operational interface.
It provides:
- dashboard views,
- CRUD interfaces for vendors, POs, contracts, RFQs,
- cost sheet analysis views,
- financial oversight dashboard,
- report generation.

### C. Cost Intelligence System (CIS) — Auxiliary
Standalone cost sheet import, search, and benchmarking.
Runs separately when needed. Uses its own database.

---

## 7) Module-First Design

The system is organized around business modules, not pages.

Primary modules:
- **Vendors** — company profiles, contacts, documents, performance scores
- **Purchase Orders** — PO lifecycle from draft to completion
- **Contracts** — contract management and lifecycle tracking
- **RFQs** — request for quotation with vendor bid management
- **Evaluations** — vendor performance scoring
- **Cost Sheets** — Excel upload, vendor comparison, cost trends
- **Cost Engine** — AI-powered cost analysis (optional OpenAI)
- **Financial Oversight** — flags, checklists, process registry, compliance
- **Reports** — dashboard, spend analysis, vendor performance
- **Auth** — JWT-based authentication and role management

UI is secondary. Business logic clarity comes first.

---

## 8) Module Standard

Every backend module must follow this structure:
```
module-name/
  module-name.module.ts      # NestJS module definition
  module-name.controller.ts  # REST endpoints
  module-name.service.ts     # Business logic
  dto/                       # Data transfer objects with validation
  README.md                  # Module documentation (optional but encouraged)
```

A module is not production-ready until:
- its Prisma models exist in schema.prisma,
- its DTOs validate all inputs,
- its controller uses JwtAuthGuard,
- its service handles errors with proper NestJS exceptions.

---

## 9) Data Doctrine

### Currency
All financial values are in **OMR (Omani Rial)** unless explicitly stated otherwise.
The Vendor model supports a currency field for international vendors.

### Roles
- **ADMIN** — full access, can manage users and system settings
- **MANAGER** — can approve POs, evaluate vendors, review flags
- **BUYER** — can create POs, manage vendors, submit flag responses
- **VIEWER** — read-only access

### Audit Trail
Every significant action must be logged in the AuditLog table:
- who did it (userId),
- what they did (action),
- what it affected (entity, entityId),
- when (timestamp),
- details (JSON).

---

## 10) Security Doctrine

- All API endpoints must be protected by JwtAuthGuard unless explicitly public.
- Passwords are hashed with bcrypt.
- Environment variables hold all secrets (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY).
- Never commit .env files. Use .env.example as reference.
- Role-based access control enforced at controller level.

---

## 11) Coding Standards

### Backend (TypeScript/NestJS)
- Use strict TypeScript.
- All DTOs use class-validator decorators.
- All services use PrismaService for database access.
- Error handling with NestJS built-in exceptions (NotFoundException, BadRequestException).
- No raw SQL unless absolutely necessary — use Prisma query builder.

### Frontend (TypeScript/Next.js)
- Use Tailwind CSS for styling — no separate CSS files.
- Use Next.js App Router (app/ directory).
- API calls use fetch with /api/ prefix proxied to backend.
- Components in src/components/, pages in src/app/dashboard/.

### General
- No console.log in production code — use proper NestJS Logger.
- Commit messages must be descriptive.
- No dead code in main branch.

---

## 12) Deployment

### Local Development
```bash
npm run install:all
npm run prisma:migrate
npm run prisma:seed
npm run backend:dev   # → http://localhost:3001
npm run frontend:dev  # → http://localhost:3000
```

### Docker
```bash
docker-compose up -d
```

### Production
- Backend: any Node.js host with PostgreSQL access
- Frontend: Vercel or any Next.js-compatible host
- Database: managed PostgreSQL (Supabase, Railway, or dedicated)

---

## 13) Testing Doctrine

- Critical business logic (cost calculations, financial oversight grading, PO totals) should have unit tests.
- Integration tests for API endpoints are encouraged.
- Manual testing is acceptable for UI workflows during early development.
- No feature ships without at least one person verifying it works end-to-end.

---

## 14) Financial Oversight Doctrine

The Financial Oversight module is a core part of the VMS, not an afterthought.

It exists because The Agency was running OMR 500K+ on Excel tabs with no formal financial statements, no bank reconciliation, and no accountability framework.

### Principles:
- Every financial flag must be tracked to resolution.
- The A-F response template is the standard investigation format.
- Monthly checklists are non-negotiable — they run every month.
- Financial processes must be documented as SOPs, not tribal knowledge.
- Overdue items escalate automatically.

This module is the direct result of a real financial audit conducted in March-April 2026.
