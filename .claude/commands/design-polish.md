---
description: Safe full UI/UX polish pass (UI only, builds before commit)
---

You are doing a DESIGN + UI/UX polish pass on this app (Vite + React + TypeScript + Tailwind).

Scope this run to: $ARGUMENTS
(If empty, do the whole app — highest-traffic pages first: Dashboard/Overview, Reports, main lists, forms.)

## HARD RULES — do not break
- Only change UI: styling, layout, spacing, typography, shared components, hover/active/focus states, loading & empty states, responsiveness, accessibility.
- Do NOT touch the Supabase data layer, `api-client`, `supabase.ts`, auth/AuthGate, hooks, queries, or business logic.
- Keep ALL existing functionality, routes, and props working.
- Use only existing dependencies + Tailwind classes already in the project. No new packages unless I approve.
- Work on a branch named `chore/ui-polish`.
- Run `npm run build` and fix EVERY error/type issue BEFORE committing.
- Commit in small, clearly-described chunks. Push only when the build is green (Vercel auto-deploys on push).

## DO — in this order
1. **Consistency audit** — find inconsistent buttons, cards, inputs, headings, badges, colours, radius, and spacing. Standardise them; extract shared components where it cuts duplication. List what you unified.
2. **Visual hierarchy & polish** — clean spacing/type scale, consistent radius/shadows/borders, clear primary vs secondary actions, refined hover/active/focus states.
3. **States** — add loading skeletons and friendly empty states everywhere a list/table/dashboard can be blank (no raw zeros or blank screens).
4. **Responsive** — every page usable on a phone: fix overflow, stacking, and tap targets (min 44px).
5. **Accessibility** — contrast, labels, visible focus rings, alt text.

## AFTER EACH PAGE
Build, give a 2-line before/after summary, then continue.

## AT THE END
List everything changed, and anything you recommend but didn't do (so I can decide).
