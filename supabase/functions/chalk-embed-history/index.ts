// chalk-embed-history: per-user training-history embeddings for Chalk RAG
// (PROD-248).
//
// One chunk per logged workout that carries notes — the prose is what makes a
// session retrievable; note-less workouts are already well served by the
// structured recent-history block chalk-chat injects. Called fire-and-forget
// by the client after a workout is logged and after post-workout notes are
// saved (idempotent upsert, so re-embedding on a notes edit just refreshes
// the chunk), plus a backfill mode ChalkPage triggers once for lifters with
// pre-RAG history.
//
// Auth mirrors chalk-chat: user from the JWT, never the body; the service
// role writes chalk_chunks (clients have no access to that table at all), and
// every write is scoped to the authenticated user's id.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { embedText } from '../_shared/embeddings.ts';

/** Backfill page size — bounds one invocation's work; the client re-invokes
 *  until `remaining` is 0. */
const BACKFILL_LIMIT = 200;

const MAX_NOTE_CHARS = 600;
const MAX_NAME_CHARS = 120;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Same rule as chalk-chat's inputs.ts: user-authored text is embedded and
 *  later rendered into a prompt, so strip control characters and cap length. */
function sanitize(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const stripped = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  return stripped.length > max ? `${stripped.slice(0, max)}…` : stripped;
}

interface WorkoutRow {
  id: number;
  completed_at: string;
  workout_goal: number | null;
  workout_goal_units: string | null;
  rpe: string | null;
  pre_workout_notes: string | null;
  post_workout_notes: string | null;
}

/** One self-describing chunk per workout: date + goal + RPE + movement lines +
 *  the lifter's own words. */
function composeChunk(
  workout: WorkoutRow,
  movements: Array<{ movement_name: string; rep_scheme: number[] | null }>,
): string | null {
  const pre = sanitize(workout.pre_workout_notes, MAX_NOTE_CHARS);
  const post = sanitize(workout.post_workout_notes, MAX_NOTE_CHARS);
  if (!pre && !post) return null;

  const moves = movements
    .map((m) => {
      const name = sanitize(m.movement_name, MAX_NAME_CHARS) ?? 'unnamed movement';
      return m.rep_scheme?.length ? `${name} ${m.rep_scheme.join('/')}` : name;
    })
    .join('; ');

  const lines = [
    `Workout on ${workout.completed_at.slice(0, 10)}` +
      (workout.workout_goal
        ? ` — goal ${workout.workout_goal} ${workout.workout_goal_units ?? ''}`.trimEnd()
        : '') +
      (workout.rpe ? ` — felt ${workout.rpe}` : ''),
  ];
  if (moves) lines.push(`Movements: ${moves}`);
  if (pre) lines.push(`Before: ${pre}`);
  if (post) lines.push(`After: ${post}`);
  return lines.join('\n');
}

async function embedWorkouts(
  admin: SupabaseClient,
  userId: string,
  workouts: WorkoutRow[],
): Promise<number> {
  if (workouts.length === 0) return 0;

  const { data: moves, error: mvErr } = await admin
    .from('movement_logs')
    .select('workout_log_id, movement_name, rep_scheme')
    .in(
      'workout_log_id',
      workouts.map((w) => w.id),
    );
  if (mvErr) throw mvErr;

  const movesByLog = new Map<number, Array<{ movement_name: string; rep_scheme: number[] | null }>>();
  for (const m of moves ?? []) {
    const list = movesByLog.get(m.workout_log_id) ?? [];
    list.push(m);
    movesByLog.set(m.workout_log_id, list);
  }

  let embedded = 0;
  for (const workout of workouts) {
    const content = composeChunk(workout, movesByLog.get(workout.id) ?? []);
    if (!content) continue;

    const embedding = await embedText(content);
    const { error } = await admin.from('chalk_chunks').upsert(
      {
        scope: 'user_history',
        user_id: userId,
        source_table: 'workout_logs',
        source_id: String(workout.id),
        chunk_index: 0,
        content,
        metadata: { completed_at: workout.completed_at },
        embedding: JSON.stringify(embedding),
      },
      { onConflict: 'user_id,source_table,source_id,chunk_index' },
    );
    if (error) throw error;
    embedded += 1;
  }
  return embedded;
}

const WORKOUT_COLUMNS =
  'id, completed_at, workout_goal, workout_goal_units, rpe, pre_workout_notes, post_workout_notes';

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json().catch(() => ({}));

    if (body.backfill === true) {
      // Oldest chunks-less workouts first; the unique upsert makes re-running
      // a page harmless. Embedded chunk ids double as the progress cursor.
      const { data: existing, error: exErr } = await admin
        .from('chalk_chunks')
        .select('source_id')
        .eq('scope', 'user_history')
        .eq('user_id', user.id)
        .eq('source_table', 'workout_logs');
      if (exErr) throw exErr;
      const done = new Set((existing ?? []).map((c) => c.source_id));

      const { data: logs, error: logErr } = await admin
        .from('workout_logs')
        .select(WORKOUT_COLUMNS)
        .eq('user_id', user.id)
        .or('pre_workout_notes.not.is.null,post_workout_notes.not.is.null')
        .order('completed_at', { ascending: true });
      if (logErr) throw logErr;

      const pending = ((logs ?? []) as WorkoutRow[]).filter(
        (w) => !done.has(String(w.id)),
      );
      const page = pending.slice(0, BACKFILL_LIMIT);
      const embedded = await embedWorkouts(admin, user.id, page);
      return json(
        { embedded, remaining: Math.max(0, pending.length - page.length) },
        200,
      );
    }

    const workoutLogId = Number(body.workout_log_id);
    if (!Number.isInteger(workoutLogId)) {
      return json({ error: 'workout_log_id or backfill required' }, 400);
    }

    // Ownership check IS the boundary — admin bypasses RLS (same contract as
    // chalk-chat's resolveThread).
    const { data: log, error: logErr } = await admin
      .from('workout_logs')
      .select(WORKOUT_COLUMNS + ', user_id')
      .eq('id', workoutLogId)
      .maybeSingle();
    if (logErr) throw logErr;
    if (!log || log.user_id !== user.id) {
      return json({ error: 'workout_not_found' }, 404);
    }

    const embedded = await embedWorkouts(admin, user.id, [log as WorkoutRow]);
    return json({ embedded }, 200);
  } catch (err) {
    console.error('chalk-embed-history error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
