-- Surface a per-pattern exertion read for the Weekly Balance panel's RPE dot.
--
-- RPE lives on workout_logs (session-level), while pattern debt aggregates
-- movement_logs. We inherit each session's rpe onto every pattern it trained and
-- return the hardest such rating over the recent window — an informational cue
-- only. Scoring (debtScore/band/overallBalance) is unchanged; hardest_rpe is not
-- an input to the model (see docs/pattern-debt-scoring-model.md).
--
-- max() over the "RPE" enum returns the hardest rating because the enum is
-- declared noEffort < easy < ideal < hard < maxEffort.

-- RETURNS TABLE is part of the signature, so the column addition needs a drop.
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
      reps.total_reps,
      reps.set_count,
      -- Session RPE inherited onto each movement it logged; hardest wins below.
      w.rpe,
      -- Volume normalized to kilograms; bodyweight / null weight contributes 0.
      reps.total_reps * CASE
        WHEN ml.weight_one_unit = 'pounds' THEN COALESCE(ml.weight_one_value, 0) * 0.45359237
        ELSE COALESCE(ml.weight_one_value, 0)
      END AS volume_kg
    FROM movement_logs ml
    LEFT JOIN workout_logs w ON w.id = ml.workout_log_id
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
