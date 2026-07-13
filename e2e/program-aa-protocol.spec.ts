import { expect, test } from '@playwright/test';

// Focused backend test for the seeded StrongFirst "A+A Protocol, Plan A" program
// (PROD-229). This is the FIRST shipped program to use intervalTimer, so it
// asserts every session carries the non-zero EMOM interval plus the single-KB
// one-arm clean & jerk / minutes-goal shape the seed migration encodes. Like
// e2e/program-schema.spec.ts it hits the LOCAL Supabase REST API directly rather
// than driving the browser; programs REVOKE anon, so it authenticates as a
// throwaway user (public rows are readable by any authenticated user).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const AA_SLUG = 'aa-protocol-plan-a';
const MOVEMENT = 'One-Arm Kettlebell Clean and Jerk';
const EMOM_INTERVAL_SECONDS = 30;

// Per-session expectations, in sequence order: 4 progression stages building to
// 30 minutes, then the monthly deload (lighter + shorter).
const EXPECTED_SESSIONS = [
  { seq: 0, goal: 8, weight: 24 },
  { seq: 1, goal: 15, weight: 24 },
  { seq: 2, goal: 22, weight: 24 },
  { seq: 3, goal: 30, weight: 24 },
  { seq: 4, goal: 15, weight: 20 }, // deload
];

interface MovementOption {
  movementName: string;
  repScheme: number[];
  weightOneValue: number;
  weightTwoValue: number;
}

interface WorkoutOptions {
  complexSet: boolean;
  intervalTimer: number;
  restTimer: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  movements: MovementOption[];
}

async function signUpThrowawayUser(): Promise<string> {
  const email = `aa-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok)
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);

  const body = (await res.json()) as { access_token?: string };
  if (body.access_token) return body.access_token;

  const signInRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!signInRes.ok) {
    throw new Error(
      `sign-in failed (${signInRes.status}): ${await signInRes.text()}`,
    );
  }
  const session = (await signInRes.json()) as { access_token: string };
  return session.access_token;
}

async function restJson<T = unknown>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

test.describe('program schema — A+A Protocol "Plan A" seed', () => {
  test('is present, public, system-owned, with intervalTimer-paced sessions', async () => {
    const token = await signUpThrowawayUser();

    const programs = await restJson<
      Array<{
        id: string;
        title: string;
        author_name: string;
        is_public: boolean;
        owner_id: string | null;
        num_weeks: number;
        days_per_week: number;
      }>
    >(`programs?slug=eq.${AA_SLUG}&select=*`, token);

    expect(programs).toHaveLength(1);
    const aa = programs[0];
    expect(aa.title).toBe('A+A Protocol "Plan A"');
    expect(aa.author_name).toBe('Pavel Tsatsouline / StrongFirst');
    expect(aa.is_public).toBe(true);
    expect(aa.owner_id).toBeNull();
    expect(aa.num_weeks).toBe(4);
    expect(aa.days_per_week).toBe(3);

    const sessions = await restJson<
      Array<{ sequence_index: number; workout_options: WorkoutOptions }>
    >(
      `program_sessions?program_id=eq.${aa.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      token,
    );

    expect(sessions).toHaveLength(EXPECTED_SESSIONS.length);
    // Contiguous 0..N-1 order.
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      EXPECTED_SESSIONS.map((e) => e.seq),
    );

    sessions.forEach((s, i) => {
      const expected = EXPECTED_SESSIONS[i];
      const wo = s.workout_options;

      // The defining feature: every session is EMOM-paced by a non-zero interval,
      // with no separate between-set rest.
      expect(wo.intervalTimer).toBe(EMOM_INTERVAL_SECONDS);
      expect(wo.intervalTimer).toBeGreaterThan(0);
      expect(wo.restTimer).toBe(0);

      // Single-movement, minutes-goal shape (not a complex).
      expect(wo.complexSet).toBe(false);
      expect(wo.workoutGoalUnits).toBe('minutes');
      expect(wo.workoutGoal).toBe(expected.goal);
      expect(wo.movements).toHaveLength(1);

      const movement = wo.movements[0];
      expect(movement.movementName).toBe(MOVEMENT);
      expect(movement.repScheme).toEqual([1]);
      // One-handed: primary weight set, secondary 0 -> drives left/right EMOM
      // alternation at runtime.
      expect(movement.weightOneValue).toBe(expected.weight);
      expect(movement.weightTwoValue).toBe(0);
    });

    // Stages build monotonically to the 30-minute target, then the deload drops.
    const goals = sessions.map((s) => s.workout_options.workoutGoal);
    expect(goals.slice(0, 4)).toEqual([8, 15, 22, 30]);
    expect(goals[4]).toBeLessThan(goals[3]);
  });
});
