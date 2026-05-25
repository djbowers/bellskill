import { expect, Page, test } from '@playwright/test';

// ── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'testpassword123';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

interface WorkoutLogRow {
  id: number;
  user_id: string;
  movements: string[];
  workout_goal_units: string;
  workout_goal: number;
  completed_rounds: number;
  completed_reps: number;
  completed_rungs: number;
  completed_volume: number;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase sign-in failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<AuthSession>;
}

/**
 * Registers an init script that writes the Supabase session to localStorage
 * before the React app mounts. Must be called before page.goto().
 *
 * supabase-js v2 derives the storage key as sb-<hostname>-auth-token.
 * For http://localhost:54321 → sb-localhost-auth-token.
 */
async function injectAuthSession(
  page: Page,
  session: AuthSession,
): Promise<void> {
  const { hostname } = new URL(SUPABASE_URL);
  const key = `sb-${hostname}-auth-token`;

  const value = JSON.stringify({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });

  await page.addInitScript(
    ({ k, v }: { k: string; v: string }) => {
      window.localStorage.setItem(k, v);
    },
    { k: key, v: value },
  );
}

// ── DB helpers ───────────────────────────────────────────────────────────────

// Uses the signed-in user's access_token for REST queries.
// RLS policies allow users to read and delete their own workout_logs rows.
async function queryWorkoutLog(
  workoutLogId: number,
  accessToken: string,
): Promise<WorkoutLogRow | null> {
  const url = `${SUPABASE_URL}/rest/v1/workout_logs?id=eq.${workoutLogId}&select=*`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`workout_logs query failed (${res.status}): ${text}`);
  }

  const rows = (await res.json()) as WorkoutLogRow[];
  return rows[0] ?? null;
}

async function deleteWorkoutLog(id: number, accessToken: string): Promise<void> {
  // movement_logs has ON DELETE CASCADE so only the parent row needs deleting
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/workout_logs?id=eq.${id}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    console.warn(`Cleanup: could not delete workout_log id=${id}: ${res.status}`);
  }
}

// ── Test ─────────────────────────────────────────────────────────────────────

test.describe('full workout flow', () => {
  let authSession: AuthSession;
  let createdWorkoutLogId: number | null = null;

  test.beforeAll(async () => {
    authSession = await signInWithPassword(TEST_EMAIL, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    if (createdWorkoutLogId !== null) {
      await deleteWorkoutLog(createdWorkoutLogId, authSession.access_token);
    }
  });

  test('fills out form, completes workout, verifies DB record', async ({
    page,
  }) => {
    // ── 1. Inject auth before page load ──────────────────────────────────
    await injectAuthSession(page, authSession);

    // ── 2. Load the app ───────────────────────────────────────────────────
    await page.goto('/');

    // Confirm we bypassed the Signup screen and landed on StartWorkoutPage
    const startWorkoutButton = page.getByRole('button', {
      name: 'Start workout',
    });
    await expect(startWorkoutButton).toBeVisible({ timeout: 10_000 });

    // ── 3. Switch goal unit to "Rounds" ───────────────────────────────────
    // Default is "minutes" (10 min). Switching to rounds sets goal to
    // previousRounds=10 from context defaults.
    await page.getByRole('tab', { name: 'Rounds' }).click();

    // ── 4. Set goal to 1 round ────────────────────────────────────────────
    // After switching to Rounds, workoutGoal is set to previousRounds=10.
    // Click the minus button 9 times to decrement from 10 → 1.
    // Using the button's aria-label (aria-label="- rounds") is more reliable
    // than fill() on a controlled React input, which bypasses synthetic events.
    const minusRoundsButton = page.getByRole('button', { name: '- rounds' });
    for (let i = 0; i < 9; i++) {
      await minusRoundsButton.click();
    }

    // ── 5. Enter movement name ────────────────────────────────────────────
    // aria-label="Movement Input" is set on the movement name Input in
    // StartWorkoutPage.tsx. Filling this enables the "Start workout" button.
    await page.getByLabel('Movement Input').fill('Clean and Press');

    // ── 6. Start the workout ──────────────────────────────────────────────
    await expect(startWorkoutButton).toBeEnabled();
    await startWorkoutButton.click();

    await expect(page).toHaveURL(/\/active$/);

    // ── 7. Complete the workout ───────────────────────────────────────────
    // With rounds goal, intervalTimer=0, restTimer=0:
    //   workoutTimerPaused = false → "Continue" renders immediately
    //
    // Clicking once: completedRounds→1 ≥ workoutGoal→1
    //   → handleRoundsGoalReached → finishWorkout() → logWorkout()
    //   → handleFinishWorkout → navigate('/history/{id}')
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // ── 8. Assert navigation to CompletedWorkoutPage ──────────────────────
    await expect(page).toHaveURL(/\/history\/\d+$/, { timeout: 10_000 });

    const match = page.url().match(/\/history\/(\d+)$/);
    const workoutLogId = parseInt(match![1], 10);
    createdWorkoutLogId = workoutLogId;

    // Confirm the redesigned completed workout page rendered
    await expect(page.getByTestId('workout-history-item')).toBeVisible();
    await expect(page.getByText('You moved')).toBeVisible();
    await expect(page.getByText('Clean and Press')).toBeVisible();
    await expect(page.getByText('1 ROUND GOAL')).toBeVisible();

    // ── 9. Verify the database record ─────────────────────────────────────
    const workoutLog = await queryWorkoutLog(workoutLogId, authSession.access_token);

    expect(workoutLog, 'workout log should exist in DB').not.toBeNull();
    expect(workoutLog!.user_id).toBe(authSession.user.id);
    expect(workoutLog!.movements).toEqual(['Clean and Press']);
    expect(workoutLog!.workout_goal_units).toBe('rounds');
    expect(workoutLog!.workout_goal).toBe(1);
    expect(workoutLog!.completed_rounds).toBe(1);
    expect(workoutLog!.completed_reps).toBe(5); // repScheme=[5]
    expect(workoutLog!.completed_rungs).toBe(1);
    expect(workoutLog!.completed_volume).toBe(80); // 16 kg × 5 reps
  });
});
