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
];
