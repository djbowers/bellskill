import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '../env';
import mockedMovementLogs from './mocked-movement-logs';
import mockedProfiles from './mocked-profiles';
import mockedWorkoutLogs from './mocked-workout-logs';

export const handlers = [
  ...mockedProfiles,
  ...mockedWorkoutLogs,
  ...mockedMovementLogs,
  http.get(`${VITE_SUPABASE_URL}/rest/v1/movements_catalog`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/user_movements`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${VITE_SUPABASE_URL}/rest/v1/analytics_events`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/analytics_events`, () =>
    HttpResponse.json([]),
  ),
  // Program tracking: no enrollments by default, which settles the Home program
  // gate on "nothing active". Suites exercising a program override these.
  http.get(`${VITE_SUPABASE_URL}/rest/v1/user_programs`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/programs`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/program_sessions`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/program_session_completions`, () =>
    HttpResponse.json([]),
  ),
  // Spotify defaults to "not connected"; spotify suites override these.
  http.post(
    `${VITE_SUPABASE_URL}/rest/v1/rpc/get_spotify_connection_status`,
    () => HttpResponse.json([{ connected: false, spotify_user_id: null }]),
  ),
  http.post(`${VITE_SUPABASE_URL}/functions/v1/spotify-auth`, () =>
    HttpResponse.json({ connected: false }),
  ),
  http.post(`${VITE_SUPABASE_URL}/functions/v1/spotify-player`, () =>
    HttpResponse.json({ connected: false }),
  ),
  // Chalk defaults to an empty conversation. `onUnhandledRequest: 'error'`
  // means any suite that renders ChalkPage needs these present.
  http.get(`${VITE_SUPABASE_URL}/rest/v1/chalk_threads`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/chalk_messages`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${VITE_SUPABASE_URL}/functions/v1/chalk-chat`, () =>
    HttpResponse.json({
      thread_id: 'thread-1',
      user_message_id: 'user-1',
      assistant_message_id: 'assistant-1',
      reply: 'Your hinge is overdue — swings would be a good call today.',
    }),
  ),
  // Fired-and-forgotten from ChalkPage mount (backfill) and workout saves.
  http.post(`${VITE_SUPABASE_URL}/functions/v1/chalk-embed-history`, () =>
    HttpResponse.json({ embedded: 0, remaining: 0 }),
  ),
];
