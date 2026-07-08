import { expect, test } from '@playwright/test';

// PROD-219: reorder + delete for program sessions (owner-editable programs).
//
// These exercise the two SECURITY INVOKER RPCs against real Postgres — the
// UNIQUE (program_id, sequence_index) constraint is NOT deferrable, so the
// constraint-safety of the temp-offset reindex can only be proven here (MSW/unit
// tests mock the RPC and never touch the DB). Mirrors the REST-level style of
// program-schema.spec.ts / program-progress.spec.ts (real Postgres, no browser).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `reorder-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

async function rest(
  method: string,
  path: string,
  token: string,
  opts: RestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function restJson<T = unknown>(
  method: string,
  path: string,
  token: string,
  opts: RestOptions = {},
): Promise<T> {
  const res = await rest(method, path, token, opts);
  if (!res.ok)
    throw new Error(
      `${method} ${path} failed (${res.status}): ${await res.text()}`,
    );
  return res.json() as Promise<T>;
}

/** RPC call that returns the raw Response (void-returning RPCs give 204/no body). */
async function rpcRaw(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
}

interface SessionRow {
  id: string;
  sequence_index: number;
  week_number: number;
  day_number: number;
  title: string;
}

/** Create a private, owner-owned program with `count` contiguous sessions (0..count-1). */
async function createOwnedProgram(
  user: TestUser,
  daysPerWeek: number,
  count: number,
): Promise<{ programId: string; sessions: SessionRow[] }> {
  const [program] = await restJson<Array<{ id: string }>>(
    'POST',
    'programs',
    user.token,
    {
      body: {
        owner_id: user.uid,
        title: 'Reorder test program',
        num_weeks: Math.ceil(count / daysPerWeek),
        days_per_week: daysPerWeek,
      },
      prefer: 'return=representation',
    },
  );

  const rows = Array.from({ length: count }, (_, i) => ({
    program_id: program.id,
    sequence_index: i,
    week_number: Math.floor(i / daysPerWeek) + 1,
    day_number: (i % daysPerWeek) + 1,
    title: `Session ${i}`,
    workout_options: { movements: [`Move ${i}`] },
  }));
  await restJson('POST', 'program_sessions', user.token, {
    body: rows,
    prefer: 'return=representation',
  });

  return {
    programId: program.id,
    sessions: await getSessions(user, program.id),
  };
}

async function getSessions(
  user: TestUser,
  programId: string,
): Promise<SessionRow[]> {
  return restJson<SessionRow[]>(
    'GET',
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index,week_number,day_number,title&order=sequence_index.asc`,
    user.token,
  );
}

async function enroll(user: TestUser, programId: string): Promise<string> {
  const [row] = await restJson<Array<{ id: string }>>(
    'POST',
    'user_programs',
    user.token,
    {
      body: { user_id: user.uid, program_id: programId, status: 'active' },
      prefer: 'return=representation',
    },
  );
  return row.id;
}

async function completeSession(
  user: TestUser,
  userProgramId: string,
  sessionId: string,
  status: 'completed' | 'skipped',
  workoutLogId: number | null = null,
): Promise<void> {
  await restJson('POST', 'program_session_completions', user.token, {
    body: {
      user_program_id: userProgramId,
      program_session_id: sessionId,
      user_id: user.uid,
      status,
      workout_log_id: workoutLogId,
    },
    prefer: 'return=representation',
  });
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
        movements: ['Clean and Press'],
        completed_reps: 10,
        completed_rounds: 1,
        completed_rungs: 1,
        workout_goal: 30,
      },
    },
  );
  return row.id;
}

test.describe('program sessions — reorder', () => {
  test('a full reorder is constraint-safe and relabels week/day (a naive swap would 409)', async () => {
    const user = await signUpThrowawayUser();
    // days_per_week=2, 4 sessions: indices 0..3 → weeks 1,1,2,2.
    const { programId, sessions } = await createOwnedProgram(user, 2, 4);
    const [a, b, c, d] = sessions;

    // Reverse the order. Swapping any two adjacent indices with plain UPDATEs
    // would violate UNIQUE (program_id, sequence_index) mid-statement; the RPC's
    // temp-offset reindex must not.
    const res = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: programId,
      p_ordered_ids: [d.id, c.id, b.id, a.id],
    });
    expect(res.status).toBeLessThan(300); // no 409 unique violation

    const after = await getSessions(user, programId);
    // New contiguous order + relabeled week/day from days_per_week=2.
    expect(after.map((s) => s.id)).toEqual([d.id, c.id, b.id, a.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2, 3]);
    expect(after.map((s) => [s.week_number, s.day_number])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);
  });

  test('an adjacent swap (the exact naive-swap scenario) succeeds via the RPC', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 3, 3);
    const [a, b, c] = sessions;

    const res = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: programId,
      p_ordered_ids: [b.id, a.id, c.id],
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([b.id, a.id, c.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
  });

  test('reorder rejects an id list that is not a permutation of the program sessions', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 2, 3);
    const [a, b] = sessions;

    // Missing one id (wrong length).
    const short = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: programId,
      p_ordered_ids: [a.id, b.id],
    });
    expect(short.status).toBeGreaterThanOrEqual(400);

    // Duplicate id (right length, but not a permutation).
    const dup = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: programId,
      p_ordered_ids: [a.id, a.id, b.id],
    });
    expect(dup.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe('program sessions — delete', () => {
  test('delete removes the session and compacts survivors so add-after-delete is safe', async () => {
    const user = await signUpThrowawayUser();
    // days_per_week=3, 3 sessions 0..2.
    const { programId, sessions } = await createOwnedProgram(user, 3, 3);
    const [a, b, c] = sessions;

    // Delete the middle session. {0,1,2} → {0,2} would leave a gap; the RPC must
    // compact to contiguous {0,1}.
    const res = await rpcRaw('delete_program_session', user.token, {
      p_session_id: b.id,
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, c.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1]); // no gap
    // c relabeled to the second slot.
    expect(after[1]).toMatchObject({ week_number: 1, day_number: 2 });

    // The builder ADD path inserts at sequence_index = sessions.length (= 2).
    // With the gap closed this must NOT violate UNIQUE.
    const addRes = await rest('POST', 'program_sessions', user.token, {
      body: {
        program_id: programId,
        sequence_index: after.length, // 2
        week_number: 1,
        day_number: 3,
        title: 'Added after delete',
        workout_options: { movements: ['New'] },
      },
      prefer: 'return=representation',
    });
    expect(addRes.status).toBeLessThan(300); // no 409

    const final = await getSessions(user, programId);
    expect(final.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
  });
});

test.describe('program sessions — derivations stay correct', () => {
  // Mirror useActiveProgram: next = first session (by sequence_index) with no completion.
  const deriveNext = (
    sessions: SessionRow[],
    satisfied: Set<string>,
  ): SessionRow | undefined => sessions.find((s) => !satisfied.has(s.id));

  test('next-workout surfacing follows the new order after a reorder', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 2, 3);
    const [a, b, c] = sessions;
    const userProgramId = await enroll(user, programId);

    // Complete A (index 0). Next is now B (index 1).
    const logId = await insertWorkoutLog(user);
    await completeSession(user, userProgramId, a.id, 'completed', logId);

    let after = await getSessions(user, programId);
    let satisfied = new Set([a.id]);
    expect(deriveNext(after, satisfied)?.id).toBe(b.id);

    // Reorder to [C, A, B]: C=0, A=1, B=2. A is still done. Lowest unsatisfied is
    // now C (index 0), so the next surfaced session must become C.
    const reorderRes = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: programId,
      p_ordered_ids: [c.id, a.id, b.id],
    });
    expect(reorderRes.status).toBeLessThan(300);

    after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([c.id, a.id, b.id]);
    expect(deriveNext(after, satisfied)?.id).toBe(c.id);
  });

  test('progress view stays correct after a delete', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 3, 3);
    const [a, b, c] = sessions;
    const userProgramId = await enroll(user, programId);

    // A done (with a log), C skipped, B untouched.
    const logId = await insertWorkoutLog(user);
    await completeSession(user, userProgramId, a.id, 'completed', logId);
    await completeSession(user, userProgramId, c.id, 'skipped');

    // Delete the untouched B. Survivors compact to A(0), C(1).
    const delRes = await rpcRaw('delete_program_session', user.token, {
      p_session_id: b.id,
    });
    expect(delRes.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, c.id]);

    const completions = await restJson<
      Array<{
        program_session_id: string;
        status: string;
        workout_log_id: number | null;
      }>
    >(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}&select=program_session_id,status,workout_log_id`,
      user.token,
    );
    const byId = new Map(completions.map((x) => [x.program_session_id, x]));

    // useProgramProgress derivation: done / skipped / upcoming per surviving session.
    const state = (s: SessionRow) => {
      const cmp = byId.get(s.id);
      if (!cmp) return 'upcoming';
      return cmp.status === 'skipped' ? 'skipped' : 'done';
    };
    expect(state(after[0])).toBe('done');
    expect(byId.get(after[0].id)?.workout_log_id).toBe(logId);
    expect(state(after[1])).toBe('skipped');

    // 2 satisfied of 2 total → complete.
    const completedCount = after.filter((s) => state(s) !== 'upcoming').length;
    expect(completedCount).toBe(2);
    expect(completedCount).toBe(after.length);
  });
});

test.describe('program sessions — owner-only (shared program is read-only)', () => {
  async function getDfwProgramId(token: string): Promise<string> {
    const [row] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      token,
    );
    return row.id;
  }

  test('a non-owner cannot reorder or delete sessions of the shared DFW program', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);
    const dfwSessions = await getSessions(user, dfwId);

    // Reorder of the shared program is rejected (not owner).
    const reorderRes = await rpcRaw('reorder_program_sessions', user.token, {
      p_program_id: dfwId,
      p_ordered_ids: dfwSessions.map((s) => s.id),
    });
    expect(reorderRes.status).toBeGreaterThanOrEqual(400);

    // Delete of a shared session is rejected (RLS delete policy denies non-owners).
    const deleteRes = await rpcRaw('delete_program_session', user.token, {
      p_session_id: dfwSessions[0].id,
    });
    expect(deleteRes.status).toBeGreaterThanOrEqual(400);

    // The shared program is unchanged.
    const stillThere = await getSessions(user, dfwId);
    expect(stillThere.map((s) => s.sequence_index)).toEqual(
      dfwSessions.map((s) => s.sequence_index),
    );
  });
});
