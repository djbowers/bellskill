# Movement Catalog (PROD-153)

The `movements` table is a self-authored, commercially-clean Kettlebell +
Bodyweight catalog (~250 rows, slim 8-field schema; the old ~3,000-row
non-commercial "Functional Fitness Exercise Database" source and its ~24 unused
columns / enum wall were removed). The controlled fields (`Primary Equipment`,
`Single or Double Arm`, `Target Muscle Group`, `Difficulty Level`,
`Movement Pattern #1`) are now free `text` guarded by CHECK constraints, not
Postgres enums — so `~/types` defines `Equipment` / `MuscleGroup` /
`DifficultyLevel` as hand-authored unions, not `Supabase['...']['Enums']`.

- **Source of truth:** `scripts/data/movements.csv` (9 authored columns incl.
  `Pattern Credits` and `Modality Credits`; `id` is generated).
  `scripts/ingest-movements.mjs` validates every row against the app
  vocabularies + Kettlebell weight-mode reachability
  (`src/utils/movementWeightModeFilter.ts`) and the pattern-debt rules: legal
  `Movement Pattern #1`, well-formed non-empty credits, and credits ⊇
  coarse(primary) (see docs/pattern-debt-scoring-model.md). `Modality Credits`
  is a non-empty `|`-separated subset of grind / ballistic / conditioning /
  mobility (see docs/modality-debt-scoring-model.md); backfill UPDATEs come
  from `--emit-modality-sql`. Run `npm run movements:check`.
- **How it loads:** the migration `*_slim_movements_catalog.sql` reloads the
  whole catalog (its INSERT block is regenerated with `npm run movements:emit-sql`),
  so it is reproducible on `supabase db reset` and auto-deploys. There is **no**
  live-DB ingest path anymore.
- **To change the catalog:** edit the CSV → `movements:check` → add a **forward**
  migration carrying the change → `supabase db reset` → `gen:types`. The reload
  migration is already applied upstream and will not re-run, so never edit its
  VALUES block; use `movements:emit-sql` only to lift correctly-quoted literals
  for the new rows, and guard additive inserts with a
  `WHERE NOT EXISTS (… lower("Movement") = lower(…))` check — `"Movement"` has no
  unique index, and the guard keeps a fresh `db reset` from double-inserting.
  `*_add_ab_wheel_core_movements.sql` is the reference shape. Any new field value
  must already be in the app vocabularies (no new enums); Explore's filter
  constants in `MovementsPage.tsx` mirror the CSV's value set.
- **Implements beyond a bell:** equipment stays two classes, so anything needing
  a bar, bench, or ab wheel is filed as `Bodyweight` with the implement named in
  the movement (`Hanging Leg Raise`, `Decline Crunch`, `Ab Wheel Rollout`). A
  third `Primary Equipment` value would be unreachable in the builder until
  `movementWeightModeFilter.ts`'s `none` mode widened beyond `Bodyweight`.
- **Renaming orphans `user_movements` FKs:** the reload relinks
  `user_movements.functional_movement_id` on exact name match, so any row whose
  `canonical_name` was renamed matches nothing and is stranded NULL (silently
  excluded from `pattern_debt_window` bucketing). PROD-153 stranded 29 prod rows;
  `*_relink_orphaned_user_movements.sql` (PROD-234) is the idempotent forward
  data-fix that reconciles them to the current catalog, writing only where the FK
  IS NULL. If a rename re-orphans rows, add another such follow-up rather than
  editing the applied reload. Names with no correct catalog equivalent are left
  deliberately NULL. The two catalog gaps PROD-234 tracked — Double Kettlebell
  Clean (PROD-235) and Double Kettlebell Overhead Press (PROD-242) — were closed
  by `*_rename_two_arm_to_double.sql`, which renamed the mislabeled `Two-Arm`
  double-bell movements to `Double` (Clean exactly; Overhead Press relinked to
  Double Kettlebell Military Press) and folded the duplicate `Two-Arm Kettlebell
  Jerk` into the existing `Double Kettlebell Jerk`.
