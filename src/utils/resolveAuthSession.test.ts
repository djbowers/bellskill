import { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '~/supabaseClient';

import { resolveAuthSession, signOutIfStaleAuthUser } from './resolveAuthSession';

vi.mock('~/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signOut: vi.fn(),
    },
  },
}));

const session = {
  user: { id: 'user-123' },
} as Session;

describe('resolveAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null session unchanged', async () => {
    await expect(resolveAuthSession(null)).resolves.toBeNull();
  });

  test('returns session when profile exists', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
        }),
      }),
    } as never);

    await expect(resolveAuthSession(session)).resolves.toBe(session);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('signs out and returns null when profile is missing', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    await expect(resolveAuthSession(session)).resolves.toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

describe('signOutIfStaleAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('signs out on foreign key violation', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    await expect(signOutIfStaleAuthUser({ code: '23503' })).resolves.toBe(true);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('ignores other errors', async () => {
    await expect(signOutIfStaleAuthUser({ code: '42501' })).resolves.toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
