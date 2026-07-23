-- Program Tracking: let the enrollee set each weight group explicitly.
--
-- 20260723000000_enroll_in_program_relative_weights.sql derives every
-- non-modal session's load by shifting the chosen working weight by that
-- session's authored offset -- A+A's deload lands 8 kg below, DFW's test day
-- 4 kg above. That is the right DEFAULT, but it assumes the athlete owns the
-- resulting bell, and kettlebells come in discrete sizes. It also silently
-- declines to offset when the enrollee picks pounds against a kg-authored seed
-- (no cross-unit arithmetic), which drops the relative deload entirely.
--
-- p_weight_overrides lets the client name the exact weight for a group, keyed
-- by the group's AUTHORED (weightOne, weightTwo) pair -- the same key the
-- client's deriveWeightGroups uses, and stable across reordering:
--
--   [{"sourceWeightOneValue": 16, "sourceWeightTwoValue": 0,
--     "weightOneValue": 12, "weightOneUnit": "kilograms",
--     "weightTwoValue": 0,  "weightTwoUnit": null}]
--
-- Resolution per cloned session, in order:
--   1. No starting weight passed at all  -> clone verbatim (unchanged).
--   2. A matching p_weight_overrides entry -> its four values/units VERBATIM.
--      No offset arithmetic, no unit-match check: the athlete named the bell.
--   3. Otherwise -> the offset math from the relative-weights migration,
--      unchanged.
--
-- Omitting p_weight_overrides is byte-identical to the prior behavior, which is
-- what keeps every existing caller and e2e case correct. An entry matching no
-- session is a silent no-op -- the client derives entries from the program's
-- own sessions, so a miss means the program changed underneath it.
--
-- The enrollment-lifecycle preamble (the duplicate-program check, the replace
-- path, and the 1..3 slot picker) is carried over VERBATIM from
-- 20260723000002_parallel_program_slots.sql; only the clone body changes. The
-- clone also now carries program_sessions.weight_label
-- (20260723140000_program_sessions_weight_label.sql) through to the copy, so
-- an enrollee's own program can still name its groups.
--
-- DROP + CREATE, one signature only: a PostgREST overload would make the
-- shorter call ambiguous ("function is not unique"), cf. the note in
-- 20260720160000_resume_program.sql.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID);
-- Its own signature too, so a re-run replaces rather than erroring.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL,
  p_replace_user_program_id UUID    DEFAULT NULL,
  p_weight_overrides        JSONB   DEFAULT NULL
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
  v_slot            SMALLINT;
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

  -- One live cursor per program. `p.source_program_id = p_program_id` catches
  -- re-enrolling in a shared program whose earlier clone is still running.
  IF EXISTS (
    SELECT 1
    FROM user_programs up
    JOIN programs p ON p.id = up.program_id
    WHERE up.user_id = v_user_id
      AND up.status = 'active'
      AND up.id IS DISTINCT FROM p_replace_user_program_id
      AND (p.id = p_program_id OR p.source_program_id = p_program_id)
  ) THEN
    RAISE EXCEPTION 'PROGRAM_ALREADY_ACTIVE';
  END IF;

  -- Free the replaced slot first so the picker below can reuse it.
  IF p_replace_user_program_id IS NOT NULL THEN
    UPDATE user_programs
      SET status = 'abandoned'
      WHERE id = p_replace_user_program_id
        AND user_id = v_user_id
        AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No active enrollment % to replace', p_replace_user_program_id;
    END IF;
  END IF;

  SELECT s.slot INTO v_slot
  FROM generate_series(1, 3) AS s(slot)
  WHERE NOT EXISTS (
    SELECT 1 FROM user_programs up
    WHERE up.user_id = v_user_id
      AND up.status = 'active'
      AND up.active_slot = s.slot
  )
  ORDER BY s.slot
  LIMIT 1;

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'PROGRAM_SLOTS_FULL';
  END IF;

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
      (program_id, sequence_index, week_number, day_number, title,
       workout_options, notes, weight_label)
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
                 FROM jsonb_array_elements(ps.workout_options->'movements') AS m
               ))
      END,
      ps.notes,
      ps.weight_label
    FROM program_sessions ps
    -- An explicit override for this session's weight GROUP, matched on the
    -- authored pair. At most one entry can match: the client emits one per
    -- distinct authored pair. `IS NOT DISTINCT FROM` so a group whose weight
    -- two is JSON null (two-hand loading) matches on null rather than dropping
    -- out of the join.
    LEFT JOIN LATERAL (
      SELECT o.value AS entry
      FROM jsonb_array_elements(COALESCE(p_weight_overrides, '[]'::jsonb)) AS o(value)
      WHERE (o.value->>'sourceWeightOneValue')::NUMERIC
              IS NOT DISTINCT FROM (ps.workout_options->'movements'->0->>'weightOneValue')::NUMERIC
        AND (o.value->>'sourceWeightTwoValue')::NUMERIC
              IS NOT DISTINCT FROM (ps.workout_options->'movements'->0->>'weightTwoValue')::NUMERIC
      LIMIT 1
    ) ov ON TRUE
    -- Per-session resolved weights: the explicit override when the group has
    -- one, otherwise the enrollee's choice shifted by this session's authored
    -- offset from the modal. A zero delta passes the chosen value through
    -- untouched -- notably it must NOT hit the >= 1 clamp, since a single-bell
    -- enrollment legitimately carries weight two = 0.
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN ov.entry IS NOT NULL THEN (ov.entry->>'weightOneValue')::NUMERIC
          WHEN p_shared_weight_one_value IS NULL OR d.one_delta = 0
            THEN p_shared_weight_one_value
          ELSE GREATEST(p_shared_weight_one_value + d.one_delta, 1)
        END AS one_value,
        CASE
          WHEN ov.entry IS NOT NULL THEN (ov.entry->>'weightTwoValue')::NUMERIC
          WHEN p_shared_weight_two_value IS NULL OR d.two_delta = 0
            THEN p_shared_weight_two_value
          ELSE GREATEST(p_shared_weight_two_value + d.two_delta, 1)
        END AS two_value,
        CASE WHEN ov.entry IS NOT NULL THEN ov.entry->>'weightOneUnit'
             ELSE p_shared_weight_one_unit END AS one_unit,
        CASE WHEN ov.entry IS NOT NULL THEN ov.entry->>'weightTwoUnit'
             ELSE p_shared_weight_two_unit END AS two_unit
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

  INSERT INTO user_programs (user_id, program_id, status, active_slot)
  VALUES (v_user_id, v_target_program, 'active', v_slot)
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB) TO authenticated;
