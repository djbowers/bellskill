import { expect, test } from '@playwright/test';

// Backend coverage for the seeded shared "Strong Endurance Plan 025" program
// (swing/snatch A+A, PROD-243), mirroring program-kettlebell-mile.spec.ts: hit
// the LOCAL Supabase REST API directly rather than driving the browser, since
// this is pure seed-data verification.
//
// 025 is the catalog's first program with AUTOREGULATED volume, so the
// assertions pin the modeling decisions that would silently break it: the
// rounds CEILINGS (25/20/15) standing in for "no target", the OTM cadence
// (intervalTimer 60 + one-handed loading so arms alternate by the minute), the
// repeating one-week block (default_auto_repeat), and the notes that carry the
// real governor -- the talk test / StrongFirst Stop Signs and the 80%/60%
// derivation from the last high day.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SE_SLUG = 'strong-endurance-plan-025';
const SE_SESSION_COUNT = 3;

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
  const email = `se-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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

interface MovementOpt {
  movementName: string;
  repScheme: number[];
  weightOneValue: number | null;
  weightTwoValue: number | null;
}
interface WorkoutOpts {
  complexSet: boolean;
  intervalTimer: number;
  restTimer: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  preWorkoutNotes: string;
  movements: MovementOpt[];
}
interface SessionRow {
  sequence_index: number;
  week_number: number;
  day_number: number;
  title: string;
  workout_options: WorkoutOpts;
}

// Each ceiling is that day's share of the terminal 50-set high day, in rounds
// (one round = a left+right pair = two OTM sets): high 25, medium 20 (80%),
// low 15 (60%). Ceilings, not targets -- the notes govern.
const EXPECTED_CEILING_ROUNDS = [25, 20, 15];
const EXPECTED_TITLES = ['High volume', 'Medium volume', 'Low volume'];

test.describe('program schema — Strong Endurance Plan 025 seed', () => {
  test('is present, public, system-owned, and a repeating one-week block', async () => {
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
        description: string;
      }>
    >(`programs?slug=eq.${SE_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const se = programs[0];
    expect(se.is_public).toBe(true);
    expect(se.owner_id).toBeNull();
    // Open-ended plan: a 1-week, 3-day block that auto-repeats until the
    // athlete graduates at sets of 10.
    expect(se.num_weeks).toBe(1);
    expect(se.days_per_week).toBe(3);
    expect(se.default_auto_repeat).toBe(true);
    expect(se.author_name).toBe('Pavel Tsatsouline (StrongFirst)');
    expect(se.title).toBe('Strong Endurance Plan 025');

    // Goal metadata: the source labels 025 fat loss + aerobic base, NOT
    // strength -- the description must say so, so it is never mis-recommended
    // against a strength goal.
    const description = se.description.toLowerCase();
    expect(description).toContain('fat loss');
    expect(description).toContain('aerobic');
    expect(description).toContain('not strength');
    // The swing-vs-snatch branch is real in the source; the seed defaults to
    // the one-arm swing and the description offers the swap.
    expect(description).toContain('snatch');
  });

  test('has 3 OTM sessions in Friday-start order with autoregulated ceilings', async () => {
    const user = await signUpThrowawayUser();
    const [se] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${SE_SLUG}&select=id`,
      user.token,
    );

    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${se.id}&select=sequence_index,week_number,day_number,title,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(SE_SESSION_COUNT);
    expect(sessions.map((s) => s.sequence_index)).toEqual([0, 1, 2]);
    expect(sessions.map((s) => s.week_number)).toEqual([1, 1, 1]);
    expect(sessions.map((s) => s.day_number)).toEqual([1, 2, 3]);
    // The source starts on Friday: High, then Monday medium, Wednesday low.
    expect(sessions.map((s) => s.title)).toEqual(EXPECTED_TITLES);

    sessions.forEach((s, i) => {
      const opts = s.workout_options;
      const movements = opts.movements;

      // One movement, sets of 5 -- the whole session is one rung repeated OTM.
      expect(movements).toHaveLength(1);
      expect(movements[0].movementName).toBe('One-Arm Kettlebell Swing');
      expect(movements[0].repScheme).toEqual([5]);

      // OTM cadence: intervalTimer 60 fires one set per minute, and one-handed
      // loading (weightTwoValue 0 => '1h' mode) mirrors sides, so arms
      // alternate minute by minute exactly as the source prescribes.
      expect(opts.intervalTimer).toBe(60);
      expect(opts.restTimer).toBe(0);
      expect(movements[0].weightOneValue).toBe(24);
      expect(movements[0].weightTwoValue).toBe(0);

      // Autoregulation seam: the app has no "no target" unit, so each day
      // carries a rounds CEILING sized to its share of the terminal 50-set
      // high day. Auto-finish is the backstop; the notes are the governor.
      // Rounds, not minutes: a backgrounded minutes countdown ends short.
      expect(opts.workoutGoalUnits).toBe('rounds');
      expect(opts.workoutGoal).toBe(EXPECTED_CEILING_ROUNDS[i]);

      expect(opts.complexSet).toBe(false);
    });
  });

  test('the notes carry the real governor: talk test, stop signs, and 80/60 derivation', async () => {
    const user = await signUpThrowawayUser();
    const [se] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${SE_SLUG}&select=id`,
      user.token,
    );

    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${se.id}&select=sequence_index,workout_options&order=sequence_index.asc`,
      user.token,
    );

    // High day: the talk test and Stop Signs are the stop rule, the ceiling is
    // not a target, and the +1-rep-at-50-sets progression is user-triggered.
    const high = sessions[0].workout_options.preWorkoutNotes.toLowerCase();
    expect(high).toContain('talk test');
    expect(high).toContain('stop');
    expect(high).toMatch(/ceiling|not a target/);
    expect(high).toContain('50 sets');
    expect(high).toContain('add one rep');

    // Medium/low days: volume derives from the LAST HIGH DAY's set count --
    // the per-enrollment state the schema lacks lives in these notes.
    const medium = sessions[1].workout_options.preWorkoutNotes.toLowerCase();
    expect(medium).toContain('80%');
    expect(medium).toContain('high day');

    const low = sessions[2].workout_options.preWorkoutNotes.toLowerCase();
    expect(low).toContain('60%');
    expect(low).toContain('high day');
  });
});
