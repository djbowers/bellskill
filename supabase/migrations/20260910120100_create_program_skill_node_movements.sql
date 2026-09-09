-- Skill-tree profile for programs: which nodes a program's prescribed movements
-- practise, derived from movements.skill_node_id by the same exact-name join
-- program_modality_movements uses (workout_options stores movements by NAME).
-- Pure aggregation only — reach verdicts live in src/utils/skillTreeProgress.ts.
-- An unmatched or unmapped movement contributes nothing, so a program with no
-- mapped movement comes back empty, which the recommender reads as within reach.

CREATE OR REPLACE FUNCTION public.program_skill_node_movements()
RETURNS TABLE (
  program_id uuid,
  skill_node_id text,
  movement_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ps.program_id,
    m.skill_node_id,
    count(*) AS movement_count
  FROM program_sessions ps
  CROSS JOIN LATERAL jsonb_array_elements(ps.workout_options->'movements') AS elem
  JOIN movements m ON m."Movement" = elem->>'movementName'
  WHERE m.skill_node_id IS NOT NULL
  GROUP BY ps.program_id, m.skill_node_id;
$$;

-- RLS on program_sessions/programs does the scoping; only authenticated users
-- may call it.
REVOKE ALL ON FUNCTION public.program_skill_node_movements() FROM public;
GRANT EXECUTE ON FUNCTION public.program_skill_node_movements() TO authenticated;
