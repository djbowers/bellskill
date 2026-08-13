import { expect, test } from '@playwright/test';

// Integration spec for the pattern_debt_movements SQL RPC (PROD-155 Phase 1).
// Seeds movement_logs/workout_logs/user_movements directly via the Supabase
// REST API (no browser), then calls the RPC and asserts the per-movement
// aggregation and volume-normalization rules documented in
// docs/pattern-debt-scoring-model.md and
// supabase/migrations/20260804150001_create_pattern_debt_movements.sql.
//
// Auth + REST conventions mirror e2e/program-armor-building-complex.spec.ts
// (throwaway signup) and e2e/workout-flow.spec.ts (fetch-based REST helpers).
// Requires the two 20260803* migrations (add_pattern_credits,
// create_pattern_debt_movements) to be applied locally — run
// `supabase db reset` if the RPC 404s.

// ── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14; // pattern_debt_movements default p_window_days
const BASELINE_DAYS = 84; // pattern_debt_movements default p_baseline_days

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

interface MovementRow {
  id: string;
  Movement: string;
  pattern_credits: string[] | null;
}

interface PatternDebtRow {
  movement_id: string | null;
  movement_name: string;
  pattern_credits: string[] | null;
  last_trained_at: string | null;
  set_count: number;
  total_reps: number;
  total_volume_kg: number;
  baseline_volume_kg: number;
  hardest_rpe: string | null;
}

interface WorkoutLogInsert {
  movements: string[];
  workout_goal_units: 'minutes' | 'rounds' | 'kilograms';
  workout_goal: number;
  completed_rounds: number;
  completed_reps: number;
  completed_rungs: number;
  rep_scheme: number[];
  started_at: string;
  completed_at?: string;
  complex_set?: boolean;
  workout_mode?: string | null;
  shared_bell?: boolean | null;
  shared_weight_one_value?: number | null;
  shared_weight_one_unit?: 'kilograms' | 'pounds' | null;
  shared_weight_two_value?: number | null;
  shared_weight_two_unit?: 'kilograms' | 'pounds' | null;
  user_id: string;
}

interface MovementLogInsert {
  movement_name: string;
  rep_scheme: number[];
  timed_rungs?: boolean;
  user_movement_id?: string | null;
  weight_one_value?: number | null;
  weight_one_unit?: 'kilograms' | 'pounds' | null;
  weight_two_value?: number | null;
  weight_two_unit?: 'kilograms' | 'pounds' | null;
  workout_log_id: number;
  user_id: string;
  created_at?: string;
}

// ── Auth helper (mirrors program-armor-building-complex.spec.ts) ───────────

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `pattern-debt-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY! },
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
        apikey: SUPABASE_ANON_KEY!,
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

// ── REST helpers ─────────────────────────────────────────────────────────────

async function restJson<T = unknown>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function restInsert<T>(
  table: string,
  row: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok)
    throw new Error(
      `POST ${table} failed (${res.status}): ${await res.text()}`,
    );
  const rows = (await res.json()) as T[];
  return rows[0];
}

async function insertUserMovement(
  canonicalName: string,
  functionalMovementId: string | null,
  userId: string,
  token: string,
): Promise<{ id: string }> {
  return restInsert(
    'user_movements',
    {
      canonical_name: canonicalName,
      functional_movement_id: functionalMovementId,
      user_id: userId,
    },
    token,
  );
}

async function insertWorkoutLog(
  fields: WorkoutLogInsert,
  token: string,
): Promise<{ id: number }> {
  return restInsert('workout_logs', fields, token);
}

async function insertMovementLog(
  fields: MovementLogInsert,
  token: string,
): Promise<{ id: number }> {
  return restInsert('movement_logs', fields, token);
}

async function callPatternDebtMovements(
  token: string,
): Promise<PatternDebtRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/pattern_debt_movements`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok)
    throw new Error(
      `rpc/pattern_debt_movements failed (${res.status}): ${await res.text()}`,
    );
  return res.json() as Promise<PatternDebtRow[]>;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function findRow(
  rows: PatternDebtRow[],
  movementName: string,
): PatternDebtRow {
  const row = rows.find((r) => r.movement_name === movementName);
  expect(row, `expected a pattern_debt_movements row for "${movementName}"`)
    .toBeDefined();
  return row!;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('pattern_debt_movements RPC', () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    'requires local Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)',
  );

  test('aggregates per-movement volume, recency, and pattern credits', async () => {
    const user = await signUpThrowawayUser();

    // ── Fixture 1: catalog-linked TGU — carries the migration's credits ────
    const [tgu] = await restJson<MovementRow[]>(
      `movements?Movement=eq.${encodeURIComponent('Kettlebell Turkish Get-Up')}&select=id,Movement,pattern_credits`,
      user.token,
    );
    expect(tgu, 'Kettlebell Turkish Get-Up should exist in the catalog').toBeDefined();

    const tguUserMovement = await insertUserMovement(
      'My Turkish Get-Up',
      tgu.id,
      user.uid,
      user.token,
    );
    const tguWorkout = await insertWorkoutLog(
      {
        movements: ['My Turkish Get-Up'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 5,
        completed_rungs: 1,
        rep_scheme: [5],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: false,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'My Turkish Get-Up',
        rep_scheme: [5],
        timed_rungs: false,
        user_movement_id: tguUserMovement.id,
        weight_one_value: 16,
        weight_one_unit: 'kilograms',
        weight_two_value: 0,
        weight_two_unit: 'kilograms',
        workout_log_id: tguWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 2: simple one-arm swing — mirrored ×2 by completed_rounds ──
    const swingWorkout = await insertWorkoutLog(
      {
        movements: ['One-Arm Kettlebell Swing'],
        workout_goal_units: 'rounds',
        workout_goal: 2,
        completed_rounds: 2,
        completed_reps: 10,
        completed_rungs: 2,
        rep_scheme: [5, 5],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: false,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'One-Arm Kettlebell Swing',
        rep_scheme: [5, 5],
        timed_rungs: false,
        weight_one_value: 16,
        weight_one_unit: 'kilograms',
        // 0 (not null) is what triggers the one-handed mirroring rule below.
        weight_two_value: 0,
        weight_two_unit: 'kilograms',
        workout_log_id: swingWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 3: complex set — volume reads the SHARED weight, not the ──
    // stale per-movement weight left on the movement_logs row.
    const complexWorkout = await insertWorkoutLog(
      {
        movements: ['Double Kettlebell Clean'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 3,
        completed_rungs: 1,
        rep_scheme: [3],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: true,
        shared_weight_one_value: 20,
        shared_weight_one_unit: 'kilograms',
        shared_weight_two_value: 20,
        shared_weight_two_unit: 'kilograms',
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'Double Kettlebell Clean',
        rep_scheme: [3],
        timed_rungs: false,
        // Stale/different per-movement weight; the RPC must ignore this in
        // favor of the workout_log's shared_weight_* columns.
        weight_one_value: 99,
        weight_one_unit: 'kilograms',
        weight_two_value: 99,
        weight_two_unit: 'kilograms',
        workout_log_id: complexWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 3b: circuit + shared bell — the axes are independent now, ──
    // and volume must follow the shared bell rather than the arrangement.
    const sharedBellWorkout = await insertWorkoutLog(
      {
        movements: ['Kettlebell Front Squat'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 4,
        completed_rungs: 1,
        rep_scheme: [4],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        workout_mode: 'circuit',
        shared_bell: true,
        complex_set: false,
        shared_weight_one_value: 10,
        shared_weight_one_unit: 'kilograms',
        shared_weight_two_value: null,
        shared_weight_two_unit: null,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'Kettlebell Front Squat',
        rep_scheme: [4],
        timed_rungs: false,
        // Stale per-movement weight the RPC must ignore in favour of the bell.
        weight_one_value: 99,
        weight_one_unit: 'kilograms',
        weight_two_value: null,
        weight_two_unit: null,
        workout_log_id: sharedBellWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 4: timed_rungs — recency/sets only, zero reps/volume ───────
    const timedWorkout = await insertWorkoutLog(
      {
        movements: ['Plank'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 0,
        completed_rungs: 2,
        rep_scheme: [30, 30],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: false,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'Plank',
        rep_scheme: [30, 30],
        timed_rungs: true,
        weight_one_value: null,
        weight_two_value: null,
        workout_log_id: timedWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 5: unlinked custom movement — credits null, row still present
    const customUserMovement = await insertUserMovement(
      'My Custom Movement',
      null,
      user.uid,
      user.token,
    );
    const customWorkout = await insertWorkoutLog(
      {
        movements: ['My Custom Movement'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 8,
        completed_rungs: 1,
        rep_scheme: [8],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: false,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'My Custom Movement',
        rep_scheme: [8],
        timed_rungs: false,
        user_movement_id: customUserMovement.id,
        weight_one_value: 12,
        weight_one_unit: 'kilograms',
        weight_two_value: 0,
        weight_two_unit: 'kilograms',
        workout_log_id: customWorkout.id,
        user_id: user.uid,
        created_at: isoDaysAgo(1),
      },
      user.token,
    );

    // ── Fixture 6: outside the window, inside the baseline ────────────────
    const staleCreatedAt = isoDaysAgo(WINDOW_DAYS + 10);
    expect(WINDOW_DAYS + 10).toBeLessThan(BASELINE_DAYS);
    const oldWorkout = await insertWorkoutLog(
      {
        movements: ['Old Movement Test'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 5,
        completed_rungs: 1,
        rep_scheme: [5],
        started_at: staleCreatedAt,
        completed_at: staleCreatedAt,
        complex_set: false,
        user_id: user.uid,
      },
      user.token,
    );
    await insertMovementLog(
      {
        movement_name: 'Old Movement Test',
        rep_scheme: [5],
        timed_rungs: false,
        weight_one_value: 10,
        weight_one_unit: 'kilograms',
        weight_two_value: 0,
        weight_two_unit: 'kilograms',
        workout_log_id: oldWorkout.id,
        user_id: user.uid,
        created_at: staleCreatedAt,
      },
      user.token,
    );

    // ── Call the RPC and assert every fixture ──────────────────────────────
    const rows = await callPatternDebtMovements(user.token);

    // 1. Catalog-linked movement carries the migration's pattern credits.
    const tguRow = findRow(rows, 'My Turkish Get-Up');
    expect(tguRow.pattern_credits).toEqual(['get_up', 'push', 'rotation']);
    expect(tgu.pattern_credits).toEqual(['get_up', 'push', 'rotation']);

    // 2. Simple one-arm swing: rep_scheme [5,5] × completed_rounds 2, mirrored
    //    ×2 (one-handed) → 4 passes total.
    const swingRow = findRow(rows, 'One-Arm Kettlebell Swing');
    expect(swingRow.total_reps).toBe(40);
    expect(swingRow.total_volume_kg).toBe(640);

    // 3. Complex set: volume comes from the shared weight (20+20=40 kg),
    //    not the stale 99 kg left on the movement_logs row.
    const complexRow = findRow(rows, 'Double Kettlebell Clean');
    expect(complexRow.total_reps).toBe(3);
    expect(complexRow.total_volume_kg).toBe(120);

    // 3b. Circuit run off one bell: volume reads the shared 10 kg, not the
    //     stale 99 kg. Before the axes split this row scored 396 kg.
    const sharedBellRow = findRow(rows, 'Kettlebell Front Squat');
    expect(sharedBellRow.total_reps).toBe(4);
    expect(sharedBellRow.total_volume_kg).toBe(40);

    // 4. Timed rungs: recency/sets only, zero reps/volume.
    const timedRow = findRow(rows, 'Plank');
    expect(timedRow.total_reps).toBe(0);
    expect(timedRow.total_volume_kg).toBe(0);
    expect(timedRow.set_count).toBeGreaterThan(0);
    expect(timedRow.last_trained_at).not.toBeNull();

    // 5. Unlinked custom movement: row present, credits null.
    const customRow = findRow(rows, 'My Custom Movement');
    expect(customRow.pattern_credits).toBeNull();

    // 6. Outside window, inside baseline: no recency/volume in-window, but
    //    baseline volume is nonzero.
    const oldRow = findRow(rows, 'Old Movement Test');
    expect(oldRow.last_trained_at).toBeNull();
    expect(oldRow.total_volume_kg).toBe(0);
    expect(oldRow.baseline_volume_kg).toBeGreaterThan(0);
  });

  test('RLS scopes results to the calling user only', async () => {
    const owner = await signUpThrowawayUser();

    const ownerWorkout = await insertWorkoutLog(
      {
        movements: ['RLS Isolation Test'],
        workout_goal_units: 'rounds',
        workout_goal: 1,
        completed_rounds: 1,
        completed_reps: 5,
        completed_rungs: 1,
        rep_scheme: [5],
        started_at: isoDaysAgo(1),
        completed_at: isoDaysAgo(1),
        complex_set: false,
        user_id: owner.uid,
      },
      owner.token,
    );
    await insertMovementLog(
      {
        movement_name: 'RLS Isolation Test',
        rep_scheme: [5],
        timed_rungs: false,
        weight_one_value: 10,
        weight_one_unit: 'kilograms',
        weight_two_value: 0,
        weight_two_unit: 'kilograms',
        workout_log_id: ownerWorkout.id,
        user_id: owner.uid,
        created_at: isoDaysAgo(1),
      },
      owner.token,
    );

    const otherUser = await signUpThrowawayUser();
    const otherRows = await callPatternDebtMovements(otherUser.token);

    expect(
      otherRows.find((r) => r.movement_name === 'RLS Isolation Test'),
    ).toBeUndefined();
  });
});
