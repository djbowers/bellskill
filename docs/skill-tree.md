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
  re-exports it). `complete` and `active` come from the row; otherwise
  `available` when every prereq is complete, else `locked`. `active` wins over
  `locked`, so a node you chose to practice early still shows as practicing
  with the advisory line.
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
elsewhere in the app, bodyweight capture for %BW benchmarks, celebrations,
retroactive unlock from history (PROD-84), settings (PROD-83), and the Swing
River weight-tier tickets (PROD-79/80/81), which this PoC neither builds nor
cancels.

The legacy `user_movements.skill_tree_enabled` column predates this model and
is unused; do not wire it up.
