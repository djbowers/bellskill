-- swap_program_movement: replace one movement across an enrollment's upcoming
-- sessions, rebasing weights the way adjust_program_weights does.
--
-- The old movement's label-aware modal (same tiered baseline as
-- adjust_program_weights) is the working weight; each session element's offset
-- from it carries over onto the new movement's chosen weight. A NULL weight
-- param drops that slot to JSON null (e.g. double -> single, or bodyweight).
--
-- Semantics callers should know:
--   * Duplicate old-name elements within a session all rename together and
--     share the one modal baseline.
--   * Movement logs recorded under the old name stay under the old name.
--   * Callers should block swapping to a name already present in the program;
--     this function does not merge histories.
CREATE FUNCTION public.swap_program_movement(
  p_user_program_id    UUID,
  p_old_movement_name  TEXT,
  p_new_movement_name  TEXT,
  p_weight_one_value   NUMERIC DEFAULT NULL,
  p_weight_one_unit    TEXT    DEFAULT NULL,
  p_weight_two_value   NUMERIC DEFAULT NULL,
  p_weight_two_unit    TEXT    DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_program   UUID;
  v_owner_id  UUID;
  v_modal_one NUMERIC;
  v_modal_two NUMERIC;
  v_updated   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF COALESCE(TRIM(p_old_movement_name), '') = ''
     OR COALESCE(TRIM(p_new_movement_name), '') = '' THEN
    RAISE EXCEPTION 'Movement names must be non-empty';
  END IF;

  IF p_old_movement_name = p_new_movement_name THEN
    RAISE EXCEPTION 'New movement name must differ from the old one';
  END IF;

  SELECT program_id INTO v_program
  FROM user_programs
  WHERE id = p_user_program_id
    AND user_id = v_user_id
    AND status IN ('active', 'queued');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active or queued enrollment % for this user', p_user_program_id;
  END IF;

  SELECT owner_id INTO v_owner_id FROM programs WHERE id = v_program;
  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to modify sessions of this program (not owner)';
  END IF;

  -- Old movement's modal from the label-aware working baseline (same tiers as
  -- adjust_program_weights). Ties break toward the lighter pair.
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
    SELECT (mv->>'weightOneValue')::NUMERIC AS one_val,
           (mv->>'weightTwoValue')::NUMERIC AS two_val,
           COUNT(*) AS cnt
    FROM baseline b,
         jsonb_array_elements(b.workout_options->'movements') AS mv
    WHERE mv->>'movementName' = p_old_movement_name
      AND (mv->>'weightOneValue') IS NOT NULL
    GROUP BY one_val, two_val
    ORDER BY cnt DESC, one_val, two_val
    LIMIT 1
  ) modal;

  UPDATE program_sessions ps
  SET workout_options = jsonb_set(
    ps.workout_options,
    '{movements}',
    (
      SELECT jsonb_agg(
               CASE
                 WHEN e.elem->>'movementName' IS DISTINCT FROM p_old_movement_name
                   THEN e.elem
                 ELSE e.elem || jsonb_build_object(
                   'movementName', p_new_movement_name,
                   'weightOneValue',
                     COALESCE(to_jsonb(
                       CASE
                         WHEN p_weight_one_value IS NULL THEN NULL::NUMERIC
                         WHEN d.one_delta = 0 THEN p_weight_one_value
                         ELSE GREATEST(p_weight_one_value + d.one_delta, 1)
                       END), 'null'::jsonb),
                   'weightOneUnit',
                     COALESCE(to_jsonb(p_weight_one_unit), 'null'::jsonb),
                   'weightTwoValue',
                     COALESCE(to_jsonb(
                       CASE
                         WHEN p_weight_two_value IS NULL THEN NULL::NUMERIC
                         -- 0 is the single-arm (1H) sentinel — never shift it
                         WHEN p_weight_two_value = 0 THEN 0
                         WHEN d.two_delta = 0 THEN p_weight_two_value
                         ELSE GREATEST(p_weight_two_value + d.two_delta, 1)
                       END), 'null'::jsonb),
                   'weightTwoUnit',
                     COALESCE(to_jsonb(p_weight_two_unit), 'null'::jsonb)
                 )
               END
               ORDER BY e.ord
             )
      FROM jsonb_array_elements(ps.workout_options->'movements')
             WITH ORDINALITY AS e(elem, ord)
      CROSS JOIN LATERAL (
        SELECT
          CASE WHEN e.elem->>'weightOneUnit'
                    IS NOT DISTINCT FROM p_weight_one_unit
               THEN COALESCE((e.elem->>'weightOneValue')::NUMERIC, 0)
                    - COALESCE(v_modal_one, 0)
               ELSE 0 END AS one_delta,
          CASE WHEN e.elem->>'weightTwoUnit'
                    IS NOT DISTINCT FROM p_weight_two_unit
               THEN COALESCE((e.elem->>'weightTwoValue')::NUMERIC, 0)
                    - COALESCE(v_modal_two, 0)
               ELSE 0 END AS two_delta
      ) d
    )
  )
  WHERE ps.program_id = v_program
    AND NOT EXISTS (
      SELECT 1 FROM program_session_completions c
      WHERE c.user_program_id = p_user_program_id
        AND c.program_session_id = ps.id
    )
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(ps.workout_options->'movements') AS m
      WHERE m->>'movementName' = p_old_movement_name
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 AND NOT EXISTS (
    SELECT 1
    FROM program_sessions ps,
         jsonb_array_elements(ps.workout_options->'movements') AS m
    WHERE ps.program_id = v_program
      AND m->>'movementName' = p_old_movement_name
  ) THEN
    RAISE EXCEPTION 'Movement % not found in this program', p_old_movement_name;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_program_movement(UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.swap_program_movement(UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;
