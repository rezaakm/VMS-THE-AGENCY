---
description: Build the full Agency OS (one app, all modules) per FULL-SYSTEM-SPEC.md
---

Read `FULL-SYSTEM-SPEC.md` in the repo root and implement it: turn this VMS into the single operating system for Modern Lifestyle LLC and its two subsidiaries (The Agency, Fitness Bay).

Work the build phases IN ORDER. After each phase: `npm run build`, fix errors, commit on branch `feat/full-system`, push (Vercel auto-deploys). Show a short summary after each phase.

Use the **frontend-design** skill for all UI and **systematic-debugging** if anything breaks. All data is already in Supabase `rmdztasccsnrqqgqvgyy` — this is assembly + UI, not new data. Reuse the existing auth gate and data layer. Money in OMR. Build the Group/subsidiary scope switcher first so every page respects it.

Start with Phase 1 (nav + dashboard). $ARGUMENTS
