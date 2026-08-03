-- update_program_sessions_forward: merge movements per element instead of
-- replacing the whole array.
--
-- The previous version jsonb-merged p_forward_options wholesale, so an edited
-- session's movements array (with ITS repScheme/timedRungs) stomped every
-- later session's authored periodization. Now each edited element is matched
-- to the target session's element by movementName — falling back to position
-- when there is no name match, both arrays have equal length, and the session
-- lacks the edited name (a rename) — and merged as
-- session_elem || (edited_elem - 'repScheme' - 'timedRungs'):
--   * propagated: movementName, weights/units, and any other movement-level keys
--   * preserved per session: repScheme and timedRungs
-- Unmatched edited elements are taken whole (new movement); session movements
-- absent from the edited array drop from future sessions. A target session
-- with no movements array takes the edited array whole; an edit without a
-- movements key keeps the old plain-merge behavior.
--
-- Scope, ownership check, completed-session skip, and return value unchanged.
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
  v_user_id    UUID := auth.uid();
  v_program_id UUID;
  v_seq        INT;
  v_owner_id   UUID;
  v_movements  JSONB;
  v_updated    INT;
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

  v_movements := p_forward_options->'movements';

  IF jsonb_typeof(v_movements) IS DISTINCT FROM 'array' THEN
    UPDATE program_sessions ps
    SET workout_options = ps.workout_options || p_forward_options
    WHERE ps.program_id = v_program_id
      AND ps.sequence_index > v_seq
      AND NOT EXISTS (
        SELECT 1
        FROM program_session_completions c
        JOIN user_programs up ON up.id = c.user_program_id
        WHERE c.program_session_id = ps.id
          AND up.user_id = v_user_id
      );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
  END IF;

  UPDATE program_sessions ps
  SET workout_options =
    ps.workout_options
    || (p_forward_options - 'movements')
    || jsonb_build_object(
         'movements',
         CASE
           WHEN jsonb_typeof(ps.workout_options->'movements') IS DISTINCT FROM 'array'
             THEN v_movements
           ELSE COALESCE(
             (
               SELECT jsonb_agg(
                        CASE
                          WHEN s.elem IS NULL THEN e.elem
                          ELSE s.elem || (e.elem - 'repScheme' - 'timedRungs')
                        END
                        ORDER BY e.ord
                      )
               FROM jsonb_array_elements(v_movements)
                      WITH ORDINALITY AS e(elem, ord)
               LEFT JOIN LATERAL (
                 SELECT s2.elem
                 FROM jsonb_array_elements(ps.workout_options->'movements')
                        WITH ORDINALITY AS s2(elem, ord)
                 WHERE s2.elem->>'movementName' = e.elem->>'movementName'
                    OR (
                      s2.ord = e.ord
                      AND jsonb_array_length(v_movements)
                          = jsonb_array_length(ps.workout_options->'movements')
                      AND NOT EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(ps.workout_options->'movements') AS x
                        WHERE x->>'movementName' = e.elem->>'movementName'
                      )
                    )
                 ORDER BY (s2.elem->>'movementName' = e.elem->>'movementName') DESC
                 LIMIT 1
               ) s ON TRUE
             ),
             '[]'::jsonb
           )
         END
       )
  WHERE ps.program_id = v_program_id
    AND ps.sequence_index > v_seq
    AND NOT EXISTS (
      SELECT 1
      FROM program_session_completions c
      JOIN user_programs up ON up.id = c.user_program_id
      WHERE c.program_session_id = ps.id
        AND up.user_id = v_user_id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) TO authenticated;
