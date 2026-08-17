import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { ChalkChatError, sendChalkMessage } from './chalkChat';

const FN = `${VITE_SUPABASE_URL}/functions/v1/chalk-chat`;

/** Replies with the function's error envelope for a given status. */
const respondWith = (status: number, body: Record<string, unknown>) =>
  server.use(http.post(FN, () => HttpResponse.json(body, { status })));

let captured: Record<string, unknown> | null = null;

beforeEach(() => {
  captured = null;
});

describe('sendChalkMessage — request', () => {
  test('sends the message, the thread id, and the local calendar date', async () => {
    server.use(
      http.post(FN, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          thread_id: 't1',
          user_message_id: 'u1',
          assistant_message_id: 'a1',
          reply: 'ok',
        });
      }),
    );

    await sendChalkMessage({ message: 'hi', threadId: 't1' });

    expect(captured).toMatchObject({ message: 'hi', thread_id: 't1' });
    // The edge runtime has no timezone of its own, so the client supplies one.
    expect(captured!.client_today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('sends a null thread id on the first turn', async () => {
    server.use(
      http.post(FN, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          thread_id: 'new',
          user_message_id: 'u1',
          assistant_message_id: 'a1',
          reply: 'ok',
        });
      }),
    );

    await sendChalkMessage({ message: 'hi' });

    expect(captured!.thread_id).toBeNull();
  });
});

describe('sendChalkMessage — error mapping', () => {
  test.each([
    [401, { error: 'premium_required', paywall_trigger: true }, 'premium_required'],
    [429, { error: 'rate_limited', cap: 50 }, 'rate_limited'],
    [404, { error: 'thread_not_found' }, 'thread_not_found'],
    [400, { error: 'message_too_long', max: 2000 }, 'message_too_long'],
    [400, { error: 'empty_message' }, 'empty_message'],
    [502, { error: 'chalk_failed' }, 'chalk_failed'],
  ])('maps %i %o to code %s', async (status, body, expected) => {
    respondWith(status, body);

    await expect(sendChalkMessage({ message: 'hi' })).rejects.toMatchObject({
      name: 'ChalkChatError',
      code: expected,
    });
  });

  test('carries the thread id a failed turn already created', async () => {
    // The function creates the thread and stores the user message before
    // calling the model, so a failure still leaves a thread to continue in.
    respondWith(502, { error: 'chalk_failed', thread_id: 't-created' });

    await expect(sendChalkMessage({ message: 'hi' })).rejects.toMatchObject({
      code: 'chalk_failed',
      threadId: 't-created',
    });
  });

  test('threadId is null when the failure predates thread creation', async () => {
    respondWith(429, { error: 'rate_limited', cap: 50 });

    await expect(sendChalkMessage({ message: 'hi' })).rejects.toMatchObject({
      code: 'rate_limited',
      threadId: null,
    });
  });

  test('an unrecognised error code falls back to "unknown"', async () => {
    respondWith(500, { error: 'something_new' });

    await expect(sendChalkMessage({ message: 'hi' })).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  test('a non-JSON error body falls back to "unknown"', async () => {
    server.use(
      http.post(FN, () =>
        HttpResponse.text('<html>gateway exploded</html>', { status: 502 }),
      ),
    );

    await expect(sendChalkMessage({ message: 'hi' })).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  test('a 200 with no reply is still an error, not a blank bubble', async () => {
    server.use(http.post(FN, () => HttpResponse.json({ thread_id: 't1' })));

    const err = await sendChalkMessage({ message: 'hi' }).catch((e) => e);
    expect(err).toBeInstanceOf(ChalkChatError);
    expect(err.code).toBe('unknown');
  });
});
