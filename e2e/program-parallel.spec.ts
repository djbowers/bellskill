import { expect, test } from '@playwright/test';

// Parallel programs: a user may run up to MAX_ACTIVE_PROGRAMS enrollments at
// once, each on its own slot with an independent cursor. The guarantees proven
// here are all DB-level and can only be exercised against real Postgres —
// enroll_in_program picking the lowest free slot, the PROGRAM_SLOTS_FULL /
// PROGRAM_ALREADY_ACTIVE raises, the replace path freeing exactly one slot, and
// completions advancing one enrollment without touching the others.
// Mirrors program-crud.spec.ts (real Postgres, no browser).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const MAX_ACTIVE_PROGRAMS = 3;

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

async function rpcRaw(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
}

async function rpc<T = unknown>(
  fn: string,
  token: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await rpcRaw(fn, token, args);
  if (!res.ok)
    throw new Error(`rpc ${fn} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** An owned program with `count` sessions, so enroll takes the no-clone path. */
async function createOwnedProgram(
  user: TestUser,
  title: string,
  count: number,
): Promise<{ programId: string; sessionIds: string[] }> {
  const [program] = await restJson<Array<{ id: string }>>(
    'POST',
    'programs',
    user.token,
    {
      body: {
        owner_id: user.uid,
        title,
        num_weeks: 1,
        days_per_week: count,
      },
      prefer: 'return=representation',
    },
  );

  const sessions = await restJson<Array<{ id: string }>>(
    'POST',
    'program_sessions',
    user.token,
    {
      body: Array.from({ length: count }, (_, i) => ({
        program_id: program.id,
        sequence_index: i,
        week_number: 1,
        day_number: i + 1,
        title: `${title} session ${i}`,
        workout_options: { movements: [`Move ${i}`] },
      })),
      prefer: 'return=representation',
    },
  );

  return { programId: program.id, sessionIds: sessions.map((s) => s.id) };
}

interface EnrollmentRow {
  id: string;
  program_id: string;
  status: string;
  active_slot: number | null;
}

async function listEnrollments(user: TestUser): Promise<EnrollmentRow[]> {
  return restJson<EnrollmentRow[]>(
    'GET',
    'user_programs?select=id,program_id,status,active_slot&order=active_slot.asc',
    user.token,
  );
}

async function activeEnrollments(user: TestUser): Promise<EnrollmentRow[]> {
  return (await listEnrollments(user)).filter((r) => r.status === 'active');
}

test.describe('parallel programs — enrollment slots', () => {
  test('three programs enroll onto distinct slots and a fourth is refused', async () => {
    const user = await signUpThrowawayUser('parallel');
    const programs = [];
    for (let i = 0; i < MAX_ACTIVE_PROGRAMS + 1; i++) {
      programs.push(await createOwnedProgram(user, `Program ${i}`, 2));
    }

    for (let i = 0; i < MAX_ACTIVE_PROGRAMS; i++) {
      const id = await rpc<string>('enroll_in_program', user.token, {
        p_program_id: programs[i].programId,
      });
      expect(id).toBeTruthy();
    }

    // Lowest free slot each time, so the three land on 1/2/3 in enroll order.
    const active = await activeEnrollments(user);
    expect(active.map((r) => r.active_slot)).toEqual([1, 2, 3]);
    expect(active.map((r) => r.program_id)).toEqual(
      programs.slice(0, MAX_ACTIVE_PROGRAMS).map((p) => p.programId),
    );

    // A fourth has nowhere to go.
    const overflow = await rpcRaw('enroll_in_program', user.token, {
      p_program_id: programs[MAX_ACTIVE_PROGRAMS].programId,
    });
    expect(overflow.ok).toBe(false);
    expect(await overflow.text()).toContain('PROGRAM_SLOTS_FULL');

    // ...and the failed attempt left the existing three untouched.
    expect((await activeEnrollments(user)).map((r) => r.active_slot)).toEqual([
      1, 2, 3,
    ]);
  });

  test('enrolling twice in the same program is refused rather than doubling the cursor', async () => {
    const user = await signUpThrowawayUser('parallel-dup');
    const { programId } = await createOwnedProgram(user, 'Only Program', 2);

    await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programId,
    });

    const duplicate = await rpcRaw('enroll_in_program', user.token, {
      p_program_id: programId,
    });
    expect(duplicate.ok).toBe(false);
    expect(await duplicate.text()).toContain('PROGRAM_ALREADY_ACTIVE');
    expect(await activeEnrollments(user)).toHaveLength(1);
  });

  test('replacing frees exactly the nominated slot and abandons only that enrollment', async () => {
    const user = await signUpThrowawayUser('parallel-replace');
    const programs = [];
    for (let i = 0; i < MAX_ACTIVE_PROGRAMS + 1; i++) {
      programs.push(await createOwnedProgram(user, `Program ${i}`, 2));
    }

    const enrollmentIds: string[] = [];
    for (let i = 0; i < MAX_ACTIVE_PROGRAMS; i++) {
      enrollmentIds.push(
        await rpc<string>('enroll_in_program', user.token, {
          p_program_id: programs[i].programId,
        }),
      );
    }

    // Replace the middle one (slot 2).
    const replaced = enrollmentIds[1];
    await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programs[MAX_ACTIVE_PROGRAMS].programId,
      p_replace_user_program_id: replaced,
    });

    const rows = await listEnrollments(user);
    expect(rows.find((r) => r.id === replaced)!.status).toBe('abandoned');

    const active = await activeEnrollments(user);
    expect(active).toHaveLength(MAX_ACTIVE_PROGRAMS);
    expect(active.map((r) => r.active_slot)).toEqual([1, 2, 3]);
    // The newcomer took the freed slot; the untouched two kept theirs.
    expect(active.find((r) => r.active_slot === 2)!.program_id).toBe(
      programs[MAX_ACTIVE_PROGRAMS].programId,
    );
    expect(active.find((r) => r.active_slot === 1)!.id).toBe(enrollmentIds[0]);
    expect(active.find((r) => r.active_slot === 3)!.id).toBe(enrollmentIds[2]);
  });
});

test.describe('parallel programs — independent cursors', () => {
  test('completing a session in one program leaves the others where they were', async () => {
    const user = await signUpThrowawayUser('parallel-cursor');
    const a = await createOwnedProgram(user, 'Program A', 3);
    const b = await createOwnedProgram(user, 'Program B', 3);
    const c = await createOwnedProgram(user, 'Program C', 3);

    const [enrollA, enrollB, enrollC] = [
      await rpc<string>('enroll_in_program', user.token, {
        p_program_id: a.programId,
      }),
      await rpc<string>('enroll_in_program', user.token, {
        p_program_id: b.programId,
      }),
      await rpc<string>('enroll_in_program', user.token, {
        p_program_id: c.programId,
      }),
    ];

    // Advance B twice; A and C are never mentioned.
    for (const sessionId of b.sessionIds.slice(0, 2)) {
      const done = await rpc<boolean>('complete_program_session', user.token, {
        p_user_program_id: enrollB,
        p_program_session_id: sessionId,
        p_status: 'skipped',
      });
      expect(done).toBe(false); // 2 of 3 — not the whole program yet
    }

    const countFor = async (userProgramId: string) =>
      (
        await restJson<Array<{ id: string }>>(
          'GET',
          `program_session_completions?user_program_id=eq.${userProgramId}&select=id`,
          user.token,
        )
      ).length;

    expect(await countFor(enrollA)).toBe(0);
    expect(await countFor(enrollB)).toBe(2);
    expect(await countFor(enrollC)).toBe(0);

    // Finishing B flips only B, freeing its slot while A and C keep running.
    const finished = await rpc<boolean>(
      'complete_program_session',
      user.token,
      {
        p_user_program_id: enrollB,
        p_program_session_id: b.sessionIds[2],
        p_status: 'skipped',
      },
    );
    expect(finished).toBe(true);

    const rows = await listEnrollments(user);
    expect(rows.find((r) => r.id === enrollB)!.status).toBe('completed');
    expect(rows.find((r) => r.id === enrollA)!.status).toBe('active');
    expect(rows.find((r) => r.id === enrollC)!.status).toBe('active');
  });

  test('a resumed enrollment claims a free slot beside the running programs', async () => {
    const user = await signUpThrowawayUser('parallel-resume');
    const a = await createOwnedProgram(user, 'Program A', 3);
    const b = await createOwnedProgram(user, 'Program B', 3);

    const enrollA = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: a.programId,
    });
    await rpc('complete_program_session', user.token, {
      p_user_program_id: enrollA,
      p_program_session_id: a.sessionIds[0],
      p_status: 'skipped',
    });

    // Stop A, start B in its place, then bring A back alongside B.
    await rest(
      'PATCH',
      `user_programs?id=eq.${enrollA}&status=eq.active`,
      user.token,
      { body: { status: 'abandoned' } },
    );
    const enrollB = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: b.programId,
    });

    const resumed = await rpc<string>('resume_program', user.token, {
      p_user_program_id: enrollA,
    });
    expect(resumed).toBe(enrollA);

    const active = await activeEnrollments(user);
    expect(active).toHaveLength(2);
    expect(active.map((r) => r.id).sort()).toEqual([enrollA, enrollB].sort());
    // Distinct slots, and A's earlier progress came back with it.
    expect(new Set(active.map((r) => r.active_slot)).size).toBe(2);
    const completions = await restJson<Array<{ id: string }>>(
      'GET',
      `program_session_completions?user_program_id=eq.${enrollA}&select=id`,
      user.token,
    );
    expect(completions).toHaveLength(1);
  });
});
