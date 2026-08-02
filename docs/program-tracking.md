# Program Tracking (behind the `programs` flag)

User-facing flows (browse, enroll, progress, authoring, lifecycle) and their
test traceability: `docs/program-user-flows.md`. This doc is the data/RPC record.

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
  (`*_seed_dry_fighting_weight.sql`), Dan John's 10,000 Swing Challenge
  (`*_seed_10000_swing_challenge.sql`), StrongFirst's A+A Protocol "Plan A"
  (`*_seed_aa_protocol_plan_a.sql`, the first EMOM/`intervalTimer` program),
  Dan John's Armor Building Complex
  (`*_seed_armor_building_complex.sql`, the first `complexSet: true` program),
  and Dr. Mike Prevost's The Kettlebell Mile (`*_seed_kettlebell_mile.sql`, the
  first carry-centric program and the first `timedRungs: true` program).
  Each is idempotent on `slug` and builds every session's `WorkoutOptions` JSONB
  (shape `Omit<WorkoutOptions,'startedAt'>`, camelCase keys) via a `pg_temp`
  helper; add another by mirroring one. Seed shape is asserted in
  `e2e/program-schema.spec.ts`. `ProgramsPage` surfaces every public program
  (`sharedPrograms = programs.filter(isPublic)`) in a compact "Browse programs"
  list (PROD-237) — a single `divide-y` `Card` of rows, each with the title +
  author/duration metadata and a `size="sm"` Start button (visible text
  "Start", per-program accessible name via `aria-label={'Start ' + title}` so
  `getByRole('button', { name: 'Start <title>' })` still resolves), so a newly
  seeded program shows up automatically.
- **Seeding a `complexSet: true` program:** see
  `*_seed_armor_building_complex.sql` (Dan John's ABC). Give each movement a
  **single-element `repScheme`** so the complex runtime's `maxMovementRungs`
  (longest repScheme) is 1 and one "Complete Set" completes a whole round, and
  **populate `sharedWeightOne/Two`** because `ComplexMovementDisplay` reads the
  shared pair (not per-movement weights) — DFW's non-complex sessions leave those
  null.
- **Next session** = lowest-`sequenceIndex` `program_sessions` row with no
  completion. `useActivePrograms` runs this client-side per program over its
  ≤~20 sessions (a dedicated SQL function buys nothing at that size). It returns
  **every active enrollment**, sorted least-recently-worked first (`lastWorkedAt`,
  the max `completed_at` over that enrollment's completions; nulls first so a
  brand-new program surfaces immediately). When _nothing_ is active it falls back
  to the single most-recently-completed enrollment so the "🎉 complete" card
  still renders after the terminal status flip — consumers that must treat only
  active enrollments specially (e.g. `ProgramsPage`) filter on
  `enrollment.status === 'active'`.
- **Parallel programs:** a user may run up to **3** programs at once
  (`MAX_ACTIVE_PROGRAMS`), each with an independent cursor. Enforced at the
  schema level by `user_programs.active_slot` (1–3) + the partial unique index
  `one_program_per_active_slot ON user_programs(user_id, active_slot) WHERE
  status = 'active'` — a slot index, not a count-checking trigger, which two
  concurrent inserts would both pass. `enroll_in_program` / `resume_program`
  claim the lowest free slot, or take the slot of the enrollment named in
  `p_replace_user_program_id`; at the cap they raise `PROGRAM_SLOTS_FULL`, and
  enrolling twice in one program raises `PROGRAM_ALREADY_ACTIVE` (both mapped to
  copy by `useProgramMutationErrorHandler`). The status↔slot `CHECK` is
  **one-directional** (`status <> 'active' OR active_slot IS NOT NULL`): active
  rows must hold a slot, so the cap can't be dodged by omitting the column (a
  unique index treats NULLs as distinct), but a deactivated row may keep a stale
  slot — which is what lets `complete_program_session`'s terminal flip and the
  cancel PATCH stay one-column updates. The write path was already
  enrollment-scoped and needed no change. See `e2e/program-parallel.spec.ts`.
- **Derived cadence (PROD-237):** `programs.num_weeks`/`days_per_week` are
  **nullable** and no longer asked at creation. `usePrograms` prefers the stored
  columns when a program authored them (the seeded shared programs) and
  otherwise **derives** cadence from the program's own embedded sessions —
  `numWeeks` (highest week) / `daysPerWeek` (widest week), null when it has no
  sessions yet. The builder and reorder/delete RPCs treat an unset
  `days_per_week` as 1 (`|| 1` / `COALESCE(...,1)` → one session per week).
- **Home surfacing:** an active program forces browse mode
  (`StartWorkoutPage`), rendering `NextProgramWorkoutCard` above the recommended
  sections. With several running, the card shows **one** program — index 0
  (least-recently-worked) unless the user picks another in `ProgramSwitcherTabs`,
  a pill row that renders `null` below two programs so the one-program surface is
  unchanged. Start/Skip act on the selected program, never the default. A
  `programGatePending` flag holds the page in browse until the (async) program
  query resolves, avoiding a builder→card flash.
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
  per session, gated on `program.ownerId === session.user.id` so read-only
  shared programs (DFW, the StrongFirst Snatch Test plan — both system-owned,
  seeded via idempotent migrations) are never editable. Both persist through RPCs
  (`useReorderProgramSessions` / `useDeleteProgramSession`) because
  `UNIQUE (program_id, sequence_index)` is **NOT deferrable** — a naive
  client-side permutation transiently duplicates an index and 409s. Each RPC
  reindexes atomically with a temp offset (bump every affected row past the
  current MAX index, then assign 0..N-1) and **relabels week/day** from
  `days_per_week`, keeping the hand-built order coherent. Delete compacts the
  survivors to 0..N-1 (no gap) so the ADD path's `sequenceIndex = sessions.length`
  never collides. Session ids are stable across a reorder (completions keep
  pointing correctly); a deleted session's completion cascades.
- **Session edit (PROD-237):** the builder handles both add and edit; the edit
  route `programs/:id/sessions/:sessionId/edit` reuses `ProgramSessionBuilderPage`,
  which branches on the `:sessionId` param. Edit mode seeds the builder from the
  target session via `ProgramSaveMode.initialSession` (a one-shot ref-guarded
  effect in `StartWorkoutPage` calls `loadIntoBuilder` + sets the title) and saves
  through `useUpdateProgramSession` (plain owner-gated `UPDATE program_sessions`,
  rewriting title + `workout_options` only — sequence/week/day and the session id
  are untouched, so completions keep pointing at it). The add-mode session list
  gains a per-session **Edit** button (owner-gated, alongside Reorder/Delete).
- **Apply-forward session edit:** saving an edit when later sessions exist asks
  "This session only" vs "This and all future sessions". The forward path
  (`useUpdateProgramSessionsForward`) rewrites the edited row in full, then the
  `update_program_sessions_forward` RPC jsonb-merges only the movement
  prescription — `movements`, `sharedWeightOne/Two` value+unit, `complexSet` —
  into every later session of the program the caller hasn't completed (no
  completion row via any of their enrollments), so each later session keeps its
  own title, notes, goal, duration, and rest settings and completed sessions
  are never rewritten. This deliberately overwrites per-session weight offsets
  on future sessions with the edited session's weights; `adjust_program_weights`
  is the offset-preserving counterpart for weight-only changes.
- **Stages (autoregulated progression):** a program can carry an ordered ladder
  in `programs.stages` (JSONB `ProgramStage[]`: `title`, `movements` as
  name+repScheme only, `preWorkoutNotes`, `deloadPreWorkoutNotes`), copied to
  the clone at enroll. The enrollment's position is
  `user_programs.current_stage_index` (default 0). The `set_program_stage`
  RPC (`useSetProgramStage`, StageCard on `ProgramProgressPage`) takes an
  absolute index — one function serves Advance and Go back — and rewrites
  every session of the clone with no completion for the enrollment. Weights
  are decided per session: complexSet sessions with shared weights get every
  stage movement stamped with the session's OWN `sharedWeightOne/Two` and the
  stage's title (`'Deload · ' + title` on `weight_label = 'Deload weeks'`
  rows); non-complex sessions keep their own title (day labels like
  High/Medium/Low volume) and each stage movement inherits the weight fields
  of the session's same-named movement (null weights if it had none). Either
  way `adjust_program_weights` remains the sole weight authority, and
  `preWorkoutNotes` swaps to the stage's (deload variant on deload rows).
  Goal/interval/rest are untouched, completed sessions never rewritten.
  Shipped ladders: A+A's five complexes (C+J → … → C+J+C+J+C+J,
  `*_seed_aa_protocol_stages.sql`) and Strong Endurance Plan 025's six rep
  counts (Sets of 5 → Sets of 10, `*_seed_se025_stages.sql` — uniform
  repScheme because 025 scales its days by set count, not reps). Backend
  coverage in `e2e/program-stages.spec.ts`.
- **Program CRUD (PROD-237, owned programs only):** `ProgramsPage`'s "My programs"
  surface adds three actions. **Cancel** = `useCancelProgram` flips the active
  enrollment to `abandoned` (reusing the existing status — no new value), freeing
  its parallel slot; confirm-gated because it discards progress. **Delete** = `useDeleteProgram`, an irreversible
  `DELETE programs` that cascades sessions/enrollments/completions — **always**
  behind a confirm dialog. **Archive/Restore** = `useSetProgramArchived` toggles
  the nullable `programs.archived_at` (migration `*_add_program_archived_at.sql`);
  archived programs are filtered out of the default list behind a "Show archived"
  toggle and are reversible, so no confirm. All three are plain RLS-gated REST
  calls (no RPC) — shared/other-user programs are protected by the existing
  owner-only policies (a non-owner mutation matches 0 rows, a silent no-op).
- DB behaviors (RLS, the advance/skip/flip RPC, idempotency, the reorder/delete
  reindex + constraint-safety, and the PROD-237 cancel/delete-cascade/archive-filter
  - owner-only guarantees in `e2e/program-crud.spec.ts`) are covered by Playwright
    e2e against the local Supabase (`e2e/program-*.spec.ts`), not MSW.
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
- **`timedRungs` (timed movements, PROD-200):** a movement with
  `timedRungs: true` reinterprets each `repScheme` entry as **seconds**, not
  reps — `ActiveWorkoutPage` runs a per-rung countdown that auto-fires
  "continue" on expiry (re-armed per rung, so `[30, 60]` works). Deliberately
  reuses `repScheme` rather than adding a parallel duration array, which would
  have to be threaded through `workout_options`, `movement_logs.rep_scheme`,
  `pattern_debt_window`, the builder, and every seed; rung structure (ladders,
  rounds, mirrored sides, complex alternation) is identical either way. Two
  consequences worth knowing: timed rungs contribute **no reps and no volume**
  (seconds × kg is not volume — see `ActiveWorkoutPage`'s `currentRungVolume`
  and the `timed_rungs` guards in `*_add_timed_rungs.sql`'s
  `pattern_debt_window`, which keep `set_count`/`last_trained_at` but zero
  `total_reps`/`volume_kg`), and it is **mutually exclusive with
  `intervalTimer`** — both drive auto-advance, so the builder disables each when
  the other is on. The Kettlebell Mile seed is the reference use; see the
  `KettlebellMileSession` story + the "timed rungs" tests in
  `ActiveWorkoutPage.test.jsx`.
- **`intervalTimer` (EMOM programs):** DFW leaves it `0`; the A+A Protocol seed
  (`*_seed_aa_protocol_plan_a.sql`) is the first/reference use. It is a
  per-session seconds cadence — `ActiveWorkoutPage` auto-fires one "continue"
  every `intervalTimer` seconds. On a **one-handed** movement (`weightTwoValue: 0`)
  each auto-fire alternates sides, so `intervalTimer: 30` gives "left on the
  minute, right 30s later." See the `AAProtocolPlanASession` story +
  `ActiveWorkoutPage.test.jsx` EMOM-cadence test. The program itself is 8 weeks
  × 2 days (16 sessions) — a +2 min duration ramp toward the source's 30-minute
  target, with weeks 4 and 8 deloaded one bell size lighter (24 → 16 kg) at the
  preceding week's duration. `*_reshape_aa_protocol_plan_a.sql` is the forward
  data fix that reconciled the original seed with the source article; the
  original seed migration is applied in prod and is left untouched.
- **Starting weight on enroll (PROD-TBD):** `enroll_in_program` takes four
  optional params mirroring `workout_options`' shared-weight shape —
  `p_shared_weight_one_value`/`_unit` + `p_shared_weight_two_value`/`_unit`. When
  weight one is set, **every** cloned session is overridden, each shifted by its
  own authored offset from the program's _modal_ (weightOne, weightTwo)
  placeholder pair (`*_enroll_in_program_relative_weights.sql`). A modal session
  has delta 0 and clones exactly as before; a deliberately different one keeps
  its relationship to the working load — DFW's W5D2 test day stays +4 kg, A+A's
  deload weeks stay −8 kg, rather than being frozen at an absolute number that
  could land _above_ a light enrollee's working sets. A delta applies only when
  the session's authored unit for that slot matches the chosen unit (all seeds
  author kg); on a mismatch the slot falls back to the flat override rather than
  inventing a converted, non-kettlebell number. A zero delta passes the chosen
  value through untouched — notably it must skip the `GREATEST(..., 1)` clamp,
  since single-bell loading legitimately carries weight two = 0. The
  override writes the resolved weight into **both** the session's
  `sharedWeightOne/Two` fields (the `complexSet` runtime path —
  `ComplexMovementDisplay` reads them) **and folds it onto every movement's own
  `weightOne/Two` fields** (`*_enroll_in_program_fold_movement_weights.sql`,
  PROD-TBD). The movement fold is what actually makes the choice take effect for
  the common `complexSet: false` programs (DFW etc.): `sharedWeightOne/Two` is a
  `complexSet`-only concept — the builder review screen and `ActiveWorkoutPage`
  (`ActiveWorkoutPage.tsx`) read `movement.weightOneValue` directly and never run
  `resolveSharedWeights` on the start path (that only runs on the log→repeat/history
  path via `workoutLogToWorkoutOptions.ts`), so writing `sharedWeightOne/Two`
  alone was inert and the workout ran at the seed placeholder. If the program has
  no numeric modal (bodyweight-first sessions make `v_modal_one` NULL), every
  delta resolves to 0 and the override degrades to a flat one across all
  sessions, so the enrollee's chosen weight is never silently discarded. A
  null weight-two slot means two-hand loading; `jsonb_set` is strict, so each override value is
  `COALESCE(to_jsonb(x), 'null'::jsonb)` (unset slots become JSON null, not a
  nulled-out column). Passing no weight params (the default) is byte-identical
  to the prior copy-verbatim behavior. `ProgramDetailsPage` (the pre-enroll
  route `programs/:id/details`) hosts the picker inline, reusing
  `ModifyCountButtons`/`WeightUnitTabs` from `~/components`; your own programs
  are already fully weight-configured in the builder and redirect away from it.
  The **pre-fill** is derived per-program (PROD-232) from `deriveStartingWeight`
  (`ProgramDetailsPage/utils`), the modal placeholder weight/mode across the
  program's sessions (same `resolveSharedWeights` priority + modal/tie-break as
  the RPC). So single-bell programs (Snatch Test) pre-fill single, swing-only
  (10K Swing) two-hand, DFW/Armor/Easy double — not a fixed 24kg.
- **Weight groups (per-group override):** a program's distinct authored
  `(weightOne, weightTwo)` pairs are its **weight groups** — the modal one is
  the working weight, the rest are the offsets above. `deriveWeightGroups`
  (`ProgramDetailsPage/utils`, which `deriveStartingWeight` now delegates to)
  returns them, and the picker renders **one control per group**: A+A's deload
  weeks, DFW's test day, the Snatch Test's light/heavy rungs; the four
  single-weight programs get nothing extra. An untouched group tracks the
  working weight through `applyGroupOffset` (a mirror of the RPC's math, so the
  number shown is the number that clones) and pins the moment it is edited.
  Groups are named by the authored `program_sessions.weight_label`
  (`*_program_sessions_weight_label.sql` — set in seed migrations only, nothing
  in the builder writes it yet); a null label falls back to a derived
  description like `8 kg lighter · weeks 4, 8`. The chosen weights ride to the
  RPC as `p_weight_overrides`
  (`*_enroll_in_program_weight_overrides.sql`), an array keyed by each group's
  **authored** pair, which makes the resolution order per cloned session:
  (1) no starting weight at all → verbatim; (2) a matching override entry → its
  values/units verbatim, no offset math and no unit-match check; (3) otherwise
  the offset math. Omitting `p_weight_overrides` is byte-identical to the
  offset-only behavior, and an entry matching no session is a silent no-op.
- **Per-movement starting weights (current):** the shared-weight + weight-group
  model above applied one weight to every movement in a session, which is right
  only when a session's movements share a config. Easy Strength mixes a
  bodyweight pull-up, a single-bell swing and double-bell lifts, so the uniform
  fold turned the pull-up and swing into doubles. Enrollment now picks a weight
  **per movement**: `ProgramDetailsPage` renders one control per distinct
  movement, sized to its config via `deriveMovementWeights`
  (`ProgramDetailsPage/utils`) + `getWeightTabValue` — bodyweight movements show
  a "Bodyweight" line (no picker), single-bell one input, double two — and sends
  them as `p_movement_weights` (`MovementWeight[]` on `useEnrollProgram`), keyed
  by `movementName`. `enroll_in_program`
  (`*_enroll_in_program_per_movement_weights.sql`) rebuilds each session's
  `movements[]`, applying the chosen weight in that movement's own config shape
  (preserving null/0 slots) shifted by that movement's authored per-session
  offset from its **per-movement** modal, so cross-session scaling still holds.
  `complexSet` programs (one bell pair for the whole complex, ABC) keep the
  single shared-weight picker and the uniform fold; a caller that passes only
  `p_shared_weight_*` (the homogeneous programs' e2e path) also takes the fold,
  so the shared-weight API stays backward-compatible. `deriveWeightGroups` +
  `applyGroupOffset` + `p_weight_overrides` are retired from the enrollment flow
  (per-movement offset replaces per-group override); `deriveStartingWeight` is
  kept only to pre-fill the `complexSet` shared picker.
