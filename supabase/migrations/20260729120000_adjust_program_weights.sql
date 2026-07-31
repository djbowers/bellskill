-- Program Tracking: adjust an active enrollment's weights for all workouts
-- going forward (PROD-237).
--
-- enroll_in_program bakes the enrollee's chosen weights into the cloned
-- program_sessions.workout_options once, at enroll time
-- (20260724000004_enroll_in_program_per_movement_weights.sql). Mid-program the
-- lifter outgrows a bell (or overreached) and needs to move every UPCOMING
-- session to a new working weight without touching what's already logged.
--
-- This RPC re-applies the enroll resolution to the enrollment's own cloned
-- program, scoped to sessions that have no completion row for the enrollment
-- (robust under skips and out-of-order starts):
--
--   * Non-complex sessions with p_movement_weights -> rebuild each movement in
--     its own config shape, offset from that movement's modal across the
--     CLONE's sessions. The clone's weights are the previous choice plus the
--     authored per-session offsets, so recomputing the modal over the clone
--     preserves those offsets (test days stay heavier, deloads lighter) while
--     re-basing on the new working weight.
--   * complexSet sessions, or a caller passing only p_shared_weight_* -> the
--     uniform shared fold, offset from the clone-level modal (movements->0).
--
-- The modal spans ALL of the clone's sessions -- completed and upcoming -- so
-- the picker's pre-fill (client deriveMovementWeights over the same full
-- session list) equals the baseline the fold shifts from. Completed sessions'
-- history lives in workout_logs and is never touched.
--
-- Ownership: the enrollment must belong to the caller and be active. The
-- UPDATE targets the caller's own cloned program (or their own program for a
-- self-authored enrollment); SECURITY INVOKER + the program_sessions owner RLS
-- policy enforce that a second time.
--
-- Returns the number of sessions rewritten.
DROP FUNCTION IF EXISTS public.adjust_program_weights(UUID, NUMERIC, TEXT, NUMERIC, TEXT, JSONB);

CREATE FUNCTION public.adjust_program_weights(
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

  -- Clone-level modal (weightOne, weightTwo) pair, used by the shared-fold
  -- path. Ties break toward the lighter pair, mirroring deriveStartingWeight.
  SELECT one_val, two_val INTO v_modal_one, v_modal_two
  FROM (
    SELECT (workout_options->'movements'->0->>'weightOneValue')::NUMERIC AS one_val,
           (workout_options->'movements'->0->>'weightTwoValue')::NUMERIC AS two_val,
           COUNT(*) AS cnt
    FROM program_sessions
    WHERE program_id = v_program
    GROUP BY one_val, two_val
    ORDER BY cnt DESC, one_val, two_val
    LIMIT 1
  ) modal;

  UPDATE program_sessions ps
  SET workout_options = sub.new_options
  FROM (
    -- Per-movement modal weight across the clone, one row per movement name.
    -- Bodyweight movements (null weight one) never form a modal, so they have
    -- no row and their elements are kept untouched below. Tie-break mirrors
    -- the client's deriveMovementWeights so pre-fill equals the new baseline.
    WITH movement_modal AS (
      SELECT DISTINCT ON (name)
        name, one_val, two_val
      FROM (
        SELECT
          mv->>'movementName' AS name,
          (mv->>'weightOneValue')::NUMERIC AS one_val,
          (mv->>'weightTwoValue')::NUMERIC AS two_val,
          COUNT(*) AS cnt
        FROM program_sessions ps2,
             jsonb_array_elements(ps2.workout_options->'movements') AS mv
        WHERE ps2.program_id = v_program
          AND (mv->>'weightOneValue') IS NOT NULL
        GROUP BY name, one_val, two_val
      ) per_pair
      ORDER BY name, cnt DESC, one_val, two_val
    )
    SELECT
      ps2.id,
      CASE
        -- non-complex with per-movement weights: rebuild each element in its
        -- own config shape, offset from that movement's modal.
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
                       -- Offset only when the movement's cloned unit matches
                       -- the chosen unit; a cross-unit choice passes through
                       -- (delta 0) rather than doing cross-unit arithmetic.
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
        -- complexSet (one bell pair for the whole complex), or a caller that
        -- passed only p_shared_weight_*: the uniform fold. COALESCE(...,
        -- 'null'::jsonb): jsonb_set is strict and to_jsonb(NULL) is SQL NULL,
        -- so an unset slot must be coerced to a JSON null.
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
    -- Per-session shared weight for the fold path: the chosen weight shifted
    -- by this session's offset from the clone modal. A zero delta passes the
    -- chosen value through untouched -- notably it must NOT hit the >= 1
    -- clamp, since a single-bell program carries weight two = 0.
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

REVOKE ALL ON FUNCTION public.adjust_program_weights(UUID, NUMERIC, TEXT, NUMERIC, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_program_weights(UUID, NUMERIC, TEXT, NUMERIC, TEXT, JSONB) TO authenticated;
