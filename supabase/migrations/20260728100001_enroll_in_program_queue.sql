-- Enroll: optionally queue instead of claiming a slot.
--
-- Adds p_queue. When true, the clone + weight-baking happens exactly as an
-- immediate enroll (so a queued program's weights reflect what the user chose
-- at queue time), but the enrollment is inserted at status 'queued' with no
-- active_slot and the next queue_position -- the slot-claim block (free-slot
-- pick, PROGRAM_SLOTS_FULL, p_replace_user_program_id) is skipped entirely.
-- Promotion into a freed slot happens in complete_program_session.
--
-- The body is carried over VERBATIM from
-- 20260727000001_enroll_in_program_auto_repeat.sql; the only changes are the
-- new parameter, guarding the replace/slot block with NOT p_queue, and the
-- status/queue_position values on the final insert. DROP + CREATE, one
-- signature only: a PostgREST overload would make the shorter call ambiguous.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB, BOOLEAN);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL,
  p_replace_user_program_id UUID    DEFAULT NULL,
  p_movement_weights        JSONB   DEFAULT NULL,
  p_auto_repeat             BOOLEAN  DEFAULT NULL,
  p_queue                   BOOLEAN  DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID    := auth.uid();
  v_owner_id           UUID;
  v_default_auto_repeat BOOLEAN;
  v_target_program     UUID;
  v_user_program_id    UUID;
  v_modal_one          NUMERIC;
  v_modal_two          NUMERIC;
  v_slot               SMALLINT;
  v_queue_position     INTEGER;
  v_override           BOOLEAN := p_shared_weight_one_value IS NOT NULL
                                 OR p_movement_weights IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- RLS on this SELECT already restricts to public-or-own; a NOT FOUND result
  -- means the program does not exist or is not visible to the caller.
  SELECT owner_id, default_auto_repeat INTO v_owner_id, v_default_auto_repeat
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;

  -- One live cursor per program. `p.source_program_id = p_program_id` catches
  -- re-enrolling in a shared program whose earlier clone is still running.
  IF NOT p_queue AND EXISTS (
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

  IF p_queue THEN
    -- Queued rows hold no slot; they take the next position in line. The
    -- partial unique index serializes concurrent inserts per user.
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_queue_position
    FROM user_programs
    WHERE user_id = v_user_id AND status = 'queued';
  ELSE
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
  END IF;

  IF v_owner_id = v_user_id THEN
    v_target_program := p_program_id;                     -- own program: no clone
  ELSE
    INSERT INTO programs
      (owner_id, source_program_id, slug, title, description, author_name,
       num_weeks, days_per_week, is_public, default_auto_repeat)
    SELECT v_user_id, id, NULL, title, description, author_name,
           num_weeks, days_per_week, false, default_auto_repeat
    FROM programs WHERE id = p_program_id
    RETURNING id INTO v_target_program;

    IF v_override THEN
      -- The modal (weightOne, weightTwo) pair across the program's sessions:
      -- the shared placeholder load every deliberately-different session is
      -- offset from, used only by the complexSet uniform-fold path. Ties break
      -- toward the lighter pair, mirroring deriveStartingWeight.
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
    -- Per-movement modal authored weight, one row per movement name. Rows with a
    -- null weight one (bodyweight) never form a modal, so a bodyweight movement
    -- has no row and its element is kept untouched below. Tie-break mirrors the
    -- client's deriveMovementWeights so pre-fill equals the cloned value.
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
        WHERE ps2.program_id = p_program_id
          AND (mv->>'weightOneValue') IS NOT NULL
        GROUP BY name, one_val, two_val
      ) per_pair
      ORDER BY name, cnt DESC, one_val, two_val
    )
    SELECT
      v_target_program, ps.sequence_index, ps.week_number, ps.day_number, ps.title,
      CASE
        WHEN NOT v_override THEN ps.workout_options
        -- non-complex with per-movement weights: rebuild each element in its own
        -- config shape, offset from that movement's modal.
        WHEN p_movement_weights IS NOT NULL
             AND ps.workout_options->>'complexSet' IS DISTINCT FROM 'true'
          THEN jsonb_set(
                 ps.workout_options,
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
                   FROM jsonb_array_elements(ps.workout_options->'movements')
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
                       -- Offset only when the movement's authored unit matches the
                       -- chosen unit; a cross-unit choice passes through (delta 0).
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
        -- complexSet (one bell pair for the whole complex, ABC), or a caller that
        -- passed only p_shared_weight_* (the homogeneous shared-weight programs):
        -- the prior uniform fold. COALESCE(..., 'null'::jsonb): jsonb_set is
        -- strict and to_jsonb(NULL) is SQL NULL, so an unset slot must be coerced
        -- to a JSON null. `m || jsonb_build_object(...)` overrides only the four
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
    -- Per-session shared weight for the complexSet path: the enrollee's choice
    -- shifted by this session's authored offset from the modal. A zero delta
    -- passes the chosen value through untouched -- notably it must NOT hit the
    -- >= 1 clamp, since a single-bell enrollment carries weight two = 0.
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

  INSERT INTO user_programs
    (user_id, program_id, status, active_slot, queue_position, auto_repeat)
  VALUES (v_user_id, v_target_program,
          CASE WHEN p_queue THEN 'queued' ELSE 'active' END,
          v_slot, v_queue_position,
          COALESCE(p_auto_repeat, v_default_auto_repeat, false))
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB, BOOLEAN, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB, BOOLEAN, BOOLEAN) TO authenticated;
