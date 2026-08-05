-- Split the shared-bell weight model out of the `complex` workout mode.
--
-- `complex` has always meant two things at once: an arrangement (movements back
-- to back, the bell never set down) and a weight model (one shared bell pair for
-- every movement, instead of per-movement weights). Those are independent. A
-- circuit or straight-sets session run off a single 24 kg bell is a normal way
-- to train, and until now there was no way to say so without also opting into
-- complex traversal.
--
-- This adds the two columns the split needs and finishes the migration #236
-- deferred:
--
--   * workout_mode -- the arrangement, replacing the complex_set / straight_sets
--     boolean pair.
--   * shared_bell  -- the weight model, on its own axis. Complex forces it on,
--     since a bell that is never set down cannot carry per-movement weights.
--
-- Both columns are NULLABLE on purpose. A PWA client running cached JS still
-- writes only the boolean pair, and NULL is the one value that unambiguously
-- means "this insert came from a pre-split client, derive from the booleans".
-- With NOT NULL DEFAULT 'circuit' a defaulted value would be indistinguishable
-- from an intended one. A trigger keeps both representations in sync in both
-- directions so old and new clients can write concurrently. A follow-up
-- migration sets NOT NULL and drops the booleans once clients have cycled --
-- the same hold-until-clients-cycle pattern as the pattern_debt_window drop.
--
-- workout_mode stores the TypeScript literal ('straightSets', not
-- 'straight_sets'). A snake/camel map is precisely the translation layer this
-- change exists to delete, and program_sessions.workout_options is already
-- camelCase throughout.

ALTER TABLE public.workout_logs
  ADD COLUMN workout_mode text
    CONSTRAINT workout_logs_workout_mode_check
    CHECK (workout_mode IN ('circuit', 'straightSets', 'complex')),
  ADD COLUMN shared_bell boolean;

COMMENT ON COLUMN public.workout_logs.workout_mode IS
  'How the movements were arranged: circuit (rotate one rung at a time), straightSets (finish each movement before the next), or complex (back to back, bell never set down). Arrangement only -- the weight model is shared_bell.';

COMMENT ON COLUMN public.workout_logs.shared_bell IS
  'When true, every movement was loaded with the workout''s shared_weight_* pair rather than its own weights. Always true for complex.';

UPDATE public.workout_logs
SET workout_mode = CASE
      WHEN complex_set THEN 'complex'
      WHEN straight_sets THEN 'straightSets'
      ELSE 'circuit'
    END,
    shared_bell = complex_set
WHERE workout_mode IS NULL;

CREATE OR REPLACE FUNCTION public.sync_workout_log_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workout_mode IS NULL THEN
    -- Pre-split client: the boolean pair is all it knows how to set.
    NEW.workout_mode := CASE
      WHEN NEW.complex_set THEN 'complex'
      WHEN NEW.straight_sets THEN 'straightSets'
      ELSE 'circuit'
    END;
    NEW.shared_bell := COALESCE(NEW.shared_bell, NEW.complex_set);
  ELSE
    NEW.complex_set := NEW.workout_mode = 'complex';
    NEW.straight_sets := NEW.workout_mode = 'straightSets';
    NEW.shared_bell := COALESCE(NEW.shared_bell, false)
                       OR NEW.workout_mode = 'complex';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_workout_log_mode
  BEFORE INSERT OR UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_workout_log_mode();

-- The same split inside program_sessions.workout_options. The old keys stay for
-- this release so a cached client keeps reading sessions it understands; the
-- follow-up migration strips them.
UPDATE public.program_sessions
SET workout_options = workout_options || jsonb_build_object(
      'workoutMode', CASE
        WHEN COALESCE((workout_options->>'complexSet')::boolean, false) THEN 'complex'
        WHEN COALESCE((workout_options->>'straightSets')::boolean, false) THEN 'straightSets'
        ELSE 'circuit'
      END,
      'sharedBell', COALESCE((workout_options->>'complexSet')::boolean, false))
WHERE workout_options->'workoutMode' IS NULL;

-- The shared-bell question, asked once, tolerant of all three vintages of stored
-- options: the new key, the legacy boolean, or a bare complex mode. Mirrors
-- usesSharedBell in src/utils/workoutMode.ts.
CREATE OR REPLACE FUNCTION public.uses_shared_bell(p_workout_options jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE((p_workout_options->>'sharedBell')::boolean, false)
      OR COALESCE((p_workout_options->>'complexSet')::boolean, false)
      OR COALESCE(p_workout_options->>'workoutMode', '') = 'complex';
$$;

-- ---------------------------------------------------------------------------
-- The four RPCs that keyed shared-vs-per-movement weights off complex. Each is
-- recreated verbatim except for that predicate -- Postgres has no way to patch a
-- function body in place.
--
-- pattern_debt_movements was outright wrong once the axes split: a circuit run
-- off one bell would have been scored with per-movement weights it never used.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pattern_debt_movements(int, int);

CREATE FUNCTION public.pattern_debt_movements(
  p_window_days int DEFAULT 14,
  p_baseline_days int DEFAULT 84
)
RETURNS TABLE (
  movement_id uuid,
  movement_name text,
  pattern_credits text[],
  last_trained_at timestamptz,
  set_count bigint,
  total_reps bigint,
  total_volume_kg numeric,
  baseline_volume_kg numeric,
  hardest_rpe "RPE"
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH logs AS (
    SELECT
      m.id AS movement_id,
      ml.movement_name,
      m.pattern_credits,
      ml.created_at,
      reps.total_reps * rounds.passes AS total_reps,
      reps.set_count * rounds.passes AS set_count,
      -- Session RPE inherited onto each movement it logged; hardest wins below.
      w.rpe,
      -- Volume normalized to kilograms; bodyweight / null weight contributes 0.
      -- Timed rungs hold seconds in rep_scheme, so they contribute no volume.
      CASE WHEN ml.timed_rungs THEN 0 ELSE
        reps.total_reps * rounds.passes * (
          CASE
            WHEN eff.weight_one_unit = 'pounds' THEN COALESCE(eff.weight_one_value, 0) * 0.45359237
            ELSE COALESCE(eff.weight_one_value, 0)
          END
          + CASE
            WHEN eff.weight_two_unit = 'pounds' THEN COALESCE(eff.weight_two_value, 0) * 0.45359237
            ELSE COALESCE(eff.weight_two_value, 0)
          END
        )
      END AS volume_kg
    FROM movement_logs ml
    LEFT JOIN workout_logs w ON w.id = ml.workout_log_id
    LEFT JOIN user_movements um ON um.id = ml.user_movement_id
    LEFT JOIN movements m ON m.id = um.functional_movement_id
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN ml.timed_rungs THEN 0 ELSE COALESCE(SUM(r), 0) END::bigint AS total_reps,
        COALESCE(COUNT(r), 0)::bigint AS set_count
      FROM unnest(ml.rep_scheme) AS r
    ) reps
    CROSS JOIN LATERAL (
      -- A shared-bell workout loads one weight; prefer it over the per-movement
      -- copy so pre-backfill / stale rows still report the weight actually used.
      -- Falls back to complex_set for rows written before the axes split.
      SELECT
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) THEN COALESCE(w.shared_weight_one_value::numeric, ml.weight_one_value) ELSE ml.weight_one_value END AS weight_one_value,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) THEN COALESCE(w.shared_weight_one_unit, ml.weight_one_unit) ELSE ml.weight_one_unit END AS weight_one_unit,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_value::numeric ELSE ml.weight_two_value END AS weight_two_value,
        CASE WHEN COALESCE(w.shared_bell, w.complex_set) AND w.shared_weight_one_value IS NOT NULL THEN w.shared_weight_two_unit ELSE ml.weight_two_unit END AS weight_two_unit
    ) eff
    CROSS JOIN LATERAL (
      -- One ladder pass scaled by completed rounds, doubled for one-handed
      -- (weight_two = 0) and mixed-weight movements, whose rungs mirror
      -- left/right — the client's shouldMirrorReps rule.
      SELECT
        GREATEST(COALESCE(w.completed_rounds, 1), 1)::bigint
        * CASE
            WHEN COALESCE(eff.weight_one_value, 0) > 0
              AND (eff.weight_two_value = 0
                OR (eff.weight_two_value > 0 AND eff.weight_two_value <> eff.weight_one_value))
            THEN 2 ELSE 1
          END AS passes
    ) rounds
    WHERE ml.user_id = auth.uid()
      AND ml.created_at >= now() - make_interval(days => p_baseline_days)
  )
  SELECT
    l.movement_id,
    l.movement_name,
    l.pattern_credits,
    max(l.created_at) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS last_trained_at,
    COALESCE(sum(l.set_count) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS set_count,
    COALESCE(sum(l.total_reps) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 0) AS total_reps,
    COALESCE(round(sum(l.volume_kg) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ), 2), 0) AS total_volume_kg,
    -- Baseline = the movement's typical per-window volume: total over the
    -- baseline window, scaled down to one window length.
    round(sum(l.volume_kg) * (p_window_days::numeric / GREATEST(p_baseline_days, 1)), 2) AS baseline_volume_kg,
    max(l.rpe) FILTER (
      WHERE l.created_at >= now() - make_interval(days => p_window_days)
    ) AS hardest_rpe
  FROM logs l
  GROUP BY l.movement_id, l.movement_name, l.pattern_credits;
$$;

-- RLS does the data scoping; only authenticated users may call it.
REVOKE ALL ON FUNCTION public.pattern_debt_movements(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pattern_debt_movements(int, int) TO authenticated;

DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT, UUID, JSONB, BOOLEAN, BOOLEAN);

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
       num_weeks, days_per_week, is_public, default_auto_repeat, stages,
       focus_tags, systemic_demand)
    SELECT v_user_id, id, NULL, title, description, author_name,
           num_weeks, days_per_week, false, default_auto_repeat, stages,
           focus_tags, systemic_demand
    FROM programs WHERE id = p_program_id
    RETURNING id INTO v_target_program;

    IF v_override THEN
      -- The modal (weightOne, weightTwo) pair across the program's sessions:
      -- the shared placeholder load every deliberately-different session is
      -- offset from, used only by the shared-bell uniform-fold path. Ties break
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
             AND NOT public.uses_shared_bell(ps.workout_options)
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
        -- Shared bell (one pair for every movement, e.g. an ABC), or a caller that
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
    -- Per-session shared weight for the shared-bell path: the enrollee's choice
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

CREATE OR REPLACE FUNCTION public.adjust_program_weights(
  p_user_program_id         UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL,
  p_movement_weights        JSONB   DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_program   UUID;
  v_modal_one NUMERIC;
  v_modal_two NUMERIC;
  v_updated   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_shared_weight_one_value IS NULL AND p_movement_weights IS NULL THEN
    RAISE EXCEPTION 'No weights provided';
  END IF;

  SELECT program_id INTO v_program
  FROM user_programs
  WHERE id = p_user_program_id
    AND user_id = v_user_id
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active enrollment % for this user', p_user_program_id;
  END IF;

  -- Shared-fold modal from the label-aware working baseline. Ties break toward
  -- the lighter pair, mirroring deriveStartingWeight / selectWeightModalSessions.
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
    -- Same label-aware baseline, then per-movement modal over those sessions.
    WITH ranked AS (
      SELECT
        ps_b.id,
        ps_b.workout_options,
        CASE
          WHEN ps_b.weight_label IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM program_session_completions c
                 WHERE c.user_program_id = p_user_program_id
                   AND c.program_session_id = ps_b.id
               )
            THEN 1
          WHEN ps_b.weight_label IS NULL
            THEN 2
          WHEN NOT EXISTS (
                 SELECT 1 FROM program_session_completions c
                 WHERE c.user_program_id = p_user_program_id
                   AND c.program_session_id = ps_b.id
               )
            THEN 3
          ELSE NULL
        END AS tier
      FROM program_sessions ps_b
      WHERE ps_b.program_id = v_program
    ),
    baseline AS (
      SELECT r.id, r.workout_options
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
        WHEN p_movement_weights IS NOT NULL
             AND NOT public.uses_shared_bell(ps2.workout_options)
          THEN jsonb_set(
                 ps2.workout_options,
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
                   FROM jsonb_array_elements(ps2.workout_options->'movements')
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
        ELSE jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       ps2.workout_options,
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
                 FROM jsonb_array_elements(ps2.workout_options->'movements') AS m
               ))
      END AS new_options
    FROM program_sessions ps2
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
            CASE WHEN ps2.workout_options->'movements'->0->>'weightOneUnit'
                      IS NOT DISTINCT FROM p_shared_weight_one_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightOneValue')::NUMERIC
                      - v_modal_one
            END, 0) AS one_delta,
          COALESCE(
            CASE WHEN ps2.workout_options->'movements'->0->>'weightTwoUnit'
                      IS NOT DISTINCT FROM p_shared_weight_two_unit
                 THEN (ps2.workout_options->'movements'->0->>'weightTwoValue')::NUMERIC
                      - v_modal_two
            END, 0) AS two_delta
      ) d
    ) w
    WHERE ps2.program_id = v_program
      AND NOT EXISTS (
        SELECT 1 FROM program_session_completions c
        WHERE c.user_program_id = p_user_program_id
          AND c.program_session_id = ps2.id
      )
  ) sub
  WHERE ps.id = sub.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_program_stage(
  p_user_program_id UUID,
  p_stage_index     INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_program UUID;
  v_stages  JSONB;
  v_stage   JSONB;
  v_updated INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT up.program_id, p.stages INTO v_program, v_stages
  FROM user_programs up
  JOIN programs p ON p.id = up.program_id
  WHERE up.id = p_user_program_id
    AND up.user_id = v_user_id
    AND up.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active enrollment % for this user', p_user_program_id;
  END IF;
  IF v_stages IS NULL OR jsonb_typeof(v_stages) <> 'array' THEN
    RAISE EXCEPTION 'PROGRAM_HAS_NO_STAGES';
  END IF;
  IF p_stage_index < 0 OR p_stage_index >= jsonb_array_length(v_stages) THEN
    RAISE EXCEPTION 'STAGE_INDEX_OUT_OF_RANGE';
  END IF;

  v_stage := v_stages -> p_stage_index;

  UPDATE program_sessions ps
  SET title = CASE
        WHEN NOT (public.uses_shared_bell(ps.workout_options)
                  AND ps.workout_options->'sharedWeightOneValue' IS NOT NULL
                  AND ps.workout_options->'sharedWeightOneValue' <> 'null'::jsonb)
          THEN ps.title
        WHEN ps.weight_label = 'Deload weeks'
          THEN 'Deload · ' || (v_stage->>'title')
        ELSE v_stage->>'title' END,
      workout_options = ps.workout_options || jsonb_build_object(
        'movements', (
          SELECT jsonb_agg(
                   m || CASE
                     WHEN public.uses_shared_bell(ps.workout_options)
                          AND ps.workout_options->'sharedWeightOneValue' IS NOT NULL
                          AND ps.workout_options->'sharedWeightOneValue' <> 'null'::jsonb
                     THEN jsonb_build_object(
                            'weightOneUnit',  ps.workout_options->'sharedWeightOneUnit',
                            'weightOneValue', ps.workout_options->'sharedWeightOneValue',
                            'weightTwoUnit',  ps.workout_options->'sharedWeightTwoUnit',
                            'weightTwoValue', ps.workout_options->'sharedWeightTwoValue')
                     ELSE COALESCE(
                       (SELECT jsonb_build_object(
                                 'weightOneUnit',  em->'weightOneUnit',
                                 'weightOneValue', em->'weightOneValue',
                                 'weightTwoUnit',  em->'weightTwoUnit',
                                 'weightTwoValue', em->'weightTwoValue')
                        FROM jsonb_array_elements(ps.workout_options->'movements') em
                        WHERE em->>'movementName' = m->>'movementName'
                        LIMIT 1),
                       jsonb_build_object(
                         'weightOneUnit',  NULL, 'weightOneValue', NULL,
                         'weightTwoUnit',  NULL, 'weightTwoValue', NULL))
                   END
                   ORDER BY ord)
          FROM jsonb_array_elements(v_stage->'movements')
                 WITH ORDINALITY AS e(m, ord)),
        'preWorkoutNotes', COALESCE(
          CASE WHEN ps.weight_label = 'Deload weeks'
               THEN v_stage->>'deloadPreWorkoutNotes' END,
          v_stage->>'preWorkoutNotes',
          ps.workout_options->>'preWorkoutNotes'))
  WHERE ps.program_id = v_program
    AND NOT EXISTS (
      SELECT 1 FROM program_session_completions c
      WHERE c.user_program_id = p_user_program_id
        AND c.program_session_id = ps.id
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE user_programs
  SET current_stage_index = p_stage_index
  WHERE id = p_user_program_id;

  RETURN v_updated;
END;
$$;
