# GitHub vs Local: VMS-THE-AGENCY Comparison

Comparison between **[github.com/rezaakm/VMS-THE-AGENCY](https://github.com/rezaakm/VMS-THE-AGENCY)** and your local project folder.

---

## Summary

| | **GitHub (rezaakm/VMS-THE-AGENCY)** | **Your local (VMS - THE AGENCY)** |
|--|-------------------------------------|-----------------------------------|
| **What it is** | **Cost Intelligence System (CIS) only** — procurement pricing intelligence, cost sheet import, search, benchmarking | **Full Vendor Management System (VMS)** — vendors, POs, contracts, evaluations, reports, cost sheets — plus a copy of CIS and legacy apps |
| **Root package name** | `cost-intelligence-system` | `vendor-management` |
| **Main app in `packages/`** | CIS backend + CIS frontend (import, categories, vendors, projects, search) | VMS backend + VMS frontend (auth, vendors, POs, contracts, evaluations, reports, cost sheets) |
| **Database** | PostgreSQL 16, `cis_db` | PostgreSQL 15, `vms_db` (main); CIS uses `cis_db` if you run it |
| **Extra on local only** | — | `vendor_system/`, `vendor_management_system/`, `server.js`, `Set Backup 2/`, `CODEBASE_OVERVIEW.md` |

**Bottom line:** The GitHub repo is **CIS only**. Your local folder is the **full VMS** and also contains CIS inside `cost-intelligence-system/cis/`. They are **not the same codebase**; local is a superset.

---

## 1. What each one does

### GitHub repo (CIS only)

- **Purpose:** “Procurement pricing intelligence for The Agency Oman” — turn historical cost sheets into search and benchmarking.
- **Features:** Import cost sheets, categories, vendors, projects, **full-text + trigram search** (PostgreSQL FTS + pg_trgm), price benchmarking, vendor recommendations.
- **Stack:** Next.js 14, NestJS, Prisma, PostgreSQL 16, custom search SQL.
- **Run:** Backend :3001, frontend :3000, then `POST /api/import/initialize` and use `/import` in the UI.

### Your local (full VMS + CIS + legacy)

- **Main app (`packages/`):** Full **Vendor Management System**
  - Vendors, contacts, documents
  - Purchase orders and line items
  - Contracts
  - Vendor evaluations
  - Reports dashboard
  - Cost sheets (Excel upload, AI search/ask, vendor compare, trends)
  - Auth (JWT, roles: Admin, Manager, Buyer, Viewer)
- **Also on disk:** CIS under `cost-intelligence-system/cis/` (same idea as GitHub), plus `vendor_system/` (Express + SQLite), root `server.js` (Node + `price_history.json`), and “Set Backup 2”.

---

## 2. Repo structure

### GitHub (root)

```
.gitignore
Makefile
README.md          ← CIS readme
SETUP_STATUS.md    ← CIS setup notes
docker-compose.yml
package.json       ← name: "cost-intelligence-system"
package-lock.json
packages/
  backend/         ← CIS NestJS (import, categories, vendors, projects, search)
  frontend/        ← CIS Next.js (import, categories, vendors, projects, search)
```

### Your local (root)

```
packages/                  ← VMS (NestJS + Next.js: vendors, POs, contracts, etc.)
vendor_system/             ← Express + SQLite (separate app)
vendor_management_system/   ← Older/alternate layout
cost-intelligence-system/   ← Nested CIS (cis/packages/backend, cis/packages/frontend)
server.js                   ← Legacy Node API (price_history.json, port 3780)
Set Backup 2/
docker-compose.yml          ← VMS Postgres + backend + frontend (dev-style)
README.md                   ← VMS readme
CODEBASE_OVERVIEW.md
package.json                ← name: "vendor-management"
...
```

So: **GitHub = only `packages/` as CIS**. Local = VMS in `packages/` + CIS in `cost-intelligence-system/cis/` + other apps.

---

## 3. package.json

| Field | GitHub | Local |
|-------|--------|--------|
| **name** | `cost-intelligence-system` | `vendor-management` |
| **workspaces** | `["packages/backend", "packages/frontend"]` | `["packages/*"]` |
| **scripts** | `dev:backend`, `dev:frontend`, `build:backend`, `build:frontend`, `prisma:generate`, `prisma:migrate` | `backend:dev`, `frontend:dev`, `install:all`, `prisma:migrate`, `prisma:seed` |

GitHub has no `prisma:seed` or `import:costsheets` at root; your local CIS copy under `cost-intelligence-system/cis/` has those in its own package.json.

---

## 4. Docker Compose

| | GitHub | Local |
|--|--------|--------|
| **DB service** | `db`, postgres:16-alpine, `cis_db` | `postgres`, postgres:15-alpine, `vms_db` |
| **Backend** | Build from `packages/backend`, production-style (`NODE_ENV: production`), no source mount | Build from `packages/backend`, **dev** (`command: npm run start:dev`, volume mount) |
| **Frontend** | Build from `packages/frontend`, no source mount | **Dev** (`command: npm run dev`, volume mount) |

So: **GitHub** is set up for a production-style run (image + env). **Local** is set up for development (live reload, mounted source).

---

## 5. How they relate

- **GitHub** content matches your **`cost-intelligence-system/cis/`** subtree (CIS app: backend + frontend, Prisma, import, search).
- Your **main app** (full VMS in `packages/`) is **not** in the GitHub repo. The repo only has CIS.
- For **office local use** you care about the **VMS** in `packages/` (vendors, POs, contracts, reports, cost sheets). That lives only on your local project, not in [rezaakm/VMS-THE-AGENCY](https://github.com/rezaakm/VMS-THE-AGENCY).

---

## 6. If you want to sync with GitHub

- **Push your full VMS to GitHub:** Use a different repo or a different branch; the current GitHub repo does not contain the VMS in `packages/` (only CIS).
- **Pull CIS updates from GitHub:** Compare/merge from `rezaakm/VMS-THE-AGENCY` into your local `cost-intelligence-system/cis/` (treat GitHub as the CIS upstream).
- **Keep one “office” app:** For the office, run the **VMS** (`packages/`) as in CODEBASE_OVERVIEW.md and the office setup notes; no need to run GitHub’s CIS-only stack unless you also want CIS.
