import { expect, test } from '@playwright/test';

// Program queue: enrollments can wait in line (status 'queued', no slot) and
// the front of the line is promoted into the slot an active program frees on
// completion. The guarantees proven here are all DB-level and can only be
// exercised against real Postgres — enroll_in_program's p_queue skipping the
// slot claim while still baking weights into the clone, complete_program_session
// promoting the lowest queue_position (beating auto_repeat), and the empty-queue
// auto-repeat loop staying intact. Mirrors program-parallel.spec.ts (real
// Postgres, no browser).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const MAX_ACTIVE_PROGRAMS = 3;
const SS_SLUG = 'simple-and-sinister';

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
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc ${fn} failed (${res.status}): ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
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
  queue_position: number | null;
  auto_repeat: boolean;
  cycles_completed: number;
  completed_at: string | null;
}

async function listEnrollments(user: TestUser): Promise<EnrollmentRow[]> {
  return restJson<EnrollmentRow[]>(
    'GET',
    'user_programs?select=id,program_id,status,active_slot,queue_position,auto_repeat,cycles_completed,completed_at&order=id.asc',
    user.token,
  );
}

async function enrollmentById(
  user: TestUser,
  id: string,
): Promise<EnrollmentRow> {
  const rows = await listEnrollments(user);
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`enrollment ${id} not found`);
  return row;
}

test.describe('program queue — queueing and promotion', () => {
  test('queueing a shared program clones it with baked weights, no slot, next position', async () => {
    const user = await signUpThrowawayUser('queue-weights');
    const { programId, sessionIds } = await createOwnedProgram(
      user,
      'Running',
      1,
    );
    const running = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programId,
    });

    // Queue the seeded shared S&S with heavier per-movement weights: the clone
    // must exist NOW with the chosen 32kg baked in, not at promotion time.
    const [ss] = await restJson<Array<{ id: string }>>(
      'GET',
      `programs?slug=eq.${SS_SLUG}&select=id`,
      user.token,
    );
    const queuedId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: ss.id,
      p_queue: true,
      p_movement_weights: [
        {
          movementName: 'One-Arm Kettlebell Swing',
          weightOneValue: 32,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
        {
          movementName: 'Kettlebell Turkish Get-Up',
          weightOneValue: 32,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ],
    });

    const queued = await enrollmentById(user, queuedId);
    expect(queued.status).toBe('queued');
    expect(queued.active_slot).toBeNull();
    expect(queued.queue_position).toBe(1);

    interface SessionRow {
      workout_options: {
        movements: Array<{ movementName: string; weightOneValue: number }>;
      };
    }
    const cloneSessions = await restJson<SessionRow[]>(
      'GET',
      `program_sessions?program_id=eq.${queued.program_id}&select=workout_options`,
      user.token,
    );
    expect(cloneSessions).toHaveLength(1);
    for (const movement of cloneSessions[0].workout_options.movements) {
      expect(movement.weightOneValue).toBe(32);
    }

    // Finishing the running program promotes the queued one into its slot,
    // clone and weights untouched.
    const done = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: running,
      p_program_session_id: sessionIds[0],
    });
    expect(done).toBe(true);

    const finished = await enrollmentById(user, running);
    expect(finished.status).toBe('completed');

    const promoted = await enrollmentById(user, queuedId);
    expect(promoted.status).toBe('active');
    expect(promoted.active_slot).toBe(1);
    expect(promoted.queue_position).toBeNull();

    const promotedSessions = await restJson<SessionRow[]>(
      'GET',
      `program_sessions?program_id=eq.${promoted.program_id}&select=workout_options`,
      user.token,
    );
    for (const movement of promotedSessions[0].workout_options.movements) {
      expect(movement.weightOneValue).toBe(32);
    }
  });

  test('auto_repeat beats a queued program: loop, not promotion', async () => {
    const user = await signUpThrowawayUser('queue-vs-repeat');
    const repeating = await createOwnedProgram(user, 'Repeating', 1);
    const next = await createOwnedProgram(user, 'Next', 1);

    const repeatingId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: repeating.programId,
      p_auto_repeat: true,
    });
    const queuedId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: next.programId,
      p_queue: true,
    });

    const done = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: repeatingId,
      p_program_session_id: repeating.sessionIds[0],
    });
    expect(done).toBe(false);

    const looped = await enrollmentById(user, repeatingId);
    expect(looped.status).toBe('active');
    expect(looped.cycles_completed).toBe(1);

    const stillQueued = await enrollmentById(user, queuedId);
    expect(stillQueued.status).toBe('queued');
    expect(stillQueued.queue_position).toBe(1);
  });

  test('enabling auto_repeat on a completed enrollment restarts it', async () => {
    const user = await signUpThrowawayUser('queue-late-repeat');
    const { programId, sessionIds } = await createOwnedProgram(
      user,
      'Finished',
      1,
    );
    const enrollmentId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programId,
    });

    const done = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: enrollmentId,
      p_program_session_id: sessionIds[0],
    });
    expect(done).toBe(true);
    expect((await enrollmentById(user, enrollmentId)).status).toBe('completed');

    await rpc('set_program_auto_repeat', user.token, {
      p_user_program_id: enrollmentId,
      p_auto_repeat: true,
    });

    const restarted = await enrollmentById(user, enrollmentId);
    expect(restarted.status).toBe('active');
    expect(restarted.active_slot).toBe(1);
    expect(restarted.cycles_completed).toBe(1);
    expect(restarted.completed_at).toBeNull();
  });

  test('empty queue: auto_repeat still loops (regression)', async () => {
    const user = await signUpThrowawayUser('queue-empty-repeat');
    const { programId, sessionIds } = await createOwnedProgram(
      user,
      'Looper',
      1,
    );
    const enrollmentId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programId,
      p_auto_repeat: true,
    });

    const done = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: enrollmentId,
      p_program_session_id: sessionIds[0],
    });
    expect(done).toBe(false);

    const looped = await enrollmentById(user, enrollmentId);
    expect(looped.status).toBe('active');
    expect(looped.cycles_completed).toBe(1);
  });

  test('two queued programs promote in queue order, one per completion', async () => {
    const user = await signUpThrowawayUser('queue-order');
    const active = [];
    for (let i = 0; i < MAX_ACTIVE_PROGRAMS; i++) {
      const program = await createOwnedProgram(user, `Active ${i}`, 1);
      active.push({
        ...program,
        enrollmentId: await rpc<string>('enroll_in_program', user.token, {
          p_program_id: program.programId,
        }),
      });
    }

    const first = await createOwnedProgram(user, 'Queued first', 1);
    const second = await createOwnedProgram(user, 'Queued second', 1);
    const firstId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: first.programId,
      p_queue: true,
    });
    const secondId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: second.programId,
      p_queue: true,
    });
    expect((await enrollmentById(user, firstId)).queue_position).toBe(1);
    expect((await enrollmentById(user, secondId)).queue_position).toBe(2);

    // Finish the program on slot 2: exactly the FIRST queued row takes slot 2.
    await rpc('complete_program_session', user.token, {
      p_user_program_id: active[1].enrollmentId,
      p_program_session_id: active[1].sessionIds[0],
    });
    expect(await enrollmentById(user, firstId)).toMatchObject({
      status: 'active',
      active_slot: 2,
      queue_position: null,
    });
    expect((await enrollmentById(user, secondId)).status).toBe('queued');

    // Finish another: the second queued row follows into that slot.
    await rpc('complete_program_session', user.token, {
      p_user_program_id: active[0].enrollmentId,
      p_program_session_id: active[0].sessionIds[0],
    });
    expect(await enrollmentById(user, secondId)).toMatchObject({
      status: 'active',
      active_slot: 1,
      queue_position: null,
    });
  });

  test('a dequeued (abandoned) program is never promoted', async () => {
    const user = await signUpThrowawayUser('queue-dequeue');
    const { programId, sessionIds } = await createOwnedProgram(
      user,
      'Running',
      1,
    );
    const runningId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: programId,
    });

    const queuedProgram = await createOwnedProgram(user, 'Changed my mind', 1);
    const queuedId = await rpc<string>('enroll_in_program', user.token, {
      p_program_id: queuedProgram.programId,
      p_queue: true,
    });

    // The client's dequeue: an RLS-scoped plain update.
    const res = await rest(
      'PATCH',
      `user_programs?id=eq.${queuedId}&status=eq.queued`,
      user.token,
      { body: { status: 'abandoned', queue_position: null } },
    );
    expect(res.ok).toBe(true);

    const done = await rpc<boolean>('complete_program_session', user.token, {
      p_user_program_id: runningId,
      p_program_session_id: sessionIds[0],
    });
    expect(done).toBe(true);

    const dequeued = await enrollmentById(user, queuedId);
    expect(dequeued.status).toBe('abandoned');
    expect((await enrollmentById(user, runningId)).status).toBe('completed');
  });
});
