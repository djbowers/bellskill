import { expect, test } from '@playwright/test';

// Program stages: set_program_stage backend behavior against local Supabase
// (auth + REST/RPC helpers mirror program-adjust-weights.spec.ts). Advancing an
// enrollment rewrites every NOT-yet-completed cloned session to the stage's
// title/movements/notes while each session keeps its own shared weights (work
// stays at the enrolled load, deloads stay light), and never touches sessions
// that already have a completion row.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const AA_SLUG = 'aa-protocol-plan-a';
const SE025_SLUG = 'strong-endurance-plan-025';
const CLEAN = 'One-Arm Kettlebell Clean';
const JERK = 'One-Arm Kettlebell Jerk';
const SWING = 'One-Arm Kettlebell Swing';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `progstage-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok)
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);

  const body = (await res.json()) as {
    access_token?: string;
    user?: { id: string };
  };
  if (body.access_token && body.user) {
    return { token: body.access_token, uid: body.user.id, email };
  }
  throw new Error('signup did not return a session');
}

interface RestOptions {
  body?: unknown;
  prefer?: string;
}

async function restJson<T = unknown>(
  method: string,
  path: string,
  token: string,
  opts: RestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      `${method} ${path} failed (${res.status}): ${await res.text()}`,
    );
  }
  return res.json() as Promise<T>;
}

async function rpc<T = unknown>(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok)
    throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function rpcError(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  expect(res.ok).toBe(false);
  return res.text();
}

interface MovementOpt {
  movementName: string;
  repScheme: number[];
  weightOneValue: number | null;
  weightOneUnit: string | null;
  weightTwoValue: number | null;
  weightTwoUnit: string | null;
}

interface SessionRow {
  id: string;
  sequence_index: number;
  title: string;
  weight_label: string | null;
  workout_options: {
    complexSet: boolean;
    workoutGoal: number;
    intervalTimer: number;
    preWorkoutNotes: string;
    sharedWeightOneValue: number | null;
    sharedWeightTwoValue: number | null;
    movements: MovementOpt[];
    [key: string]: unknown;
  };
}

async function orderedSessions(
  token: string,
  programId: string,
): Promise<SessionRow[]> {
  return restJson<SessionRow[]>(
    'GET',
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index,title,weight_label,workout_options&order=sequence_index.asc`,
    token,
  );
}

async function programIdBySlug(token: string, slug: string): Promise<string> {
  const [row] = await restJson<Array<{ id: string }>>(
    'GET',
    `programs?slug=eq.${slug}&select=id`,
    token,
  );
  return row.id;
}

interface EnrollmentRow {
  program_id: string;
  current_stage_index: number;
}

async function enrollmentRow(
  token: string,
  userProgramId: string,
): Promise<EnrollmentRow> {
  const [row] = await restJson<EnrollmentRow[]>(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=program_id,current_stage_index`,
    token,
  );
  return row;
}

async function insertWorkoutLog(user: TestUser): Promise<number> {
  const [row] = await restJson<Array<{ id: number }>>(
    'POST',
    'workout_logs',
    user.token,
    {
      prefer: 'return=representation',
      body: {
        user_id: user.uid,
        started_at: new Date().toISOString(),
        movements: [CLEAN, JERK],
        completed_reps: 10,
        completed_rounds: 1,
        completed_rungs: 1,
        workout_goal: 30,
      },
    },
  );
  return row.id;
}

async function completeSession(
  user: TestUser,
  userProgramId: string,
  sessionId: string,
): Promise<void> {
  const logId = await insertWorkoutLog(user);
  await rpc('complete_program_session', user.token, {
    p_user_program_id: userProgramId,
    p_program_session_id: sessionId,
    p_workout_log_id: logId,
  });
}

interface StageRow {
  stages: Array<{
    title: string;
    movements: Array<{ movementName: string; repScheme: number[] }>;
    preWorkoutNotes: string;
    deloadPreWorkoutNotes: string;
  }> | null;
}

test.describe('set_program_stage — A+A progression ladder', () => {
  test('template carries the 5-stage ladder, and the enroll clone copies it at stage 0', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);

    const [template] = await restJson<StageRow[]>(
      'GET',
      `programs?id=eq.${aaId}&select=stages`,
      user.token,
    );
    expect(template.stages).toHaveLength(5);
    expect(template.stages!.map((s) => s.title)).toEqual([
      'C+J',
      'C+J+C',
      'C+J+C+J',
      'C+J+C+J+C',
      'C+J+C+J+C+J',
    ]);
    // Alternating complex, surplus clean appended; reps stay [1] throughout.
    const last = template.stages![4];
    expect(last.movements.map((m) => m.movementName)).toEqual([
      CLEAN, JERK, CLEAN, JERK, CLEAN, JERK,
    ]);
    for (const stage of template.stages!) {
      for (const m of stage.movements) expect(m.repScheme).toEqual([1]);
      expect(stage.preWorkoutNotes).toBeTruthy();
      expect(stage.deloadPreWorkoutNotes).toContain('Deload');
    }

    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
    });
    const enrollment = await enrollmentRow(user.token, userProgramId);
    expect(enrollment.current_stage_index).toBe(0);

    const [clone] = await restJson<StageRow[]>(
      'GET',
      `programs?id=eq.${enrollment.program_id}&select=stages`,
      user.token,
    );
    expect(clone.stages).toEqual(template.stages);
  });

  test('advancing rewrites uncompleted sessions only, keeping per-session weights and cadence', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
    });
    const { program_id: cloneId } = await enrollmentRow(
      user.token,
      userProgramId,
    );

    const before = await orderedSessions(user.token, cloneId);
    const completedSession = before[0];
    await completeSession(user, userProgramId, completedSession.id);

    const updated = await rpc<number>('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 1,
    });
    expect(updated).toBe(before.length - 1);

    const after = await orderedSessions(user.token, cloneId);
    const enrollment = await enrollmentRow(user.token, userProgramId);
    expect(enrollment.current_stage_index).toBe(1);

    for (const session of after) {
      const prior = before.find((s) => s.id === session.id)!;

      if (session.id === completedSession.id) {
        // Completed history is untouched — still the stage it was done at.
        expect(session.title).toBe(prior.title);
        expect(session.workout_options).toEqual(prior.workout_options);
        continue;
      }

      const isDeload = session.weight_label === 'Deload weeks';
      expect(session.title).toBe(isDeload ? 'Deload · C+J+C' : 'C+J+C');

      // Stage 2 complex: clean, jerk, clean — at THIS session's shared weight.
      expect(session.workout_options.movements.map((m) => m.movementName))
        .toEqual([CLEAN, JERK, CLEAN]);
      for (const m of session.workout_options.movements) {
        expect(m.repScheme).toEqual([1]);
        expect(m.weightOneValue).toBe(prior.workout_options.sharedWeightOneValue);
        expect(m.weightTwoValue).toBe(prior.workout_options.sharedWeightTwoValue);
      }
      expect(session.workout_options.sharedWeightOneValue).toBe(
        prior.workout_options.sharedWeightOneValue,
      );

      // Notes swap to the stage's; goal and cadence stay put.
      expect(session.workout_options.preWorkoutNotes).toContain('C+J+C');
      if (isDeload) {
        expect(session.workout_options.preWorkoutNotes).toContain('Deload');
      }
      expect(session.workout_options.workoutGoal).toBe(
        prior.workout_options.workoutGoal,
      );
      expect(session.workout_options.intervalTimer).toBe(
        prior.workout_options.intervalTimer,
      );
      expect(session.workout_options.complexSet).toBe(true);
    }

    // Going back restores the first stage's shape on the same scope.
    await rpc('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 0,
    });
    const reverted = await orderedSessions(user.token, cloneId);
    for (const session of reverted) {
      if (session.id === completedSession.id) continue;
      const isDeload = session.weight_label === 'Deload weeks';
      expect(session.title).toBe(isDeload ? 'Deload · C+J' : 'C+J');
      expect(session.workout_options.movements.map((m) => m.movementName))
        .toEqual([CLEAN, JERK]);
    }
    expect(
      (await enrollmentRow(user.token, userProgramId)).current_stage_index,
    ).toBe(0);
  });

  test('rejects out-of-range indexes, ladder-less programs, and foreign enrollments', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
      p_queue: false,
    });

    expect(
      await rpcError('set_program_stage', user.token, {
        p_user_program_id: userProgramId,
        p_stage_index: 5,
      }),
    ).toContain('STAGE_INDEX_OUT_OF_RANGE');
    expect(
      await rpcError('set_program_stage', user.token, {
        p_user_program_id: userProgramId,
        p_stage_index: -1,
      }),
    ).toContain('STAGE_INDEX_OUT_OF_RANGE');

    // A different user cannot move this enrollment.
    const stranger = await signUpThrowawayUser();
    expect(
      await rpcError('set_program_stage', stranger.token, {
        p_user_program_id: userProgramId,
        p_stage_index: 1,
      }),
    ).toContain('No active enrollment');

    // A program without a ladder refuses stage moves.
    const dfwId = await programIdBySlug(stranger.token, 'dry-fighting-weight');
    const dfwEnrollment = await rpc<string>('enroll_in_program', stranger.token, {
      p_program_id: dfwId,
    });
    expect(
      await rpcError('set_program_stage', stranger.token, {
        p_user_program_id: dfwEnrollment,
        p_stage_index: 1,
      }),
    ).toContain('PROGRAM_HAS_NO_STAGES');
  });

  test('adjust_program_weights still folds correctly after an advance', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
    });
    const { program_id: cloneId } = await enrollmentRow(
      user.token,
      userProgramId,
    );

    await rpc('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 2,
    });
    await rpc('adjust_program_weights', user.token, {
      p_user_program_id: userProgramId,
      p_shared_weight_one_value: 28,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 0,
      p_shared_weight_two_unit: 'kilograms',
    });

    const after = await orderedSessions(user.token, cloneId);
    for (const session of after) {
      const isDeload = session.weight_label === 'Deload weeks';
      // Work modal 24 -> 28; deloads keep their authored -8 offset (16 -> 20).
      const expected = isDeload ? 20 : 28;
      expect(session.workout_options.sharedWeightOneValue).toBe(expected);
      expect(session.workout_options.movements).toHaveLength(4);
      for (const m of session.workout_options.movements) {
        expect(m.weightOneValue).toBe(expected);
      }
    }
  });
});

// Plan 025 exercises the generalized non-complex path: NULL shared weights,
// per-movement loads, and day-label titles the stage must not clobber.
test.describe('set_program_stage — Strong Endurance Plan 025 rep ladder', () => {
  test('template carries the 6-stage rep ladder, and the enroll clone copies it at stage 0', async () => {
    const user = await signUpThrowawayUser();
    const seId = await programIdBySlug(user.token, SE025_SLUG);

    const [template] = await restJson<StageRow[]>(
      'GET',
      `programs?id=eq.${seId}&select=stages`,
      user.token,
    );
    expect(template.stages).toHaveLength(6);
    expect(template.stages!.map((s) => s.title)).toEqual([
      'Sets of 5',
      'Sets of 6',
      'Sets of 7',
      'Sets of 8',
      'Sets of 9',
      'Sets of 10',
    ]);
    template.stages!.forEach((stage, i) => {
      expect(stage.movements).toHaveLength(1);
      expect(stage.movements[0].movementName).toBe(SWING);
      expect(stage.movements[0].repScheme).toEqual([5 + i]);
      // Day-agnostic note: high-day autoregulation plus Medium/Low derivation.
      expect(stage.preWorkoutNotes).toContain('80%');
      expect(stage.preWorkoutNotes).toContain('60%');
      expect(stage.deloadPreWorkoutNotes).toBeUndefined();
    });
    expect(template.stages![2].preWorkoutNotes).toContain('sets of 8');
    expect(template.stages![5].preWorkoutNotes).toContain('500 reps in 50 min');

    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: seId,
    });
    const enrollment = await enrollmentRow(user.token, userProgramId);
    expect(enrollment.current_stage_index).toBe(0);

    const [clone] = await restJson<StageRow[]>(
      'GET',
      `programs?id=eq.${enrollment.program_id}&select=stages`,
      user.token,
    );
    expect(clone.stages).toEqual(template.stages);
  });

  test('advancing rewrites uncompleted repSchemes and notes, preserving per-movement weights and day titles', async () => {
    const user = await signUpThrowawayUser();
    const seId = await programIdBySlug(user.token, SE025_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: seId,
    });
    const { program_id: cloneId } = await enrollmentRow(
      user.token,
      userProgramId,
    );

    const before = await orderedSessions(user.token, cloneId);
    expect(before.map((s) => s.title)).toEqual([
      'High volume',
      'Medium volume',
      'Low volume',
    ]);
    const completedSession = before[0];
    await completeSession(user, userProgramId, completedSession.id);

    const updated = await rpc<number>('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 1,
    });
    expect(updated).toBe(before.length - 1);
    expect(
      (await enrollmentRow(user.token, userProgramId)).current_stage_index,
    ).toBe(1);

    const after = await orderedSessions(user.token, cloneId);
    for (const session of after) {
      const prior = before.find((s) => s.id === session.id)!;

      if (session.id === completedSession.id) {
        expect(session.workout_options).toEqual(prior.workout_options);
        continue;
      }

      // Day-label titles survive the stage change on the non-complex path.
      expect(session.title).toBe(prior.title);

      // The single swing moves to sets of 6 at ITS OWN prior weights,
      // including weightTwoValue 0 (one-handed mode).
      expect(session.workout_options.movements).toHaveLength(1);
      const [swing] = session.workout_options.movements;
      const [priorSwing] = prior.workout_options.movements;
      expect(swing.movementName).toBe(SWING);
      expect(swing.repScheme).toEqual([6]);
      expect(swing.weightOneValue).toBe(priorSwing.weightOneValue);
      expect(swing.weightOneUnit).toBe(priorSwing.weightOneUnit);
      expect(swing.weightTwoValue).toBe(0);

      // Shared weights stay null; notes swap to the stage's; cadence stays.
      expect(session.workout_options.sharedWeightOneValue).toBeNull();
      expect(session.workout_options.preWorkoutNotes).toContain('Sets of 6');
      expect(session.workout_options.workoutGoal).toBe(
        prior.workout_options.workoutGoal,
      );
      expect(session.workout_options.intervalTimer).toBe(
        prior.workout_options.intervalTimer,
      );
      expect(session.workout_options.complexSet).toBe(false);
    }

    // Going back restores sets of 5 on the same scope.
    await rpc('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 0,
    });
    for (const session of await orderedSessions(user.token, cloneId)) {
      if (session.id === completedSession.id) continue;
      expect(session.workout_options.movements[0].repScheme).toEqual([5]);
    }
  });

  test('the final stage note says you graduated', async () => {
    const user = await signUpThrowawayUser();
    const seId = await programIdBySlug(user.token, SE025_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: seId,
    });
    const { program_id: cloneId } = await enrollmentRow(
      user.token,
      userProgramId,
    );

    await rpc('set_program_stage', user.token, {
      p_user_program_id: userProgramId,
      p_stage_index: 5,
    });
    for (const session of await orderedSessions(user.token, cloneId)) {
      expect(session.workout_options.movements[0].repScheme).toEqual([10]);
      expect(session.workout_options.preWorkoutNotes).toContain(
        '500 reps in 50 min',
      );
      expect(session.workout_options.preWorkoutNotes).toContain('heavier bell');
    }
  });
});
