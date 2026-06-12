# E2E Smoke Tests (Playwright)

Browser-level smoke tests that log into Agency OS (VMS) and verify the core
screens render real data. They run against the deployed app by default.

## Required environment variables

| Variable               | Required | Default                              | Purpose                                              |
| ---------------------- | -------- | ------------------------------------ | ---------------------------------------------------- |
| `E2E_EMAIL`            | yes      | —                                    | Login email for the Supabase user                    |
| `E2E_PASSWORD`         | yes      | —                                    | Login password (NEVER commit this)                   |
| `E2E_BASE_URL`         | no       | `https://vms-the-agency.vercel.app`  | Target app URL (set to `http://localhost:5174` for local) |
| `E2E_RUN_DESTRUCTIVE`  | no       | unset                                | Set to `1` to enable the create→edit→delete enquiry test |

Credentials are read from the environment only — no password is ever
hard-coded in the specs.

## Install browsers (one time)

```bash
npm run e2e:install        # downloads the Chromium browser binary
```

## Run

```bash
# Read-only smoke tests against the deployed app
E2E_EMAIL=you@theagencyoman.com E2E_PASSWORD=••••• npm run e2e

# Against a local dev server
npm run dev   # in another terminal (serves on :5174)
E2E_BASE_URL=http://localhost:5174 E2E_EMAIL=… E2E_PASSWORD=… npm run e2e
```

On Windows PowerShell, set env vars with `$env:` first:

```powershell
$env:E2E_EMAIL="you@theagencyoman.com"; $env:E2E_PASSWORD="•••••"; npm run e2e
```

## What each spec covers

| Spec                       | Checks                                                        |
| -------------------------- | ------------------------------------------------------------ |
| `01-login.spec.ts`         | Login succeeds and the app shell (sidebar) appears           |
| `02-dashboard.spec.ts`     | Dashboard shows at least one non-zero OMR metric             |
| `03-quotations.spec.ts`    | Quotations list loads with > 0 rows                          |
| `04-cost-sheets.spec.ts`   | Cost-sheet rows render with a non-blank title/event          |
| `05-pnl.spec.ts`           | P&L shows snapshot-derived YTD figures (non-zero OMR)        |
| `06-fitness-bay.spec.ts`   | Fitness Bay partner split shows Reza (70%) + Mahsa (30%)     |
| `07-enquiry-crud.spec.ts`  | **Destructive** create→edit→delete of a marked test enquiry  |

## The destructive test

`07-enquiry-crud.spec.ts` writes to the live database. It is **skipped unless
`E2E_RUN_DESTRUCTIVE=1`** is set. It creates an enquiry whose subject is
clearly marked `E2E SMOKE TEST — delete me (<timestamp>)`, edits it, then
deletes it — leaving no residue when it completes. Do not run it against
production casually.

## Reports

An HTML report is written to `playwright-report/`. Open it with:

```bash
npx playwright show-report
```
