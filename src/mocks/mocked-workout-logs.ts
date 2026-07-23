import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '../env';
import { workoutLogs } from './data';

const WORKOUT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/workout_logs`;

export const mockedWorkoutLogsGet = http.get(
  WORKOUT_LOGS_URL,
  ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const workoutLogId = id.split('.')[1];
      const workoutLog = workoutLogs.find((w) => w.id === Number(workoutLogId));

      if (!workoutLog) {
        throw new Error('Cannot find workout log with id: ' + id);
      }

      return HttpResponse.json([workoutLog]);
    }

    // Match the real ordering used by the paginated hook (started_at desc).
    let logs = workoutLogs;
    if (url.searchParams.get('order')?.startsWith('started_at')) {
      logs = [...workoutLogs].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
    }

    // Honor Supabase's range-based pagination. supabase-js's `.range()` is sent
    // as `offset`/`limit` query params, and reads the total count from the
    // `Content-Range` response header when `{ count: 'exact' }` is requested.
    const offsetParam = url.searchParams.get('offset');
    const limitParam = url.searchParams.get('limit');
    if (offsetParam !== null && limitParam !== null) {
      const from = Number(offsetParam);
      const to = from + Number(limitParam) - 1;
      const page = logs.slice(from, from + Number(limitParam));
      return HttpResponse.json(page, {
        headers: {
          'Content-Range': `${from}-${to}/${logs.length}`,
        },
      });
    }

    return HttpResponse.json(logs);
  },
);

export const mockedWorkoutLogsPatch = http.patch(
  WORKOUT_LOGS_URL,
  async ({ request }) => {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      throw new Error('Request body must be an object');
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      throw new Error('Must provide an ID');
    }

    const workoutLogId = id.split('.')[1];
    const workoutLog = workoutLogs.find((w) => w.id === Number(workoutLogId));
    if (!workoutLog) {
      throw new Error(`No workout log exists with id of ${id}`);
    }

    if ('rpe' in body) {
      workoutLog.rpe = body.rpe;
    }

    if ('post_workout_notes' in body) {
      workoutLog.post_workout_notes = body.post_workout_notes;
    }

    return HttpResponse.json();
  },
);

export const mockedWorkoutLogsPost = http.post(
  WORKOUT_LOGS_URL,
  async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  },
);

export default [
  mockedWorkoutLogsGet,
  mockedWorkoutLogsPatch,
  mockedWorkoutLogsPost,
];
