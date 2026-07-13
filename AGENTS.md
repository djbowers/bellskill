# Claude Development Guidelines

## Agent Guidelines

For guidelines on automated agent behavior (Bellskill PM and Bellskill Builder), see [AGENT_GUIDELINES.md](AGENT_GUIDELINES.md).

## Project Overview

This is a kettlebell workout tracking application built with React, TypeScript, Vite, and Supabase. It features PWA support for mobile installation.

## Custom Tailwind Sizing

This project uses **custom spacing values** in `tailwind.config.js` that are LARGER than Tailwind's defaults. When adding new shadcn/ui components to the `src/components/ui/` folder, you MUST use these custom sizes instead of the default values:

### Custom Spacing Scale:

```javascript
spacing: {
  px: '1px',
  0: '0',
  0.5: '4px',    // default: 2px
  1: '8px',      // default: 4px
  1.5: '12px',   // default: 6px
  2: '16px',     // default: 8px
  2.5: '20px',   // default: 10px
  3: '24px',     // default: 12px
  4: '32px',     // default: 16px
  5: '48px',     // default: 20px
  6: '64px',     // default: 24px
  7: '80px',     // default: 28px
}
```

### Important Rules for shadcn/ui Components:

1. **Always check existing UI components** in `src/components/ui/` for sizing patterns
2. **Use the custom spacing scale** - don't use default shadcn sizing
3. **Follow the existing height conventions**:
   - Small: `h-3` (24px)
   - Default: `h-4` (32px)
   - Large: `h-5` (48px)
4. **Maintain consistency** with existing components like `input.tsx` and `button.tsx`

### Example Adjustments Needed:

- Default shadcn input: `h-10` → Use: `h-4` or `h-5`
- Default shadcn button: `h-10` → Use: `h-4` or `h-5`
- Default shadcn padding: `px-3` → Use: `px-2` or `px-3` (but verify against existing components)

## Project Structure

```
src/
  api/          # React Query hooks (useMovements, useLogWorkout, etc.) + Supabase calls
  app/          # App.tsx, Root.tsx, routes.tsx — router and top-level providers
  components/   # Shared components (Header, Page, SafeAreaWrapper) and ui/ (shadcn)
  constants/    # Enums and static values (query keys, etc.)
  contexts/     # React contexts (SessionContext, WorkoutOptionsContext)
  examples/     # Test fixture factories
  hooks/        # Shared hooks (useCountdownTimer, useDebouncedCallback)
  lib/          # Utility wrappers (cn() from tailwind-merge + clsx) and shared action helpers (nav-actions: theme toggle, sign-out)
  mocks/        # MSW handlers, Node server, browser SW setup
  pages/        # One folder per route (see Page Structure below)
  types/        # TypeScript interfaces and types (supabase.ts is auto-generated)
  utils/        # Pure utility functions
```

## Import Path Alias

`~` resolves to `src/`. Always use `~/api`, `~/components`, `~/contexts`, `~/types`, etc. rather than relative `../` paths when crossing module boundaries.

## Domain Concepts

- **Movement**: a single exercise (e.g. "Kettlebell Swing") with a name, rep scheme, and optional weight(s).
- **Rep scheme / ladder**: ordered list of rep counts per rung — e.g. `[1, 2, 3, 4, 5]`.
- **Rung**: one step in a ladder (one element of the `repScheme` array).
- **Complex set** (`complexSet: true`): movements performed back-to-back without setting the weight down.
- **Weight configuration**: each movement supports up to two weights. Tabs: `None`, `2H` (two-handed), `1H` (one-handed/offset), `Double` (two separate bells).
- **Workout goal**: time-based (minutes), rounds-based, or volume-based (kg lifted).
- **Workout options**: the full session configuration — movements, goal, timers, and weight setup — held in `WorkoutOptionsContext` and written to Supabase on completion.

## Page Structure

Each page is a self-contained folder under `src/pages/`:

```
pages/
  StartWorkoutPage/
    StartWorkoutPage.tsx        # Page component
    StartWorkoutPage.test.tsx   # Tests
    StartWorkoutPage.stories.tsx
    components/                 # Components used only by this page
    hooks/                      # Hooks used only by this page
    utils/                      # Pure utilities for this page
    index.ts                    # Re-exports the page component
```

## API Layer

- All data-fetching hooks live in `src/api/`.
- Queries use `useQuery`, mutations use `useMutation` (react-query v3).
- Supabase client is the `supabase` named export from `~/supabaseClient`.
- Query keys are defined in `src/constants/queries.enum.ts`.
- `npm run gen:types` writes the **repo-root** `types/supabase.ts` — commit that file after any schema change (requires `supabase start` to be running). `src/types/supabase.ts` is just a 3-line alias (`export type Supabase = Database`) re-exporting the root file; it is not regenerated.
- Schema changes that must reach staging/production (e.g. seeded shared content) belong in a **migration**, not `supabase/seed.sql`. `seed.sql` runs only on local `supabase db reset` (`config.toml [db.seed]`); migrations auto-deploy via `.github/workflows/supabase-*.yaml`.

## Movement Catalog (PROD-153)

The `movements` table is a self-authored, commercially-clean Kettlebell +
Bodyweight catalog (~250 rows, slim 8-field schema; the old ~3,000-row
non-commercial "Functional Fitness Exercise Database" source and its ~24 unused
columns / enum wall were removed). The controlled fields (`Primary Equipment`,
`Single or Double Arm`, `Target Muscle Group`, `Difficulty Level`,
`Movement Pattern #1`) are now free `text` guarded by CHECK constraints, not
Postgres enums — so `~/types` defines `Equipment` / `MuscleGroup` /
`DifficultyLevel` as hand-authored unions, not `Supabase['...']['Enums']`.

- **Source of truth:** `scripts/data/movements.csv` (7 authored columns; `id` is
  generated). `scripts/ingest-movements.mjs` validates every row against the app
  vocabularies + Kettlebell weight-mode reachability
  (`src/utils/movementWeightModeFilter.ts`) and recognized pattern-debt patterns
  (`pattern_debt_window` CASE). Run `npm run movements:check`.
- **How it loads:** the migration `*_slim_movements_catalog.sql` reloads the
  whole catalog (its INSERT block is regenerated with `npm run movements:emit-sql`),
  so it is reproducible on `supabase db reset` and auto-deploys. There is **no**
  live-DB ingest path anymore.
- **To change the catalog:** edit the CSV → `movements:check` → regenerate the
  migration's VALUES block via `movements:emit-sql` → `supabase db reset` →
  `gen:types`. Any new field value must already be in the app vocabularies (no
  new enums); Explore's filter constants in `MovementsPage.tsx` mirror the CSV's
  value set.

## Testing Setup

- Vitest + React Testing Library.
- MSW (Mock Service Worker) handles API mocking:
  - `src/mocks/server.ts` — Node server for unit tests
  - `src/mocks/browser.ts` — browser SW for dev mode
  - `src/mocks/handlers.ts` — shared request handlers
- Test data lives in `src/examples/` and `src/mocks/mocked-*.ts`.
- Test files collocate with source: `ComponentName.test.tsx`.

## Program Tracking (behind the `programs` flag)

A sequencing/progress layer over the existing `workout_logs` pipeline. Four
tables (`programs`, `program_sessions`, `user_programs`,
`program_session_completions`) plus four SQL functions: `enroll_in_program`
(copy-on-enroll clone + activate), `complete_program_session` (record a
completion/skip, advance, and flip the enrollment to `completed` on the final
session — atomic), and the PROD-219 editing pair `reorder_program_sessions` /
`delete_program_session`. All are `SECURITY INVOKER` RPCs; progress is fully
**derived from the completions set**, never a stored cursor.

- **Shared programs (seeded, system-owned):** the public shared programs
  (`owner_id NULL`, `is_public`) ship as migrations (not `seed.sql`, so they
  also reach staging/prod) — Dry Fighting Weight
  (`*_seed_dry_fighting_weight.sql`) and Dan John's 10,000 Swing Challenge
  (`*_seed_10000_swing_challenge.sql`). Each is idempotent on `slug` and builds
  every session's `WorkoutOptions` JSONB (shape `Omit<WorkoutOptions,'startedAt'>`,
  camelCase keys) via a `pg_temp` helper; add another by mirroring one. Seed
  shape is asserted in `e2e/program-schema.spec.ts`. `ProgramsPage` currently
  features only a single shared program (`sharedPrograms[0]`, preferring the DFW
  slug), so a newly seeded program lands in the shared-program data but is not
  yet surfaced in that UI.
- **Next session** = lowest-`sequenceIndex` `program_sessions` row with no
  completion. `useActiveProgram` runs this client-side over the program's ≤~15
  sessions (a dedicated SQL function buys nothing at that size). It returns the
  **active _or_ most-recently-completed** enrollment so the "🎉 complete" card
  still renders after the terminal status flip — consumers that must treat only
  active enrollments specially (e.g. `ProgramsPage`) guard on
  `enrollment.status === 'active'`.
- **Home surfacing:** an active program forces browse mode
  (`StartWorkoutPage`), rendering `NextProgramWorkoutCard` above the recommended
  sections. A `programGatePending` flag holds the page in browse until the
  (async) program query resolves, avoiding a builder→card flash.
- **Card → start → log seam:** starting a program session threads
  `{ userProgramId, programSessionId }` through **`ProgramSessionContext`** (a
  sibling of `WorkoutOptionsProvider` in `App.tsx`), set by `useStartWorkout`
  and read in `useLogWorkout.onSuccess` to write the completion linked to the new
  `workout_logs.id`. The linkage is deliberately **NOT** a `workout_logs` column
  — the completion row is the only new write; the existing log path is untouched.
- **Progress view (Slice 4):** `ProgramProgressPage` at `programs/:id` renders
  the program's sessions grouped by week as done ✓ / skipped ⊘ / upcoming chips,
  plus an "N of M sessions" / "Week X of Y" summary. State is derived by
  `useProgramProgress(programId)` **entirely** from the enrollment's
  `program_session_completions` joined to `program_sessions` — nothing from
  `workout_logs`. Completed chips link to `/history/<workout_log_id>` (the
  completion row carries the log id), reusing `CompletedWorkoutPage` verbatim.
  Entry points: each `ProgramsPage` "My programs" card and the home
  `NextProgramWorkoutCard` (`onViewProgress`).
- **Reorder / delete (PROD-219, owner-editable programs only):** the builder
  save-mode surface (`ProgramSessionBuilderPage`) shows up/down + Delete controls
  per session, gated on `program.ownerId === session.user.id` so the read-only
  shared DFW is never editable. Both persist through RPCs
  (`useReorderProgramSessions` / `useDeleteProgramSession`) because
  `UNIQUE (program_id, sequence_index)` is **NOT deferrable** — a naive
  client-side permutation transiently duplicates an index and 409s. Each RPC
  reindexes atomically with a temp offset (bump every affected row past the
  current MAX index, then assign 0..N-1) and **relabels week/day** from
  `days_per_week`, keeping the hand-built order coherent. Delete compacts the
  survivors to 0..N-1 (no gap) so the ADD path's `sequenceIndex = sessions.length`
  never collides. Session ids are stable across a reorder (completions keep
  pointing correctly); a deleted session's completion cascades.
- DB behaviors (RLS, the advance/skip/flip RPC, idempotency, the reorder/delete
  reindex + constraint-safety) are covered by Playwright e2e against the local
  Supabase (`e2e/program-*.spec.ts`), not MSW.
- **Error feedback (PROD-220):** program mutations surface failures through one
  reusable toast — `ToastProvider`/`useToast` (`~/contexts/ToastContext`, mounted
  app-wide in `App.tsx`; presentational `Toast` in `~/components/ui/toast`). Each
  program `useMutation` wires the shared `useProgramMutationErrorHandler` as its
  `onError`; a new program mutation reuses it by adding that `onError`. The
  behavior is scoped to programs structurally (it is wired only into program
  hooks), not via a runtime flag check.
- **Shared program seeds:** each canonical public program is its own idempotent
  seed **migration** (`owner_id NULL`, `is_public true`, `ON CONFLICT (slug)`), a
  `pg_temp` helper building the per-session `WorkoutOptions` JSONB
  (`Omit<WorkoutOptions,'startedAt'>`, camelCase). DFW
  (`*_seed_dry_fighting_weight.sql`) is the template; add a focused
  `e2e/program-<slug>.spec.ts` asserting the seeded shape.
- **`intervalTimer` (EMOM programs):** DFW leaves it `0`; the A+A Protocol seed
  (`*_seed_aa_protocol_plan_a.sql`) is the first/reference use. It is a
  per-session seconds cadence — `ActiveWorkoutPage` auto-fires one "continue"
  every `intervalTimer` seconds. On a **one-handed** movement (`weightTwoValue: 0`)
  each auto-fire alternates sides, so `intervalTimer: 30` gives "left on the
  minute, right 30s later." See the `AAProtocolPlanASession` story +
  `ActiveWorkoutPage.test.jsx` EMOM-cadence test.

## Runtime Feature Flags (PROD-175)

Server-authoritative, per-user flag/assignment mechanism that replaced the
build-time `VITE_FEATURE_*` env vars for **experiment** flags (as opposed to
the release-toggle flags in `~/config/features`, which stay build-time).

- Schema + RPCs in `supabase/migrations/20260713000001_create_feature_flags.sql`; eval
  client in `~/api/useFeatureFlags` (`useFeatureFlags()` hook); app-facing
  flag keys/types and the safe-default mapping in `~/config/experiments`.

* Two tables: `feature_flags` (runtime-toggleable definitions — enabled /
  rollout_percentage / default_variant, client-readable, never client-writable)
  and `feature_flag_assignments` (sticky per-user variant, `user_id, flag_key`
  PK, readable only by its own user, **writable only by the RPC** — no client
  insert/update policy exists, so a user cannot forge their own bucket).
* `evaluate_feature_flag(flag_key)` is `SECURITY DEFINER`: on first eval of an
  enabled flag it buckets the user deterministically
  (`hashtextextended(user_id || flag_key)` mod 100 vs `rollout_percentage`) and
  persists the assignment; every later eval reads that row back, so the bucket
  can't drift even if rollout changes. The batch
  `evaluate_feature_flags(flag_keys[])` is a plain `LANGUAGE sql` wrapper
  (SECURITY INVOKER) that just delegates each key to the singular DEFINER
  function — it does no table DML itself, so the privileged assignment write
  still happens only inside `evaluate_feature_flag`. Disabled flags and unknown
  flag keys resolve to `default_variant`/`control` with no assignment row
  written, so re-enabling later re-buckets fresh.
* `useFeatureFlags()` returns that record alongside an `isPending` gate. It maps
  DB variants to the app-facing `ExperimentFeatures` boolean record
  (`curatedFirstWorkout`, `repeatPrevious`, `recommender` — the PROD-174
  discovery flags plus the AI recommender), falling back to
  `SAFE_DEFAULT_FEATURES` (all off) on any query error, while loading, and when
  unauthenticated — the eval client never flips a user into treatment on
  failure. `staleTime: Infinity` since assignment is server-sticky. Owners
  previewing all features (see `~/config/features`) get every experiment feature
  forced on (`ALL_EXPERIMENT_FEATURES_ON`), mirroring `getFeatures()`.
* **App-init gate, not a per-screen skeleton:** `FeatureFlagsGate`
  (`~/app/FeatureFlagsGate.tsx`) resolves flags once, inside `SessionProvider`
  and wrapping `RouterProvider` in `App.tsx` — before any route (or its
  flag-dependent UI) ever mounts. It blocks on the same branded `Loading`
  splash the session-bootstrap gate already uses, cleared on `isPending ===
false` **or** an independent hard timeout (`FLAGS_TIMEOUT_MS`, ~1.75s),
  whichever comes first — `isPending` alone has no wall-clock cap for a
  slow-but-succeeding request, so the timeout is what actually guarantees the
  app never hangs on this splash. If the timeout fires first, `useFeatureFlags()`
  already reads as the safe default until the real result lands, so there's no
  separate fallback path to maintain. Because the underlying query is keyed
  `[QUERIES.FEATURE_FLAGS, userId]` with `staleTime: Infinity`, any later
  consumer (e.g. `StartWorkoutPage`) calling `useFeatureFlags()` just reads the
  already-resolved cache instantly — flags are loaded once per session, not
  re-awaited on navigation. `StartWorkoutPage` itself only tracks
  `programGatePending` (the separate active-program query) for its own
  pending-skeleton handling; it has no flags-pending state left to gate on.
* Migrating another build-time flag onto this mechanism: add its key to
  `EXPERIMENT_FLAG_KEYS`/`KEY_TO_FEATURE` in `~/config/experiments`, add a row
  to the migration's seed `INSERT` (defaulted `enabled = false` to preserve
  current behavior), and swap the read site from `useFeatures()` to
  `useFeatureFlags()`.

## Authentication

- Uses Supabase Auth with both magic links and OTP (one-time passwords)
- Magic links are primary method, OTP is fallback for mobile users
- Session management handled via React Context

## Development Commands

- `npm run dev` - Start development server (port 5173)
- `npm run dev:host` - Dev server exposed on local network IP
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests (Vitest, single run)
- `npm run test-watch` - Run tests in watch mode
- `npm run coverage` - Run tests with coverage report
- `npm run compile:ts` - TypeScript type-check without emitting
- `npm run lint` - Run ESLint
- `npm run prettier` - Format all files with Prettier
- `npm run storybook` - Storybook on port 6006
- `npm run start:server` - Start local Supabase (required before gen:types)
- `npm run gen:types` - Generate Supabase TypeScript types from local schema
- `npm run diff-db` - Show schema diff (useful before creating a migration)

## Key Technologies

- React 18 with TypeScript
- Vite for build tooling
- React Router v6 for routing
- Supabase for backend and auth
- Tailwind CSS with custom spacing
- Radix UI primitives (via shadcn/ui)
- React Query v3 for data fetching
- MSW for API mocking in tests
- Vitest + React Testing Library for testing
- Storybook for component development

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
