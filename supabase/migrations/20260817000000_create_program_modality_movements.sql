-- Modality debt Phase 2: give programs a modality profile.
--
-- A program's training modality is derived from the movements its sessions
-- actually prescribe, rather than stored editorially — that keeps it consistent
-- by construction with the movement-level scorer and needs no backfill when the
-- catalog's modality_credits change. This is deliberately NOT the same axis as
-- programs.focus_tags: focus is what a prescription buys (strength, endurance),
-- modality is how a rep moves you. See docs/modality-debt-scoring-model.md.
--
-- Pure aggregation only — one row per (program_id, modality) with how many
-- prescribed movements credit it. Share/threshold logic lives in
-- src/utils/programModality.ts, per the layering rule.
--
-- workout_options stores movements by NAME with no FK into the catalog, so this
-- joins movements."Movement" exactly — the same exact-string join the enroll
-- RPC's movement_modal CTE uses, and the reason seeded programs are required to
-- spell movementName exactly as scripts/data/movements.csv does. An unmatched
-- name (user-authored program, or a catalog row whose modality_credits were
-- never backfilled) simply contributes no row, so a program with nothing matched
-- comes back empty rather than wrong.

CREATE OR REPLACE FUNCTION public.program_modality_movements()
RETURNS TABLE (
  program_id uuid,
  modality text,
  movement_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ps.program_id,
    credit AS modality,
    count(*) AS movement_count
  FROM program_sessions ps
  CROSS JOIN LATERAL jsonb_array_elements(ps.workout_options->'movements') AS elem
  JOIN movements m ON m."Movement" = elem->>'movementName'
  CROSS JOIN LATERAL unnest(m.modality_credits) AS credit
  GROUP BY ps.program_id, credit;
$$;

-- RLS on program_sessions/programs does the scoping; only authenticated users
-- may call it.
REVOKE ALL ON FUNCTION public.program_modality_movements() FROM public;
GRANT EXECUTE ON FUNCTION public.program_modality_movements() TO authenticated;
