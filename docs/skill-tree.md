# Skill Tree PoC (PROD-249)

A nine-level map of kettlebell competence with self-assessed benchmarks. Built
as an owner-dogfood proof of concept; the design question it answers is whether
seeing the map changes how you train, not whether the tree can drive programs.

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
- **Derivation:** `src/pages/SkillTreePage/utils/deriveNodeStates.ts` (pure).
  `complete` and `active` come from the row; otherwise `available` when every
  prereq is complete, else `locked`. `active` wins over `locked`, so a node you
  chose to practice early still shows as practicing with the advisory line.
- **Advisory gates only.** Locked nodes stay tappable. The dialog lists which
  prerequisites are incomplete and never disables Start practicing.
- **Flag:** build-time `skillTree` in `src/config/features.ts`, off by default
  everywhere. Turn it on with the owner preview override on the Account page,
  or via `VITE_FEATURE_SKILL_TREE=true` in a gitignored `.env.local`. Deploy
  previews force it on. Route `/skill-tree`; nav item lands in the bottom bar's
  promoted slot only when Chalk and Movements are off, otherwise in More.

## Out of scope for the PoC

12-session practice counters, session tagging, the A/B/C rotation, nudges
elsewhere in the app, bodyweight capture for %BW benchmarks, celebrations,
retroactive unlock from history (PROD-84), settings (PROD-83), and the Swing
River weight-tier tickets (PROD-79/80/81), which this PoC neither builds nor
cancels.

The legacy `user_movements.skill_tree_enabled` column predates this model and
is unused; do not wire it up.
