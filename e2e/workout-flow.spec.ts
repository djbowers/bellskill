import { Page, expect, test } from '@playwright/test';

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
  complex_set: boolean;
  straight_sets: boolean;
  workout_mode: string | null;
  shared_bell: boolean | null;
  shared_weight_one_value: number | null;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

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

async function queryMovementLogs(
  workoutLogId: number,
  accessToken: string,
): Promise<
  { weight_one_value: number | null; weight_one_unit: string | null }[]
> {
  const url = `${SUPABASE_URL}/rest/v1/movement_logs?workout_log_id=eq.${workoutLogId}&select=weight_one_value,weight_one_unit`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`movement_logs query failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function deleteWorkoutLog(
  id: number,
  accessToken: string,
): Promise<void> {
  // movement_logs has ON DELETE CASCADE so only the parent row needs deleting
  const res = await fetch(`${SUPABASE_URL}/rest/v1/workout_logs?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    console.warn(
      `Cleanup: could not delete workout_log id=${id}: ${res.status}`,
    );
  }
}

// Reaching a goal opens a confirm dialog instead of finishing outright;
// accept it to log the workout and move on to the completed page.
async function confirmGoalReached(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /goal reached/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Finish workout' }).click();
}

// ── Test ─────────────────────────────────────────────────────────────────────

test.describe('full workout flow', () => {
  let authSession: AuthSession;
  let createdWorkoutLogId: number | null = null;
  let straightSetsWorkoutLogId: number | null = null;
  let sharedBellWorkoutLogId: number | null = null;

  test.beforeAll(async () => {
    authSession = await signInWithPassword(TEST_EMAIL, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    for (const id of [
      createdWorkoutLogId,
      straightSetsWorkoutLogId,
      sharedBellWorkoutLogId,
    ]) {
      if (id !== null) await deleteWorkoutLog(id, authSession.access_token);
    }
  });

  test('fills out form, completes workout, verifies DB record', async ({
    page,
  }) => {
    // ── 1. Inject auth before page load ──────────────────────────────────
    await injectAuthSession(page, authSession);

    // ── 2. Load the app and open the builder ──────────────────────────────
    await page.goto('/');

    // The Start page now opens on the hub (not the raw builder). With no active
    // program, that's the quick-start hero; its "Build a workout" action opens
    // the custom builder. Clicking it confirms we bypassed the Signup screen and
    // landed on StartWorkoutPage's hub. (The eval is async, so the hub appears
    // once the discovery-flag result resolves.)
    const buildWorkoutButton = page.getByRole('button', {
      name: /build a workout/i,
    });
    await expect(buildWorkoutButton).toBeVisible({ timeout: 10_000 });
    await buildWorkoutButton.click();

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
    //   → handleRoundsGoalReached → goal confirm dialog → finishWorkout()
    //   → logWorkout() → handleFinishWorkout → navigate('/history/{id}')
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // ── 8. Assert navigation to CompletedWorkoutPage ──────────────────────
    await confirmGoalReached(page);
    await expect(page).toHaveURL(/\/history\/\d+$/, { timeout: 10_000 });

    const match = page.url().match(/\/history\/(\d+)$/);
    const workoutLogId = parseInt(match![1], 10);
    createdWorkoutLogId = workoutLogId;

    // Arriving from a finished workout renders the celebratory just-finished
    // view, which leads with the outcome stats.
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expect(page.getByTestId('headline-stats')).toBeVisible();

    // ── 9. Verify the database record ─────────────────────────────────────
    const workoutLog = await queryWorkoutLog(
      workoutLogId,
      authSession.access_token,
    );

    expect(workoutLog, 'workout log should exist in DB').not.toBeNull();
    expect(workoutLog!.user_id).toBe(authSession.user.id);
    expect(workoutLog!.movements).toEqual(['Clean and Press']);
    expect(workoutLog!.workout_goal_units).toBe('rounds');
    expect(workoutLog!.workout_goal).toBe(1);
    expect(workoutLog!.completed_rounds).toBe(1);
    expect(workoutLog!.completed_reps).toBe(5); // repScheme=[5]
    expect(workoutLog!.completed_rungs).toBe(1);
    expect(workoutLog!.completed_volume).toBe(80); // 16 kg × 5 reps
    // Circuit is the default arrangement, with per-movement weights.
    expect(workoutLog!.workout_mode).toBe('circuit');
    expect(workoutLog!.shared_bell).toBe(false);
    // The legacy pair stays in sync until cached clients cycle.
    expect(workoutLog!.complex_set).toBe(false);
    expect(workoutLog!.straight_sets).toBe(false);
  });

  test('movements can be reordered by dragging the index badge', async ({
    page,
  }) => {
    await injectAuthSession(page, authSession);
    await page.goto('/');

    const buildWorkoutButton = page.getByRole('button', {
      name: /build a workout/i,
    });
    await expect(buildWorkoutButton).toBeVisible({ timeout: 10_000 });
    await buildWorkoutButton.click();

    const movementInputs = page.getByLabel('Movement Input');
    await movementInputs.fill('Clean and Press');
    await movementInputs.last().blur();
    await page.getByRole('button', { name: '+ Movement' }).click();
    await movementInputs.nth(1).fill('Kettlebell Swing');
    await movementInputs.last().blur();

    // Fold both cards first so the drag geometry is deterministic — expanded
    // cards auto-collapse when the drag starts, which moves the target mid-drag.
    // Each click renames the button to "Expand movement", so always take the
    // first remaining match rather than iterating a stale list.
    const collapseButtons = page.getByRole('button', {
      name: 'Collapse movement',
    });
    await collapseButtons.first().click();
    await collapseButtons.first().click();

    // The pointer sensor arms after 8px of travel, so a plain dragTo (single
    // hop) can miss activation — walk the handle down in steps instead.
    const handle = page.getByRole('button', { name: 'Reorder movement 1' });
    const from = (await handle.boundingBox())!;
    const target = (await page
      .getByRole('button', { name: 'Reorder movement 2' })
      .boundingBox())!;
    const startX = from.x + from.width / 2;
    const startY = from.y + from.height / 2;
    const endY = target.y + target.height / 2 + 10;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(startX, startY + ((endY - startY) * step) / 10);
    }
    await page.mouse.up();

    // Cards are collapsed, so order reads from the summary buttons.
    const summaries = page.getByRole('button', {
      name: /^Expand (Kettlebell Swing|Clean and Press)$/,
    });
    await expect(summaries.first()).toHaveAccessibleName(
      'Expand Kettlebell Swing',
    );
    await expect(summaries.nth(1)).toHaveAccessibleName(
      'Expand Clean and Press',
    );
  });

  test('a straight-sets workout traverses and persists as straight sets', async ({
    page,
  }) => {
    await injectAuthSession(page, authSession);
    await page.goto('/');

    const buildWorkoutButton = page.getByRole('button', {
      name: /build a workout/i,
    });
    await expect(buildWorkoutButton).toBeVisible({ timeout: 10_000 });
    await buildWorkoutButton.click();

    const startWorkoutButton = page.getByRole('button', {
      name: 'Start workout',
    });
    await expect(startWorkoutButton).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Straight Sets' }).click();
    await expect(page.getByRole('tab', { name: 'Straight Sets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Straight sets prescribes its work in the rep schemes, so there is no goal
    // to pick.
    await expect(page.getByRole('heading', { name: 'Goal' })).toBeHidden();

    // Two movements, two sets each: A, A, B, B.
    const movementInputs = page.getByLabel('Movement Input');
    await movementInputs.first().fill('Kettlebell Swing');
    await page.getByRole('button', { name: 'Add set' }).first().click();

    await page.getByRole('button', { name: '+ Movement' }).click();
    await movementInputs.nth(1).fill('Goblet Squat');
    await page.getByRole('button', { name: 'Add set' }).nth(1).click();

    await expect(startWorkoutButton).toBeEnabled();
    await startWorkoutButton.click();
    await expect(page).toHaveURL(/\/active$/);

    const currentMovement = page.getByTestId('current-movement-card');
    const continueButton = page.getByRole('button', { name: 'Continue' });

    await expect(continueButton).toBeVisible();
    await expect(currentMovement).toContainText('Kettlebell Swing');
    await continueButton.click();

    // Still the first movement — straight sets finishes it before moving on.
    await expect(currentMovement).toContainText('Kettlebell Swing');
    await continueButton.click();

    await expect(currentMovement).toContainText('Goblet Squat');
    await continueButton.click();
    await expect(currentMovement).toContainText('Goblet Squat');
    await continueButton.click();

    await confirmGoalReached(page);
    await expect(page).toHaveURL(/\/history\/\d+$/, { timeout: 10_000 });
    const match = page.url().match(/\/history\/(\d+)$/);
    const workoutLogId = parseInt(match![1], 10);
    straightSetsWorkoutLogId = workoutLogId;

    const workoutLog = await queryWorkoutLog(
      workoutLogId,
      authSession.access_token,
    );

    expect(workoutLog!.workout_mode).toBe('straightSets');
    // 2 movements x 2 sets, counted one per set against the derived goal.
    expect(workoutLog!.completed_rounds).toBe(4);
    expect(workoutLog!.shared_bell).toBe(false);
    expect(workoutLog!.straight_sets).toBe(true);
    expect(workoutLog!.complex_set).toBe(false);

    // History labels the arrangement, so the mode survives the round trip.
    await page.goto('/history');
    await expect(page.getByText('Straight Sets').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // The 2026-08-04 bug: unequal rungs loaded into circuit mode left a red error
  // and a dead Start button with no way forward but hand-editing.
  test('unequal rungs block circuit, and the one-tap fix starts the workout', async ({
    page,
  }) => {
    await injectAuthSession(page, authSession);
    await page.goto('/');

    const buildWorkoutButton = page.getByRole('button', {
      name: /build a workout/i,
    });
    await expect(buildWorkoutButton).toBeVisible({ timeout: 10_000 });
    await buildWorkoutButton.click();

    const startWorkoutButton = page.getByRole('button', {
      name: 'Start workout',
    });
    await expect(startWorkoutButton).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Rounds' }).click();
    const minusRoundsButton = page.getByRole('button', { name: '- rounds' });
    for (let i = 0; i < 9; i++) {
      await minusRoundsButton.click();
    }

    await page.getByLabel('Movement Input').fill('Kettlebell Swing');
    // The autocomplete's dismiss layer eats the next click, so close it first.
    await page.getByLabel('Movement Input').last().blur();
    await page.getByRole('button', { name: '+ Movement' }).click();
    await page.getByLabel('Movement Input').nth(1).fill('Goblet Squat');
    await page.getByLabel('Movement Input').last().blur();

    // Give the second movement a longer ladder than the first.
    await page.getByRole('button', { name: 'Add rung' }).nth(1).click();

    await expect(
      page.getByText(/Rep schemes differ across movements/i),
    ).toBeVisible();
    await expect(startWorkoutButton).toBeDisabled();

    await page.getByRole('button', { name: 'Switch to Straight Sets' }).click();

    await expect(
      page.getByText(/Rep schemes differ across movements/i),
    ).toBeHidden();
    await expect(startWorkoutButton).toBeEnabled();
    await startWorkoutButton.click();
    await expect(page).toHaveURL(/\/active$/);

    // Straight sets runs each movement's own ladder — 1 rung then 2 — so the
    // session advances rung by rung rather than in one step.
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible();
    for (let rung = 0; rung < 3 && !/\/history\//.test(page.url()); rung++) {
      await continueButton.click();
    }

    await confirmGoalReached(page);
    await expect(page).toHaveURL(/\/history\/\d+$/, { timeout: 10_000 });
    const workoutLogId = parseInt(page.url().match(/\/history\/(\d+)$/)![1], 10);

    const workoutLog = await queryWorkoutLog(
      workoutLogId,
      authSession.access_token,
    );
    expect(workoutLog!.straight_sets).toBe(true);
  });

  test('a circuit can run off one shared bell', async ({ page }) => {
    await injectAuthSession(page, authSession);
    await page.goto('/');

    const buildWorkoutButton = page.getByRole('button', {
      name: /build a workout/i,
    });
    await expect(buildWorkoutButton).toBeVisible({ timeout: 10_000 });
    await buildWorkoutButton.click();

    const startWorkoutButton = page.getByRole('button', {
      name: 'Start workout',
    });
    await expect(startWorkoutButton).toBeVisible({ timeout: 10_000 });

    // Circuit stays selected; the shared bell is now an independent axis.
    await expect(page.getByRole('tab', { name: 'Circuit' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: /^Shared Bell,/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Rounds' }).click();
    const minusRoundsButton = page.getByRole('button', { name: '- rounds' });
    for (let i = 0; i < 9; i++) {
      await minusRoundsButton.click();
    }

    await page.getByLabel('Movement Input').fill('Kettlebell Swing');

    await expect(startWorkoutButton).toBeEnabled();
    await startWorkoutButton.click();
    await expect(page).toHaveURL(/\/active$/);

    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    await confirmGoalReached(page);
    await expect(page).toHaveURL(/\/history\/\d+$/, { timeout: 10_000 });
    const workoutLogId = parseInt(page.url().match(/\/history\/(\d+)$/)![1], 10);
    sharedBellWorkoutLogId = workoutLogId;

    const workoutLog = await queryWorkoutLog(
      workoutLogId,
      authSession.access_token,
    );

    // The combination that was inexpressible before: shared bell, no complex.
    expect(workoutLog!.workout_mode).toBe('circuit');
    expect(workoutLog!.shared_bell).toBe(true);
    expect(workoutLog!.complex_set).toBe(false);
    expect(workoutLog!.shared_weight_one_value).not.toBeNull();

    // The shared weight is copied onto each movement, so volume accumulation
    // and movement_logs can't disagree.
    const movementLogs = await queryMovementLogs(
      workoutLogId,
      authSession.access_token,
    );
    expect(movementLogs.length).toBeGreaterThan(0);
    for (const movementLog of movementLogs) {
      expect(movementLog.weight_one_value).toBe(
        workoutLog!.shared_weight_one_value,
      );
    }
  });
});
