# Skill Tree PoC (PROD-249)

A nine-level map of kettlebell competence with self-assessed benchmarks. Built
as an owner-dogfood proof of concept to learn whether seeing the map changes how
you train. Since then the tree also feeds both Chalk recommenders as a
deterministic ceiling (see "Recommender integration" below).

- **Node map:** `src/config/skillTree.ts` — static, typed, 37 nodes across 9
  levels transcribed from the vault spec (`bellskill_full_skill_tree_spec_v2.md`).
  Ids are `L{level}-N{n}` for movement nodes in spec order and `L{level}-M1` for
  the level's standalone mobility node. `prereqs` holds node ids the spec names;
  free-text prerequisites live in `prereqNotes`. `src/config/skillTree.test.ts`
  guards the graph: every prereq exists, no cycles, no upward edges, one mobility
  node per level 2–9.
- **Progress:** `skill_node_progress(user_id, node_id, status, completed_at)`
  (`supabase/migrations/20260907120000_*`). `status` is `active` or `complete`;
  an absent row means not started. Owner-only RLS, same shape as
  `user_equipment`. Hooks: `useSkillNodeProgress`, `useSetSkillNodeStatus`
  (upsert on `user_id,node_id`), `useResetSkillNode` (delete).
- **Derivation:** `src/utils/skillTreeProgress.ts` (pure, relative imports only
  so the edge functions and the eval runner can share it; the page util
  re-exports it). `complete` comes from the row **or** from a load edge at or
  past the node's target; otherwise `active` from the row, else `available` when
  every prereq is complete, else `locked`. Prerequisites read that combined
  completeness, so an auto-passed swing unlocks the clean. `completionSource`
  says which won — a manual row keeps its Undo, a log pass has nothing to undo.
  `active` wins over `locked`, so a node you chose to practice early still shows
  as practicing with the advisory line.
- **Load edge (PROD-79/80/81, "Swing River").** Nodes a bell measures carry a
  `targetKg` in `src/config/skillTree.ts` — the bell that passes the node.
  *Which* movements count comes from the catalog (`movements.skill_node_id`),
  not from the config, so there is one mapping and it picks up catalog rows the
  tree never names. Targets are spec v2's %BW benchmarks at an 80kg reference
  lifter, snapped to the ladder in `src/utils/bellLadder.ts` (8–48kg); nodes the
  spec gives an absolute weight keep it. `skillTree.test.ts` asserts that every
  node with a target has at least one kettlebell movement mapped to it, so a
  target whose edge could never move fails CI.
- **Edge derivation:** `src/utils/skillNodeLoadEdge.ts` (pure) returns the
  heaviest bell per node id, plus the first date it was reached. A log only
  counts when the way it was weighted matches the movement's catalog hand mode
  (`movementWeightModeFilter`), so a bodyweight goblet squat or a two-bell log of
  a one-bell movement is ignored. Double work counts as its lighter bell. Pound
  loads round to the half-kilo before snapping to a rung, so a 35lb bell reads as
  16kg rather than 12kg.
- **Fetching:** `src/api/useSkillNodeLoadLogs.ts` reads the catalog rows that
  carry a `skill_node_id`, then the user's `movement_logs` joined through
  `user_movements` to those ids. Complex and shared-bell workouts take the
  parent's shared weights when it has them, falling back to the movement's own —
  the same COALESCE the pattern-debt aggregate makes in SQL. Logs never linked to
  a catalog movement are excluded by the join. Invalidated on logging a workout
  and on linking or unlinking a movement log.
- **Advisory gates only.** Locked nodes stay tappable. The dialog lists which
  prerequisites are incomplete and never disables Start practicing.
- **Flag:** build-time `skillTree` in `src/config/features.ts`, off by default
  everywhere. Turn it on with the owner preview override on the Account page,
  or via `VITE_FEATURE_SKILL_TREE=true` in a gitignored `.env.local`. Deploy
  previews force it on. Route `/skill-tree`; nav item lands in the bottom bar's
  promoted slot only when Chalk and Movements are off, otherwise in More.

## Recommender integration

Both `recommend-session` and `recommend-program` read the lifter's rows through
`_shared/skillTreeInput.ts` and reason over a `SkillTreeSummary`
(`summarizeSkillTree`: passed / practicing / ready node ids plus per-level
counts), persisted verbatim in the recommendation's `inputs` JSONB.

- **No rows, no effect.** `summarizeSkillTree` returns `null` for a lifter with
  no progress on the map, and both functions then omit the section and apply no
  ceiling. That is what gates the server side: the build-time `skillTree` flag
  only hides the UI, and nobody has rows until they use it.
- **Reach.** A node is within reach when it is passed, practicing, or ready
  (every direct prereq passed), or is a transitive prerequisite of a passed or
  practicing node (practicing the clean implies the swings). `active` rows with
  missing prereqs count as in reach, matching the page.
- **Catalog mapping.** `movements.skill_node_id` (CSV column `Skill Node`, see
  `docs/movement-catalog.md`) names the hardest node a movement requires; null
  means never gated. Roughly half the catalog (rows, floor presses, push-ups,
  core) has no node by construction.
- **Session ceiling.** `applySkillCeiling` in `recommend-session/inputs.ts`
  drops out-of-reach candidates before balance targets are chosen, so the model
  never sees them and the existing catalog-membership validation rejects
  anything else. Catalog lines carry `· practises: <node> (passed|practising|ready)`
  and the system prompt prefers practising nodes, then ready ones, ranked below
  readiness and goal and above pattern balance.
- **Program reach.** `program_skill_node_movements()` aggregates each program's
  prescribed movements by node (same exact-name join as the modality profile);
  `assessSkillReach` gives every candidate a `within_reach` or `stretch`
  verdict, and `recommend-program/validate.ts` rejects a stretch pick whenever
  any candidate is within reach, so the rule never empties the set.
- **Vocabulary.** Prompts say passed / practising / ready / "not yet in reach";
  never "locked", never "debt".
- **Eval.** `npm run eval:next-session` has a `skill-tree` category with the
  `skill_ceiling` and `must_not_prescribe` checks.

## Out of scope for the PoC

12-session practice counters, session tagging, the A/B/C rotation, nudges
elsewhere in the app, per-user bodyweight capture (targets use a fixed 80kg
reference instead), celebrations, and settings (PROD-83).

Three nodes carry no target because no catalog movement maps to them yet:
`L6-M1` and `L7-M1` (their carries map to the movement nodes they load) and
`L8-N2` (Clean and Press currently maps to `L4-N3`). They stay self-assessed
until the mapping is revised.

The legacy `user_movements.skill_tree_enabled` column predates this model and
is unused; do not wire it up.
