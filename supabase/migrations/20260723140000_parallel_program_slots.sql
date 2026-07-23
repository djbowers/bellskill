-- Program Tracking: run up to 3 programs in parallel.
--
-- 20260706170000_create_program_tables.sql:112 pinned a user to ONE active
-- enrollment via a partial unique index on (user_id) WHERE status = 'active',
-- and both enrollment RPCs opened by abandoning whatever was active so that
-- index could never trip. Running a strength program and a conditioning program
-- side by side was therefore impossible.
--
-- Generalize the index into a SLOT index rather than swapping it for a
-- count-checking trigger: two concurrent inserts can each read "2 active" and
-- both insert, so a BEFORE INSERT count check does not actually bound anything.
-- A unique index on (user_id, active_slot) does, and the old index is literally
-- this one's single-slot case.
--
-- The status coupling is deliberately ONE-directional: an active row must hold
-- a slot, but a deactivated row may keep a stale one. That direction is what
-- actually enforces the cap (a unique index treats NULLs as distinct, so
-- slot-less active rows would be unbounded), while leaving the reverse loose
-- means complete_program_session's terminal status flip and the client's plain
-- cancel PATCH stay one-column updates that need no change at all.

ALTER TABLE user_programs ADD COLUMN active_slot SMALLINT;

COMMENT ON COLUMN user_programs.active_slot IS
  'Parallel-program slot 1..3, unique per user among active enrollments. '
  'Meaningful only while status = ''active''; a non-active row may carry a '
  'stale value, which the partial unique index ignores.';

ALTER TABLE user_programs ADD CONSTRAINT user_programs_active_slot_range
  CHECK (active_slot IS NULL OR active_slot BETWEEN 1 AND 3);

UPDATE user_programs SET active_slot = 1 WHERE status = 'active';

-- Added after the backfill so existing active rows already satisfy it.
ALTER TABLE user_programs ADD CONSTRAINT user_programs_active_needs_slot
  CHECK (status <> 'active' OR active_slot IS NOT NULL);

DROP INDEX one_active_program_per_user;

CREATE UNIQUE INDEX one_program_per_active_slot
  ON user_programs(user_id, active_slot) WHERE status = 'active';

-- ── enroll_in_program(): assign a slot instead of abandoning everything ──────
-- The clone body below -- the relative-weight modal, the per-session delta, and
-- the movement fold -- is carried over VERBATIM from
-- 20260723000000_enroll_in_program_relative_weights.sql. What changes is only
-- the enrollment-lifecycle preamble that used to abandon every active row:
--
--   * p_replace_user_program_id  abandon THAT enrollment and take its slot.
--                                Passed when the user is at the cap and picked
--                                which program to drop.
--   * otherwise                  take the lowest free slot in 1..3, or raise
--                                PROGRAM_SLOTS_FULL (a stable, greppable
--                                message the client maps to the replace dialog).
--
-- Also new: enrolling twice in the same program concurrently is rejected. For a
-- shared program each enroll clones a fresh row, so the duplicate check has to
-- look through source_program_id, not just the target id -- otherwise "Start"
-- twice on DFW would yield two identical cards racing the same sessions.
--
-- DROP + CREATE, one signature only: a PostgREST overload would make the
-- shorter call ambiguous ("function is not unique"), cf. the note in
-- 20260720160000_resume_program.sql.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL,
  p_replace_user_program_id UUID    DEFAULT NULL
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

  INSERT INTO user_programs (user_id, program_id, status, active_slot)
  VALUES (v_user_id, v_target_program, 'active', v_slot)
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- ── resume_program(): same slot treatment ────────────────────────────────────
-- Reactivating a prior enrollment no longer abandons the others; it claims a
-- free slot, or replaces the caller-nominated one. The resumed row is given a
-- freshly picked slot rather than whatever it held before it went inactive --
-- that value is stale by definition and may now belong to a live enrollment.
DROP FUNCTION IF EXISTS public.resume_program(UUID);

CREATE FUNCTION public.resume_program(
  p_user_program_id UUID,
  p_replace_user_program_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_program_id UUID;
  v_slot       SMALLINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The target must be the caller's own enrollment and not already active.
  SELECT program_id INTO v_program_id
  FROM user_programs
  WHERE id = p_user_program_id
    AND user_id = v_user_id
    AND status <> 'active';

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'No resumable enrollment %', p_user_program_id;
  END IF;

  -- Resuming a program that already has a live cursor would give it two.
  IF EXISTS (
    SELECT 1 FROM user_programs
    WHERE user_id = v_user_id
      AND status = 'active'
      AND program_id = v_program_id
      AND id IS DISTINCT FROM p_replace_user_program_id
  ) THEN
    RAISE EXCEPTION 'PROGRAM_ALREADY_ACTIVE';
  END IF;

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

  UPDATE user_programs
    SET status = 'active', completed_at = NULL, active_slot = v_slot
    WHERE id = p_user_program_id;

  RETURN p_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_program(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.resume_program(UUID, UUID) TO authenticated;
