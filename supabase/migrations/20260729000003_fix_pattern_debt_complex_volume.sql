-- Complex-set workouts kept two weight stores: the shared weight the user edits
-- on workout_logs, and per-movement weights on movement_logs that could go
-- stale (the builder hides them in complex mode). Volume math read the stale
-- per-movement value. The client now syncs shared weight onto movements at
-- start time; this migration repairs existing rows and makes
-- pattern_debt_window compute volume the same way the client does.

-- 1) Backfill: copy the session's shared weight onto complex-set movement rows.
UPDATE movement_logs ml
SET
  weight_one_value = w.shared_weight_one_value,
  weight_one_unit = w.shared_weight_one_unit,
  weight_two_value = w.shared_weight_two_value,
  weight_two_unit = w.shared_weight_two_unit
FROM workout_logs w
WHERE w.id = ml.workout_log_id
  AND w.complex_set
  AND w.shared_weight_one_value IS NOT NULL
  AND (
    ml.weight_one_value IS DISTINCT FROM w.shared_weight_one_value
    OR ml.weight_one_unit IS DISTINCT FROM w.shared_weight_one_unit
    OR ml.weight_two_value IS DISTINCT FROM w.shared_weight_two_value
    OR ml.weight_two_unit IS DISTINCT FROM w.shared_weight_two_unit
  );

-- 2) Backfill: recompute completed_volume for complex-set sessions from the
-- now-correct movement weights. Whole-rounds approximation: reps per ladder
-- pass x completed rounds (partial final rounds are floored). One-handed
-- (weight_two = 0) and mixed-weight movements mirror each rung left/right, so
-- one round contributes two passes — the client's shouldMirrorReps rule.
WITH recomputed AS (
  SELECT
    ml.workout_log_id,
    round(
      GREATEST(COALESCE(w.completed_rounds, 1), 1)
      * SUM(
          CASE WHEN ml.timed_rungs THEN 0 ELSE
            (SELECT COALESCE(SUM(r), 0) FROM unnest(ml.rep_scheme) AS r)
            * CASE
                WHEN COALESCE(ml.weight_one_value, 0) > 0
                  AND (ml.weight_two_value = 0
                    OR (ml.weight_two_value > 0 AND ml.weight_two_value <> ml.weight_one_value))
                THEN 2 ELSE 1
              END
            * (
                CASE
                  WHEN ml.weight_one_unit = 'pounds' THEN COALESCE(ml.weight_one_value, 0) * 0.45359237
                  ELSE COALESCE(ml.weight_one_value, 0)
                END
                + CASE
                  WHEN ml.weight_two_unit = 'pounds' THEN COALESCE(ml.weight_two_value, 0) * 0.45359237
                  ELSE COALESCE(ml.weight_two_value, 0)
                END
              )
          END
        )
    ) AS volume
  FROM movement_logs ml
  JOIN workout_logs w ON w.id = ml.workout_log_id
  WHERE w.complex_set
    AND w.shared_weight_one_value IS NOT NULL
  GROUP BY ml.workout_log_id, w.completed_rounds
)
UPDATE workout_logs w
SET completed_volume = recomputed.volume
FROM recomputed
WHERE w.id = recomputed.workout_log_id
  AND w.completed_volume IS DISTINCT FROM recomputed.volume;

-- 3) Fix pattern_debt_window's volume model:
--    * complex sets read the session's shared weight (stale-row safety even
--      after the backfill above);
--    * weight_two counts (double-bell work was halved);
--    * reps/sets/volume scale by completed rounds instead of one ladder pass;
--    * timed rungs (rep_scheme holds seconds) contribute no reps or volume,
--      matching the client accumulator.

DROP FUNCTION IF EXISTS public.pattern_debt_window(int, int);

CREATE FUNCTION public.pattern_debt_window(
  p_window_days int DEFAULT 14,
  p_baseline_days int DEFAULT 84
)
RETURNS TABLE (
  pattern text,
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
  WITH patterns(pattern) AS (
    VALUES ('hinge'), ('squat'), ('push'), ('pull'), ('carry'), ('rotation'), ('get_up')
  ),
  logs AS (
    SELECT
      ml.created_at,
      -- Collapse the catalog's granular Movement Pattern into a coarse bucket.
      -- get-ups are detected by name (complex/combo movement, not a single tag)
      -- and take precedence; everything else maps from Movement Pattern #1.
      CASE
        WHEN ml.movement_name ~* '(get[ -]?up|turkish)' THEN 'get_up'
        WHEN m."Movement Pattern #1" IN ('Hip Hinge', 'Hip Dominant', 'Hip Extension') THEN 'hinge'
        WHEN m."Movement Pattern #1" = 'Knee Dominant' THEN 'squat'
        WHEN m."Movement Pattern #1" IN ('Vertical Push', 'Horizontal Push') THEN 'push'
        WHEN m."Movement Pattern #1" IN ('Vertical Pull', 'Horizontal Pull') THEN 'pull'
        WHEN m."Movement Pattern #1" = 'Loaded Carry' THEN 'carry'
        WHEN m."Movement Pattern #1" IN ('Rotational', 'Spinal Rotational') THEN 'rotation'
        ELSE NULL
      END AS pattern,
      reps.total_reps * rounds.passes AS total_reps,
      reps.set_count * rounds.passes AS set_count,
      -- Session RPE inherited onto each movement it logged; hardest wins below.
      w.rpe,
      -- Volume normalized to kilograms; bodyweight / null weight contributes 0.
      -- Timed rungs hold seconds in rep_scheme, so they contribute no volume.
      CASE WHEN ml.timed_rungs THEN 0 ELSE
        reps.total_reps * rounds.passes * (
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
    ) reps
    CROSS JOIN LATERAL (
      -- Complex sets load one shared weight; prefer it over the per-movement
      -- copy so pre-backfill / stale rows still report the weight actually used.
      -- shared_weight_* is double precision; keep the whole volume expression
      -- numeric so round(x, 2) below stays valid.
      SELECT
        CASE WHEN w.complex_set THEN COALESCE(w.shared_weight_one_value::numeric, ml.weight_one_value) ELSE ml.weight_one_value END AS weight_one_value,
        CASE WHEN w.complex_set THEN COALESCE(w.shared_weight_one_unit, ml.weight_one_unit) ELSE ml.weight_one_unit END AS weight_one_unit,
        CASE WHEN w.complex_set AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_value::numeric ELSE ml.weight_two_value END AS weight_two_value,
        CASE WHEN w.complex_set AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_unit ELSE ml.weight_two_unit END AS weight_two_unit
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
    WHERE ml.user_id = auth.uid()
      AND ml.created_at >= now() - make_interval(days => p_baseline_days)
  )
  SELECT
    p.pattern,
    max(l.created_at) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS last_trained_at,
    COALESCE(sum(l.set_count) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS set_count,
    COALESCE(sum(l.total_reps) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS total_reps,
    COALESCE(sum(l.volume_kg) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS total_volume_kg,
    -- Baseline = typical per-window volume: total over the baseline window,
    -- scaled down to one window length. NULL when there is no baseline history.
    CASE
      WHEN sum(l.volume_kg) IS NULL THEN NULL
      ELSE round(sum(l.volume_kg) * (p_window_days::numeric / p_baseline_days), 2)
    END AS baseline_volume_kg,
    -- Hardest exertion rating across sessions that trained the pattern in the
    -- recent window; NULL when untrained or unrated.
    max(l.rpe) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS hardest_rpe
  FROM patterns p
  LEFT JOIN logs l ON l.pattern = p.pattern
  GROUP BY p.pattern;
$$;

-- RLS does the data scoping; only authenticated users may call it.
REVOKE ALL ON FUNCTION public.pattern_debt_window(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pattern_debt_window(int, int) TO authenticated;
