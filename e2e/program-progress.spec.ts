import { expect, test } from '@playwright/test';

// Slice 4 read contract: the progress page derives done / skipped / upcoming
// state (and the history link) entirely from the `program_session_completions`
// set joined to `program_sessions` — nothing from `workout_logs`. This asserts
// the exact REST shape `useProgramProgress` consumes against the LOCAL Supabase,
// mirroring program-next-workout.spec.ts (real-Postgres behavior, no browser).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `progview-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

type SessionState = 'done' | 'skipped' | 'upcoming';

test.describe('program progress — derived view', () => {
  test('completions map sessions to done/skipped/upcoming with the log link', async () => {
    const user = await signUpThrowawayUser();
    const [dfw] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      user.token,
    );
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfw.id,
    });
    const [{ program_id: cloneId }] = await restJson<
      Array<{ program_id: string }>
    >(
      'GET',
      `user_programs?id=eq.${userProgramId}&select=program_id`,
      user.token,
    );

    // Ordered sessions — exactly what the hook fetches.
    const sessions = await restJson<
      Array<{ id: string; sequence_index: number; week_number: number }>
    >(
      'GET',
      `program_sessions?program_id=eq.${cloneId}&select=id,sequence_index,week_number&order=sequence_index.asc`,
      user.token,
    );
    expect(sessions.length).toBeGreaterThanOrEqual(3);

    // Complete session 0 against a real log; skip session 1; leave the rest.
    const logId = await insertWorkoutLog(user);
    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: sessions[0].id,
      p_workout_log_id: logId,
    });
    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: sessions[1].id,
      p_status: 'skipped',
    });

    // The completion set the page derives progress from.
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
    const byId = new Map(completions.map((c) => [c.program_session_id, c]));

    const derive = (
      id: string,
    ): { state: SessionState; logId: number | null } => {
      const c = byId.get(id);
      if (!c) return { state: 'upcoming', logId: null };
      return {
        state: c.status === 'skipped' ? 'skipped' : 'done',
        logId: c.status === 'skipped' ? null : c.workout_log_id,
      };
    };

    expect(derive(sessions[0].id)).toEqual({ state: 'done', logId });
    expect(derive(sessions[1].id)).toEqual({ state: 'skipped', logId: null });
    expect(derive(sessions[2].id)).toEqual({ state: 'upcoming', logId: null });

    // "N of M sessions": 2 satisfied of all sessions.
    const satisfied = sessions.filter((s) => byId.has(s.id)).length;
    expect(satisfied).toBe(2);
  });
});
