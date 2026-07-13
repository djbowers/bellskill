import { expect, test } from '@playwright/test';

// Slice 1 backend tests for the program-tracking schema. These exercise real
// Postgres behavior (RLS, the one-active-program partial unique index, the
// copy-on-enroll transaction, completion uniqueness) that MSW/unit tests can't,
// so they hit the REST API of the LOCAL Supabase directly rather than driving
// the browser. Auth mirrors e2e/workout-flow.spec.ts (password grant against
// local GoTrue), plus throwaway signups for the multi-user RLS cases.

// ── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';
const DFW_SESSION_COUNT = 14;
const SWING10K_SLUG = '10000-swing-challenge';
const SWING10K_SESSION_COUNT = 20;

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthSession {
  access_token: string;
  user: { id: string; email: string; [key: string]: unknown };
}

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function signUpThrowawayUser(): Promise<TestUser> {
  // Unique email per run so re-running against the same local DB never collides.
  const email = `prog-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as Partial<AuthSession>;
  // enable_confirmations=false locally, so signup returns a session directly.
  if (body.access_token && body.user) {
    return { token: body.access_token, uid: body.user.id, email };
  }

  // Fallback: sign in explicitly if the instance didn't auto-issue a session.
  const signInRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!signInRes.ok) {
    throw new Error(`sign-in failed (${signInRes.status}): ${await signInRes.text()}`);
  }
  const session = (await signInRes.json()) as AuthSession;
  return { token: session.access_token, uid: session.user.id, email };
}

// ── REST helpers ─────────────────────────────────────────────────────────────

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
    throw new Error(`${method} ${path} failed (${res.status}): ${await res.text()}`);
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
  if (!res.ok) {
    throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Fetch the shared DFW program's id (as any authenticated user).
async function getDfwProgramId(token: string): Promise<string> {
  const rows = await restJson<Array<{ id: string; is_public: boolean; owner_id: string | null }>>(
    'GET',
    `programs?slug=eq.${DFW_SLUG}&select=id,is_public,owner_id`,
    token,
  );
  expect(rows).toHaveLength(1);
  return rows[0].id;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('program schema — DFW seed', () => {
  test('the shared DFW program is present, public, system-owned, and has 14 ordered sessions', async () => {
    const user = await signUpThrowawayUser();

    const programs = await restJson<
      Array<{ id: string; is_public: boolean; owner_id: string | null; num_weeks: number; days_per_week: number }>
    >('GET', `programs?slug=eq.${DFW_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const dfw = programs[0];
    expect(dfw.is_public).toBe(true);
    expect(dfw.owner_id).toBeNull();
    expect(dfw.num_weeks).toBe(5);
    expect(dfw.days_per_week).toBe(3);

    const sessions = await restJson<
      Array<{ sequence_index: number; workout_options: { movements: unknown[] } }>
    >(
      'GET',
      `program_sessions?program_id=eq.${dfw.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(DFW_SESSION_COUNT);
    // Contiguous 0..13 order.
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      Array.from({ length: DFW_SESSION_COUNT }, (_, i) => i),
    );
    // Every session carries a runnable WorkoutOptions blob with >=1 movement.
    for (const s of sessions) {
      expect(Array.isArray(s.workout_options.movements)).toBe(true);
      expect(s.workout_options.movements.length).toBeGreaterThan(0);
    }
  });
});

test.describe('program schema — 10,000 Swing Challenge seed', () => {
  test('the shared 10k Swing Challenge is present, public, system-owned, with 20 flat sessions', async () => {
    const user = await signUpThrowawayUser();

    const programs = await restJson<
      Array<{ id: string; is_public: boolean; owner_id: string | null; num_weeks: number; days_per_week: number }>
    >('GET', `programs?slug=eq.${SWING10K_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const challenge = programs[0];
    expect(challenge.is_public).toBe(true);
    expect(challenge.owner_id).toBeNull();
    expect(challenge.num_weeks).toBe(4);
    expect(challenge.days_per_week).toBe(5);

    const sessions = await restJson<
      Array<{
        sequence_index: number;
        week_number: number;
        day_number: number;
        workout_options: {
          complexSet: boolean;
          intervalTimer: number;
          restTimer: number;
          workoutGoal: number;
          workoutGoalUnits: string;
          movements: Array<{
            movementName: string;
            repScheme: number[];
            weightOneUnit: string | null;
            weightOneValue: number | null;
            weightTwoUnit: string | null;
            weightTwoValue: number | null;
          }>;
        };
      }>
    >(
      'GET',
      `program_sessions?program_id=eq.${challenge.id}&select=sequence_index,week_number,day_number,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(SWING10K_SESSION_COUNT);
    // Contiguous 0..19 order.
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      Array.from({ length: SWING10K_SESSION_COUNT }, (_, i) => i),
    );
    // 4 weeks x 5 days, laid out in order.
    expect(sessions.map((s) => [s.week_number, s.day_number])).toEqual(
      Array.from({ length: SWING10K_SESSION_COUNT }, (_, i) => [
        Math.floor(i / 5) + 1,
        (i % 5) + 1,
      ]),
    );

    // Every session is the identical 500-swing conditioning target.
    for (const s of sessions) {
      const opts = s.workout_options;
      expect(opts.complexSet).toBe(false);
      expect(opts.intervalTimer).toBe(0);
      expect(opts.restTimer).toBe(0);
      expect(opts.workoutGoal).toBe(5);
      expect(opts.workoutGoalUnits).toBe('rounds');
      expect(opts.movements).toHaveLength(1);
      const [swing] = opts.movements;
      expect(swing.movementName).toBe('Kettlebell Swing');
      expect(swing.repScheme).toEqual([10, 15, 25, 50]);
      expect(swing.weightOneUnit).toBe('kilograms');
      expect(swing.weightOneValue).toBe(24);
      expect(swing.weightTwoUnit).toBeNull();
      expect(swing.weightTwoValue).toBeNull();
    }
  });
});

test.describe('program schema — RLS', () => {
  test('a user cannot read or write another user\'s private program', async () => {
    const alice = await signUpThrowawayUser();
    const bob = await signUpThrowawayUser();

    // Alice creates a private program she owns.
    const [program] = await restJson<Array<{ id: string }>>('POST', 'programs', alice.token, {
      body: {
        owner_id: alice.uid,
        title: "Alice's secret program",
        num_weeks: 1,
        days_per_week: 1,
      },
      prefer: 'return=representation',
    });
    expect(program.id).toBeTruthy();

    // Bob cannot see it.
    const bobView = await restJson<Array<unknown>>(
      'GET',
      `programs?id=eq.${program.id}&select=id`,
      bob.token,
    );
    expect(bobView).toHaveLength(0);

    // Bob cannot insert a session into Alice's program (RLS WITH CHECK rejects).
    const bobInsert = await rest('POST', 'program_sessions', bob.token, {
      body: {
        program_id: program.id,
        sequence_index: 0,
        week_number: 1,
        day_number: 1,
        title: 'injected',
        workout_options: { movements: [] },
      },
    });
    expect(bobInsert.status).toBe(403);
  });

  test('any user can read the shared DFW program but cannot write it', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);

    // Reads succeed.
    const sessions = await restJson<Array<unknown>>(
      'GET',
      `program_sessions?program_id=eq.${dfwId}&select=id`,
      user.token,
    );
    expect(sessions.length).toBe(DFW_SESSION_COUNT);

    // UPDATE is silently scoped out by the RLS USING clause (owner_id is NULL):
    // 0 rows affected, and the shared row is unchanged.
    const updated = await restJson<Array<unknown>>('PATCH', `programs?id=eq.${dfwId}`, user.token, {
      body: { title: 'hacked' },
      prefer: 'return=representation',
    });
    expect(updated).toHaveLength(0);

    const stillNamed = await restJson<Array<{ title: string }>>(
      'GET',
      `programs?id=eq.${dfwId}&select=title`,
      user.token,
    );
    expect(stillNamed[0].title).toBe('Dry Fighting Weight');

    // INSERT of a session into the shared program is rejected outright.
    const insert = await rest('POST', 'program_sessions', user.token, {
      body: {
        program_id: dfwId,
        sequence_index: 99,
        week_number: 9,
        day_number: 9,
        title: 'injected',
        workout_options: { movements: [] },
      },
    });
    expect(insert.status).toBe(403);
  });
});

test.describe('program schema — constraints', () => {
  test('a user may have at most one active enrollment', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);

    // First active enrollment succeeds.
    const [first] = await restJson<Array<{ id: string }>>('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: dfwId, status: 'active' },
      prefer: 'return=representation',
    });
    expect(first.id).toBeTruthy();

    // A second active enrollment violates one_active_program_per_user.
    const second = await rest('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: dfwId, status: 'active' },
    });
    expect(second.status).toBe(409);

    // But a non-active enrollment for the same user is fine.
    const [abandoned] = await restJson<Array<{ id: string }>>('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: dfwId, status: 'abandoned' },
      prefer: 'return=representation',
    });
    expect(abandoned.id).toBeTruthy();
  });

  test('a program session can be satisfied at most once per enrollment', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);

    const [enrollment] = await restJson<Array<{ id: string }>>('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: dfwId, status: 'active' },
      prefer: 'return=representation',
    });
    const [session] = await restJson<Array<{ id: string }>>(
      'GET',
      `program_sessions?program_id=eq.${dfwId}&select=id&order=sequence_index.asc&limit=1`,
      user.token,
    );

    const completionBody = {
      user_program_id: enrollment.id,
      program_session_id: session.id,
      user_id: user.uid,
      status: 'skipped',
    };

    const [completion] = await restJson<Array<{ id: string }>>(
      'POST',
      'program_session_completions',
      user.token,
      { body: completionBody, prefer: 'return=representation' },
    );
    expect(completion.id).toBeTruthy();

    const dup = await rest('POST', 'program_session_completions', user.token, {
      body: completionBody,
    });
    expect(dup.status).toBe(409);
  });
});

test.describe('program schema — enroll_in_program (copy-on-enroll)', () => {
  test('enrolling in the shared DFW clones it into an isolated, user-owned copy', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);

    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    expect(typeof userProgramId).toBe('string');

    // A new user-owned, private clone exists, linked back to the source.
    const clones = await restJson<
      Array<{ id: string; owner_id: string; is_public: boolean; source_program_id: string }>
    >(
      'GET',
      `programs?source_program_id=eq.${dfwId}&owner_id=eq.${user.uid}&select=id,owner_id,is_public,source_program_id`,
      user.token,
    );
    expect(clones).toHaveLength(1);
    const clone = clones[0];
    expect(clone.owner_id).toBe(user.uid);
    expect(clone.is_public).toBe(false);
    expect(clone.source_program_id).toBe(dfwId);

    // The clone's sessions match DFW's exactly (count + sequence + options).
    const cloneSessions = await restJson<
      Array<{ sequence_index: number; workout_options: unknown }>
    >(
      'GET',
      `program_sessions?program_id=eq.${clone.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );
    const dfwSessions = await restJson<
      Array<{ sequence_index: number; workout_options: unknown }>
    >(
      'GET',
      `program_sessions?program_id=eq.${dfwId}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );
    expect(cloneSessions).toHaveLength(DFW_SESSION_COUNT);
    expect(cloneSessions.map((s) => s.sequence_index)).toEqual(
      dfwSessions.map((s) => s.sequence_index),
    );
    expect(cloneSessions.map((s) => s.workout_options)).toEqual(
      dfwSessions.map((s) => s.workout_options),
    );

    // Exactly one active enrollment, pointing at the CLONE (not the shared DFW).
    const active = await restJson<Array<{ id: string; program_id: string; status: string }>>(
      'GET',
      `user_programs?user_id=eq.${user.uid}&status=eq.active&select=id,program_id,status`,
      user.token,
    );
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(userProgramId);
    expect(active[0].program_id).toBe(clone.id);

    // Editing the clone must NOT mutate the shared template (isolation).
    const [firstClone] = await restJson<Array<{ id: string }>>(
      'GET',
      `program_sessions?program_id=eq.${clone.id}&select=id&order=sequence_index.asc&limit=1`,
      user.token,
    );
    await restJson('PATCH', `program_sessions?id=eq.${firstClone.id}`, user.token, {
      body: { title: 'Edited by owner' },
      prefer: 'return=representation',
    });
    const dfwFirst = await restJson<Array<{ title: string }>>(
      'GET',
      `program_sessions?program_id=eq.${dfwId}&select=title&order=sequence_index.asc&limit=1`,
      user.token,
    );
    expect(dfwFirst[0].title).not.toBe('Edited by owner');
  });

  test('re-enrolling atomically switches the active program', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await getDfwProgramId(user.token);

    const firstEnrollment = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    const secondEnrollment = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    expect(secondEnrollment).not.toBe(firstEnrollment);

    // The first enrollment is now abandoned; exactly one active remains (the new one).
    const enrollments = await restJson<Array<{ id: string; status: string }>>(
      'GET',
      `user_programs?user_id=eq.${user.uid}&select=id,status`,
      user.token,
    );
    const active = enrollments.filter((e) => e.status === 'active');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(secondEnrollment);

    const previous = enrollments.find((e) => e.id === firstEnrollment);
    expect(previous?.status).toBe('abandoned');
  });
});
