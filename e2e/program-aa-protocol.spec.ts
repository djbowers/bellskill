import { expect, test } from '@playwright/test';

// Focused backend test for the seeded StrongFirst "A+A Protocol, Plan A" program
// (PROD-229). This is the FIRST shipped program to use intervalTimer, so it
// asserts every session carries the non-zero EMOM interval plus the single-KB
// one-arm clean & jerk / minutes-goal shape the seed migration encodes. Like
// e2e/program-schema.spec.ts it hits the LOCAL Supabase REST API directly rather
// than driving the browser; programs REVOKE anon, so it authenticates as a
// throwaway user (public rows are readable by any authenticated user).
//
// The layout asserted here is the reshaped one from
// *_reshape_aa_protocol_plan_a.sql, which reconciles the seed with the source
// article: twice a week for eight weeks, a duration ramp toward 30 minutes, and
// every fourth week deloaded one bell size lighter at the SAME duration.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const AA_SLUG = 'aa-protocol-plan-a';
const MOVEMENT = 'One-Arm Kettlebell Clean and Jerk';
const EMOM_INTERVAL_SECONDS = 30;
const NUM_WEEKS = 8;
const DAYS_PER_WEEK = 2;
const WORKING_WEIGHT = 24;
// "-8kg for gentlemen" from the 24 kg placeholder.
const DELOAD_WEIGHT = 16;
const DELOAD_WEEKS = [4, 8];

// Per-session expectations, in sequence order.
const EXPECTED_SESSIONS = [
  { seq: 0, week: 1, day: 1, goal: 10, weight: WORKING_WEIGHT },
  { seq: 1, week: 1, day: 2, goal: 12, weight: WORKING_WEIGHT },
  { seq: 2, week: 2, day: 1, goal: 14, weight: WORKING_WEIGHT },
  { seq: 3, week: 2, day: 2, goal: 16, weight: WORKING_WEIGHT },
  { seq: 4, week: 3, day: 1, goal: 18, weight: WORKING_WEIGHT },
  { seq: 5, week: 3, day: 2, goal: 20, weight: WORKING_WEIGHT },
  { seq: 6, week: 4, day: 1, goal: 20, weight: DELOAD_WEIGHT },
  { seq: 7, week: 4, day: 2, goal: 20, weight: DELOAD_WEIGHT },
  { seq: 8, week: 5, day: 1, goal: 22, weight: WORKING_WEIGHT },
  { seq: 9, week: 5, day: 2, goal: 24, weight: WORKING_WEIGHT },
  { seq: 10, week: 6, day: 1, goal: 26, weight: WORKING_WEIGHT },
  { seq: 11, week: 6, day: 2, goal: 28, weight: WORKING_WEIGHT },
  { seq: 12, week: 7, day: 1, goal: 30, weight: WORKING_WEIGHT },
  { seq: 13, week: 7, day: 2, goal: 30, weight: WORKING_WEIGHT },
  { seq: 14, week: 8, day: 1, goal: 30, weight: DELOAD_WEIGHT },
  { seq: 15, week: 8, day: 2, goal: 30, weight: DELOAD_WEIGHT },
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
    expect(aa.num_weeks).toBe(NUM_WEEKS);
    expect(aa.days_per_week).toBe(DAYS_PER_WEEK);

    const sessions = await restJson<
      Array<{
        sequence_index: number;
        week_number: number;
        day_number: number;
        weight_label: string | null;
        workout_options: WorkoutOptions;
      }>
    >(
      `program_sessions?program_id=eq.${aa.id}&select=sequence_index,week_number,day_number,weight_label,workout_options&order=sequence_index.asc`,
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

      // Twice a week for eight weeks — the cadence the program advertises.
      expect(s.week_number).toBe(expected.week);
      expect(s.day_number).toBe(expected.day);

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

    // Every session belongs to exactly one of eight weeks, two days apiece.
    expect(new Set(sessions.map((s) => s.week_number)).size).toBe(NUM_WEEKS);
    for (let week = 1; week <= NUM_WEEKS; week++) {
      const inWeek = sessions.filter((s) => s.week_number === week);
      expect(inWeek).toHaveLength(DAYS_PER_WEEK);
      expect(inWeek.map((s) => s.day_number)).toEqual([1, 2]);
    }

    // Duration never regresses: the ramp builds toward the 30-minute target and
    // each deload week HOLDS the preceding week's duration rather than cutting
    // it — the source deloads by dropping a bell size, nothing else.
    const goals = sessions.map((s) => s.workout_options.workoutGoal);
    for (let i = 1; i < goals.length; i++) {
      expect(goals[i]).toBeGreaterThanOrEqual(goals[i - 1]);
    }
    expect(goals[goals.length - 1]).toBe(30);

    // The deload group carries an authored name so the enrollment picker can
    // label its weight control something better than "8 kg lighter".
    for (const s of sessions) {
      expect(s.weight_label).toBe(
        DELOAD_WEEKS.includes(s.week_number) ? 'Deload weeks' : null,
      );
    }

    for (const week of DELOAD_WEEKS) {
      const deload = sessions.filter((s) => s.week_number === week);
      const priorWeek = sessions.filter((s) => s.week_number === week - 1);
      const priorDuration = priorWeek[priorWeek.length - 1].workout_options
        .workoutGoal;
      for (const s of deload) {
        expect(s.workout_options.workoutGoal).toBe(priorDuration);
        // "-8kg for gentlemen" — one kettlebell size below the working load.
        expect(s.workout_options.movements[0].weightOneValue).toBe(
          WORKING_WEIGHT - 8,
        );
      }
    }
  });
});
