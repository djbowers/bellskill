import { expect, test } from '@playwright/test';

// PROD-237: adjust_program_weights backend behavior, hit directly against local
// Supabase (auth + REST/RPC helpers mirror program-in-program-flow.spec.ts).
// The RPC re-bases every NOT-yet-completed cloned session onto new working
// weights, preserving authored per-session offsets, and never touches sessions
// that already have a completion row. Expectations are derived from the clone
// itself (modal + offset recomputed here) so the spec doesn't hard-code seed
// weights.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ES_SLUG = 'easy-strength';
const ABC_SLUG = 'armor-building-complex';
const AA_SLUG = 'aa-protocol-plan-a';
const DFW_SLUG = 'dry-fighting-weight';
const SWING = 'Kettlebell Swing';
const DFW_PRESS = 'Double Kettlebell Clean and Press';
const DELOAD_LABEL = 'Deload weeks';
const TEST_DAY_LABEL = 'Test day';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `progadjust-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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
  weight_label: string | null;
  workout_options: {
    complexSet: boolean;
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
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index,weight_label,workout_options&order=sequence_index.asc`,
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

async function cloneProgramId(
  token: string,
  userProgramId: string,
): Promise<string> {
  const [row] = await restJson<Array<{ program_id: string }>>(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=program_id`,
    token,
  );
  return row.program_id;
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
        movements: [SWING],
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

/** The modal (most common) weight pair a movement carries across the clone,
 *  tie-broken toward the lighter pair — the RPC's re-base baseline. */
function movementModal(
  sessions: SessionRow[],
  movementName: string,
): { one: number; two: number } {
  const counts = new Map<string, { one: number; two: number; count: number }>();
  for (const session of sessions) {
    for (const m of session.workout_options.movements) {
      if (m.movementName !== movementName || m.weightOneValue === null)
        continue;
      const key = `${m.weightOneValue}|${m.weightTwoValue}`;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else
        counts.set(key, {
          one: m.weightOneValue,
          two: m.weightTwoValue ?? 0,
          count: 1,
        });
    }
  }
  const modal = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.one - b.one || a.two - b.two,
  )[0];
  expect(modal).toBeDefined();
  return modal;
}

test.describe('adjust_program_weights — mid-program weight change', () => {
  test('per-movement adjust re-bases upcoming sessions, preserves offsets, skips completed and unlisted movements', async () => {
    const user = await signUpThrowawayUser();
    const esId = await programIdBySlug(user.token, ES_SLUG);
    // Clone verbatim — the seed's authored weights are the baseline.
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: esId,
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const before = await orderedSessions(user.token, cloneId);

    const modal = movementModal(before, SWING);
    const newWeight = modal.one + 4;

    // Lock in the first session before adjusting.
    await completeSession(user, userProgramId, before[0].id);

    const swingUnit = before
      .flatMap((s) => s.workout_options.movements)
      .find((m) => m.movementName === SWING)!.weightOneUnit;
    const updated = await rpc<number>('adjust_program_weights', user.token, {
      p_user_program_id: userProgramId,
      p_movement_weights: [
        {
          movementName: SWING,
          weightOneValue: newWeight,
          weightOneUnit: swingUnit,
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ],
    });
    expect(updated).toBe(before.length - 1);

    const after = await orderedSessions(user.token, cloneId);
    for (let i = 0; i < after.length; i++) {
      const beforeMovements = before[i].workout_options.movements;
      const afterMovements = after[i].workout_options.movements;
      expect(afterMovements).toHaveLength(beforeMovements.length);

      for (let j = 0; j < afterMovements.length; j++) {
        const was = beforeMovements[j];
        const now = afterMovements[j];
        if (i === 0) {
          // Completed session: untouched, swing included.
          expect(now).toEqual(was);
        } else if (was.movementName === SWING) {
          // Re-based: new working weight plus this session's authored offset
          // from the swing's modal (a zero delta passes straight through).
          const offset = (was.weightOneValue ?? 0) - modal.one;
          expect(now.weightOneValue).toBe(
            offset === 0 ? newWeight : Math.max(newWeight + offset, 1),
          );
          expect(now.weightOneUnit).toBe(swingUnit);
          // A one-bell swing entry keeps its shape (weight two from payload).
          expect(now.weightTwoValue).toBeNull();
          expect(now.repScheme).toEqual(was.repScheme);
        } else {
          // Movements not in the payload (incl. bodyweight) are untouched.
          expect(now).toEqual(was);
        }
      }
    }
  });

  test('complexSet adjust folds the shared pair uniformly onto upcoming sessions only', async () => {
    const user = await signUpThrowawayUser();
    const abcId = await programIdBySlug(user.token, ABC_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: abcId,
      p_shared_weight_one_value: 24,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 24,
      p_shared_weight_two_unit: 'kilograms',
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const before = await orderedSessions(user.token, cloneId);

    await completeSession(user, userProgramId, before[0].id);

    const updated = await rpc<number>('adjust_program_weights', user.token, {
      p_user_program_id: userProgramId,
      p_shared_weight_one_value: 28,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 28,
      p_shared_weight_two_unit: 'kilograms',
    });
    expect(updated).toBe(before.length - 1);

    const after = await orderedSessions(user.token, cloneId);
    // Completed session keeps the enrollment-time 24s.
    expect(after[0].workout_options).toEqual(before[0].workout_options);
    for (const session of after.slice(1)) {
      const options = session.workout_options;
      expect(options.sharedWeightOneValue).toBe(28);
      expect(options.sharedWeightTwoValue).toBe(28);
      for (const m of options.movements) {
        expect(m.weightOneValue).toBe(28);
        expect(m.weightTwoValue).toBe(28);
      }
    }
  });

  test('rejects an enrollment that is not the caller’s active one, and a weightless call', async () => {
    const user = await signUpThrowawayUser();
    await expect(
      rpc('adjust_program_weights', user.token, {
        p_user_program_id: '00000000-0000-0000-0000-000000000000',
        p_shared_weight_one_value: 24,
        p_shared_weight_one_unit: 'kilograms',
      }),
    ).rejects.toThrow(/No active enrollment/);

    const esId = await programIdBySlug(user.token, ES_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: esId,
    });
    await expect(
      rpc('adjust_program_weights', user.token, {
        p_user_program_id: userProgramId,
      }),
    ).rejects.toThrow(/No weights provided/);
  });
});

/** Assert A+A work/deload absolute loads (shared + every movement). */
function expectAaLoads(
  sessions: SessionRow[],
  workWeight: number,
  deloadWeight: number,
) {
  for (const session of sessions) {
    const isDeload = session.weight_label === DELOAD_LABEL;
    const expected = isDeload ? deloadWeight : workWeight;
    expect(session.workout_options.sharedWeightOneValue).toBe(expected);
    expect(session.workout_options.sharedWeightTwoValue).toBe(0);
    for (const m of session.workout_options.movements) {
      expect(m.weightOneValue).toBe(expected);
      expect(m.weightTwoValue).toBe(0);
    }
  }
}

async function adjustAaShared(
  token: string,
  userProgramId: string,
  weight: number,
): Promise<number> {
  return rpc<number>('adjust_program_weights', token, {
    p_user_program_id: userProgramId,
    p_shared_weight_one_value: weight,
    p_shared_weight_one_unit: 'kilograms',
    p_shared_weight_two_value: 0,
    p_shared_weight_two_unit: 'kilograms',
  });
}

test.describe('adjust_program_weights — A+A Plan A deload offsets', () => {
  test('enroll with shared weights then adjust keeps deload at chosen − 8', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    // UI-shaped enroll: pick a working bell (seed modal is 24; choose 20).
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
      p_shared_weight_one_value: 20,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 0,
      p_shared_weight_two_unit: 'kilograms',
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    expectAaLoads(await orderedSessions(user.token, cloneId), 20, 12);

    await adjustAaShared(user.token, userProgramId, 28);
    expectAaLoads(await orderedSessions(user.token, cloneId), 28, 20);
  });

  test('mid-block re-adjust after completing work does not double-apply deltas', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const before = await orderedSessions(user.token, cloneId);
    // Complete 4 of 6 work sessions so stale completed 24s would outvote
    // rebased upcoming work under the old all-sessions modal.
    const work = before.filter((s) => s.weight_label !== DELOAD_LABEL);
    expect(work).toHaveLength(6);
    for (const session of work.slice(0, 4)) {
      await completeSession(user, userProgramId, session.id);
    }

    await adjustAaShared(user.token, userProgramId, 28);
    const afterFirst = await orderedSessions(user.token, cloneId);
    // Completed rows untouched at enroll weight; upcoming work 28 / deload 20.
    for (const session of afterFirst) {
      const wasCompleted = work.slice(0, 4).some((w) => w.id === session.id);
      if (wasCompleted) {
        expect(session.workout_options.sharedWeightOneValue).toBe(24);
      } else if (session.weight_label === DELOAD_LABEL) {
        expect(session.workout_options.sharedWeightOneValue).toBe(20);
      } else {
        expect(session.workout_options.sharedWeightOneValue).toBe(28);
      }
    }

    // Second adjust: label-aware modal is incomplete work at 28, not stale 24.
    await adjustAaShared(user.token, userProgramId, 32);
    const afterSecond = await orderedSessions(user.token, cloneId);
    for (const session of afterSecond) {
      const wasCompleted = work.slice(0, 4).some((w) => w.id === session.id);
      if (wasCompleted) {
        expect(session.workout_options.sharedWeightOneValue).toBe(24);
      } else if (session.weight_label === DELOAD_LABEL) {
        expect(session.workout_options.sharedWeightOneValue).toBe(24);
      } else {
        expect(session.workout_options.sharedWeightOneValue).toBe(32);
      }
    }
  });

  test('adjusting when only deload sessions remain keeps chosen − 8', async () => {
    const user = await signUpThrowawayUser();
    const aaId = await programIdBySlug(user.token, AA_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: aaId,
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const before = await orderedSessions(user.token, cloneId);
    const work = before.filter((s) => s.weight_label !== DELOAD_LABEL);
    for (const session of work) {
      await completeSession(user, userProgramId, session.id);
    }

    // Naive incomplete-only modal would treat deload 16 as working and flatten.
    await adjustAaShared(user.token, userProgramId, 28);
    const after = await orderedSessions(user.token, cloneId);
    for (const session of after) {
      if (session.weight_label === DELOAD_LABEL) {
        expect(session.workout_options.sharedWeightOneValue).toBe(20);
        for (const m of session.workout_options.movements) {
          expect(m.weightOneValue).toBe(20);
        }
      } else {
        expect(session.workout_options.sharedWeightOneValue).toBe(24);
      }
    }
  });
});

test.describe('adjust_program_weights — DFW test-day offset', () => {
  test('per-movement adjust keeps Test day at chosen + 4', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await programIdBySlug(user.token, DFW_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
      p_movement_weights: [
        {
          movementName: DFW_PRESS,
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
        {
          movementName: 'Front Squat With Two Kettlebells',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
      ],
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const enrolled = await orderedSessions(user.token, cloneId);
    const testDay = enrolled.find((s) => s.weight_label === TEST_DAY_LABEL);
    expect(testDay).toBeDefined();
    const testPress = testDay!.workout_options.movements.find(
      (m) => m.movementName === DFW_PRESS,
    );
    expect(testPress?.weightOneValue).toBe(24); // 20 + 4

    await rpc<number>('adjust_program_weights', user.token, {
      p_user_program_id: userProgramId,
      p_movement_weights: [
        {
          movementName: DFW_PRESS,
          weightOneValue: 28,
          weightOneUnit: 'kilograms',
          weightTwoValue: 28,
          weightTwoUnit: 'kilograms',
        },
      ],
    });

    const after = await orderedSessions(user.token, cloneId);
    for (const session of after) {
      const press = session.workout_options.movements.find(
        (m) => m.movementName === DFW_PRESS,
      );
      if (!press) continue;
      const expected =
        session.weight_label === TEST_DAY_LABEL ? 32 : 28; // +4 on test day
      expect(press.weightOneValue).toBe(expected);
      expect(press.weightTwoValue).toBe(expected);
    }
  });
});
