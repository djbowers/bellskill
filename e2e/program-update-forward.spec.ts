import { expect, test } from '@playwright/test';

// update_program_sessions_forward backend behavior, hit directly against local
// Supabase (auth + REST/RPC helpers mirror program-in-program-flow.spec.ts).
// The RPC is the "this and all future sessions" half of the session-edit save:
// the client rewrites the edited session in full, then the RPC jsonb-merges
// only the movement prescription (movements, shared weights, complexSet) into
// every LATER session the caller hasn't completed — each later session keeps
// its own title, goal, and other workout_options keys, and completed sessions
// are never touched.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `progforward-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

async function rpc<T = unknown>(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await rpcRaw(fn, token, args);
  if (!res.ok)
    throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface SessionRow {
  id: string;
  sequence_index: number;
  title: string;
  workout_options: {
    complexSet: boolean;
    movements: Array<{ movementName: string; [key: string]: unknown }>;
    workoutGoal?: number;
    [key: string]: unknown;
  };
}

async function orderedSessions(
  token: string,
  programId: string,
): Promise<SessionRow[]> {
  return restJson<SessionRow[]>(
    'GET',
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index,title,workout_options&order=sequence_index.asc`,
    token,
  );
}

async function enrollInDfw(
  user: TestUser,
): Promise<{ userProgramId: string; cloneId: string }> {
  const [dfw] = await restJson<Array<{ id: string }>>(
    'GET',
    `programs?slug=eq.${DFW_SLUG}&select=id`,
    user.token,
  );
  const userProgramId = await rpc<string>('enroll_in_program', user.token, {
    p_program_id: dfw.id,
  });
  const [enrollment] = await restJson<Array<{ program_id: string }>>(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=program_id`,
    user.token,
  );
  return { userProgramId, cloneId: enrollment.program_id };
}

async function completeSession(
  user: TestUser,
  userProgramId: string,
  programSessionId: string,
): Promise<void> {
  const [log] = await restJson<Array<{ id: number }>>(
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
  await rpc('complete_program_session', user.token, {
    p_user_program_id: userProgramId,
    p_program_session_id: programSessionId,
    p_workout_log_id: log.id,
  });
}

// The propagated slice the client sends: a new movement prescription.
const NEW_MOVEMENTS = [
  {
    movementName: 'Clean, Jerk, and Clean',
    repScheme: [5],
    weightOneValue: 24,
    weightOneUnit: 'kilograms',
    weightTwoValue: null,
    weightTwoUnit: null,
  },
];
const FORWARD_OPTIONS = {
  movements: NEW_MOVEMENTS,
  sharedWeightOneValue: 24,
  sharedWeightOneUnit: 'kilograms',
  sharedWeightTwoValue: null,
  sharedWeightTwoUnit: null,
  complexSet: false,
};

test.describe('update_program_sessions_forward', () => {
  test('rewrites later incomplete sessions only, preserving their own titles and goals', async () => {
    const user = await signUpThrowawayUser();
    const { userProgramId, cloneId } = await enrollInDfw(user);
    const before = await orderedSessions(user.token, cloneId);
    expect(before.length).toBeGreaterThan(3);

    // Session 0 completed; session 3 completed out of order (stays untouched).
    await completeSession(user, userProgramId, before[0].id);
    await completeSession(user, userProgramId, before[3].id);

    // Editing session 1 forward.
    const updated = await rpc<number>(
      'update_program_sessions_forward',
      user.token,
      { p_session_id: before[1].id, p_forward_options: FORWARD_OPTIONS },
    );
    // Every session after index 1 except the completed one at index 3.
    expect(updated).toBe(before.length - 3);

    const after = await orderedSessions(user.token, cloneId);
    for (const [i, session] of after.entries()) {
      const original = before[i];
      // Titles and non-propagated options always survive.
      expect(session.title).toBe(original.title);
      expect(session.workout_options.workoutGoal).toEqual(
        original.workout_options.workoutGoal,
      );

      const untouched = i <= 1 || i === 3;
      const expectedMovements = untouched
        ? original.workout_options.movements
        : NEW_MOVEMENTS;
      expect(session.workout_options.movements).toEqual(expectedMovements);
      if (!untouched) {
        expect(session.workout_options.sharedWeightOneValue).toBe(24);
        expect(session.workout_options.complexSet).toBe(false);
      }
    }
  });

  test('rejects a caller who does not own the program', async () => {
    const owner = await signUpThrowawayUser();
    const { cloneId } = await enrollInDfw(owner);
    const [first] = await orderedSessions(owner.token, cloneId);

    const stranger = await signUpThrowawayUser();
    const res = await rpcRaw('update_program_sessions_forward', stranger.token, {
      p_session_id: first.id,
      p_forward_options: FORWARD_OPTIONS,
    });
    // The stranger can't even see the clone (RLS), so the session lookup fails.
    expect(res.ok).toBe(false);
  });

  test('rejects empty options', async () => {
    const user = await signUpThrowawayUser();
    const { cloneId } = await enrollInDfw(user);
    const [first] = await orderedSessions(user.token, cloneId);

    const res = await rpcRaw('update_program_sessions_forward', user.token, {
      p_session_id: first.id,
      p_forward_options: {},
    });
    expect(res.ok).toBe(false);
  });
});
