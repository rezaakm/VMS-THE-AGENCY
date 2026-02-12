# CIS setup status

## Completed

- **Dependencies**: `npm install` at repo root (installs workspaces).
- **Env**: `packages/backend/.env` and `packages/frontend/.env.local` created from examples.
- **Prisma client**: `npx prisma generate` run in `packages/backend`.
- **Backend**: TypeScript errors in `search.service.ts` fixed; backend compiles.
- **Frontend**: Next.js runs on http://localhost:3000 (started in background).

## When Docker / PostgreSQL is available

1. **Start PostgreSQL** (if using Docker):
   ```bash
   docker run -d --name cis-postgres -p 5432:5432 -e POSTGRES_DB=cis_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16-alpine
   ```
   If the container already exists: `docker rm -f cis-postgres` then run the command again.

2. **Apply migrations** (from `packages/backend`):
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Run custom search SQL** (from repo root `cis/`; needs `psql` or run the file in pgAdmin/DBeaver):
   ```bash
   psql postgresql://postgres:postgres@localhost:5432/cis_db -f packages/backend/prisma/migrations/custom_search.sql
   ```

4. **Start backend** (if not running):
   ```bash
   cd packages/backend && npm run dev
   ```

5. **Initialize categories**:
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3001/api/import/initialize -Method POST
   ```

6. **Import cost sheets**: open http://localhost:3000/import and upload Excel files.

## Notes

- Docker was not running during setup, so the DB container and migrations were not applied. The backend exits on startup until it can connect to PostgreSQL.
- If something other than the cis-postgres container is using port 5432, ensure it uses user `postgres`, password `postgres`, and database `cis_db`, or update `packages/backend/.env` accordingly.
