-- Apply-forward session edits must preserve per-session weight offsets.
--
-- 20260728110000_update_program_sessions_forward.sql merged the edited
-- session's movements AND absolute weights verbatim onto every later
-- incomplete session. Found in live use (A+A Plan A, program clone
-- 08e65605): a mid-program C+J -> C+J+C edit at the new 28 kg working
-- weight stamped 28 kg onto the week-4 'Deload weeks' sessions too,
-- erasing their authored -8 kg offset -- so the deload week loaded at the
-- full working load. Every other weight writer (enroll_in_program,
-- adjust_program_weights) is offset-preserving; this brings the forward
-- path in line.
--
-- New semantics: the structural keys (movements' names/repSchemes,
-- workoutMode, complexSet/straightSets, sharedBell) still propagate
-- verbatim, but each target session's WEIGHTS are re-based -- the edited
-- session's new weight shifted by the target's current offset from the
-- label-aware working baseline (the same tiered modal as
-- adjust_program_weights: unlabeled-incomplete first, else
-- unlabeled-completed, else labeled-incomplete). A working session
-- (delta 0) still receives the edit verbatim; a deload/test-day session
-- keeps its relationship to the working load.
--
--   * Shared-bell target -> per-session delta from the target's current
--     movements->0 pair vs the modal; the re-based pair is written to
--     sharedWeightOne/Two and every propagated movement.
--   * Per-movement target -> each propagated movement's weight is shifted
--     by the delta of the target's same-named current movement vs that
--     movement's modal (a movement the target didn't have gets the edit
--     verbatim; bodyweight/null forward weights pass through).
--   * Unit mismatch -> delta 0 passthrough (no cross-unit arithmetic),
--     and a zero delta skips the GREATEST(..., 1) clamp so a single-bell
--     weight two of 0 survives -- both rules identical to
--     adjust_program_weights.
--
-- Scope is unchanged: later sequence_index only, sessions the caller has
-- completed (via any of their enrollments) are never touched, owner-gated.
CREATE OR REPLACE FUNCTION public.update_program_sessions_forward(
  p_session_id      UUID,
  p_forward_options JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_program_id   UUID;
  v_seq          INT;
  v_owner_id     UUID;
  v_updated      INT;
  v_modal_one    NUMERIC;
  v_modal_two    NUMERIC;
  v_fwd_one      NUMERIC := (p_forward_options->>'sharedWeightOneValue')::NUMERIC;
  v_fwd_two      NUMERIC := (p_forward_options->>'sharedWeightTwoValue')::NUMERIC;
  v_fwd_one_unit TEXT    := p_forward_options->>'sharedWeightOneUnit';
  v_fwd_two_unit TEXT    := p_forward_options->>'sharedWeightTwoUnit';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_forward_options IS NULL OR p_forward_options = '{}'::jsonb THEN
    RAISE EXCEPTION 'No options provided';
  END IF;

  SELECT ps.program_id, ps.sequence_index, p.owner_id
    INTO v_program_id, v_seq, v_owner_id
  FROM program_sessions ps
  JOIN programs p ON p.id = ps.program_id
  WHERE ps.id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program session % not found or not accessible', p_session_id;
  END IF;

  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to update sessions of this program (not owner)';
  END IF;

  -- Label-aware working-baseline modal for the shared-bell fold. The edited
  -- row was already rewritten by the client, but the baseline is a modal over
  -- the working sessions, so one edited row cannot move it.
  WITH ranked AS (
    SELECT
      ps.workout_options,
      CASE
        WHEN ps.weight_label IS NULL
             AND NOT EXISTS (
               SELECT 1
               FROM program_session_completions c
               JOIN user_programs up ON up.id = c.user_program_id
               WHERE c.program_session_id = ps.id AND up.user_id = v_user_id
             )
          THEN 1
        WHEN ps.weight_label IS NULL
          THEN 2
        WHEN NOT EXISTS (
               SELECT 1
               FROM program_session_completions c
               JOIN user_programs up ON up.id = c.user_program_id
               WHERE c.program_session_id = ps.id AND up.user_id = v_user_id
             )
          THEN 3
        ELSE NULL
      END AS tier
    FROM program_sessions ps
    WHERE ps.program_id = v_program_id
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
    -- Same baseline, then a per-movement modal over it for the non-shared path.
    WITH ranked AS (
      SELECT
        ps_b.id,
        ps_b.workout_options,
        CASE
          WHEN ps_b.weight_label IS NULL
               AND NOT EXISTS (
                 SELECT 1
                 FROM program_session_completions c
                 JOIN user_programs up ON up.id = c.user_program_id
                 WHERE c.program_session_id = ps_b.id AND up.user_id = v_user_id
               )
            THEN 1
          WHEN ps_b.weight_label IS NULL
            THEN 2
          WHEN NOT EXISTS (
                 SELECT 1
                 FROM program_session_completions c
                 JOIN user_programs up ON up.id = c.user_program_id
                 WHERE c.program_session_id = ps_b.id AND up.user_id = v_user_id
               )
            THEN 3
          ELSE NULL
        END AS tier
      FROM program_sessions ps_b
      WHERE ps_b.program_id = v_program_id
    ),
    baseline AS (
      SELECT r.workout_options
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
        WHEN public.uses_shared_bell(ps2.workout_options || p_forward_options)
          -- Shared bell: propagate the structure, then stamp the re-based pair
          -- onto the shared fields and every movement.
          THEN (ps2.workout_options || p_forward_options)
               || jsonb_build_object(
                    'sharedWeightOneValue', COALESCE(to_jsonb(w.one_value), 'null'::jsonb),
                    'sharedWeightOneUnit',  COALESCE(to_jsonb(v_fwd_one_unit), 'null'::jsonb),
                    'sharedWeightTwoValue', COALESCE(to_jsonb(w.two_value), 'null'::jsonb),
                    'sharedWeightTwoUnit',  COALESCE(to_jsonb(v_fwd_two_unit), 'null'::jsonb),
                    'movements', (
                      SELECT jsonb_agg(
                               m || jsonb_build_object(
                                 'weightOneValue', COALESCE(to_jsonb(w.one_value), 'null'::jsonb),
                                 'weightOneUnit',  COALESCE(to_jsonb(v_fwd_one_unit), 'null'::jsonb),
                                 'weightTwoValue', COALESCE(to_jsonb(w.two_value), 'null'::jsonb),
                                 'weightTwoUnit',  COALESCE(to_jsonb(v_fwd_two_unit), 'null'::jsonb)
                               )
                               ORDER BY ord
                             )
                      FROM jsonb_array_elements(
                             (ps2.workout_options || p_forward_options)->'movements')
                             WITH ORDINALITY AS s(m, ord)
                    ))
        -- Per-movement weights: propagate the structure, each movement's weight
        -- shifted by the target's same-named current movement vs its modal.
        ELSE (ps2.workout_options || p_forward_options)
             || jsonb_build_object(
                  'movements', (
                    SELECT jsonb_agg(
                             elem || jsonb_build_object(
                               'weightOneValue',
                                 COALESCE(to_jsonb(
                                   CASE
                                     WHEN (elem->>'weightOneValue')::NUMERIC IS NULL
                                       OR r.one_delta = 0
                                       THEN (elem->>'weightOneValue')::NUMERIC
                                     ELSE GREATEST((elem->>'weightOneValue')::NUMERIC + r.one_delta, 1)
                                   END), 'null'::jsonb),
                               'weightTwoValue',
                                 COALESCE(to_jsonb(
                                   CASE
                                     WHEN (elem->>'weightTwoValue')::NUMERIC IS NULL
                                       OR r.two_delta = 0
                                       THEN (elem->>'weightTwoValue')::NUMERIC
                                     ELSE GREATEST((elem->>'weightTwoValue')::NUMERIC + r.two_delta, 1)
                                   END), 'null'::jsonb)
                             )
                             ORDER BY ord
                           )
                    FROM jsonb_array_elements(
                           COALESCE(p_forward_options->'movements',
                                    ps2.workout_options->'movements'))
                           WITH ORDINALITY AS e(elem, ord)
                    LEFT JOIN LATERAL (
                      SELECT om
                      FROM jsonb_array_elements(ps2.workout_options->'movements') AS om
                      WHERE om->>'movementName' = elem->>'movementName'
                      LIMIT 1
                    ) old_mv ON TRUE
                    LEFT JOIN movement_modal mm ON mm.name = elem->>'movementName'
                    CROSS JOIN LATERAL (
                      SELECT
                        CASE WHEN old_mv.om IS NOT NULL
                                  AND old_mv.om->>'weightOneUnit'
                                      IS NOT DISTINCT FROM elem->>'weightOneUnit'
                             THEN COALESCE((old_mv.om->>'weightOneValue')::NUMERIC, 0)
                                  - COALESCE(mm.one_val, 0)
                             ELSE 0 END AS one_delta,
                        CASE WHEN old_mv.om IS NOT NULL
                                  AND old_mv.om->>'weightTwoUnit'
                                      IS NOT DISTINCT FROM elem->>'weightTwoUnit'
                             THEN COALESCE((old_mv.om->>'weightTwoValue')::NUMERIC, 0)
                                  - COALESCE(mm.two_val, 0)
                             ELSE 0 END AS two_delta
                    ) r
                  ))
      END AS new_options
    FROM program_sessions ps2
    -- Shared-bell re-based pair: the edit's weight shifted by this session's
    -- current offset from the working modal. Delta 0 passes the edit through
    -- untouched (no clamp -- weight two 0 is legitimate single-bell loading).
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN v_fwd_one IS NULL OR d.one_delta = 0
            THEN v_fwd_one
          ELSE GREATEST(v_fwd_one + d.one_delta, 1)
        END AS one_value,
        CASE
          WHEN v_fwd_two IS NULL OR d.two_delta = 0
            THEN v_fwd_two
          ELSE GREATEST(v_fwd_two + d.two_delta, 1)
        END AS two_value
      FROM (
        SELECT
          COALESCE(
            CASE WHEN ps2.workout_options->'movements'->0->>'weightOneUnit'
                      IS NOT DISTINCT FROM v_fwd_one_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightOneValue')::NUMERIC
                      - v_modal_one
            END, 0) AS one_delta,
          COALESCE(
            CASE WHEN ps2.workout_options->'movements'->0->>'weightTwoUnit'
                      IS NOT DISTINCT FROM v_fwd_two_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightTwoValue')::NUMERIC
                      - v_modal_two
            END, 0) AS two_delta
      ) d
    ) w
    WHERE ps2.program_id = v_program_id
      AND ps2.sequence_index > v_seq
      AND NOT EXISTS (
        SELECT 1
        FROM program_session_completions c
        JOIN user_programs up ON up.id = c.user_program_id
        WHERE c.program_session_id = ps2.id
          AND up.user_id = v_user_id
      )
  ) sub
  WHERE ps.id = sub.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) TO authenticated;
