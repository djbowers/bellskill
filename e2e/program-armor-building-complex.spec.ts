import { expect, test } from '@playwright/test';

// Backend tests for the seeded Armor Building Complex (Dan John) program — the
// FIRST shipped program to use complexSet=true. These assert the migration's
// data shape against the LOCAL Supabase REST API (not the browser): every
// session is a flowing double-KB complex (clean → press → squat, bells never
// set down), encoded so the ActiveWorkoutPage complex runtime treats one
// "continue" as one full round. Auth mirrors e2e/program-schema.spec.ts.

// ── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ABC_SLUG = 'armor-building-complex';
const ABC_SESSION_COUNT = 20;

// One round of the ABC: 2 cleans, 1 press, 3 squats. Each movement carries a
// SINGLE-element repScheme, so maxMovementRungs = 1 and a single "continue"
// press in the complex runtime completes a whole round.
const EXPECTED_MOVEMENTS = [
  { movementName: 'Two-Arm Kettlebell Clean', repScheme: [2] },
  { movementName: 'Two-Arm Kettlebell Military Press', repScheme: [1] },
  { movementName: 'Front Squat With Two Kettlebells', repScheme: [3] },
];

// Round-progression ramp (progression = add rounds, not weight), by sequence.
const EXPECTED_GOAL_RAMP = [
  5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10,
];

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

interface Movement {
  movementName: string;
  repScheme: number[];
  weightOneUnit: string | null;
  weightOneValue: number | null;
  weightTwoUnit: string | null;
  weightTwoValue: number | null;
}

interface WorkoutOptions {
  complexSet: boolean;
  intervalTimer: number;
  restTimer: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  movements: Movement[];
  sharedWeightOneUnit: string | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: string | null;
  sharedWeightTwoValue: number | null;
}

// ── Auth helper ──────────────────────────────────────────────────────────────

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `abc-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok)
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);

  const body = (await res.json()) as Partial<AuthSession>;
  if (body.access_token && body.user) {
    return { token: body.access_token, uid: body.user.id, email };
  }

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
  const session = (await signInRes.json()) as AuthSession;
  return { token: session.access_token, uid: session.user.id, email };
}

// ── REST helper ──────────────────────────────────────────────────────────────

async function restJson<T = unknown>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('program schema — Armor Building Complex seed', () => {
  test('is present, public, system-owned, with 20 ordered complex-set sessions', async () => {
    const user = await signUpThrowawayUser();

    const programs = await restJson<
      Array<{
        id: string;
        is_public: boolean;
        owner_id: string | null;
        author_name: string;
        num_weeks: number;
        days_per_week: number;
      }>
    >(`programs?slug=eq.${ABC_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const abc = programs[0];
    expect(abc.is_public).toBe(true);
    expect(abc.owner_id).toBeNull();
    expect(abc.author_name).toBe('Dan John');
    expect(abc.num_weeks).toBe(5);
    expect(abc.days_per_week).toBe(4);

    const sessions = await restJson<
      Array<{ sequence_index: number; workout_options: WorkoutOptions }>
    >(
      `program_sessions?program_id=eq.${abc.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(ABC_SESSION_COUNT);
    // Contiguous 0..19 order.
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      Array.from({ length: ABC_SESSION_COUNT }, (_, i) => i),
    );

    for (const [i, s] of sessions.entries()) {
      const wo = s.workout_options;

      // Every session is a flowing complex for rounds.
      expect(wo.complexSet).toBe(true);
      expect(wo.workoutGoalUnits).toBe('rounds');
      expect(wo.intervalTimer).toBe(0);
      expect(wo.restTimer).toBeGreaterThan(0); // rest is BETWEEN rounds

      // Rounds ramp upward toward the 10-round benchmark.
      expect(wo.workoutGoal).toBe(EXPECTED_GOAL_RAMP[i]);

      // The complex display reads the SHARED weight pair (double bells), so both
      // must be populated — DFW leaves these null; ABC must not.
      expect(wo.sharedWeightOneValue).toBeGreaterThan(0);
      expect(wo.sharedWeightTwoValue).toBeGreaterThan(0);
      expect(wo.sharedWeightOneUnit).toBe('kilograms');
      expect(wo.sharedWeightTwoUnit).toBe('kilograms');

      // Three movements as one chain, exact names + single-element repSchemes.
      expect(wo.movements).toHaveLength(3);
      wo.movements.forEach((m, mi) => {
        expect(m.movementName).toBe(EXPECTED_MOVEMENTS[mi].movementName);
        expect(m.repScheme).toEqual(EXPECTED_MOVEMENTS[mi].repScheme);
        // Double kettlebell: both bells loaded.
        expect(m.weightOneValue).toBeGreaterThan(0);
        expect(m.weightTwoValue).toBeGreaterThan(0);
      });

      // maxMovementRungs (longest repScheme) === 1, so one "continue" per round.
      const maxRungs = Math.max(...wo.movements.map((m) => m.repScheme.length));
      expect(maxRungs).toBe(1);
    }

    // The final session is the classic 10-round ABC benchmark.
    expect(sessions[ABC_SESSION_COUNT - 1].workout_options.workoutGoal).toBe(
      10,
    );
  });

  test('enrolling clones the ABC into an isolated user-owned copy', async () => {
    const user = await signUpThrowawayUser();

    const [abc] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ABC_SLUG}&select=id`,
      user.token,
    );

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enroll_in_program`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_program_id: abc.id }),
    });
    expect(res.ok).toBe(true);
    const userProgramId = (await res.json()) as string;
    expect(typeof userProgramId).toBe('string');

    // A user-owned, private clone with all 20 complex-set sessions preserved.
    const clones = await restJson<
      Array<{ id: string; owner_id: string; is_public: boolean }>
    >(
      `programs?source_program_id=eq.${abc.id}&owner_id=eq.${user.uid}&select=id,owner_id,is_public`,
      user.token,
    );
    expect(clones).toHaveLength(1);
    expect(clones[0].is_public).toBe(false);

    const cloneSessions = await restJson<
      Array<{ workout_options: WorkoutOptions }>
    >(
      `program_sessions?program_id=eq.${clones[0].id}&select=workout_options&order=sequence_index.asc`,
      user.token,
    );
    expect(cloneSessions).toHaveLength(ABC_SESSION_COUNT);
    expect(cloneSessions.every((s) => s.workout_options.complexSet)).toBe(true);
  });
});
