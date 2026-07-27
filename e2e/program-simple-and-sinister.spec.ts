import { expect, test } from '@playwright/test';

// Backend coverage for the seeded shared "Simple & Sinister" program (Pavel
// Tsatsouline, StrongFirst), mirroring program-kettlebell-mile.spec.ts: hit the
// LOCAL Supabase REST API directly rather than driving the browser, since this is
// seed-data + RPC-behavior verification.
//
// S&S is the catalog's first REPEATING WORKOUT (default_auto_repeat true). The
// assertions cover the two things that would silently break it: the single-session
// swing+get-up shape with one-handed mirror loading (weightTwoValue 0), and -- the
// real point -- that finishing an auto-repeat enrollment LOOPS rather than flipping
// to 'completed'.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SS_SLUG = 'simple-and-sinister';

interface AuthSession {
  access_token: string;
  user: { id: string; email: string; [key: string]: unknown };
}
interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `ss-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signup failed (${res.status}): ${await res.text()}`);

  const body = (await res.json()) as Partial<AuthSession>;
  if (body.access_token && body.user) {
    return { token: body.access_token, uid: body.user.id, email };
  }

  const signInRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!signInRes.ok)
    throw new Error(`sign-in failed (${signInRes.status}): ${await signInRes.text()}`);
  const s = (await signInRes.json()) as AuthSession;
  return { token: s.access_token, uid: s.user.id, email };
}

async function restJson<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${await res.text()}`);
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
  if (!res.ok) throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface MovementOpt {
  movementName: string;
  repScheme: number[];
  weightOneValue: number | null;
  weightTwoValue: number | null;
}
interface WorkoutOpts {
  complexSet: boolean;
  straightSets?: boolean;
  intervalTimer: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  movements: MovementOpt[];
}
interface SessionRow {
  sequence_index: number;
  workout_options: WorkoutOpts;
}

test.describe('program schema — Simple & Sinister seed', () => {
  test('is present, public, system-owned, repeating, with the right metadata', async () => {
    const user = await signUpThrowawayUser();
    const programs = await restJson<
      Array<{
        is_public: boolean;
        owner_id: string | null;
        num_weeks: number | null;
        days_per_week: number | null;
        default_auto_repeat: boolean;
        author_name: string;
        title: string;
      }>
    >(`programs?slug=eq.${SS_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const ss = programs[0];
    expect(ss.is_public).toBe(true);
    expect(ss.owner_id).toBeNull();
    expect(ss.default_auto_repeat).toBe(true);
    // A repeating workout has no fixed length.
    expect(ss.num_weeks).toBeNull();
    expect(ss.days_per_week).toBeNull();
    expect(ss.author_name).toBe('Pavel Tsatsouline (StrongFirst)');
    expect(ss.title).toBe('Simple & Sinister');
  });

  test('is one session: 100 one-arm swings then 10 get-ups, mirrored', async () => {
    const user = await signUpThrowawayUser();
    const [ss] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${SS_SLUG}&select=id`,
      user.token,
    );
    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${ss.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(1);
    const opts = sessions[0].workout_options;
    expect(opts.complexSet).toBe(false);
    // All swings, then all get-ups.
    expect(opts.straightSets).toBe(true);
    expect(opts.intervalTimer).toBe(0);
    expect(opts.workoutGoal).toBe(1);
    expect(opts.workoutGoalUnits).toBe('rounds');

    const [swing, getup] = opts.movements;
    expect(opts.movements).toHaveLength(2);

    expect(swing.movementName).toBe('One-Arm Kettlebell Swing');
    expect(swing.repScheme).toEqual([10, 10, 10, 10, 10]); // 5 rungs, mirrored -> 100
    expect(swing.weightOneValue).toBe(24);
    expect(swing.weightTwoValue).toBe(0); // single-bell '1h' mode: mirror per hand

    expect(getup.movementName).toBe('Kettlebell Turkish Get-Up');
    expect(getup.repScheme).toEqual([1, 1, 1, 1, 1]); // 5 rungs, mirrored -> 10
    expect(getup.weightOneValue).toBe(24);
    expect(getup.weightTwoValue).toBe(0);
  });

  test('finishing an auto-repeat enrollment loops instead of completing', async () => {
    const user = await signUpThrowawayUser();
    const [ss] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${SS_SLUG}&select=id`,
      user.token,
    );

    // Enroll: default_auto_repeat true flows into user_programs.auto_repeat.
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: ss.id,
    });

    const [enrollment] = await restJson<
      Array<{ status: string; auto_repeat: boolean; cycles_completed: number; program_id: string }>
    >(
      `user_programs?id=eq.${userProgramId}&select=status,auto_repeat,cycles_completed,program_id`,
      user.token,
    );
    expect(enrollment.auto_repeat).toBe(true);
    expect(enrollment.cycles_completed).toBe(0);

    // The single cloned session.
    const [cloneSession] = await restJson<Array<{ id: string }>>(
      `program_sessions?program_id=eq.${enrollment.program_id}&select=id&order=sequence_index.asc`,
      user.token,
    );

    // Complete it. The program has one session, so this satisfies "all" -- but
    // auto_repeat must loop rather than finish.
    const doneAll = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: cloneSession.id,
    });
    expect(doneAll).toBe(false); // never reports "complete" for a repeating workout

    const [after] = await restJson<
      Array<{ status: string; cycles_completed: number }>
    >(
      `user_programs?id=eq.${userProgramId}&select=status,cycles_completed`,
      user.token,
    );
    // Still active, one cycle banked...
    expect(after.status).toBe('active');
    expect(after.cycles_completed).toBe(1);

    // ...and progress reset, so the same session is served again next.
    const completions = await restJson<Array<{ program_session_id: string }>>(
      `program_session_completions?user_program_id=eq.${userProgramId}&select=program_session_id`,
      user.token,
    );
    expect(completions).toHaveLength(0);
  });
});
