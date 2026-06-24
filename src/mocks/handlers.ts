import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '../env';
import mockedMovementLogs from './mocked-movement-logs';
import mockedProfiles from './mocked-profiles';
import mockedWorkoutLogs from './mocked-workout-logs';

export const handlers = [
  ...mockedProfiles,
  ...mockedWorkoutLogs,
  ...mockedMovementLogs,
  http.get(`${VITE_SUPABASE_URL}/rest/v1/movements_catalog`, () => HttpResponse.json([])),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () => HttpResponse.json([])),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/user_movements`, () => HttpResponse.json([])),
  http.post(`${VITE_SUPABASE_URL}/rest/v1/analytics_events`, () => HttpResponse.json([])),
  http.get(`${VITE_SUPABASE_URL}/rest/v1/analytics_events`, () => HttpResponse.json([])),
];
