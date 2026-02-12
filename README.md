# Cost Intelligence System (CIS)

**Procurement pricing intelligence for The Agency Oman**

Transform 518 historical cost sheets into actionable procurement intelligence with smart search, price benchmarking, and vendor recommendations.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS
- **Backend**: NestJS, TypeScript, Prisma
- **Database**: PostgreSQL 16 with pg_trgm full-text search
- **Search**: PostgreSQL FTS + Trigram fuzzy matching

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+ (or Docker)

### Setup
```bash
npm install
cd packages/backend && npm install
cd ../frontend && npm install

# Database (Docker)
docker run -d --name cis-postgres -p 5432:5432 -e POSTGRES_DB=cis_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# Configure
cd packages/backend && cp .env.example .env
cd packages/frontend && cp .env.local.example .env.local

# Migrate
cd packages/backend
npx prisma generate
npx prisma migrate dev --name init
psql postgresql://postgres:postgres@localhost:5432/cis_db -f prisma/migrations/custom_search.sql

# Run
cd packages/backend && npm run dev    # Terminal 1 → http://localhost:3001
cd packages/frontend && npm run dev   # Terminal 2 → http://localhost:3000

# Initialize & Import
curl -X POST http://localhost:3001/api/import/initialize
# Then use web UI at http://localhost:3000/import
```
