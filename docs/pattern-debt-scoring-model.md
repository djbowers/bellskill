# Pattern Debt Scoring Model

> Spec for **PROD-155** (Pattern Debt Engine). This document is the single source of
> truth for how "pattern debt" is computed. The SQL aggregation
> (`pattern_debt_movements`) and the TypeScript scoring module
> (`src/utils/patternDebt.ts`) both implement what is written here. Change this doc
> first, then keep both implementations and their tests in sync.
>
> Vocabulary: "debt" is internal model language only. User-facing copy says
> **"Balance"** with the bands **On track / Due / Overdue / New** — never "debt"
> or "readiness".

## What it is

A **deterministic** (no-LLM) measure of how overdue each fundamental movement
pattern is for a user, based on their recent training. It powers the free-tier
**Weekly Balance** visualization and is the structured input the AI Next Session
Recommender (PROD-86/87) reasons over — the `pattern_debt` key reserved in
`session_recommendations.inputs`.

## The eight coarse patterns

The movement catalog tags each exercise with a `Movement Pattern #1` value — a
free-`text` column (PROD-153) constrained by a CHECK to the controlled vocabulary
below — plus a `pattern_credits text[]` column naming every coarse pattern the
movement pays credit toward. The engine scores eight patterns:

| Coarse pattern | Source `Movement Pattern` values                                               |
| -------------- | ------------------------------------------------------------------------------ |
| `hinge`        | Hip Hinge, Hip Dominant, Hip Extension                                         |
| `squat`        | Knee Dominant                                                                  |
| `push`         | Vertical Push, Horizontal Push                                                 |
| `pull`         | Vertical Pull, Horizontal Pull                                                 |
| `carry`        | Loaded Carry                                                                   |
| `rotation`     | Rotational, Spinal Rotational                                                  |
| `core`         | Anti-Rotation, Anti-Extension (catalog sub-labels rolling up into one scored pattern) |
| `get_up`       | explicit `pattern_credits` on the get-up catalog rows; _name-based_ fallback (`get-up` / `get up` / `getup` / `turkish`) for movements with no catalog link |

## Multi-pattern credit (boolean, equal)

Each catalog row's `pattern_credits` is a non-empty array drawn from the eight
coarse patterns. A logged movement contributes its **full** aggregates (recency,
sets, reps, volume) to **every** pattern in its credits — boolean equal credit,
no fractional weights, no normalization. Example: the Turkish get-up credits
`{get_up, push, rotation}`, so one TGU session refreshes all three patterns.

Rules:

- For single-pattern movements, `pattern_credits` = the coarse mapping of
  `Movement Pattern #1`.
- **Invariant (CI-enforced by `scripts/ingest-movements.mjs`):** `pattern_credits`
  always contains the coarse mapping of `Movement Pattern #1` (credits ⊇
  coarse(primary)).
- Multi-credit rows are editorial. Today: the four get-up movements credit
  `get_up|push|rotation`. Everything else is single-credit.
- Accepted trade: equal full credit slightly flatters multi-pattern-heavy users'
  spread (a TGU-only user reads more balanced than their training is).

### Attribution lives ONLY in TypeScript

SQL returns raw **per-movement** aggregates and the row's `pattern_credits`.
The shared TS scorer performs all attribution:

1. Row has `pattern_credits` (catalog-linked) → fan out to those patterns.
2. Row has no catalog link (`pattern_credits` null) → if the movement **name**
   matches `get[ -]?up|turkish` (case-insensitive), credit `get_up`; otherwise
   the movement is ignored.

There is deliberately no SQL-side attribution and therefore no SQL/TS parity
test for it. The SQL layer stays a pure aggregation.

## Windows

| Param          | Default | Meaning                                                                              |
| -------------- | ------- | ------------------------------------------------------------------------------------ |
| `windowDays`   | 14      | The "recent" window the debt is computed over.                                       |
| `baselineDays` | 84      | Trailing window (6 × 14d) used to establish each pattern's personal volume baseline. |

Both are configurable arguments to the SQL function so the UI and the recommender
can request different horizons.

> **Known coupling caveat:** the recency component saturates at a fixed
> `OVERDUE_DAYS` (14) regardless of the `windowDays` a caller passes. A caller
> requesting a 7-day window flattens everything trained 8–13 days ago to max
> recency. Do not tune `windowDays` expecting the recency curve to follow;
> window-scaled recency is tracked in TODOS.md.

## Per-movement aggregates (computed in SQL — `pattern_debt_movements`)

The RPC returns one row per distinct movement the user logged inside
`baselineDays` (grouped by `movement_name` + catalog link):

- `movement_id` — catalog `movements.id`, or `null` for unlinked custom movements.
- `movement_name` — the logged name (drives the get-up regex fallback).
- `pattern_credits` — the catalog row's credits array, or `null` when unlinked.
- `last_trained_at` — most recent log **inside `windowDays`**, or `null`.
- `set_count`, `total_reps`, `total_volume_kg` — window aggregates. Volume is
  normalized to kilograms (`pounds × 0.45359237`); complex sets read the
  session's shared weight; both weights count; reps/sets/volume scale by
  completed rounds with the left/right mirroring rule; timed rungs (seconds in
  `rep_scheme`) contribute recency but no reps/volume. Bodyweight / null weight
  contributes `0` volume but still counts toward recency and set/rep counts.
- `baseline_volume_kg` — the movement's typical per-window volume: total volume
  over `baselineDays`, scaled to a single window
  (`Σ volume × windowDays / baselineDays`). `null` when no baseline history.
- `hardest_rpe` — hardest session RPE that included the movement in the window.
- `total_unloaded_reps`, `baseline_unloaded_reps` — the **bodyweight track**:
  reps from non-timed sets whose effective load is zero (both weights null/0
  after the shared-bell rule). Weighted reps never enter this track. Baseline
  scaled like `baseline_volume_kg`.
- `total_seconds`, `baseline_seconds` — the **timed track**: timed-rung seconds
  (`rep_scheme` values × rounds passes). Baseline scaled the same way.

Rollout note: `pattern_debt_movements` is a **new** function; the legacy
7-pattern `pattern_debt_window` stays live until the PWA and both recommender
edge functions migrate, then a cleanup migration drops it (PWA service-worker
client skew makes in-place replacement unsafe).

## Scoring (computed in shared TypeScript — `src/utils/patternDebt.ts`)

Scoring lives in TS, not SQL, so it is unit-testable in this repo's harness and so
the Deno edge functions (recommender) can import the exact same implementation.
The TS layer: attributes each movement row to its patterns (see above), sums the
window and baseline aggregates per pattern, then scores each pattern.

### Constants

```
TARGET_CADENCE_DAYS = 7                       // a pattern is ideally trained ~ every 7 days
OVERDUE_DAYS        = 2 × TARGET_CADENCE_DAYS // recency debt saturates at 2× cadence (derived)
W_RECENCY           = 0.6                     // recency weight
W_VOLUME            = 0.4                     // volume-deficit weight
BAND_YELLOW         = 33                      // debtScore >= 33 -> yellow ("Due")
BAND_RED            = 66                      // debtScore >= 66 -> red  ("Overdue")
BALANCE_SPREAD      = 25                      // max-min debtScore < 25 -> "balanced"
```

`TARGET_CADENCE_DAYS` is the single tunable cadence knob, structured so a future
per-pattern override replaces the scalar with a map (X5).

### Per pattern

**Recency component** (`0..1`):

- Untrained in window (`lastTrainedAt = null`) → `recency = 1`.
- Otherwise `d = daysSince(lastTrainedAt)` and `recency = clamp(d / OVERDUE_DAYS, 0, 1)`.

**Work-deficit component** (`0..1`) — three tracks so bodyweight and timed
work pay down debt like loaded kilograms:

| Track     | Recent               | Baseline                 |
| --------- | -------------------- | ------------------------ |
| kg        | `totalVolumeKg`      | `baselineVolumeKg`       |
| reps      | `totalUnloadedReps`  | `baselineUnloadedReps`   |
| seconds   | `totalSeconds`       | `baselineSeconds`        |

- Each track with a **positive baseline** contributes
  `d = clamp(1 - recent / baseline, 0, 1)`.
- `deficit` = the **unweighted mean** of contributing tracks (units are
  incomparable, so no magnitude weighting; `min` would let one track mask
  neglect in another).
- No track has a baseline:
  - any recent activity on any track → `deficit = 0` (a new but active pattern isn't "in debt").
  - otherwise → `deficit = 1`.

Because weighted reps never enter the rep track, pure-weighted patterns have
rep/second baselines of exactly 0 and this reduces to the original kg-only
formula — worked examples 1–4 below are unchanged.

**Debt score** (`0..100`, integer):

```
debtScore = round(100 × (W_RECENCY × recency + W_VOLUME × deficit))
```

**Band:** `green` if `< BAND_YELLOW`, `yellow` if `< BAND_RED`, else `red`.
User-facing: On track / Due / Overdue.

### New-pattern grace state

A pattern with **zero contributing rows in the entire baseline window** is
`isNew: true`. New patterns render a neutral **"New"** state (never a red bar)
and are **excluded** from the spread / overall-balance computation until first
trained. This covers both brand-new users' untouched patterns after cold start
and taxonomy additions (e.g. `core`'s debut for existing users).

### Enabled patterns

`computePatternBalance(rows, now, enabledPatterns = PATTERNS)` accepts the set of
patterns to score. Disabled patterns (Phase 2 per-user preference) are omitted
from the result and from spread/overallBalance. Forward-compatible seam; today
all eight are enabled.

### Overall balance

Across the **enabled, non-New** patterns, let `spread = max(debtScore) − min(debtScore)`:

- `spread < BALANCE_SPREAD` → `'balanced'`.
- otherwise → `` `${pattern}-heavy` `` for the pattern with the **lowest** debt
  (the one trained most recently / heaviest is the one the user is skewed toward).

## Edge cases

- **No history at all** — every pattern is `isNew`; `overallBalance` is
  `'balanced'`. The UI does not show balance for users with `< 3` logged
  workouts; it shows the cold-start empty state instead (handled in the component
  via workout count, not here).
- **Single-pattern user** — the trained pattern scores low, untouched patterns
  are New (excluded); patterns with older history score high, yielding a clear
  `'{pattern}-heavy'` once more than one pattern has history.
- **New-but-active pattern** (volume, no baseline) — recency drives the score,
  volume deficit is neutral (`0`).
- **Unlinked custom movement** — no catalog credits; get-up-named movements
  credit `get_up`, everything else is ignored (absent from Balance).

## Worked examples

Assume `now` such that a log "5 days ago" means `d = 5`. Encoded as tests in
`src/utils/patternDebt.test.ts` (regression suite — these values must not drift).

1. **Trained 2 days ago, at baseline volume** → `recency = 2/14 = 0.143`,
   `deficit = 0` → `debtScore = round(100 × 0.6 × 0.143) = 9` → `green`.
2. **Trained 10 days ago, half of baseline volume** → `recency = 10/14 = 0.714`,
   `deficit = 0.5` → `100 × (0.6×0.714 + 0.4×0.5) = round(42.86 + 20) = 63` → `yellow`.
3. **Never trained in window, with baseline history** → `recency = 1`,
   `deficit = 1` → `debtScore = 100` → `red`. (Without any baseline history the
   pattern is `isNew` instead — grace state, not red.)
4. **One TGU session 2 days ago at baseline volume** → `get_up`, `push`, and
   `rotation` each score as example 1; no phantom rotation debt.
5. **Bodyweight-only pattern, trained 10 days ago at half its rep baseline**
   (200 recent / 400 baseline reps, 0 kg) → same math as example 2 on the rep
   track → `debtScore = 63` → `yellow`. (Previously pinned at ~44 forever.)
6. **Timed-only pattern (plank), trained 2 days ago at half its seconds
   baseline** (60/120 s) → `recency = 2/14`, `deficit = 0.5` → `debtScore = 29`.
7. **Mixed kg + bodyweight, trained today, kg at half baseline, reps at
   baseline** → deficits `0.5` (kg) and `0` (reps), mean `0.25` →
   `debtScore = 10`.
