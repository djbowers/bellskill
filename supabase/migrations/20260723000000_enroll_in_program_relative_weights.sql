-- Program Tracking: make the enroll starting weight RELATIVE, not modal-only.
--
-- 20260721000001_enroll_in_program_fold_movement_weights.sql folds the
-- enrollee's chosen weight onto every session whose first movement matches the
-- program's *modal* placeholder, and copies every other session verbatim. That
-- leaves a deliberately-different session frozen at its authored absolute load:
--
--   * A+A Protocol "Plan A" authors its deload week one bell size below the
--     working weight. An enrollee starting at 16 kg got a "deload" HEAVIER than
--     their working sets; one starting at 32 kg got a 16 kg cliff.
--   * Dry Fighting Weight's W5D2 test day authors +4 kg over the working load,
--     and stayed at a flat 28 kg no matter what the enrollee picked.
--
-- Fix: override EVERY cloned session, offsetting each weight slot by that
-- session's own authored distance from the modal placeholder. A session
-- authored at the modal weight has delta 0 and clones byte-identically to
-- before; a session authored -8 kg stays -8 kg below whatever the enrollee
-- chose. Passing no weight params is still a verbatim clone.
--
-- Unit handling: a delta is applied only when the session's authored unit for
-- that slot equals the enrollee's chosen unit for that slot. Every seeded
-- program authors kilograms, so the common path offsets correctly; a pounds
-- enrollee falls back to the previous flat override rather than having us
-- invent a converted, non-kettlebell number. The seeds' workoutDetails carry
-- the "go down one bell size" instruction in prose for that case.
--
-- The modal is now the (weightOne, weightTwo) PAIR rather than weight one
-- alone, matching how the client's deriveStartingWeight keys the mode. When a
-- program has no numeric modal at all (bodyweight-first sessions), every delta
-- resolves to 0 and the behavior collapses to the prior flat override of every
-- session -- the same fallback as before, now implicit rather than a branch.
--
-- DROP + CREATE (forward-only, idempotent) mirrors the prior migrations.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID    := auth.uid();
  v_owner_id        UUID;
  v_target_program  UUID;
  v_user_program_id UUID;
  v_modal_one       NUMERIC;
  v_modal_two       NUMERIC;
  v_override        BOOLEAN := p_shared_weight_one_value IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- RLS on this SELECT already restricts to public-or-own; a NOT FOUND result
  -- means the program does not exist or is not visible to the caller.
  SELECT owner_id INTO v_owner_id
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;

  -- Abandon any existing active enrollment (keeps the partial unique index happy).
  UPDATE user_programs
    SET status = 'abandoned'
    WHERE user_id = v_user_id AND status = 'active';

  IF v_owner_id = v_user_id THEN
    v_target_program := p_program_id;                     -- own program: no clone
  ELSE
    INSERT INTO programs
      (owner_id, source_program_id, slug, title, description, author_name,
       num_weeks, days_per_week, is_public)
    SELECT v_user_id, id, NULL, title, description, author_name,
           num_weeks, days_per_week, false
    FROM programs WHERE id = p_program_id
    RETURNING id INTO v_target_program;

    IF v_override THEN
      -- The modal (weightOne, weightTwo) pair across the program's sessions:
      -- the shared placeholder load every deliberately-different session is
      -- offset from. Ties break toward the lighter pair, mirroring
      -- deriveStartingWeight.
      SELECT one_val, two_val INTO v_modal_one, v_modal_two
      FROM (
        SELECT (workout_options->'movements'->0->>'weightOneValue')::NUMERIC AS one_val,
               (workout_options->'movements'->0->>'weightTwoValue')::NUMERIC AS two_val,
               COUNT(*) AS cnt
        FROM program_sessions
        WHERE program_id = p_program_id
        GROUP BY one_val, two_val
        ORDER BY cnt DESC, one_val, two_val
        LIMIT 1
      ) modal;
    END IF;

    INSERT INTO program_sessions
      (program_id, sequence_index, week_number, day_number, title, workout_options, notes)
    SELECT
      v_target_program, ps.sequence_index, ps.week_number, ps.day_number, ps.title,
      CASE
        WHEN NOT v_override THEN ps.workout_options
        -- COALESCE(..., 'null'::jsonb): jsonb_set is strict and to_jsonb(NULL)
        -- is SQL NULL, so an unset slot (e.g. weight two in two-hand loading)
        -- must be coerced to a JSON null or the whole workout_options nulls out.
        --
        -- The outermost jsonb_set rebuilds {movements}, folding the resolved
        -- weight onto every movement (the shape ActiveWorkoutPage / the builder
        -- read for non-complex sessions); the inner four set sharedWeight* (the
        -- complex path). `m || jsonb_build_object(...)` overrides only the four
        -- weight keys, preserving movementName / repScheme / etc.
        ELSE jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       ps.workout_options,
                       '{sharedWeightOneValue}',
                       COALESCE(to_jsonb(w.one_value), 'null'::jsonb)),
                     '{sharedWeightOneUnit}',
                     COALESCE(to_jsonb(p_shared_weight_one_unit), 'null'::jsonb)),
                   '{sharedWeightTwoValue}',
                   COALESCE(to_jsonb(w.two_value), 'null'::jsonb)),
                 '{sharedWeightTwoUnit}',
                 COALESCE(to_jsonb(p_shared_weight_two_unit), 'null'::jsonb)),
               '{movements}',
               (
                 SELECT jsonb_agg(
                          m || jsonb_build_object(
                            'weightOneValue', COALESCE(to_jsonb(w.one_value), 'null'::jsonb),
                            'weightOneUnit',  COALESCE(to_jsonb(p_shared_weight_one_unit),  'null'::jsonb),
                            'weightTwoValue', COALESCE(to_jsonb(w.two_value), 'null'::jsonb),
                            'weightTwoUnit',  COALESCE(to_jsonb(p_shared_weight_two_unit),  'null'::jsonb)
                          )
                        )
                 FROM jsonb_array_elements(ps.workout_options->'movements') AS m
               ))
      END,
      ps.notes
    FROM program_sessions ps
    -- Per-session resolved weights: the enrollee's choice shifted by this
    -- session's authored offset from the modal. A zero delta passes the chosen
    -- value through untouched -- notably it must NOT hit the >= 1 clamp, since a
    -- single-bell enrollment legitimately carries weight two = 0.
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
        END AS two_value
      FROM (
        SELECT
          COALESCE(
            CASE WHEN ps.workout_options->'movements'->0->>'weightOneUnit'
                      IS NOT DISTINCT FROM p_shared_weight_one_unit
                 THEN (ps.workout_options->'movements'->0->>'weightOneValue')::NUMERIC
                      - v_modal_one
            END, 0) AS one_delta,
          COALESCE(
            CASE WHEN ps.workout_options->'movements'->0->>'weightTwoUnit'
                      IS NOT DISTINCT FROM p_shared_weight_two_unit
                 THEN (ps.workout_options->'movements'->0->>'weightTwoValue')::NUMERIC
                      - v_modal_two
            END, 0) AS two_delta
      ) d
    ) w
    WHERE ps.program_id = p_program_id
    ORDER BY ps.sequence_index;
  END IF;

  INSERT INTO user_programs (user_id, program_id, status)
  VALUES (v_user_id, v_target_program, 'active')
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;
