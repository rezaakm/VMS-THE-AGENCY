# VMS - THE AGENCY — Codebase Overview

This document gives a full overview of the project folder: what each part is, how it fits together, and how to run it.

---

## 1. Top-Level Structure and Applications

The workspace contains **one main application** (a monorepo) plus **several standalone or legacy apps** that are independent of each other.

| Path | Purpose |
|------|--------|
| **`packages/`** | **Main VMS app** — Next.js frontend + NestJS backend (PostgreSQL, Prisma). This is the primary Vendor Management System. |
| **`vendor_system/`** | Standalone Express 5 app with **better-sqlite3** and UUID. Own SQLite DB (`vendor_system.db`), tables: vendors, projects, rfqs, etc. Separate from the main monorepo. |
| **`vendor_management_system/`** | Older/alternate layout; contains a nested `vendor_system` (duplicate or earlier variant of the Express/sqlite app). |
| **`cost-intelligence-system/`** | Separate **Cost Intelligence** monorepo under `cis/`. Own `packages/backend` and `packages/frontend` (NestJS + Next.js + Prisma + PostgreSQL). Focus: import, categories, vendors, projects, search. Has its own Docker and env examples. |
| **`server.js`** (root) | Legacy **Node.js HTTP server** (no Express). Reads `price_history.json`, serves REST-style endpoints (vendors, projects, clients, dashboard, prices) on **PORT** (default **3780**). File-based only, no database. |
| **`Set Backup 2/`** | Backup/legacy snapshot (README + package.json). Vendor & pricing system powered by `price_history.json`; run with `node server.js` on port 3780. |
| **`.vscode/`** | Editor/workspace settings. |

**Summary:** The **main app** to run and extend is under **`packages/`**. The others are either legacy, backups, or separate products (CIS, vendor_system).

---

## 2. Main Monorepo: `packages/`

### 2.1 Backend — `packages/backend`

- **Stack:** NestJS 10, TypeScript, Prisma ORM, PostgreSQL. Passport (JWT + local), bcrypt, class-validator/class-transformer, Swagger at `/api`, optional OpenAI (cost-sheets AI).
- **Responsibilities:**
  - **Auth:** JWT + Passport (local + JWT). Roles: `ADMIN`, `MANAGER`, `BUYER`, `VIEWER`. `RolesGuard` and `JwtAuthGuard` protect routes.
  - **Domain modules:** Vendors, Purchase Orders, Contracts, Evaluations, Users, Reports, **Cost Sheets** (Excel parsing, AI search/ask, vendor compare, trends). Each has controller + service (and DTOs where applicable).
  - **Cost sheets:** Excel upload (XLSX), CostSheet/CostSheetItem in DB; optional OpenAI GPT-4o-mini for natural-language search and “ask”; vendor comparison and cost trends; estimate extraction.
  - **Audit:** `AuditLog` model (userId, action, entity, entityId, changes JSON, ipAddress, userAgent).
- **Key structure:** `src/` — `app.module.ts` wires Prisma, Auth, Users, Vendors, PurchaseOrders, Contracts, Evaluations, Reports, CostSheets. Auth uses `auth/strategies` (local, jwt) and `auth/guards` (jwt-auth, roles).

### 2.2 Frontend — `packages/frontend`

- **Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI / shadcn-style components (`src/components/ui/`). TanStack Query, Axios, React Hook Form + Zod, Recharts, Lucide.
- **Responsibilities:**
  - **Auth:** Login page; token in localStorage; `useAuth` / auth hooks; 401 triggers redirect to `/login`.
  - **Dashboard:** Layout under `src/app/dashboard/` — dashboard home, vendors, purchase-orders, contracts, cost-sheets.
  - **Features:** Vendor management, POs, contracts, cost sheets (upload, AI search, vendor compare, cost trends, estimate extraction). Shared API client in `lib/api.ts` (Axios + auth header + 401 logout).
- **Routes (App Router):** `/`, `/login`, `/dashboard`, `/dashboard/vendors`, `/dashboard/purchase-orders`, `/dashboard/contracts`, `/dashboard/cost-sheets`.

**Integrations:** Main app is REST-only (no n8n/webhook/WhatsApp/ClickUp in the explored code). Frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`) to talk to the backend.

---

## 3. Data Models and Storage

### 3.1 Main app — PostgreSQL (Prisma)

- **Database:** PostgreSQL. Connection via `DATABASE_URL` in env. Schema: `packages/backend/prisma/schema.prisma`.
- **Documentation:** `packages/backend/DATABASE.md` (schema, enums, setup, migrations, seeding).

**Models:**

- **User** — id, email, password, firstName, lastName, role (UserRole), isActive, timestamps. Relations: PurchaseOrders, Evaluations, AuditLogs.
- **Vendor** — id, name, code (unique), email, phone, website, taxId, status (VendorStatus), address/city/state/country/postalCode, industry, category, description, registrationDate, paymentTerms, creditLimit, currency, performanceScore, totalOrders, totalSpent, timestamps. Relations: VendorContact, Document, PurchaseOrder, Contract, Evaluation, Invoice.
- **VendorContact** — vendorId, firstName, lastName, email, phone, position, isPrimary.
- **Document** — vendorId, name, type, fileUrl, fileSize, mimeType, expiryDate.
- **PurchaseOrder** — orderNumber (unique), vendorId, userId, status (POStatus), dates (orderDate, requiredDate, deliveryDate), subtotal, taxAmount, shippingCost, totalAmount, description, notes, deliveryAddress. Relations: Vendor, User, POItem[], Invoice[].
- **POItem** — poId, itemNumber, description, quantity, unitPrice, discount, taxRate, totalPrice.
- **Contract** — contractNumber (unique), vendorId, title, status (ContractStatus), startDate, endDate, signedDate, contractValue, currency, terms, description, autoRenew, renewalPeriod.
- **Evaluation** — vendorId, evaluatorId, qualityScore, deliveryScore, pricingScore, serviceScore, overallScore, comments, evaluationDate, period.
- **Invoice** — invoiceNumber (unique), vendorId, poId, dates (invoiceDate, dueDate, paidDate), amount, taxAmount, totalAmount, paidAmount, status (PaymentStatus).
- **AuditLog** — userId, action, entity, entityId, changes (JSON), ipAddress, userAgent, createdAt.
- **CostSheet** — jobNumber, client, event, date, driveFileId (unique), fileName, lastSynced. Relation: CostSheetItem[].
- **CostSheetItem** — costSheetId, itemNumber, description, vendor, days, unitCost, totalCost, unitSellingPrice, totalSellingPrice.

**Enums:** `UserRole`, `VendorStatus`, `POStatus`, `ContractStatus`, `PaymentStatus`.

### 3.2 Other storage

- **Root `server.js`:** In-memory aggregation from **`price_history.json`**; no DB. Used for dashboard, vendors, projects, clients, prices endpoints on port 3780.
- **`vendor_system/`:** **SQLite** via better-sqlite3 (`vendor_system.db`). Tables include vendors, projects, rfqs, etc. (see `vendor_system/database.js`).

---

## 4. How to Run the Main Application

### 4.1 Prerequisites

- Node.js (v16+). PostgreSQL (local or Docker).
- From repo root, workspaces are `packages/*` (see root `package.json`).

### 4.2 Environment variables

**Backend (`packages/backend/.env`):**

- `DATABASE_URL` — e.g. `postgresql://user:pass@localhost:5432/vms_db`
- `JWT_SECRET` — secret for JWT signing
- `JWT_EXPIRATION` — e.g. `7d`
- `PORT` — API port (default **3001**)
- `FRONTEND_URL` — CORS origin (default `http://localhost:3000`)
- `OPENAI_API_KEY` — optional; for cost-sheets AI features

**Frontend:**

- `NEXT_PUBLIC_API_URL` — backend API base URL (default `http://localhost:3001`)

No `.env` or `.env.example` is committed; see README and DATABASE.md for examples.

### 4.3 Scripts (root and backend)

From **repo root** (`package.json`):

- `npm run backend:dev` — run backend in dev (NestJS watch)
- `npm run frontend:dev` — run frontend in dev (Next.js)
- `npm run install:all` — install backend + frontend deps
- `npm run prisma:migrate` — run Prisma migrations (backend)
- `npm run prisma:seed` — seed database (backend)

**Backend only** (`packages/backend`):

- `npm run start:dev` — NestJS dev
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:migrate` — migrate dev
- `npm run prisma:seed` — seed (admin@vms.com / admin123, buyer@vms.com / buyer123, sample vendors, POs, contracts, evaluations, invoices)
- `npm run prisma:studio` — open Prisma Studio (e.g. http://localhost:5555)

### 4.4 Quick start (main app)

1. Start PostgreSQL (e.g. `docker-compose up -d` for postgres only, or use existing DB).
2. In `packages/backend`: create `.env` with `DATABASE_URL`, `JWT_SECRET`, and optionally `OPENAI_API_KEY`.
3. From repo root or `packages/backend`:  
   `npm run prisma:generate` → `npm run prisma:migrate` → `npm run prisma:seed`
4. Run backend: `npm run backend:dev` (or from `packages/backend`: `npm run start:dev`).
5. Run frontend: `npm run frontend:dev` (or from `packages/frontend`: `npm run dev`).

**Access:**

- Frontend: http://localhost:3000  
- API docs (Swagger): http://localhost:3001/api  
- Default login: **admin@vms.com** / **admin123**

### 4.5 Docker (full stack)

From repo root, `docker-compose up -d` runs:

- **postgres** — PostgreSQL 15, port 5432, DB `vms_db`
- **backend** — NestJS on port 3001, uses Postgres and `npm run start:dev`
- **frontend** — Next.js on port 3000, `NEXT_PUBLIC_API_URL=http://localhost:3001`

---

## 5. Other Notable Details

- **Tests:** Backend has Jest (unit/e2e in `package.json`); no test implementation files were highlighted in the scan. No CI config (e.g. GitHub Actions) in the repo.
- **Docs:** Root `README.md` (quick start, env, API overview); `packages/backend/DATABASE.md` (schema, enums, setup, migrations, seeding).
- **Workspace rule vs repo:** The workspace rule mentions “MongoDB Atlas + Mongoose”; the **main app uses PostgreSQL + Prisma**. Either the rule targets another project or a future migration.

---

## 6. Diagram — Applications and Data

```mermaid
flowchart LR
  subgraph main [Main VMS - packages/]
    FE[Next.js Frontend :3000]
    BE[NestJS Backend :3001]
    PG[(PostgreSQL)]
    FE --> BE
    BE --> PG
  end

  subgraph legacy [Legacy / Other]
    Server[server.js :3780]
    JSON[price_history.json]
    VS[vendor_system]
    SQLite[(SQLite)]
    Server --> JSON
    VS --> SQLite
  end

  subgraph cis [Cost Intelligence]
    CIS_FE[CIS Frontend]
    CIS_BE[CIS Backend]
    CIS_PG[(PostgreSQL)]
    CIS_FE --> CIS_BE
    CIS_BE --> CIS_PG
  end
```

This overview reflects the current state of the codebase and should be enough to onboard a developer or plan changes without editing the plan file.
