import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '../env';
import { movementLogs } from './data';

const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;

export const mockedMovementLogsGet = http.get(
  MOVEMENT_LOGS_URL,
  ({ request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get('workout_log_id') ?? '';

    // Recent-repeats fetch uses `.in('workout_log_id', [...])`, sent as
    // `workout_log_id=in.(1,2,3)`. May legitimately match nothing, so don't
    // throw for this case.
    if (filter.startsWith('in.')) {
      const ids = filter
        .slice('in.'.length)
        .replace(/[()]/g, '')
        .split(',')
        .map(Number)
        .filter((id) => !Number.isNaN(id));
      return HttpResponse.json(
        movementLogs.filter((m) => ids.includes(m.workout_log_id)),
      );
    }

    // Single-workout fetch via `.eq('workout_log_id', id)` → `eq.<id>`.
    const workoutLogId = filter.split('.')[1];
    const filteredMovementLogs = movementLogs.filter(
      (m) => m.workout_log_id === Number(workoutLogId),
    );

    if (filteredMovementLogs.length === 0) {
      throw new Error(
        'Cannot find movement logs with workout_log_id: ' + workoutLogId,
      );
    }

    return HttpResponse.json(filteredMovementLogs);
  },
);

export default [mockedMovementLogsGet];
