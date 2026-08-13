-- Max rungs, and per-set actuals.
--
-- Two gaps, one root: the client only ever persisted the PLAN. `rep_scheme` is
-- the prescription and `workout_logs.completed_reps` is a single aggregate the
-- runner derives from it, so a set taken to failure had no number to record and
-- a set that fell short of its rung was logged as if it hadn't.
--
-- A rung of 0 now means "to failure" — max reps, or max time on a timed
-- movement. It rides inside `rep_scheme` rather than a per-movement flag so a
-- ladder can mix prescribed rungs with a max one: {1,2,3,4,5,0} or {15,30,45,0}.
-- Zero reps is not a set anyone programs, so the value is free as a sentinel and
-- no column is needed to carry it.
--
-- `completed_rep_scheme` is the actuals record: one entry per set actually
-- completed, in completion order, in the same unit `rep_scheme` uses for that
-- movement (reps, or seconds when `timed_rungs`). It spans every round and
-- mirrored side, so it is NOT index-aligned with `rep_scheme`. Null on every
-- pre-existing row, which is the honest "we never captured this."

ALTER TABLE public.movement_logs
  ADD COLUMN completed_rep_scheme smallint[];

COMMENT ON COLUMN public.movement_logs.completed_rep_scheme IS
  'What was actually done, one entry per completed set in order, in the same unit as rep_scheme. Spans all rounds and sides, so not index-aligned with rep_scheme. Null for rows written before this was captured.';

COMMENT ON COLUMN public.movement_logs.rep_scheme IS
  'The prescription, one entry per rung. Reps, or seconds when timed_rungs. A 0 rung means "to failure" — the magnitude lands in completed_rep_scheme instead.';

-- ---------------------------------------------------------------------------
-- pattern_debt_movements: score off what was actually done, when we have it.
--
-- The function derives a movement's reps and volume from `rep_scheme` — one
-- ladder pass — scaled by `completed_rounds` and doubled for mirrored work. That
-- is a solid estimate when every rung is prescribed, but it now has a hole: a
-- max rung is stored as 0, so a set taken to failure would score as zero reps
-- and zero volume, and the recommender would read the hardest work in the
-- session as no work at all.
--
-- `completed_rep_scheme` closes it and is strictly better besides. It already
-- holds every set across every round and side, so it is summed directly with NO
-- passes multiplier — and because it records only sets that actually happened, a
-- workout cut short stops being scored as if it ran to completion. Rows written
-- before this migration have no actuals, so they keep the estimate.
--
-- Body is otherwise unchanged from
-- 20260805010000_split_shared_bell_from_workout_mode.sql.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pattern_debt_movements(
  p_window_days int DEFAULT 14,
  p_baseline_days int DEFAULT 84
)
RETURNS TABLE (
  movement_id uuid,
  movement_name text,
  pattern_credits text[],
  last_trained_at timestamptz,
  set_count bigint,
  total_reps bigint,
  total_volume_kg numeric,
  baseline_volume_kg numeric,
  hardest_rpe "RPE"
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH logs AS (
    SELECT
      m.id AS movement_id,
      ml.movement_name,
      m.pattern_credits,
      ml.created_at,
      effort.total_reps,
      effort.set_count,
      -- Session RPE inherited onto each movement it logged; hardest wins below.
      w.rpe,
      -- Volume normalized to kilograms; bodyweight / null weight contributes 0.
      -- Timed rungs hold seconds, so they contribute no volume.
      CASE WHEN ml.timed_rungs THEN 0 ELSE
        effort.total_reps * (
          CASE
            WHEN eff.weight_one_unit = 'pounds' THEN COALESCE(eff.weight_one_value, 0) * 0.45359237
            ELSE COALESCE(eff.weight_one_value, 0)
          END
          + CASE
            WHEN eff.weight_two_unit = 'pounds' THEN COALESCE(eff.weight_two_value, 0) * 0.45359237
            ELSE COALESCE(eff.weight_two_value, 0)
          END
        )
      END AS volume_kg
    FROM movement_logs ml
    LEFT JOIN workout_logs w ON w.id = ml.workout_log_id
    LEFT JOIN user_movements um ON um.id = ml.user_movement_id
    LEFT JOIN movements m ON m.id = um.functional_movement_id
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN ml.timed_rungs THEN 0 ELSE COALESCE(SUM(r), 0) END::bigint AS total_reps,
        COALESCE(COUNT(r), 0)::bigint AS set_count
      FROM unnest(ml.rep_scheme) AS r
    ) planned
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN ml.timed_rungs THEN 0 ELSE COALESCE(SUM(r), 0) END::bigint AS total_reps,
        COALESCE(COUNT(r), 0)::bigint AS set_count
      FROM unnest(COALESCE(ml.completed_rep_scheme, '{}'::smallint[])) AS r
    ) actual
    CROSS JOIN LATERAL (
      -- A shared-bell workout loads one weight; prefer it over the per-movement
      -- copy so pre-backfill / stale rows still report the weight actually used.
      -- Falls back to complex_set for rows written before the axes split.
      SELECT
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) THEN COALESCE(w.shared_weight_one_value::numeric, ml.weight_one_value) ELSE ml.weight_one_value END AS weight_one_value,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) THEN COALESCE(w.shared_weight_one_unit, ml.weight_one_unit) ELSE ml.weight_one_unit END AS weight_one_unit,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_value::numeric ELSE ml.weight_two_value END AS weight_two_value,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_unit ELSE ml.weight_two_unit END AS weight_two_unit
    ) eff
    CROSS JOIN LATERAL (
      -- One ladder pass scaled by completed rounds, doubled for one-handed
      -- (weight_two = 0) and mixed-weight movements, whose rungs mirror
      -- left/right — the client's shouldMirrorReps rule.
      SELECT
        GREATEST(COALESCE(w.completed_rounds, 1), 1)::bigint
        * CASE
            WHEN COALESCE(eff.weight_one_value, 0) > 0
              AND (eff.weight_two_value = 0
                OR (eff.weight_two_value > 0 AND eff.weight_two_value <> eff.weight_one_value))
            THEN 2 ELSE 1
          END AS passes
    ) rounds
    CROSS JOIN LATERAL (
      -- Actuals already span every round and side, so they are summed as-is.
      -- Without them, fall back to the estimate: one pass times the passes made.
      SELECT
        CASE WHEN ml.completed_rep_scheme IS NULL
          THEN planned.total_reps * rounds.passes ELSE actual.total_reps END AS total_reps,
        CASE WHEN ml.completed_rep_scheme IS NULL
          THEN planned.set_count * rounds.passes ELSE actual.set_count END AS set_count
    ) effort
    WHERE ml.user_id = auth.uid()
      AND ml.created_at >= now() - make_interval(days => p_baseline_days)
  )
  SELECT
    l.movement_id,
    l.movement_name,
    l.pattern_credits,
    max(l.created_at) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS last_trained_at,
    COALESCE(sum(l.set_count) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS set_count,
    COALESCE(sum(l.total_reps) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS total_reps,
    COALESCE(round(sum(l.volume_kg) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 2), 0) AS total_volume_kg,
    -- Baseline = the movement's typical per-window volume: total over the
    -- baseline window, scaled down to one window length.
    round(sum(l.volume_kg) * (p_window_days::numeric / GREATEST(p_baseline_days, 1)), 2) AS baseline_volume_kg,
    max(l.rpe) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS hardest_rpe
  FROM logs l
  GROUP BY l.movement_id, l.movement_name, l.pattern_credits;
$$;

-- RLS does the data scoping; only authenticated users may call it.
REVOKE ALL ON FUNCTION public.pattern_debt_movements(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pattern_debt_movements(int, int) TO authenticated;
