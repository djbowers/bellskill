-- adjust_program_weights: label-aware working-weight modal (A+A deload / DFW
-- test day).
--
-- The previous modal spanned EVERY clone session. After a mid-program adjust,
-- completed rows keep the old absolute load and can outvote rebased upcoming
-- work on a short program (A+A: 6 work + 2 deload), so a later Adjust
-- double-applies deltas. A naive "incomplete only" modal would instead flatten
-- A+A week 4: once only deload sessions remain, the deload load becomes the
-- mode and chosen + 0 wipes the -8 kg offset.
--
-- Working sessions are those with weight_label IS NULL. Labeled groups
-- ('Deload weeks', 'Test day', snatch light/medium/heavy) are offset groups.
-- Modal session set (lowest tier that has rows):
--   1. Incomplete + unlabeled
--   2. Any unlabeled (completed work — A+A deload-week case)
--   3. Incomplete (all-labeled programs; unlabeled-only programs hit tier 1)
--
-- Prefill on AdjustWeightsDialog uses the same rule via selectWeightModalSessions.
-- Offset math, completed-session exclusion, unit mismatch, and clamps are unchanged.
CREATE OR REPLACE FUNCTION public.adjust_program_weights(
  p_user_program_id         UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL,
  p_movement_weights        JSONB   DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_program   UUID;
  v_modal_one NUMERIC;
  v_modal_two NUMERIC;
  v_updated   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_shared_weight_one_value IS NULL AND p_movement_weights IS NULL THEN
    RAISE EXCEPTION 'No weights provided';
  END IF;

  SELECT program_id INTO v_program
  FROM user_programs
  WHERE id = p_user_program_id
    AND user_id = v_user_id
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active enrollment % for this user', p_user_program_id;
  END IF;

  -- Shared-fold modal from the label-aware working baseline. Ties break toward
  -- the lighter pair, mirroring deriveStartingWeight / selectWeightModalSessions.
  WITH ranked AS (
    SELECT
      ps.workout_options,
      CASE
        WHEN ps.weight_label IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM program_session_completions c
               WHERE c.user_program_id = p_user_program_id
                 AND c.program_session_id = ps.id
             )
          THEN 1
        WHEN ps.weight_label IS NULL
          THEN 2
        WHEN NOT EXISTS (
               SELECT 1 FROM program_session_completions c
               WHERE c.user_program_id = p_user_program_id
                 AND c.program_session_id = ps.id
             )
          THEN 3
        ELSE NULL
      END AS tier
    FROM program_sessions ps
    WHERE ps.program_id = v_program
  ),
  baseline AS (
    SELECT r.workout_options
    FROM ranked r
    WHERE r.tier = (SELECT MIN(tier) FROM ranked WHERE tier IS NOT NULL)
  )
  SELECT one_val, two_val INTO v_modal_one, v_modal_two
  FROM (
    SELECT (workout_options->'movements'->0->>'weightOneValue')::NUMERIC AS one_val,
           (workout_options->'movements'->0->>'weightTwoValue')::NUMERIC AS two_val,
           COUNT(*) AS cnt
    FROM baseline
    GROUP BY one_val, two_val
    ORDER BY cnt DESC, one_val, two_val
    LIMIT 1
  ) modal;

  UPDATE program_sessions ps
  SET workout_options = sub.new_options
  FROM (
    -- Same label-aware baseline, then per-movement modal over those sessions.
    WITH ranked AS (
      SELECT
        ps_b.id,
        ps_b.workout_options,
        CASE
          WHEN ps_b.weight_label IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM program_session_completions c
                 WHERE c.user_program_id = p_user_program_id
                   AND c.program_session_id = ps_b.id
               )
            THEN 1
          WHEN ps_b.weight_label IS NULL
            THEN 2
          WHEN NOT EXISTS (
                 SELECT 1 FROM program_session_completions c
                 WHERE c.user_program_id = p_user_program_id
                   AND c.program_session_id = ps_b.id
               )
            THEN 3
          ELSE NULL
        END AS tier
      FROM program_sessions ps_b
      WHERE ps_b.program_id = v_program
    ),
    baseline AS (
      SELECT r.id, r.workout_options
      FROM ranked r
      WHERE r.tier = (SELECT MIN(tier) FROM ranked WHERE tier IS NOT NULL)
    ),
    movement_modal AS (
      SELECT DISTINCT ON (name)
        name, one_val, two_val
      FROM (
        SELECT
          mv->>'movementName' AS name,
          (mv->>'weightOneValue')::NUMERIC AS one_val,
          (mv->>'weightTwoValue')::NUMERIC AS two_val,
          COUNT(*) AS cnt
        FROM baseline b,
             jsonb_array_elements(b.workout_options->'movements') AS mv
        WHERE (mv->>'weightOneValue') IS NOT NULL
        GROUP BY name, one_val, two_val
      ) per_pair
      ORDER BY name, cnt DESC, one_val, two_val
    )
    SELECT
      ps2.id,
      CASE
        WHEN p_movement_weights IS NOT NULL
             AND ps2.workout_options->>'complexSet' IS DISTINCT FROM 'true'
          THEN jsonb_set(
                 ps2.workout_options,
                 '{movements}',
                 (
                   SELECT jsonb_agg(
                            CASE
                              WHEN mw.value IS NULL THEN elem
                              ELSE elem || jsonb_build_object(
                                'weightOneValue',
                                  COALESCE(to_jsonb(
                                    CASE
                                      WHEN (mw.value->>'weightOneValue')::NUMERIC IS NULL
                                        OR r.one_delta = 0
                                        THEN (mw.value->>'weightOneValue')::NUMERIC
                                      ELSE GREATEST((mw.value->>'weightOneValue')::NUMERIC + r.one_delta, 1)
                                    END), 'null'::jsonb),
                                'weightOneUnit',
                                  COALESCE(to_jsonb(mw.value->>'weightOneUnit'), 'null'::jsonb),
                                'weightTwoValue',
                                  COALESCE(to_jsonb(
                                    CASE
                                      WHEN (mw.value->>'weightTwoValue')::NUMERIC IS NULL
                                        OR r.two_delta = 0
                                        THEN (mw.value->>'weightTwoValue')::NUMERIC
                                      ELSE GREATEST((mw.value->>'weightTwoValue')::NUMERIC + r.two_delta, 1)
                                    END), 'null'::jsonb),
                                'weightTwoUnit',
                                  COALESCE(to_jsonb(mw.value->>'weightTwoUnit'), 'null'::jsonb)
                              )
                            END
                            ORDER BY ord
                          )
                   FROM jsonb_array_elements(ps2.workout_options->'movements')
                          WITH ORDINALITY AS e(elem, ord)
                   LEFT JOIN LATERAL (
                     SELECT o.value
                     FROM jsonb_array_elements(p_movement_weights) AS o(value)
                     WHERE o.value->>'movementName' = elem->>'movementName'
                     LIMIT 1
                   ) mw ON TRUE
                   LEFT JOIN movement_modal mm ON mm.name = elem->>'movementName'
                   CROSS JOIN LATERAL (
                     SELECT
                       CASE WHEN elem->>'weightOneUnit'
                                 IS NOT DISTINCT FROM mw.value->>'weightOneUnit'
                            THEN COALESCE((elem->>'weightOneValue')::NUMERIC, 0)
                                 - COALESCE(mm.one_val, 0)
                            ELSE 0 END AS one_delta,
                       CASE WHEN elem->>'weightTwoUnit'
                                 IS NOT DISTINCT FROM mw.value->>'weightTwoUnit'
                            THEN COALESCE((elem->>'weightTwoValue')::NUMERIC, 0)
                                 - COALESCE(mm.two_val, 0)
                            ELSE 0 END AS two_delta
                   ) r
                 ))
        ELSE jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       ps2.workout_options,
                       '{sharedWeightOneValue}',
                       COALESCE(to_jsonb(w.one_value), 'null'::jsonb)),
                     '{sharedWeightOneUnit}',
                     COALESCE(to_jsonb(w.one_unit), 'null'::jsonb)),
                   '{sharedWeightTwoValue}',
                   COALESCE(to_jsonb(w.two_value), 'null'::jsonb)),
                 '{sharedWeightTwoUnit}',
                 COALESCE(to_jsonb(w.two_unit), 'null'::jsonb)),
               '{movements}',
               (
                 SELECT jsonb_agg(
                          m || jsonb_build_object(
                            'weightOneValue', COALESCE(to_jsonb(w.one_value), 'null'::jsonb),
                            'weightOneUnit',  COALESCE(to_jsonb(w.one_unit),  'null'::jsonb),
                            'weightTwoValue', COALESCE(to_jsonb(w.two_value), 'null'::jsonb),
                            'weightTwoUnit',  COALESCE(to_jsonb(w.two_unit),  'null'::jsonb)
                          )
                        )
                 FROM jsonb_array_elements(ps2.workout_options->'movements') AS m
               ))
      END AS new_options
    FROM program_sessions ps2
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN p_shared_weight_one_value IS NULL OR d.one_delta = 0
            THEN p_shared_weight_one_value
          ELSE GREATEST(p_shared_weight_one_value + d.one_delta, 1)
        END AS one_value,
        CASE
          WHEN p_shared_weight_two_value IS NULL OR d.two_delta = 0
            THEN p_shared_weight_two_value
          ELSE GREATEST(p_shared_weight_two_value + d.two_delta, 1)
        END AS two_value,
        p_shared_weight_one_unit AS one_unit,
        p_shared_weight_two_unit AS two_unit
      FROM (
        SELECT
          COALESCE(
            CASE WHEN ps2.workout_options->'movements'->0->>'weightOneUnit'
                      IS NOT DISTINCT FROM p_shared_weight_one_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightOneValue')::NUMERIC
                      - v_modal_one
            END, 0) AS one_delta,
          COALESCE(
            CASE WHEN ps2.workout_options->'movements'->0->>'weightTwoUnit'
                      IS NOT DISTINCT FROM p_shared_weight_two_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightTwoValue')::NUMERIC
                      - v_modal_two
            END, 0) AS two_delta
      ) d
    ) w
    WHERE ps2.program_id = v_program
      AND NOT EXISTS (
        SELECT 1 FROM program_session_completions c
        WHERE c.user_program_id = p_user_program_id
          AND c.program_session_id = ps2.id
      )
  ) sub
  WHERE ps.id = sub.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
