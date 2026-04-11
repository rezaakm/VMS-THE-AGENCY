# ARCHITECTURE.md — The Agency VMS System Architecture

## 1) System Definition

VMS-THE-AGENCY is the procurement, vendor management, and financial controls platform for The Agency Oman. It handles the full lifecycle from vendor onboarding through purchase orders, contracts, cost analysis, and financial oversight.

**Critical rule**: the database is the source of truth, not spreadsheets, not email threads, not informal PDFs.

---

## 2) Architectural Principles

- Module-first, not page-first
- Database as source of truth
- Clear separation between backend logic and frontend presentation
- Audit trails for every material action
- Role-based access control at every endpoint
- Financial data treated with production-grade discipline
- No feature ships without data model support

---

## 3) Layered System View

### A. Interface Layer (Next.js 14)
Handles:
- dashboard views and KPI cards,
- CRUD forms for vendors, POs, contracts, RFQs,
- cost sheet upload and comparison views,
- financial oversight dashboard (flags, checklist, processes),
- report generation and export.

### B. API Layer (NestJS Controllers)
Handles:
- REST endpoint routing,
- request validation via DTOs,
- authentication guard enforcement,
- response formatting.

### C. Business Logic Layer (NestJS Services)
Handles:
- vendor scoring and performance calculations,
- PO total calculations and status transitions,
- cost comparison and benchmarking logic,
- financial flag grading and auto-escalation,
- checklist period generation and completion tracking,
- report aggregation.

### D. Data Layer (Prisma + PostgreSQL)
Handles:
- schema definition and migrations,
- query building and optimization,
- relationship management,
- data validation at model level.

### E. Intelligence Layer (Optional — OpenAI)
Handles:
- AI-powered cost analysis (cost engine),
- cost sheet semantic search,
- natural language cost queries.

---

## 4) Module Map

| Module | Backend Path | Frontend Path | Purpose |
|--------|-------------|---------------|---------|
| Auth | `src/auth/` | `src/app/login/` | JWT authentication, role management |
| Users | `src/users/` | — | User CRUD, role assignment |
| Vendors | `src/vendors/` | `dashboard/vendors/` | Vendor profiles, contacts, documents |
| Purchase Orders | `src/purchase-orders/` | `dashboard/purchase-orders/` | PO lifecycle management |
| Contracts | `src/contracts/` | `dashboard/contracts/` | Contract tracking |
| RFQs | `src/rfqs/` | `dashboard/rfqs/` | Request for quotation + vendor bids |
| Evaluations | `src/evaluations/` | — | Vendor performance scoring |
| Cost Sheets | `src/cost-sheets/` | `dashboard/cost-sheets/` | Excel upload, vendor comparison |
| Cost Engine | `src/cost-engine/` | `dashboard/cost-engine/` | AI-powered cost analysis |
| Reports | `src/reports/` | `dashboard/` (main) | Dashboard, spend analytics |
| Financial Oversight | `src/financial-oversight/` | `dashboard/financial-oversight/` | Flags, checklist, processes, compliance |
| AI Assistant | `src/ai-assistant/` | — | Natural language cost queries |

---

## 5) Request Flow

1. User authenticates via JWT token.
2. Frontend sends API request to backend endpoint.
3. Controller validates DTO and checks auth guard.
4. Service executes business logic via Prisma.
5. Audit log is written for material actions.
6. Response returned to frontend.
7. Frontend renders result.

For financial oversight specifically:
1. Flag is created (manually or from audit).
2. Flag is assigned to responsible person with deadline.
3. Assignee submits response using A-F template.
4. Reviewer grades response (Adequate/Partial/Inadequate).
5. If Adequate → flag auto-resolves.
6. If Partial/Inadequate → flag remains open with follow-up deadline.
7. Overdue flags are surfaced on dashboard.

---

## 6) Data Model Summary

### Core Entities
- **User** — authenticated operators with roles
- **Vendor** — company profiles with contacts, documents, performance
- **PurchaseOrder** — procurement orders with line items
- **Contract** — vendor contracts with lifecycle status
- **RFQ** — quotation requests with vendor bids
- **Evaluation** — vendor performance assessments
- **CostSheet** — uploaded cost data for comparison
- **Invoice** — vendor invoices linked to POs
- **AuditLog** — immutable action trail

### Financial Oversight Entities
- **FinancialFlag** — audit issues with severity, status, assignment
- **FlagResponse** — A-F template submissions with grading
- **FinancialChecklistItem** — recurring compliance checks
- **ChecklistCompletion** — period-based completion tracking
- **FinancialProcess** — SOP registry with ownership and status

Full schema in `packages/backend/prisma/schema.prisma`.

---

## 7) Integration Points

| System | Purpose | Status |
|--------|---------|--------|
| PostgreSQL | Primary database | Active |
| OpenAI GPT-4o-mini | Cost analysis AI | Optional |
| Zoho Books | Accounting (planned) | Planned |
| Bank Muscat | Bank reconciliation data | Manual import |
| Excel/CSV | Cost sheet import | Active |

---

## 8) Repository Structure

```
VMS-THE-AGENCY/
├── packages/
│   ├── backend/            # NestJS API
│   │   ├── prisma/         # Schema + migrations
│   │   └── src/            # Modules (vendors, POs, financial-oversight, etc.)
│   └── frontend/           # Next.js 14 app
│       └── src/
│           ├── app/        # Pages (dashboard/, login/, etc.)
│           ├── components/ # Reusable UI components
│           ├── hooks/      # Custom React hooks
│           └── lib/        # Utilities
├── cost-intelligence-system/  # Standalone CIS app
├── docker-compose.yml
├── package.json
├── CLAUDE.md               # Project constitution (this doc's authority)
├── ARCHITECTURE.md          # This file
├── ROADMAP.md              # Delivery roadmap
└── PROGRESS.md             # Current state tracker
```
