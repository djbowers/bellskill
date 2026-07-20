import { expect, test } from '@playwright/test';

// PROD-237 in-program flow backend behavior, hit directly against local Supabase
// (like program-next-workout.spec.ts): (1) starting a non-next session leaves the
// earlier ones upcoming — gaps, never auto-skips — and (2) resume_program brings a
// prior enrollment back to `active` with its completions intact after switching
// away. Auth + REST/RPC helpers mirror program-next-workout.spec.ts.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';
const SWING_SLUG = '10000-swing-challenge';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(): Promise<TestUser> {
  const email = `proginflow-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'testpassword123';

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok)
    throw new Error(`signup failed (${res.status}): ${await res.text()}`);

  const body = (await res.json()) as {
    access_token?: string;
    user?: { id: string };
  };
  if (body.access_token && body.user) {
    return { token: body.access_token, uid: body.user.id, email };
  }
  throw new Error('signup did not return a session');
}

interface RestOptions {
  body?: unknown;
  prefer?: string;
}

async function rest(
  method: string,
  path: string,
  token: string,
  opts: RestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function restJson<T = unknown>(
  method: string,
  path: string,
  token: string,
  opts: RestOptions = {},
): Promise<T> {
  const res = await rest(method, path, token, opts);
  if (!res.ok) {
    throw new Error(
      `${method} ${path} failed (${res.status}): ${await res.text()}`,
    );
  }
  return res.json() as Promise<T>;
}

async function rpc<T = unknown>(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok)
    throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface SessionRow {
  id: string;
  sequence_index: number;
}

async function orderedSessions(
  token: string,
  programId: string,
): Promise<SessionRow[]> {
  return restJson<SessionRow[]>(
    'GET',
    `program_sessions?program_id=eq.${programId}&select=id,sequence_index&order=sequence_index.asc`,
    token,
  );
}

// Mirror useActiveProgram's cursor: lowest-sequence session with no completion.
async function nextSession(
  token: string,
  userProgramId: string,
  programId: string,
): Promise<SessionRow | null> {
  const sessions = await orderedSessions(token, programId);
  const completions = await restJson<Array<{ program_session_id: string }>>(
    'GET',
    `program_session_completions?user_program_id=eq.${userProgramId}&select=program_session_id`,
    token,
  );
  const satisfied = new Set(completions.map((c) => c.program_session_id));
  return sessions.find((s) => !satisfied.has(s.id)) ?? null;
}

async function getEnrollment(
  token: string,
  userProgramId: string,
): Promise<{ status: string; completed_at: string | null }> {
  const rows = await restJson<
    Array<{ status: string; completed_at: string | null }>
  >(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=status,completed_at`,
    token,
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function completionCount(
  token: string,
  userProgramId: string,
): Promise<number> {
  const rows = await restJson<Array<{ id: string }>>(
    'GET',
    `program_session_completions?user_program_id=eq.${userProgramId}&select=id`,
    token,
  );
  return rows.length;
}

async function programIdBySlug(token: string, slug: string): Promise<string> {
  const [row] = await restJson<Array<{ id: string }>>(
    'GET',
    `programs?slug=eq.${slug}&select=id`,
    token,
  );
  return row.id;
}

async function cloneProgramId(
  token: string,
  userProgramId: string,
): Promise<string> {
  const [row] = await restJson<Array<{ program_id: string }>>(
    'GET',
    `user_programs?id=eq.${userProgramId}&select=program_id`,
    token,
  );
  return row.program_id;
}

async function insertWorkoutLog(user: TestUser): Promise<number> {
  const [row] = await restJson<Array<{ id: number }>>(
    'POST',
    'workout_logs',
    user.token,
    {
      prefer: 'return=representation',
      body: {
        user_id: user.uid,
        started_at: new Date().toISOString(),
        movements: ['Clean and Press'],
        completed_reps: 10,
        completed_rounds: 1,
        completed_rungs: 1,
        workout_goal: 30,
      },
    },
  );
  return row.id;
}

test.describe('program in-program flow — start-any-session + resume', () => {
  test('starting a non-next session leaves the earlier ones upcoming (gaps, no auto-skip)', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await programIdBySlug(user.token, DFW_SLUG);
    const userProgramId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    const cloneId = await cloneProgramId(user.token, userProgramId);
    const sessions = await orderedSessions(user.token, cloneId);
    const later = sessions[3]; // pick a session well past the next one

    // Complete a later session directly, as the progress-page picker now allows.
    const logId = await insertWorkoutLog(user);
    await rpc('complete_program_session', user.token, {
      p_user_program_id: userProgramId,
      p_program_session_id: later.id,
      p_workout_log_id: logId,
    });

    // Only that one session is satisfied — no skip rows were written for 0..2.
    expect(await completionCount(user.token, userProgramId)).toBe(1);
    const earlierCompletions = await restJson<Array<{ id: string }>>(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}` +
        `&program_session_id=in.(${sessions[0].id},${sessions[1].id},${sessions[2].id})&select=id`,
      user.token,
    );
    expect(earlierCompletions).toHaveLength(0);

    // The cursor still points at the lowest incomplete session (sequence 0) — the
    // gap stays upcoming rather than being skipped.
    const next = await nextSession(user.token, userProgramId, cloneId);
    expect(next?.sequence_index).toBe(0);

    // The enrollment is still active (a mid-program gap is not completion).
    expect((await getEnrollment(user.token, userProgramId)).status).toBe(
      'active',
    );
  });

  test('switching away then resuming reactivates the enrollment with completions intact', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await programIdBySlug(user.token, DFW_SLUG);

    // Enroll in DFW and log the first session.
    const dfwEnrollment = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    const dfwCloneId = await cloneProgramId(user.token, dfwEnrollment);
    const first = await nextSession(user.token, dfwEnrollment, dfwCloneId);
    const logId = await insertWorkoutLog(user);
    await rpc('complete_program_session', user.token, {
      p_user_program_id: dfwEnrollment,
      p_program_session_id: first!.id,
      p_workout_log_id: logId,
    });
    expect(await completionCount(user.token, dfwEnrollment)).toBe(1);

    // Switch to a different program — the DFW enrollment is abandoned.
    const swingId = await programIdBySlug(user.token, SWING_SLUG);
    const swingEnrollment = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: swingId,
    });
    expect((await getEnrollment(user.token, dfwEnrollment)).status).toBe(
      'abandoned',
    );
    expect((await getEnrollment(user.token, swingEnrollment)).status).toBe(
      'active',
    );

    // Resume DFW by its exact enrollment id — the same enrollment comes back
    // active, the swing enrollment is abandoned, the earlier completion survives.
    const resumedId = await rpc<string>('resume_program', user.token, {
      p_user_program_id: dfwEnrollment,
    });
    expect(resumedId).toBe(dfwEnrollment);

    const resumed = await getEnrollment(user.token, dfwEnrollment);
    expect(resumed.status).toBe('active');
    expect(resumed.completed_at).toBeNull();
    expect((await getEnrollment(user.token, swingEnrollment)).status).toBe(
      'abandoned',
    );

    // Completion survived, so the cursor picks up at the second session, not the
    // first.
    expect(await completionCount(user.token, dfwEnrollment)).toBe(1);
    const next = await nextSession(user.token, dfwEnrollment, dfwCloneId);
    expect(next?.sequence_index).toBe(1);
  });

  test('resumes the exact enrollment passed, not the most recent one', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await programIdBySlug(user.token, DFW_SLUG);

    // First enrollment on a DFW clone, with one logged session.
    const older = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    const cloneId = await cloneProgramId(user.token, older);
    const first = await nextSession(user.token, older, cloneId);
    const logId = await insertWorkoutLog(user);
    await rpc('complete_program_session', user.token, {
      p_user_program_id: older,
      p_program_session_id: first!.id,
      p_workout_log_id: logId,
    });

    // Start that same clone over → a second, newer enrollment on the SAME
    // program (0 completions), then switch away so both are non-active with a
    // NULL completed_at.
    const newer = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: cloneId,
    });
    const swingId = await programIdBySlug(user.token, SWING_SLUG);
    await rpc('enroll_in_program', user.token, { p_program_id: swingId });

    // Resuming the OLDER enrollment explicitly must reactivate exactly it — the
    // one whose progress the prompt showed — not the newer (empty) one a
    // program-id-keyed heuristic would have picked.
    const resumed = await rpc<string>('resume_program', user.token, {
      p_user_program_id: older,
    });
    expect(resumed).toBe(older);
    expect((await getEnrollment(user.token, older)).status).toBe('active');
    expect((await getEnrollment(user.token, newer)).status).toBe('abandoned');
    expect(await completionCount(user.token, older)).toBe(1);
    expect(await completionCount(user.token, newer)).toBe(0);
  });

  test('resuming an already-active enrollment is rejected', async () => {
    const user = await signUpThrowawayUser();
    const dfwId = await programIdBySlug(user.token, DFW_SLUG);
    const active = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: dfwId,
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resume_program`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_user_program_id: active }),
    });
    // The enrollment is already active → nothing to resume, the RPC raises.
    expect(res.ok).toBe(false);
  });
});
