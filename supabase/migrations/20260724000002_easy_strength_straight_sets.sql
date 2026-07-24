-- Run the seeded "Easy Strength" template in straight-sets order.
--
-- 20260714000002_seed_easy_strength.sql modeled every session as
-- alternating-rung (like DFW), so the runtime delivers press -> pull -> hinge ->
-- squat -> carry, twice. Dan John's template prescribes the opposite: both sets
-- of a movement, then the next movement. `straightSets` (workout_logs
-- .straight_sets, added in 20260724000001) is the runtime's traversal flag, so
-- setting it on each session's workout_options is the whole fix -- the rep
-- schemes, weights, goal (1 round), and session count are already correct, and
-- one round still means the whole prescription completed once.
--
-- This is a forward DATA FIX over deployed rows (the original seed is applied in
-- production and is ON CONFLICT DO NOTHING, so re-running it changes nothing).
-- Modeled on 20260723000001_reshape_aa_protocol_plan_a.sql: guarded, idempotent,
-- RAISE NOTICE row count for the post-merge prod check. On a fresh local/CI
-- database the seed runs first (earlier timestamp) and this lands it on the same
-- state as production.
--
-- Scoped to the SYSTEM-OWNED template (slug = 'easy-strength' AND owner_id IS
-- NULL). Copy-on-enroll clones carry slug NULL and a real owner_id, so existing
-- enrollees keep the program they started.

DO $$
DECLARE
  v_program_id UUID;
  v_sessions_fixed INT := 0;
BEGIN
  SELECT id INTO v_program_id
  FROM public.programs
  WHERE slug = 'easy-strength' AND owner_id IS NULL;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Easy Strength template not found; nothing to update.';
    RETURN;
  END IF;

  UPDATE public.program_sessions
  SET workout_options = jsonb_set(workout_options, '{straightSets}', 'true'::jsonb)
  WHERE program_id = v_program_id
    AND workout_options->>'straightSets' IS DISTINCT FROM 'true';
  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;

  RAISE NOTICE 'Easy Strength straight sets: program_sessions updated=%', v_sessions_fixed;
END $$;
