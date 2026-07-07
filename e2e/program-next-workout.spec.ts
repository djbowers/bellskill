import { expect, test } from '@playwright/test';

// Slice 3 backend behavior: the next-unsatisfied-session cursor and the
// complete_program_session RPC (record completion / skip, advance, and flip the
// enrollment to `completed` on the final session). These are real-Postgres
// behaviors, so — like program-schema.spec.ts — this hits the LOCAL Supabase
// REST/RPC surface directly rather than driving the browser. Auth mirrors
// program-schema.spec.ts.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `prognext-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

interface SessionRow {
  id: string;
  sequence_index: number;
}

// Mirror useActiveProgram's client-side cursor: the lowest-sequence session with
// no completion row yet.
async function nextSession(
  token: string,
  userProgramId: string,
  programId: string,
): Promise<SessionRow | null> {
  const sessions = await restJson<SessionRow[]>(
    'GET',
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index&order=sequence_index.asc`,
    token,
  );
  const completions = await restJson<Array<{ program_session_id: string }>>(
    'GET',
    `program_session_completions?user_program_id=eq.${userProgramId}&select=program_session_id`,
    token,
  );
  const satisfied = new Set(completions.map((c) => c.program_session_id));
  return sessions.find((s) => !satisfied.has(s.id)) ?? null;
}

async function getEnrollment(
  token: string,
  userProgramId: string,
): Promise<{
  status: string;
  completed_at: string | null;
  program_id: string;
}> {
  const rows = await restJson<
    Array<{ status: string; completed_at: string | null; program_id: string }>
  >(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=status,completed_at,program_id`,
    token,
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

// Insert a minimal-but-valid workout_logs row and return its id, so a completion
// can link to a real log (as it does in the app via useLogWorkout).
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

test.describe('program next-workout — complete/skip/advance', () => {
  test('completing a session advances the cursor and links the workout log', async () => {
    const user = await signUpThrowawayUser();
    const [dfw] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      user.token,
    );
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfw.id,
    });
    const { program_id: cloneId } = await getEnrollment(
      user.token,
      userProgramId,
    );

    // Cursor starts at sequence 0.
    const first = await nextSession(user.token, userProgramId, cloneId);
    expect(first?.sequence_index).toBe(0);

    // Complete it against a real workout_logs row.
    const logId = await insertWorkoutLog(user);
    const doneAll = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: first!.id,
      p_workout_log_id: logId,
    });
    expect(doneAll).toBe(false); // DFW has 14 sessions — not done after one.

    // A completion row exists, linked to the log, status completed.
    const completions = await restJson<
      Array<{ workout_log_id: number | null; status: string }>
    >(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}&program_session_id=eq.${first!.id}&select=workout_log_id,status`,
      user.token,
    );
    expect(completions).toHaveLength(1);
    expect(completions[0].status).toBe('completed');
    expect(completions[0].workout_log_id).toBe(logId);

    // Cursor advanced to sequence 1.
    const second = await nextSession(user.token, userProgramId, cloneId);
    expect(second?.sequence_index).toBe(1);
  });

  test('skipping writes a skipped completion (no log) and advances', async () => {
    const user = await signUpThrowawayUser();
    const [dfw] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      user.token,
    );
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfw.id,
    });
    const { program_id: cloneId } = await getEnrollment(
      user.token,
      userProgramId,
    );

    const first = await nextSession(user.token, userProgramId, cloneId);
    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: first!.id,
      p_status: 'skipped',
    });

    const completions = await restJson<
      Array<{ workout_log_id: number | null; status: string }>
    >(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}&program_session_id=eq.${first!.id}&select=workout_log_id,status`,
      user.token,
    );
    expect(completions[0].status).toBe('skipped');
    expect(completions[0].workout_log_id).toBeNull();

    const second = await nextSession(user.token, userProgramId, cloneId);
    expect(second?.sequence_index).toBe(1);
  });

  test('satisfying every session flips the enrollment to completed', async () => {
    const user = await signUpThrowawayUser();
    const [dfw] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      user.token,
    );
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfw.id,
    });
    const { program_id: cloneId } = await getEnrollment(
      user.token,
      userProgramId,
    );

    // Walk the whole program by skipping every session; the final call returns
    // true and flips the enrollment.
    let lastResult = false;
    for (;;) {
      const next = await nextSession(user.token, userProgramId, cloneId);
      if (!next) break;
      lastResult = await rpc<boolean>('complete_program_session', user.token, {
        p_user_program_id: userProgramId,
        p_program_session_id: next.id,
        p_status: 'skipped',
      });
    }

    expect(lastResult).toBe(true);
    const enrollment = await getEnrollment(user.token, userProgramId);
    expect(enrollment.status).toBe('completed');
    expect(enrollment.completed_at).not.toBeNull();
  });

  test('a duplicate completion is a harmless no-op (idempotent)', async () => {
    const user = await signUpThrowawayUser();
    const [dfw] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      user.token,
    );
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfw.id,
    });
    const { program_id: cloneId } = await getEnrollment(
      user.token,
      userProgramId,
    );
    const first = await nextSession(user.token, userProgramId, cloneId);

    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: first!.id,
      p_status: 'skipped',
    });
    // Second call for the same session must not throw or duplicate.
    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: first!.id,
      p_status: 'skipped',
    });

    const completions = await restJson<Array<unknown>>(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}&program_session_id=eq.${first!.id}`,
      user.token,
    );
    expect(completions).toHaveLength(1);
  });
});
