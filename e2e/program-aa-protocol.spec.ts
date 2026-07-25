import { expect, test } from '@playwright/test';

// Focused backend test for the seeded StrongFirst "A+A Protocol, Plan A" program
// (PROD-229). This is the FIRST shipped program to use intervalTimer AND the
// first single-arm complex, so it asserts every session carries the non-zero
// EMOM interval plus the single-KB, one-hand, decomposed clean+jerk complex the
// seed migration encodes. Like e2e/program-schema.spec.ts it hits the LOCAL
// Supabase REST API directly rather than driving the browser; programs REVOKE
// anon, so it authenticates as a throwaway user (public rows are readable by any
// authenticated user).
//
// The layout asserted here is the refit one from
// *_refit_aa_protocol_plan_a_autoregulated.sql (PROD-245), which reconciles the
// seed with the source article: duration is autoregulated (every session a
// 30-minute ceiling, not a ramp), and progression is milestone-based — the
// C+J -> C+J+C -> C+J+C+J stages ARE the session blocks, each a single-arm
// complex (one bell, weightTwoValue 0) so it alternates hands under EMOM and
// sums volume per lift. Every fourth week deloads one bell size lighter.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const AA_SLUG = 'aa-protocol-plan-a';
const CLEAN = 'One-Arm Kettlebell Clean';
const JERK = 'One-Arm Kettlebell Jerk';
const EMOM_INTERVAL_SECONDS = 30;
const GOAL_CEILING = 30;
const NUM_WEEKS = 12;
const DAYS_PER_WEEK = 2;
const WORKING_WEIGHT = 24;
// "-8kg for gentlemen" from the 24 kg placeholder.
const DELOAD_WEIGHT = 16;
const DELOAD_WEEKS = [4, 8, 12];

// The decomposed complex per milestone stage (no compound "Clean and Jerk").
const STAGE_MOVEMENTS: Record<number, string[]> = {
  1: [CLEAN, JERK], // C+J
  2: [CLEAN, JERK, CLEAN], // C+J+C
  3: [CLEAN, JERK, CLEAN, JERK], // C+J+C+J
};
const STAGE_BY_WEEK: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1,
  5: 2, 6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3, 12: 3,
};

interface ExpectedSession {
  seq: number;
  week: number;
  day: number;
  weight: number;
  isDeload: boolean;
  movements: string[];
}

// 12 weeks x 2 days = 24 sessions, in sequence order.
const EXPECTED_SESSIONS: ExpectedSession[] = [];
{
  let seq = 0;
  for (let week = 1; week <= NUM_WEEKS; week++) {
    const stage = STAGE_BY_WEEK[week];
    const isDeload = DELOAD_WEEKS.includes(week);
    for (let day = 1; day <= DAYS_PER_WEEK; day++) {
      EXPECTED_SESSIONS.push({
        seq: seq++,
        week,
        day,
        weight: isDeload ? DELOAD_WEIGHT : WORKING_WEIGHT,
        isDeload,
        movements: STAGE_MOVEMENTS[stage],
      });
    }
  }
}

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
  sharedWeightOneValue: number;
  sharedWeightTwoValue: number;
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
  test('is present, public, system-owned, with single-arm complex EMOM sessions', async () => {
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

      // Twice a week for twelve weeks — the cadence the program advertises.
      expect(s.week_number).toBe(expected.week);
      expect(s.day_number).toBe(expected.day);

      // The defining feature: every session is EMOM-paced by a non-zero interval,
      // with no separate between-set rest.
      expect(wo.intervalTimer).toBe(EMOM_INTERVAL_SECONDS);
      expect(wo.restTimer).toBe(0);

      // Autoregulated duration: a 30-minute ceiling on every session (the note,
      // not the goal, tells the athlete to stop early on a failed talk test).
      expect(wo.workoutGoalUnits).toBe('minutes');
      expect(wo.workoutGoal).toBe(GOAL_CEILING);

      // Single-arm complex: one shared bell (weightTwo 0), decomposed lifts.
      expect(wo.complexSet).toBe(true);
      expect(wo.sharedWeightOneValue).toBe(expected.weight);
      expect(wo.sharedWeightTwoValue).toBe(0);

      // Stage decomposition: C+J -> C+J+C -> C+J+C+J, in order, no compound lift.
      expect(wo.movements.map((m) => m.movementName)).toEqual(
        expected.movements,
      );
      wo.movements.forEach((movement) => {
        expect(movement.repScheme).toEqual([1]);
        // One-handed single bell: primary weight set, secondary 0 -> drives the
        // left/right EMOM alternation at runtime.
        expect(movement.weightOneValue).toBe(expected.weight);
        expect(movement.weightTwoValue).toBe(0);
      });
    });

    // Every session belongs to exactly one of twelve weeks, two days apiece.
    expect(new Set(sessions.map((s) => s.week_number)).size).toBe(NUM_WEEKS);
    for (let week = 1; week <= NUM_WEEKS; week++) {
      const inWeek = sessions.filter((s) => s.week_number === week);
      expect(inWeek).toHaveLength(DAYS_PER_WEEK);
      expect(inWeek.map((s) => s.day_number)).toEqual([1, 2]);
    }

    // Duration is autoregulated, not a ramp: every session shares the 30-minute
    // ceiling, deloads included.
    expect(
      sessions.every((s) => s.workout_options.workoutGoal === GOAL_CEILING),
    ).toBe(true);

    // The deload group carries an authored name so the enrollment picker can
    // label its weight control something better than "8 kg lighter".
    for (const s of sessions) {
      expect(s.weight_label).toBe(
        DELOAD_WEEKS.includes(s.week_number) ? 'Deload weeks' : null,
      );
    }

    // Deload weeks are the same stage complex, one bell size lighter (24 -> 16).
    for (const week of DELOAD_WEEKS) {
      const deload = sessions.filter((s) => s.week_number === week);
      for (const s of deload) {
        expect(s.workout_options.sharedWeightOneValue).toBe(DELOAD_WEIGHT);
        for (const movement of s.workout_options.movements) {
          // "-8kg for gentlemen" — one kettlebell size below the working load.
          expect(movement.weightOneValue).toBe(WORKING_WEIGHT - 8);
        }
      }
    }
  });
});
