import { expect, test } from '@playwright/test';

// PROD-237 slice 3: program-level CRUD (cancel enrollment, hard-delete, archive)
// exercised against real Postgres + RLS. These are plain REST operations (no
// RPC), but their DB-level guarantees — the abandon frees the partial
// one-active-program unique index, delete cascades to sessions/enrollments/
// completions, the archived_at filter hides a program, and the owner-only
// policies protect shared/other-user programs — can only be proven here.
// Mirrors program-reorder-delete.spec.ts (real Postgres, no browser).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const DFW_SLUG = 'dry-fighting-weight';

interface TestUser {
  token: string;
  uid: string;
  email: string;
}

async function signUpThrowawayUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.com`;
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
  if (!res.ok)
    throw new Error(
      `${method} ${path} failed (${res.status}): ${await res.text()}`,
    );
  return res.json() as Promise<T>;
}

async function createOwnedProgram(
  user: TestUser,
  count: number,
): Promise<{ programId: string; sessionIds: string[] }> {
  const [program] = await restJson<Array<{ id: string }>>(
    'POST',
    'programs',
    user.token,
    {
      body: {
        owner_id: user.uid,
        title: 'CRUD test program',
        num_weeks: 1,
        days_per_week: 3,
      },
      prefer: 'return=representation',
    },
  );

  const rows = Array.from({ length: count }, (_, i) => ({
    program_id: program.id,
    sequence_index: i,
    week_number: 1,
    day_number: i + 1,
    title: `Session ${i}`,
    workout_options: { movements: [`Move ${i}`] },
  }));
  const sessions = await restJson<Array<{ id: string }>>(
    'POST',
    'program_sessions',
    user.token,
    { body: rows, prefer: 'return=representation' },
  );

  return { programId: program.id, sessionIds: sessions.map((s) => s.id) };
}

async function enroll(user: TestUser, programId: string): Promise<string> {
  const [row] = await restJson<Array<{ id: string }>>(
    'POST',
    'user_programs',
    user.token,
    {
      body: { user_id: user.uid, program_id: programId, status: 'active' },
      prefer: 'return=representation',
    },
  );
  return row.id;
}

test.describe('program CRUD — cancel (abandon enrollment)', () => {
  test('abandoning frees the one-active-program unique index for a fresh enroll', async () => {
    const user = await signUpThrowawayUser('cancel');
    const { programId } = await createOwnedProgram(user, 2);
    const userProgramId = await enroll(user, programId);

    // A second active enrollment while one is active violates the partial unique
    // index one_active_program_per_user.
    const blocked = await rest('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: programId, status: 'active' },
    });
    expect(blocked.status).toBe(409);

    // Cancel = flip to 'abandoned', scoped to the active row.
    const cancelRes = await rest(
      'PATCH',
      `user_programs?id=eq.${userProgramId}&status=eq.active`,
      user.token,
      { body: { status: 'abandoned' } },
    );
    expect(cancelRes.status).toBeLessThan(300);

    const [row] = await restJson<Array<{ status: string }>>(
      'GET',
      `user_programs?id=eq.${userProgramId}&select=status`,
      user.token,
    );
    expect(row.status).toBe('abandoned');

    // With the active slot freed, enrolling again now succeeds.
    const reEnroll = await rest('POST', 'user_programs', user.token, {
      body: { user_id: user.uid, program_id: programId, status: 'active' },
    });
    expect(reEnroll.status).toBeLessThan(300);
  });
});

test.describe('program CRUD — delete (hard cascade)', () => {
  test('deleting a program cascades to its sessions, enrollments, and completions', async () => {
    const user = await signUpThrowawayUser('delete');
    const { programId, sessionIds } = await createOwnedProgram(user, 2);
    const userProgramId = await enroll(user, programId);
    await restJson('POST', 'program_session_completions', user.token, {
      body: {
        user_program_id: userProgramId,
        program_session_id: sessionIds[0],
        user_id: user.uid,
        status: 'skipped',
        workout_log_id: null,
      },
      prefer: 'return=representation',
    });

    const del = await rest('DELETE', `programs?id=eq.${programId}`, user.token);
    expect(del.status).toBeLessThan(300);

    // Program and every dependent row are gone (ON DELETE CASCADE).
    const program = await restJson<unknown[]>(
      'GET',
      `programs?id=eq.${programId}`,
      user.token,
    );
    expect(program).toHaveLength(0);
    const sessions = await restJson<unknown[]>(
      'GET',
      `program_sessions?program_id=eq.${programId}`,
      user.token,
    );
    expect(sessions).toHaveLength(0);
    const enrollments = await restJson<unknown[]>(
      'GET',
      `user_programs?id=eq.${userProgramId}`,
      user.token,
    );
    expect(enrollments).toHaveLength(0);
    const completions = await restJson<unknown[]>(
      'GET',
      `program_session_completions?user_program_id=eq.${userProgramId}`,
      user.token,
    );
    expect(completions).toHaveLength(0);
  });
});

test.describe('program CRUD — archive / restore', () => {
  test('archiving hides a program from the live filter; restoring brings it back', async () => {
    const user = await signUpThrowawayUser('archive');
    const { programId } = await createOwnedProgram(user, 1);

    const liveOnly = async () =>
      restJson<Array<{ id: string }>>(
        'GET',
        `programs?owner_id=eq.${user.uid}&archived_at=is.null&select=id`,
        user.token,
      );

    expect((await liveOnly()).map((p) => p.id)).toContain(programId);

    // Archive: set the timestamp.
    const archive = await rest(
      'PATCH',
      `programs?id=eq.${programId}`,
      user.token,
      { body: { archived_at: new Date().toISOString() } },
    );
    expect(archive.status).toBeLessThan(300);
    expect((await liveOnly()).map((p) => p.id)).not.toContain(programId);

    // The row (and its history) is preserved, just archived.
    const [archived] = await restJson<Array<{ archived_at: string | null }>>(
      'GET',
      `programs?id=eq.${programId}&select=archived_at`,
      user.token,
    );
    expect(archived.archived_at).not.toBeNull();

    // Restore: clear the timestamp.
    const restore = await rest(
      'PATCH',
      `programs?id=eq.${programId}`,
      user.token,
      { body: { archived_at: null } },
    );
    expect(restore.status).toBeLessThan(300);
    expect((await liveOnly()).map((p) => p.id)).toContain(programId);
  });
});

test.describe('program CRUD — owner-only (shared + other-user programs protected)', () => {
  async function getDfwProgramId(token: string): Promise<string> {
    const [row] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${DFW_SLUG}&select=id`,
      token,
    );
    return row.id;
  }

  test('a non-owner cannot delete or archive the shared DFW program', async () => {
    const user = await signUpThrowawayUser('rls');
    const dfwId = await getDfwProgramId(user.token);

    // RLS matches 0 rows for a non-owner, so both are no-ops (2xx, nothing
    // changed) rather than mutations — assert the program is untouched.
    const del = await rest('DELETE', `programs?id=eq.${dfwId}`, user.token);
    expect(del.status).toBeLessThan(300);
    const archive = await rest('PATCH', `programs?id=eq.${dfwId}`, user.token, {
      body: { archived_at: new Date().toISOString() },
    });
    expect(archive.status).toBeLessThan(300);

    const [dfw] = await restJson<
      Array<{ id: string; archived_at: string | null }>
    >('GET', `programs?id=eq.${dfwId}&select=id,archived_at`, user.token);
    expect(dfw.id).toBe(dfwId);
    expect(dfw.archived_at).toBeNull();
  });

  test("a user cannot delete another user's private program", async () => {
    const owner = await signUpThrowawayUser('rls-owner');
    const other = await signUpThrowawayUser('rls-other');
    const { programId } = await createOwnedProgram(owner, 1);

    // The other user can't even see it (RLS select is public-or-own), so the
    // delete matches nothing.
    const del = await rest(
      'DELETE',
      `programs?id=eq.${programId}`,
      other.token,
    );
    expect(del.status).toBeLessThan(300);

    // The owner still has it.
    const stillThere = await restJson<unknown[]>(
      'GET',
      `programs?id=eq.${programId}`,
      owner.token,
    );
    expect(stillThere).toHaveLength(1);
  });
});
