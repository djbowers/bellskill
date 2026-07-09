# Pattern Debt Scoring Model

> Spec for **PROD-155** (Pattern Debt Engine). This document is the single source of
> truth for how "pattern debt" is computed. The SQL aggregation
> (`pattern_debt_window`) and the TypeScript scoring module
> (`src/utils/patternDebt.ts`) both implement what is written here. Change this doc
> first, then keep both implementations and their tests in sync.

## What it is

A **deterministic** (no-LLM) measure of how overdue each fundamental movement
pattern is for a user, based on their recent training. It powers the free-tier
**Weekly Balance** visualization and is the structured input the AI Next Session
Recommender (PROD-86/87) reasons over — the `pattern_debt` key reserved in
`session_recommendations.inputs`.

## The seven coarse patterns

The movement catalog tags each exercise with a `Movement Pattern #1` value — a
free-`text` column (PROD-153) constrained by a CHECK to the controlled vocabulary
below. The engine collapses those into the seven patterns a lifter actually
programs around:

| Coarse pattern | Source `Movement Pattern` values |
| --- | --- |
| `hinge`    | Hip Hinge, Hip Dominant, Hip Extension |
| `squat`    | Knee Dominant |
| `push`     | Vertical Push, Horizontal Push |
| `pull`     | Vertical Pull, Horizontal Pull |
| `carry`    | Loaded Carry |
| `rotation` | Rotational, Spinal Rotational |
| `get_up`   | *name-based* — movement name matches `get-up` / `get up` / `getup` / `turkish` |

`get_up` is detected by name because the Turkish get-up is a complex/combo
movement, not a single catalog pattern. Name detection is checked **first**; if a
movement is a get-up it is bucketed there, otherwise it falls through to the
pattern mapping (using `Movement Pattern #1`). Movements that map to no coarse
pattern are ignored. The slim catalog keeps only `Movement Pattern #1` — the
`#2`/`#3` columns were dropped (PROD-153).

## Windows

| Param | Default | Meaning |
| --- | --- | --- |
| `windowDays`   | 14 | The "recent" window the debt is computed over. |
| `baselineDays` | 84 | Trailing window (6 × 14d) used to establish each pattern's personal volume baseline. |

Both are configurable arguments to the SQL function so the UI and the recommender
can request different horizons.

## Per-pattern aggregates (computed in SQL)

For each of the seven patterns, over `windowDays`:

- `lastTrainedAt` — most recent `movement_logs.created_at`, or `null` if untrained in the window.
- `setCount` — number of sets (sum of `cardinality(rep_scheme)` across logs).
- `totalReps` — sum of every rep across every set's `rep_scheme`.
- `totalVolumeKg` — `Σ (reps × weightOneKg)`, where weight is normalized to
  kilograms (`pounds × 0.45359237`). Bodyweight / null weight contributes `0`
  volume but still counts toward recency and set/rep counts.
- `baselineVolumeKg` — the user's typical per-window volume for the pattern:
  total volume over `baselineDays`, scaled to a single window
  (`Σ volume over baselineDays × windowDays / baselineDays`). `null` when there is
  no baseline history.

The function always returns exactly seven rows (one per coarse pattern), even when
a pattern has zero activity — untrained patterns come back with `null`/`0`
aggregates rather than being absent.

## Scoring (computed in shared TypeScript — `src/utils/patternDebt.ts`)

Scoring lives in TS, not SQL, so it is unit-testable in this repo's harness and so
the Deno edge function (recommender) can import the exact same implementation. The
SQL layer stays a pure, fast aggregation.

### Constants

```
TARGET_CADENCE_DAYS = 7     // a pattern is ideally trained ~ every 7 days
OVERDUE_DAYS        = 14    // recency debt saturates at 2× cadence
W_RECENCY           = 0.6   // recency weight
W_VOLUME            = 0.4   // volume-deficit weight
BAND_YELLOW         = 33    // debtScore >= 33 -> yellow ("due")
BAND_RED            = 66    // debtScore >= 66 -> red  ("overdue")
BALANCE_SPREAD      = 25    // max-min debtScore < 25 -> "balanced"
```

### Per pattern

**Recency component** (`0..1`):

- Untrained in window (`lastTrainedAt = null`) → `recency = 1`.
- Otherwise `d = daysSince(lastTrainedAt)` and `recency = clamp(d / OVERDUE_DAYS, 0, 1)`.

**Volume-deficit component** (`0..1`):

- No baseline (`baselineVolumeKg` null or 0):
  - trained this window (`totalVolumeKg > 0`) → `deficit = 0` (a new but active pattern isn't "in debt").
  - otherwise → `deficit = 1`.
- With a baseline → `deficit = clamp(1 - totalVolumeKg / baselineVolumeKg, 0, 1)`.

**Debt score** (`0..100`, integer):

```
debtScore = round(100 × (W_RECENCY × recency + W_VOLUME × deficit))
```

**Band:** `green` if `< BAND_YELLOW`, `yellow` if `< BAND_RED`, else `red`.

### Overall balance

Across the seven patterns, let `spread = max(debtScore) − min(debtScore)`:

- `spread < BALANCE_SPREAD` → `'balanced'`.
- otherwise → `` `${pattern}-heavy` `` for the pattern with the **lowest** debt
  (the one trained most recently / heaviest is the one the user is skewed toward).

## Edge cases

- **No history at all** — every pattern scores 100 and ties, so `overallBalance`
  is `'balanced'`. The UI does not show balance for users with `< 3` logged
  workouts; it shows the cold-start empty state instead (handled in the component
  via workout count, not here).
- **Single-pattern user** — the trained pattern scores low, the other six score
  high, yielding a clear `'{pattern}-heavy'`.
- **New-but-active pattern** (volume, no baseline) — recency drives the score,
  volume deficit is neutral (`0`).

## Worked examples

Assume `now` such that a log "5 days ago" means `d = 5`. Encoded as tests in
`src/utils/patternDebt.test.ts`.

1. **Trained 2 days ago, at baseline volume** → `recency = 2/14 = 0.143`,
   `deficit = 0` → `debtScore = round(100 × 0.6 × 0.143) = 9` → `green`.
2. **Trained 10 days ago, half of baseline volume** → `recency = 10/14 = 0.714`,
   `deficit = 0.5` → `100 × (0.6×0.714 + 0.4×0.5) = round(42.86 + 20) = 63` → `yellow`.
3. **Never trained in window, no baseline** → `recency = 1`, `deficit = 1` →
   `debtScore = 100` → `red`.
