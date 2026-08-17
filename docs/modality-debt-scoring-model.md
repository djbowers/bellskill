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
- **Recommender coupling is soft only**: all three AI surfaces read the modality
  balance, but it never becomes a hard constraint. `selectBalanceTargets` and
  `recommend-session/validate.ts` stay pattern-only — a modality is never a
  must-cover target and never a retry reason, because two competing hard
  constraints can be unsatisfiable from a small movement library.

## AI surfaces (Phase 2)

`recommend-session`, `chalk-chat` and `recommend-program` each render a movement-mix
section from `computeModalityBalance`. All three already call
`pattern_debt_movements`, which returns `modality_credits` beside `pattern_credits`,
so both axes are scored from **one** RPC round trip — see each function's
`gatherBalances`. A failure degrades both to null and the section is omitted rather
than claiming an even mix.

Prompt weighting: in `recommend-session` the mix is explicitly ranked below pattern
balance, readiness and the lifter's goal — a tie-breaker, not a driver.

### The `conditioning` / `mobility` collision

Both values also exist in `programs.focus_tags`, meaning something different there:
modality `conditioning` is *a movement that is sustained cardio-effort work*, focus
`conditioning` is *a program that buys work capacity*. A dense circuit of presses is
focus-conditioning but modality-grind. Nothing about that is wrong in the database,
but the two must never appear as bare, indistinguishable tag lists in one prompt.

Fixed at the **rendering layer only**, no migration
(`supabase/functions/_shared/modalityPrompt.ts`): modality sections are labelled
"movement mix" and render `conditioning` as **cardio** (matching the UI's
`MODALITY_LABELS`), while focus tags are labelled "trains for". `modalityWord()` is
the single chokepoint — route any new modality rendering through it.

## Program modality profiles

Programs carry a modality profile derived from the movements their sessions
prescribe, *not* stored editorially and *not* derived from `focus_tags`. The two
program axes are independent: Simple & Sinister and the 10,000 Swing Challenge are
both swing-dominant (`ballistic + conditioning`) yet sit at opposite ends of the
focus and demand axes, so neither predicts the other.

- SQL (`program_modality_movements()`) is a pure aggregation: one row per
  `(program_id, modality)` with an occurrence count.
- `src/utils/programModality.ts` turns those into an ordered profile, keeping
  modalities at or above `PROFILE_MIN_SHARE` (0.2) of a program's matched credits,
  so one mobility drill in a twenty-session strength program is not mistaken for
  what the program trains.

`workout_options` identifies movements by **name**, with no FK into the catalog, so
the join is an exact match on `movements."Movement"` — the same join the enroll
RPC's `movement_modal` CTE uses. That is why seeded programs must spell
`movementName` exactly as `scripts/data/movements.csv` does. An unmatched name
contributes nothing and the program's profile comes back empty, which renders as no
claim at all.

**Caveat:** catalog rows added by migration rather than from the CSV (the ab-wheel
and march/Pallof additions) have NULL `modality_credits` and so pay no modality
credit anywhere — neither in the balance nor in a program profile — until they are
backfilled.

The layering rule is unchanged: SQL is a pure aggregation; attribution and
scoring live in TypeScript (`src/utils/modalityDebt.ts` +
`modalityDebt.test.ts`). Change this doc first, then keep the implementation and
tests in sync. UI vocabulary: "Training Mix" / "Balance", never "debt".
