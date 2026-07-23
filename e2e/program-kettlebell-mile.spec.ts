import { expect, test } from '@playwright/test';

// Backend coverage for the seeded shared "Kettlebell Mile" program (Dr. Mike
// Prevost, StrongFirst), mirroring program-easy-strength.spec.ts: hit the LOCAL
// Supabase REST API directly rather than driving the browser, since this is pure
// seed-data verification.
//
// This is the catalog's first carry-centric program and its first user of timed
// rungs (PROD-200), so the assertions below are mostly about the two things that
// would silently break it: `timedRungs` surviving into the stored blob, and the
// one-handed weight mode (weightTwoValue 0) that makes the runtime alternate
// hands. It also pins the distance -> time approximation to the test session's
// workoutDetails, so the modeling call can never quietly disappear.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const KM_SLUG = 'kettlebell-mile';
const KM_SESSION_COUNT = 8;
const TEST_DAY_SEQ = 7;

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
  const email = `km-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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
  timedRungs?: boolean;
  weightOneValue: number | null;
  weightTwoValue: number | null;
}
interface WorkoutOpts {
  complexSet: boolean;
  intervalTimer: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  workoutDetails: string;
  movements: MovementOpt[];
}
interface SessionRow {
  sequence_index: number;
  week_number: number;
  day_number: number;
  workout_options: WorkoutOpts;
}

// Every session is a single 60-second rung; rounds are the progression lever.
// One rung mirrored left/right means one round = two minutes of carrying, so a
// session's total time under load is rounds x 2: build 6 -> 16 min, a 12-minute
// taper, then the test's 20-minute ceiling.
const RUNG_SECONDS = 60;
const EXPECTED_ROUNDS = [3, 4, 5, 6, 7, 8, 6, 10];
const EXPECTED_TOTAL_MINUTES = [6, 8, 10, 12, 14, 16, 12, 20];

test.describe('program schema — Kettlebell Mile seed', () => {
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
    >(`programs?slug=eq.${KM_SLUG}&select=*`, user.token);

    expect(programs).toHaveLength(1);
    const km = programs[0];
    expect(km.is_public).toBe(true);
    expect(km.owner_id).toBeNull();
    expect(km.num_weeks).toBe(8);
    expect(km.days_per_week).toBe(1);
    expect(km.author_name).toBe('Dr. Mike Prevost (StrongFirst)');
    expect(km.title).toBe('The Kettlebell Mile');
  });

  test('has 8 ordered weekly sessions that build, taper, then test', async () => {
    const user = await signUpThrowawayUser();
    const [km] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${KM_SLUG}&select=id`,
      user.token,
    );

    const sessions = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${km.id}&select=sequence_index,week_number,day_number,workout_options&order=sequence_index.asc`,
      user.token,
    );

    expect(sessions).toHaveLength(KM_SESSION_COUNT);
    expect(sessions.map((s) => s.sequence_index)).toEqual(
      Array.from({ length: KM_SESSION_COUNT }, (_, i) => i),
    );
    // One session per week, so week N is exactly session N-1.
    expect(sessions.map((s) => s.week_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sessions.map((s) => s.day_number)).toEqual(Array(8).fill(1));

    sessions.forEach((s, i) => {
      const movements = s.workout_options.movements;

      // A single carry is the whole session.
      expect(movements).toHaveLength(1);
      expect(movements[0].movementName).toBe('Kettlebell Suitcase Carry');

      // Timed rungs: the single repScheme entry is SECONDS, not reps. Keeping
      // it to ONE rung is what makes rounds the progression lever — several
      // rungs inside one round would pin "rounds remaining" at 1 all session.
      expect(movements[0].timedRungs).toBe(true);
      expect(movements[0].repScheme).toEqual([RUNG_SECONDS]);

      // Total time under load is rounds x 2 min — one rung carried per hand.
      expect(s.workout_options.workoutGoal).toBe(EXPECTED_ROUNDS[i]);
      const totalMinutes = (EXPECTED_ROUNDS[i] * RUNG_SECONDS * 2) / 60;
      expect(totalMinutes).toBe(EXPECTED_TOTAL_MINUTES[i]);

      // Single bell: weightTwoValue 0 (not null) is the Single/'1h' mode the
      // runtime keys off to mirror each rung per hand.
      expect(movements[0].weightOneValue).toBe(24);
      expect(movements[0].weightTwoValue).toBe(0);

      // intervalTimer must stay 0: it and timed rungs both drive auto-advance,
      // and running both would double-advance every rung.
      expect(s.workout_options.intervalTimer).toBe(0);

      expect(s.workout_options.complexSet).toBe(false);
      expect(s.workout_options.workoutGoalUnits).toBe('rounds');
    });

    // Volume peaks in week 6 and the taper is genuinely lighter than it.
    expect(EXPECTED_ROUNDS[5]).toBeGreaterThan(EXPECTED_ROUNDS[6]);
  });

  test('the test session flags the distance→time approximation in workoutDetails', async () => {
    const user = await signUpThrowawayUser();
    const [km] = await restJson<Array<{ id: string }>>(
      `programs?slug=eq.${KM_SLUG}&select=id`,
      user.token,
    );

    const [session] = await restJson<SessionRow[]>(
      `program_sessions?program_id=eq.${km.id}&sequence_index=eq.${TEST_DAY_SEQ}&select=sequence_index,workout_options`,
      user.token,
    );

    // The seam that keeps the approximation honest: the source prescribes a
    // MILE, the app prescribes minutes, and the user must be told that the
    // clock-based rungs are a pace guide they can finish early.
    const details = session.workout_options.workoutDetails.toLowerCase();
    expect(details).toContain('mile');
    expect(details).toMatch(/not a target|pace|finish/);
    expect(details).toContain('9 min'); // the sub-9 benchmark
  });
});
