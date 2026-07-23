-- Timed movements (PROD-200): carries, planks, and marches are prescribed in
-- seconds, not reps. Rather than a parallel duration array -- which would have to
-- be threaded through workout_options JSONB, movement_logs.rep_scheme,
-- workout_logs.rep_scheme, pattern_debt_window, the rung/round runtime, the
-- builder ladder UI, and every program seed -- a timed movement reuses
-- `rep_scheme` and reinterprets each entry as SECONDS. Rung structure (ladders,
-- rounds, mirrored sides, complex alternation) is identical either way; only the
-- unit of the magnitude changes.
--
-- Existing rows are all rep-based, so the `false` default is correct history and
-- no backfill is needed.

ALTER TABLE public.movement_logs
  ADD COLUMN timed_rungs boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.movement_logs.timed_rungs IS
  'When true, each rep_scheme entry is a duration in seconds rather than a rep count.';

-- Timed rungs must not pollute rep/volume aggregates. `rep_scheme` for a timed
-- carry holds seconds, so the existing `total_reps * weight` product would report
-- a 2x120s carry at 24 kg as 5,760 kg against the carry pattern and swamp every
-- real lift in the recommender's baseline.
--
-- Timed rows still contribute `set_count` and `last_trained_at` -- "you carried
-- three times this week, most recently Tuesday" stays true and is what the
-- staleness half of the debt score reads. Only the two magnitude columns
-- (total_reps, volume_kg) are zeroed, because seconds and reps are not
-- commensurable and there is no honest way to add them.
--
-- Body is otherwise unchanged from 20260624000000_create_pattern_debt_function.sql.
CREATE OR REPLACE FUNCTION public.pattern_debt_window(
  p_window_days int DEFAULT 14,
  p_baseline_days int DEFAULT 84
)
RETURNS TABLE (
  pattern text,
  last_trained_at timestamptz,
  set_count bigint,
  total_reps bigint,
  total_volume_kg numeric,
  baseline_volume_kg numeric
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
      CASE WHEN ml.timed_rungs THEN 0 ELSE reps.total_reps END AS total_reps,
      reps.set_count,
      -- Volume normalized to kilograms; bodyweight / null weight contributes 0.
      CASE WHEN ml.timed_rungs THEN 0 ELSE reps.total_reps END * CASE
        WHEN ml.weight_one_unit = 'pounds' THEN COALESCE(ml.weight_one_value, 0) * 0.45359237
        ELSE COALESCE(ml.weight_one_value, 0)
      END AS volume_kg
    FROM movement_logs ml
    LEFT JOIN user_movements um ON um.id = ml.user_movement_id
    LEFT JOIN movements m ON m.id = um.functional_movement_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(r), 0)::bigint AS total_reps,
        COALESCE(COUNT(r), 0)::bigint AS set_count
      FROM unnest(ml.rep_scheme) AS r
    ) reps
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
    END AS baseline_volume_kg
  FROM patterns p
  LEFT JOIN logs l ON l.pattern = p.pattern
  GROUP BY p.pattern;
$$;

REVOKE ALL ON FUNCTION public.pattern_debt_window(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pattern_debt_window(int, int) TO authenticated;
