import { expect, test } from '@playwright/test';

// Session layout + delete for program sessions (owner-editable programs).
//
// These exercise the SECURITY INVOKER RPCs against real Postgres — the
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

type LayoutEntry = { id: string; week_number: number; day_number: number };

/** `[[week, day], ...]` per session → the RPC's layout array. */
const layout = (
  sessions: SessionRow[],
  slots: Array<[number, number]>,
): LayoutEntry[] =>
  sessions.map((s, i) => ({
    id: s.id,
    week_number: slots[i][0],
    day_number: slots[i][1],
  }));

const weekDay = (rows: SessionRow[]) =>
  rows.map((s) => [s.week_number, s.day_number]);

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
      body: {
        user_id: user.uid,
        program_id: programId,
        status: 'active',
        active_slot: 1,
      },
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

test.describe('program sessions — set layout', () => {
  test('a full reorder is constraint-safe and writes week/day explicitly (a naive swap would 409)', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 2, 4);
    const [a, b, c, d] = sessions;

    // Reverse the order. Swapping any two adjacent indices with plain UPDATEs
    // would violate UNIQUE (program_id, sequence_index) mid-statement; the RPC's
    // temp-offset reindex must not.
    const res = await rpcRaw('set_program_session_layout', user.token, {
      p_program_id: programId,
      p_layout: layout(
        [d, c, b, a],
        [
          [1, 1],
          [1, 2],
          [2, 1],
          [2, 2],
        ],
      ),
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([d.id, c.id, b.id, a.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2, 3]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);
  });

  test('sequence follows (week, day) regardless of array order, and uneven weeks survive', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 3, 3);
    const [a, b, c] = sessions;

    // Move C up into week 1 ahead of A, leave B alone in week 2 — sent shuffled.
    const res = await rpcRaw('set_program_session_layout', user.token, {
      p_program_id: programId,
      p_layout: layout(
        [b, a, c],
        [
          [2, 1],
          [1, 2],
          [1, 1],
        ],
      ),
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([c.id, a.id, b.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  test('clears the stored cadence so it derives from the sessions', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 2, 2);
    const [a, b] = sessions;

    await rpcRaw('set_program_session_layout', user.token, {
      p_program_id: programId,
      p_layout: layout(
        [a, b],
        [
          [1, 1],
          [2, 1],
        ],
      ),
    });

    const [program] = await restJson<
      Array<{ num_weeks: number | null; days_per_week: number | null }>
    >(
      'GET',
      `programs?id=eq.${programId}&select=num_weeks,days_per_week`,
      user.token,
    );
    expect(program).toEqual({ num_weeks: null, days_per_week: null });
  });

  test('rejects layouts that are not a full, contiguous permutation', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 2, 3);
    const [a, b, c] = sessions;

    const attempt = (p_layout: unknown) =>
      rpcRaw('set_program_session_layout', user.token, {
        p_program_id: programId,
        p_layout,
      });

    // Wrong length.
    expect(
      (
        await attempt(
          layout(
            [a, b],
            [
              [1, 1],
              [1, 2],
            ],
          ),
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    // Duplicate id.
    expect(
      (
        await attempt(
          layout(
            [a, a, b],
            [
              [1, 1],
              [1, 2],
              [1, 3],
            ],
          ),
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    // Weeks skip 2.
    expect(
      (
        await attempt(
          layout(
            [a, b, c],
            [
              [1, 1],
              [1, 2],
              [3, 1],
            ],
          ),
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    // Days collide.
    expect(
      (
        await attempt(
          layout(
            [a, b, c],
            [
              [1, 1],
              [1, 1],
              [2, 1],
            ],
          ),
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    // Days skip 2.
    expect(
      (
        await attempt(
          layout(
            [a, b, c],
            [
              [1, 1],
              [1, 3],
              [2, 1],
            ],
          ),
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    // Not an array.
    expect((await attempt({ id: a.id })).status).toBeGreaterThanOrEqual(400);

    // Nothing changed.
    expect(weekDay(await getSessions(user, programId))).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });
});

test.describe('program sessions — delete', () => {
  test('delete removes the session and compacts survivors so add-after-delete is safe', async () => {
    const user = await signUpThrowawayUser();
    const { programId, sessions } = await createOwnedProgram(user, 3, 3);
    const [a, b, c] = sessions;

    // Delete the middle session. {0,1,2} → {0,2} would leave a gap; the RPC must
    // compact to contiguous {0,1} and close the day gap in week 1.
    const res = await rpcRaw('delete_program_session', user.token, {
      p_session_id: b.id,
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, c.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [1, 2],
    ]);

    // The builder ADD path inserts at sequence_index = sessions.length (= 2).
    // With the gap closed this must NOT violate UNIQUE.
    const addRes = await rest('POST', 'program_sessions', user.token, {
      body: {
        program_id: programId,
        sequence_index: after.length,
        week_number: 1,
        day_number: 3,
        title: 'Added after delete',
        workout_options: { movements: ['New'] },
      },
      prefer: 'return=representation',
    });
    expect(addRes.status).toBeLessThan(300);

    const final = await getSessions(user, programId);
    expect(final.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
  });

  test('deleting the only session of a middle week closes the week gap', async () => {
    const user = await signUpThrowawayUser();
    // days_per_week=1, 3 sessions → weeks 1, 2, 3.
    const { programId, sessions } = await createOwnedProgram(user, 1, 3);
    const [a, b, c] = sessions;

    const res = await rpcRaw('delete_program_session', user.token, {
      p_session_id: b.id,
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, c.id]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  test('delete_program_week removes the week, renumbers later weeks, and cascades completions', async () => {
    const user = await signUpThrowawayUser();
    // days_per_week=2, 6 sessions → weeks 1,1,2,2,3,3.
    const { programId, sessions } = await createOwnedProgram(user, 2, 6);
    const [a, b, c, , e, f] = sessions;
    const userProgramId = await enroll(user, programId);
    await completeSession(user, userProgramId, c.id, 'skipped');

    const res = await rpcRaw('delete_program_week', user.token, {
      p_program_id: programId,
      p_week_number: 2,
    });
    expect(res.status).toBeLessThan(300);
    expect(await res.json()).toBe(2);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, b.id, e.id, f.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2, 3]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);

    const completions = await restJson<Array<{ program_session_id: string }>>(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}&select=program_session_id`,
      user.token,
    );
    expect(completions).toEqual([]);

    // A week with no sessions is an error, not a silent no-op.
    const missing = await rpcRaw('delete_program_week', user.token, {
      p_program_id: programId,
      p_week_number: 9,
    });
    expect(missing.status).toBeGreaterThanOrEqual(400);
  });

  test('compact_program_sessions ranks an appended row by its week/day', async () => {
    const user = await signUpThrowawayUser();
    // weeks 1, 2 with one session each.
    const { programId, sessions } = await createOwnedProgram(user, 1, 2);
    const [a, b] = sessions;

    // The builder appends a week-1 session at the end index, then compacts.
    const [added] = await restJson<SessionRow[]>(
      'POST',
      'program_sessions',
      user.token,
      {
        body: {
          program_id: programId,
          sequence_index: 2,
          week_number: 1,
          day_number: 2,
          title: 'Added to week 1',
          workout_options: { movements: ['New'] },
        },
        prefer: 'return=representation',
      },
    );
    const res = await rpcRaw('compact_program_sessions', user.token, {
      p_program_id: programId,
    });
    expect(res.status).toBeLessThan(300);

    const after = await getSessions(user, programId);
    expect(after.map((s) => s.id)).toEqual([a.id, added.id, b.id]);
    expect(after.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
    expect(weekDay(after)).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
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

    // Move C to week 1 day 1 ahead of A: C=0, A=1, B=2. A is still done. Lowest
    // unsatisfied is now C (index 0), so the next surfaced session must become C.
    const reorderRes = await rpcRaw('set_program_session_layout', user.token, {
      p_program_id: programId,
      p_layout: layout(
        [c, a, b],
        [
          [1, 1],
          [1, 2],
          [2, 1],
        ],
      ),
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

  test('a non-owner cannot relayout or delete sessions of the shared DFW program', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);
    const dfwSessions = await getSessions(user, dfwId);

    // Writing the current layout back is rejected (not owner).
    const layoutRes = await rpcRaw('set_program_session_layout', user.token, {
      p_program_id: dfwId,
      p_layout: dfwSessions.map((s) => ({
        id: s.id,
        week_number: s.week_number,
        day_number: s.day_number,
      })),
    });
    expect(layoutRes.status).toBeGreaterThanOrEqual(400);

    const weekRes = await rpcRaw('delete_program_week', user.token, {
      p_program_id: dfwId,
      p_week_number: 1,
    });
    expect(weekRes.status).toBeGreaterThanOrEqual(400);

    const compactRes = await rpcRaw('compact_program_sessions', user.token, {
      p_program_id: dfwId,
    });
    expect(compactRes.status).toBeGreaterThanOrEqual(400);

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
