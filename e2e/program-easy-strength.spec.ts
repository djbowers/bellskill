import { expect, test } from '@playwright/test';

// Backend coverage for the seeded shared "Easy Strength" program (Dan John),
// mirroring program-schema.spec.ts: hit the LOCAL Supabase REST API directly
// rather than driving the browser, since this is pure seed-data verification.
// Confirms the 10-workout / 2-week "Even Easier Strength" cycle carries the right
// rep schemes per session, the correct 5 movement patterns + weight modes, and
// that the approximated ascending-weight day flags itself in preWorkoutNotes.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const ES_SLUG = 'easy-strength';
const ES_SESSION_COUNT = 10;

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
  const email = `es-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);
  }

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

async function restJson<T = unknown>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function rpcPost<T = unknown>(
  fn: string,
  body: unknown,
  token: string,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST rpc/${fn} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ── Types for the seeded WorkoutOptions blob ─────────────────────────────────

interface MovementOpt {
  movementName: string;
  repScheme: number[];
  timedRungs?: boolean;
  weightOneValue: number | null;
  weightOneUnit: string | null;
  weightTwoValue: number | null;
  weightTwoUnit: string | null;
}
interface WorkoutOpts {
  complexSet: boolean;
  straightSets: boolean;
  workoutGoal: number;
  workoutGoalUnits: string;
  preWorkoutNotes: string;
  movements: MovementOpt[];
}
interface SessionRow {
  sequence_index: number;
  week_number: number;
  day_number: number;
  workout_options: WorkoutOpts;
}

// The "Even Easier Strength" 10-workout / 2-week cycle: one shared rep scheme per
// session applied across the rep-counted movements. The Farmer's Carry runs on
// the clock instead (a fixed 30-second rung), so it carries its own scheme.
const EXPECTED_REP_SCHEMES: number[][] = [
  [5, 5], // W1D1 2x5
  [5, 5], // W1D2 2x5
  [5, 3, 2], // W1D3 5-3-2
  [5, 5], // W1D4 2x5
  [5, 5], // W1D5 2x5
  [5, 5], // W2D1 2x5
  [1, 1, 1, 1, 1, 1], // W2D2 6x1 ascending (approximated)
  [10], // W2D3 1x10
  [5, 5], // W2D4 2x5
  [5, 3, 1], // W2D5 5-3-1
];

const EXPECTED_MOVEMENTS = [
  'Double Kettlebell Military Press',
  'Pull-Up',
  'Kettlebell Swing',
  'Double Kettlebell Front Squat',
  "Kettlebell Farmer's Carry",
];

const ASCENDING_DAY_SEQ = 6;

test.describe('program schema — Easy Strength seed', () => {
  test('is present, public, system-owned, with the right metadata', async () => {
    const user = await signUpThrowawayUser();

    const programs = await restJson<
      Array<{
        is_public: boolean;
        owner_id: string | null;
        num_weeks: number;
        days_per_week: number;
        author_name: string;
        title: string;
      }>
    >(`programs?slug=eq.${ES_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const es = programs[0];
    expect(es.is_public).toBe(true);
    expect(es.owner_id).toBeNull();
    expect(es.num_weeks).toBe(2);
    expect(es.days_per_week).toBe(5);
    expect(es.author_name).toBe('Dan John');
    expect(es.title).toBe('Easy Strength');
  });

  test('has 10 ordered sessions whose rep schemes follow the Week A/B cycle', async () => {
    const user = await signUpThrowawayUser();
    const [es] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ES_SLUG}&select=id`,
      user.token,
    );

    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${es.id}&select=sequence_index,week_number,day_number,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(ES_SESSION_COUNT);
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      Array.from({ length: ES_SESSION_COUNT }, (_, i) => i),
    );

    sessions.forEach((s, i) => {
      const expectedReps = EXPECTED_REP_SCHEMES[i];

      // The five movement patterns, in order, on every session.
      expect(s.workout_options.movements.map((m) => m.movementName)).toEqual(
        EXPECTED_MOVEMENTS,
      );

      // Each rep-counted movement carries this session's rep scheme; the timed
      // carry runs on its own fixed 30-second rung.
      for (const m of s.workout_options.movements) {
        if (m.movementName === "Kettlebell Farmer's Carry") {
          expect(m.timedRungs).toBe(true);
          expect(m.repScheme).toEqual([30]);
        } else {
          expect(m.repScheme).toEqual(expectedReps);
        }
      }

      // Straight sets: both sets of a movement before the next movement, per the
      // source template (20260724000002_easy_strength_straight_sets.sql).
      expect(s.workout_options.straightSets).toBe(true);

      // Goal is a fixed 1 round: one round == completing the whole ladder once.
      expect(s.workout_options.complexSet).toBe(false);
      expect(s.workout_options.workoutGoalUnits).toBe('rounds');
      expect(s.workout_options.workoutGoal).toBe(1);

      // Weight modes: press/squat/carry double, swing two-hand single, pull-up bodyweight.
      const byName = Object.fromEntries(
        s.workout_options.movements.map((m) => [m.movementName, m]),
      );
      expect(byName['Pull-Up'].weightOneValue).toBeNull();
      expect(byName['Pull-Up'].weightTwoValue).toBeNull();
      expect(byName['Kettlebell Swing'].weightOneValue).toBe(24);
      expect(byName['Kettlebell Swing'].weightTwoValue).toBeNull();
      expect(byName['Double Kettlebell Military Press'].weightTwoValue).toBe(
        24,
      );
      expect(byName['Double Kettlebell Front Squat'].weightTwoValue).toBe(
        24,
      );
      expect(byName["Kettlebell Farmer's Carry"].weightTwoValue).toBe(24);
      // The carry is a timed double-bell movement, not rep-counted.
      expect(byName["Kettlebell Farmer's Carry"].timedRungs).toBe(true);
    });
  });

  test('the ascending-weight day is 6 singles and flags its approximation in preWorkoutNotes', async () => {
    const user = await signUpThrowawayUser();
    const [es] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ES_SLUG}&select=id`,
      user.token,
    );

    const [session] = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${es.id}&sequence_index=eq.${ASCENDING_DAY_SEQ}&select=sequence_index,workout_options`,
      user.token,
    );

    expect(session.workout_options.movements[0].repScheme).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);

    // The seam that makes the schema-level approximation honest to the user: the
    // details must tell them to add weight manually across the six singles.
    const details = session.workout_options.preWorkoutNotes.toLowerCase();
    expect(details).toContain('add');
    expect(details).toMatch(/weight|load/);
    expect(details).toMatch(/single|placeholder|manual/);
  });

  // Starting the program means enrolling, which copy-clones the template into
  // user-owned sessions. Straight sets is the whole point of this program, so the
  // clone must carry it on every session — otherwise the builder opens with the
  // toggle off and the athlete runs Easy Strength as a circuit again.
  test('enrolling clones straightSets onto every session, so starting the program has it on by default', async () => {
    const user = await signUpThrowawayUser();
    const [es] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ES_SLUG}&select=id`,
      user.token,
    );

    const userProgramId = await rpcPost<string>(
      'enroll_in_program',
      { p_program_id: es.id },
      user.token,
    );

    const [enrollment] = await restJson<Array<{ program_id: string }>>(
      `user_programs?id=eq.${userProgramId}&select=program_id`,
      user.token,
    );

    const cloned = await restJson<Array<{ workout_options: WorkoutOpts }>>(
      `program_sessions?program_id=eq.${enrollment.program_id}&select=workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(cloned).toHaveLength(ES_SESSION_COUNT);
    expect(cloned.every((s) => s.workout_options.straightSets === true)).toBe(
      true,
    );
  });

  // The regression this feature exists for: enrolling with a starting weight
  // used to fold ONE weight onto every movement, turning the bodyweight pull-up
  // and single-bell swing into doubles. Per-movement weights must land in each
  // movement's own config shape.
  test('enrolling with per-movement weights preserves each movement’s config', async () => {
    const user = await signUpThrowawayUser();
    const [es] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${ES_SLUG}&select=id`,
      user.token,
    );

    const userProgramId = await rpcPost<string>(
      'enroll_in_program',
      {
        p_program_id: es.id,
        p_movement_weights: [
          {
            movementName: 'Double Kettlebell Military Press',
            weightOneValue: 20,
            weightOneUnit: 'kilograms',
            weightTwoValue: 20,
            weightTwoUnit: 'kilograms',
          },
          {
            movementName: 'Kettlebell Swing',
            weightOneValue: 32,
            weightOneUnit: 'kilograms',
            weightTwoValue: null,
            weightTwoUnit: null,
          },
          {
            movementName: 'Double Kettlebell Front Squat',
            weightOneValue: 28,
            weightOneUnit: 'kilograms',
            weightTwoValue: 28,
            weightTwoUnit: 'kilograms',
          },
          {
            movementName: "Kettlebell Farmer's Carry",
            weightOneValue: 40,
            weightOneUnit: 'kilograms',
            weightTwoValue: 40,
            weightTwoUnit: 'kilograms',
          },
        ],
      },
      user.token,
    );

    const [enrollment] = await restJson<Array<{ program_id: string }>>(
      `user_programs?id=eq.${userProgramId}&select=program_id`,
      user.token,
    );

    const [first] = await restJson<Array<{ workout_options: WorkoutOpts }>>(
      `program_sessions?program_id=eq.${enrollment.program_id}&sequence_index=eq.0&select=workout_options`,
      user.token,
    );
    const byName = Object.fromEntries(
      first.workout_options.movements.map((m) => [m.movementName, m]),
    );

    // Chosen weights land per movement, each in its own config shape.
    expect(byName['Double Kettlebell Military Press'].weightOneValue).toBe(20);
    expect(byName['Double Kettlebell Military Press'].weightTwoValue).toBe(20);
    expect(byName['Double Kettlebell Front Squat'].weightOneValue).toBe(28);
    expect(byName['Double Kettlebell Front Squat'].weightTwoValue).toBe(28);

    // Bodyweight stays bodyweight — never folded into a double.
    expect(byName['Pull-Up'].weightOneValue).toBeNull();
    expect(byName['Pull-Up'].weightTwoValue).toBeNull();

    // Single-bell swing keeps its empty second slot.
    expect(byName['Kettlebell Swing'].weightOneValue).toBe(32);
    expect(byName['Kettlebell Swing'].weightTwoValue).toBeNull();

    // The carry takes its chosen double load and stays timed.
    expect(byName["Kettlebell Farmer's Carry"].weightOneValue).toBe(40);
    expect(byName["Kettlebell Farmer's Carry"].weightTwoValue).toBe(40);
    expect(byName["Kettlebell Farmer's Carry"].timedRungs).toBe(true);
  });
});
