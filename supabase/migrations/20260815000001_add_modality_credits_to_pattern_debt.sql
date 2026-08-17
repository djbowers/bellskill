-- Modality debt Phase 1: expose modality_credits through the debt RPC.
--
-- Recreates pattern_debt_movements with a modality_credits output column so
-- one aggregation serves both the pattern and modality scorers. Body is
-- otherwise identical to the 20260805010000_split_shared_bell_from_workout_mode
-- recreation (the current version, with the shared-bell weight rule);
-- attribution stays in the TS scorers (src/utils/patternDebt.ts,
-- src/utils/modalityDebt.ts).

DROP FUNCTION IF EXISTS public.pattern_debt_movements(int, int);

CREATE FUNCTION public.pattern_debt_movements(
  p_window_days int DEFAULT 14,
  p_baseline_days int DEFAULT 84
)
RETURNS TABLE (
  movement_id uuid,
  movement_name text,
  pattern_credits text[],
  modality_credits text[],
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
      m.modality_credits,
      ml.created_at,
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
    WHERE ml.user_id = auth.uid()
      AND ml.created_at >= now() - make_interval(days => p_baseline_days)
  )
  SELECT
    l.movement_id,
    l.movement_name,
    l.pattern_credits,
    l.modality_credits,
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
  GROUP BY l.movement_id, l.movement_name, l.pattern_credits, l.modality_credits;
$$;

-- RLS does the data scoping; only authenticated users may call it.
REVOKE ALL ON FUNCTION public.pattern_debt_movements(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pattern_debt_movements(int, int) TO authenticated;
