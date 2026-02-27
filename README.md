# VMS - THE AGENCY

**Unified Vendor Management System and Cost Intelligence for The Agency Oman**

This repository contains the full office stack: the main **Vendor Management System (VMS)** and the **Cost Intelligence System (CIS)**, plus optional legacy tools.

---

## What's in this repo

| Path | Description |
|------|-------------|
| **`packages/`** | **Main VMS app** — use this for office. Next.js frontend + NestJS backend (vendors, purchase orders, contracts, evaluations, reports, cost sheets, auth). |
| **`cost-intelligence-system/`** | **CIS** — cost sheet import, search, and benchmarking (PostgreSQL FTS + trigram). Run separately when needed. |
| **`vendor_system/`** | Standalone Express + SQLite app (vendors, projects). Optional. |
| **`server.js`** | Legacy Node API (reads `price_history.json`, port 3780). Optional. |

---

## Main app: VMS (`packages/`)

Vendor management with AI-powered cost analysis.

### Features
- **Vendor Management** — company info, contacts, documents
- **Purchase Orders** — create and track POs
- **Contracts** — contract lifecycle
- **Evaluations** — vendor performance scores
- **Reports** — dashboard, spend by vendor/category
- **Cost Sheets** — Excel upload, vendor comparison, cost trends, optional AI search

### Tech stack
- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** Next.js 14 + Tailwind CSS
- **AI:** OpenAI GPT-4o-mini (optional)

### Quick start (office / local)

```bash
# Clone this repo
git clone https://github.com/rezaakm/VMS-THE-AGENCY.git
cd VMS-THE-AGENCY

# Install
npm run install:all

# Configure (create packages/backend/.env)
# DATABASE_URL="postgresql://user:pass@localhost:5432/vms_db"
# JWT_SECRET="your-secret-key"
# PORT=3001
# Optional: OPENAI_API_KEY="sk-..."

# Database
npm run prisma:migrate
npm run prisma:seed

# Run (two terminals)
npm run backend:dev   # → http://localhost:3001
npm run frontend:dev  # → http://localhost:3000
```

**Access:** Frontend http://localhost:3000 — API docs http://localhost:3001/api — Login: `admin@vms.com` / `admin123`

For **office network:** set `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` to the server PC’s IP or hostname so other computers can open the app in the browser.

### Docker

```bash
docker-compose up -d
```

Runs Postgres + backend + frontend (see `docker-compose.yml`).

---

## Cost Intelligence System (CIS)

Run when you need cost sheet import and search. See **`cost-intelligence-system/cis/README.md`** (or repo root of that subfolder) for setup. Uses its own DB (`cis_db`) and ports (e.g. 3000/3001 if VMS is not running).

---

## Repository structure

```
VMS-THE-AGENCY/
├── packages/           # Main VMS (backend + frontend)
├── cost-intelligence-system/   # CIS app
├── vendor_system/      # Optional Express+SQLite app
├── server.js           # Optional legacy API (price_history.json)
├── docker-compose.yml  # VMS: Postgres + backend + frontend
├── package.json        # VMS scripts
└── README.md           # This file
```

---

**Author:** rezaakm @ The Agency Oman
