-- Make the seeded "Easy Strength" Farmer's Carry a timed movement.
--
-- 20260714000002_seed_easy_strength.sql seeds all five movements through one
-- helper that shares the session's rep ladder, so the Kettlebell Farmer's Carry
-- came out rep-counted like the presses and squats. A loaded carry runs on the
-- clock, not on reps: `timedRungs: true` reinterprets each repScheme entry as
-- seconds per rung (see MovementOptions, and Kettlebell Mile's single-rung
-- [60]/timed shape in 20260723130000_seed_kettlebell_mile.sql).
--
-- Set the carry to a single 30-second rung (`repScheme [30]`, `timedRungs true`)
-- and leave its 24 kg double loading untouched. A single fixed rung keeps the
-- carry consistent across every session rather than ballooning to the session's
-- rung count (e.g. the 6x1 day would otherwise be six 30s carries).
--
-- Forward DATA FIX over deployed rows (the original seed is applied in
-- production and is ON CONFLICT DO NOTHING). Scoped to the SYSTEM-OWNED template
-- (slug = 'easy-strength' AND owner_id IS NULL); copy-on-enroll clones carry
-- slug NULL + a real owner_id, so existing enrollees keep what they started.
-- Matched by movementName (not array index) and idempotent: a session whose
-- carry is already timed no-ops on re-run. Modeled on
-- 20260724000002_easy_strength_straight_sets.sql; guarded, RAISE NOTICE count.

DO $$
DECLARE
  v_program_id     UUID;
  v_sessions_fixed INT := 0;
BEGIN
  SELECT id INTO v_program_id
  FROM public.programs
  WHERE slug = 'easy-strength' AND owner_id IS NULL;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Easy Strength template not found; nothing to update.';
    RETURN;
  END IF;

  UPDATE public.program_sessions ps
  SET workout_options = jsonb_set(
    ps.workout_options,
    '{movements}',
    (
      SELECT jsonb_agg(
        CASE elem->>'movementName'
          WHEN 'Kettlebell Farmer''s Carry'
            THEN jsonb_set(
                   jsonb_set(elem, '{timedRungs}', 'true'::jsonb),
                   '{repScheme}', '[30]'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(ps.workout_options->'movements')
        WITH ORDINALITY AS m(elem, ord)
    )
  )
  WHERE ps.program_id = v_program_id
    AND ps.workout_options->'movements' @> '[{"movementName": "Kettlebell Farmer''s Carry"}]'::jsonb
    AND NOT (
      ps.workout_options->'movements'
        @> '[{"movementName": "Kettlebell Farmer''s Carry", "timedRungs": true}]'::jsonb
    );
  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;

  RAISE NOTICE 'Easy Strength timed carry: program_sessions updated=%', v_sessions_fixed;
END $$;
