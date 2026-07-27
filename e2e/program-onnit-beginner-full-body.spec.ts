import { expect, test } from '@playwright/test';

// Backend coverage for the seeded shared "Onnit Beginner Full-Body" program,
// mirroring program-kettlebell-mile.spec.ts: hit the LOCAL Supabase REST API
// directly. A repeating workout (default_auto_repeat true) modeled as a single
// 3-round circuit. The assertions pin the "map to closest, drop hip-pass" catalog
// mapping and the per-movement loading modes so a rename can't silently break it.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ONNIT_SLUG = 'onnit-beginner-full-body';

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
  const email = `onnit-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

async function restJson<T = unknown>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${await res.text()}`);
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

// [name, reps, weightTwoValue] -- weightTwoValue 0 marks the one-handed (mirrored)
// movements; null marks the two-handed single-bell ones.
const EXPECTED_MOVEMENTS: Array<[string, number[], number | null]> = [
  ['Goblet Squat', [10], null],
  ['One-Arm Kettlebell Row', [8], 0],
  ['One-Arm Kettlebell Military Press', [5], 0],
  ['Kettlebell Swing', [15], null],
  ['Kettlebell Halo', [8], null],
  ['Kettlebell Figure 8', [5], null],
];

test.describe('program schema — Onnit Beginner Full-Body seed', () => {
  test('is present, public, system-owned, repeating, with the right metadata', async () => {
    const user = await signUpThrowawayUser();
    const programs = await restJson<
      Array<{
        is_public: boolean;
        owner_id: string | null;
        default_auto_repeat: boolean;
        author_name: string;
        title: string;
      }>
    >(`programs?slug=eq.${ONNIT_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const onnit = programs[0];
    expect(onnit.is_public).toBe(true);
    expect(onnit.owner_id).toBeNull();
    expect(onnit.default_auto_repeat).toBe(true);
    expect(onnit.author_name).toBe('Onnit');
    expect(onnit.title).toBe('Onnit Beginner Full-Body');
  });

  test('is one 3-round circuit with the mapped movements and loading modes', async () => {
    const user = await signUpThrowawayUser();
    const [onnit] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ONNIT_SLUG}&select=id`,
      user.token,
    );
    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${onnit.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(1);
    const opts = sessions[0].workout_options;
    // A circuit: rotate through the movements each round, 3 rounds.
    expect(opts.complexSet).toBe(false);
    expect(opts.straightSets).toBe(false);
    expect(opts.workoutGoal).toBe(3);
    expect(opts.workoutGoalUnits).toBe('rounds');

    expect(opts.movements).toHaveLength(EXPECTED_MOVEMENTS.length);
    opts.movements.forEach((mv, i) => {
      const [name, reps, weightTwo] = EXPECTED_MOVEMENTS[i];
      expect(mv.movementName).toBe(name);
      expect(mv.repScheme).toEqual(reps);
      expect(mv.weightOneValue).toBe(16);
      expect(mv.weightTwoValue).toBe(weightTwo);
    });
  });
});
