# Modality Debt scoring model

A second balance axis alongside pattern debt: instead of movement patterns, it
scores the four **training modalities** and surfaces them as the "Training Mix"
card on the History page (flag: `modalityBalance` / `VITE_FEATURE_MODALITY_BALANCE`).

All scoring math is **identical to the pattern model** — windows, recency and
volume-deficit components, weights, bands, grace state, and spread all reuse the
constants and functions exported by `src/utils/patternDebt.ts`. Read
`docs/pattern-debt-scoring-model.md` first; this doc only records what differs.

## Taxonomy

| Modality | Meaning | Examples |
| --- | --- | --- |
| `grind` | Slow strength | presses, squats, deadlifts, rows, get-ups |
| `ballistic` | Hardstyle power | swings, snatches, cleans, jerks, push presses |
| `conditioning` | Sustained cardio-effort work | swings/snatches, carries, crawls, jumps, burpees |
| `mobility` | Flow / range-of-motion work | halos, windmills, figure 8s, cossacks |

UI label for `conditioning` is **Cardio**. Movements multi-credit
(`movements.modality_credits text[]`, mirroring `pattern_credits`): a snatch is
`ballistic|conditioning`, a loaded carry `grind|conditioning`. Source of truth
is the `Modality Credits` column of `scripts/data/movements.csv`, validated by
`npm run movements:check` and backfilled by
`node scripts/ingest-movements.mjs --emit-modality-sql`.

## Differences from the pattern model

- **Attribution** (`src/utils/modalityDebt.ts`): catalog credits only — there is
  **no name-regex fallback**. Unlinked custom movements pay no modality credit
  until linked to the catalog (Explore → link), at which point history counts
  retroactively.
- **Data source**: the same `pattern_debt_movements` RPC, which returns
  `modality_credits` alongside `pattern_credits`; one aggregation serves both
  scorers (`useModalityDebt` / `usePatternDebt` each apply their own model).
- **No recommender coupling yet**: balance-target selection and the edge-function
  prompt lines are pattern-only; modality inputs are a Phase 2 follow-up.

The layering rule is unchanged: SQL is a pure aggregation; attribution and
scoring live in TypeScript (`src/utils/modalityDebt.ts` +
`modalityDebt.test.ts`). Change this doc first, then keep the implementation and
tests in sync. UI vocabulary: "Training Mix" / "Balance", never "debt".
