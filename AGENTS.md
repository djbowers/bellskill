# Claude Development Guidelines

## Off-Limits Paths
Stop and ask a human before changing any of these (a task requiring them is a spec error, not a green light):
- **Auth & sessions** — `src/auth/`, Supabase auth client, anything issuing/validating tokens.
- **Row-Level Security policies** — security boundaries are a human call.
- **Payments / billing** — anything that charges or entitles.
- **Secrets, env, CI** — `.env*`, `.github/workflows/`.

A refactor that incidentally touches these is equally off-limits.

## Overview
Kettlebell workout-tracking PWA: React 18 + TypeScript + Vite + Tailwind + Supabase, React Query v5 (`@tanstack/react-query`), Radix/shadcn UI. `~` resolves to `src/` — always import `~/api`, `~/components`, etc. rather than relative `../`.

## Structure
One folder per route under `src/pages/` (`Page.tsx`, `.test.tsx`, `.stories.tsx`, page-local `components/`/`hooks/`/`utils/`, `index.ts`). Shared: `src/api/` (React Query hooks + Supabase calls), `src/components/` (+ `ui/` shadcn), `src/contexts/`, `src/hooks/`, `src/utils/`, `src/types/` (`supabase.ts` auto-generated). Fixtures in `src/examples/` and `src/mocks/`.

## Domain Concepts
- **Movement**: one exercise with a rep scheme and up to two weights.
- **Rep scheme / ladder**: rep counts per rung, e.g. `[1,2,3,4,5]`; a **rung** is one element. Three rung modes: reps, `timedRungs` (seconds per rung), `maxReps` (to failure — the runner asks for the count). Actual reps per set land in `movement_logs.completed_rep_scheme`.
- **Complex set** (`complexSet: true`): movements done back-to-back without setting the bell down.
- **Weight config**: up to two weights — tabs None / 2H / 1H / Double.
- **Workout goal**: time, rounds, or volume. **Workout options**: full session config in `WorkoutOptionsContext`, written to Supabase on completion.

## Linear workflow
Work is tracked in Linear (ticket refs `CB-*`, `PROD-*`). At the start of a task, check Linear for related tickets (via the Linear MCP). Keep statuses in sync with reality: move a ticket to In Progress when starting on it, and to Done when its PR merges — link the PR on the ticket.

## Conventions
- Data fetching lives in `src/api/`: `useQuery`/`useMutation` (`@tanstack/react-query` v5 — object-form signature `useQuery({ queryKey, queryFn })`, filters take a filter object, mutation pending is `isPending` not `isLoading`), `supabase` from `~/supabaseClient`, query keys in `src/constants/queries.enum.ts`.
- `npm run gen:types` writes repo-root `types/supabase.ts` (commit after schema changes; needs `supabase start`). `src/types/supabase.ts` is a 3-line alias.
- Schema changes bound for production go in a **migration**, not `supabase/seed.sql` (seed reaches staging only). See `.github/workflows/supabase-*.yaml`.
- Custom Tailwind spacing is **larger** than defaults — check `tailwind.config.js` and existing `src/components/ui/` before sizing new components.
- Testing: Vitest + React Testing Library, MSW mocking (`src/mocks/`), tests collocated as `*.test.tsx`.

## PR screenshots
Any PR with visible UI work needs screenshots in the template's **Gallery** section: before *and* after for changed UI, after alone for new UI.
- **Capture:** `preview_start` the `bellskill-dev` config in `.claude/launch.json` (port 5173; run `start:server` first), drive to the affected screen, and use the browser `computer {action: "screenshot"}` tool, saving to the session scratchpad. For a "before", capture on `main` or stash the change first. `bellskill-storybook` (port 6006) is the cheaper surface for isolated components.
- **Embed:** run the `uploading-attachments` skill on the saved files for GitHub CDN URLs, then put those in Gallery — don't commit screenshots. If browser login for that skill isn't set up, save to the scratchpad and ask DJ to drag-drop instead. Flag that CDN uploads are permanent; GitHub can't delete them.

## Commands
`npm run dev` · `npm test` / `test-watch` · `compile:ts` · `lint` · `storybook` · `start:server` (local Supabase, before `gen:types`) · `diff-db`. Full list in `package.json`. `npm run dev` reads local Supabase defaults (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) from `.env.development`, so run `start:server` first; override via a gitignored `.env.local`.

## Deeper docs (read when working in these areas)
- Movement catalog (CSV source, ingest, migration reload): `docs/movement-catalog.md`
- Program tracking (tables, RPCs, seeds, enroll/starting-weight flow): `docs/program-tracking.md`
- Runtime feature flags (PROD-175): `docs/feature-flags.md`
- Launchpad shell (PROD-171): `docs/launchpad-shell.md`
- Pattern-debt scoring: `docs/pattern-debt-scoring-model.md`

## Maintaining this file
Keep only knowledge useful to almost every session; point to the authoritative file/command rather than repeating what the code shows. Prune and rewrite over appending. Deep feature notes belong in `docs/`.
