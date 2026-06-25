import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { VITE_SUPABASE_URL } from '../env';
import { server } from '~/mocks/server';

import { AnalyticsEvent, trackEvent } from './analytics';

const ANALYTICS_URL = `${VITE_SUPABASE_URL}/rest/v1/analytics_events`;

describe('trackEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('inserts an event row with user_id, event_name, and properties', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(ANALYTICS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    await trackEvent({
      event: AnalyticsEvent.WorkoutCompleted,
      userId: 'user-123',
      properties: { is_first_workout: true },
    });

    expect(capturedBody).toEqual({
      user_id: 'user-123',
      event_name: 'workout_completed',
      properties: { is_first_workout: true },
    });
  });

  test('defaults properties to an empty object', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(ANALYTICS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    await trackEvent({
      event: AnalyticsEvent.FirstSessionStarted,
      userId: 'user-123',
    });

    expect(capturedBody).toEqual({
      user_id: 'user-123',
      event_name: 'first_session_started',
      properties: {},
    });
  });

  test('no-ops without a userId and issues no request', async () => {
    const onRequest = vi.fn();
    server.use(
      http.post(ANALYTICS_URL, () => {
        onRequest();
        return HttpResponse.json([]);
      }),
    );

    await expect(
      trackEvent({ event: AnalyticsEvent.WorkoutStarted, userId: '' }),
    ).resolves.toBeUndefined();

    expect(onRequest).not.toHaveBeenCalled();
  });

  test('never throws when the insert fails', async () => {
    server.use(
      http.post(ANALYTICS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await expect(
      trackEvent({
        event: AnalyticsEvent.WorkoutStarted,
        userId: 'user-123',
      }),
    ).resolves.toBeUndefined();
  });
});
