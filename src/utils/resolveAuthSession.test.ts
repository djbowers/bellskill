import { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '~/supabaseClient';

import {
  isStaleAuthUserForeignKey,
  resolveAuthSession,
  signOutIfStaleAuthUser,
} from './resolveAuthSession';

vi.mock('~/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signOut: vi.fn(),
    },
  },
}));

const session = {
  user: {
    id: 'user-123',
    user_metadata: { full_name: 'Test User' },
  },
} as unknown as Session;

function mockProfilesTable({
  profile,
  profileError = null,
  insertError = null,
}: {
  profile?: { id: string } | null;
  profileError?: unknown;
  insertError?: { code: string } | null;
}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: profile ?? null, error: profileError });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const insert = vi.fn().mockResolvedValue({ error: insertError });

  vi.mocked(supabase.from).mockReturnValue({
    select,
    insert,
  } as never);
}

describe('resolveAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null session unchanged', async () => {
    await expect(resolveAuthSession(null)).resolves.toBeNull();
  });

  test('returns session when profile exists', async () => {
    const insert = vi.fn();
    mockProfilesTable({ profile: { id: 'user-123' } });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
        }),
      }),
      insert,
    } as never);

    await expect(resolveAuthSession(session)).resolves.toBe(session);
    expect(insert).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('creates profile when missing and keeps session', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockProfilesTable({ profile: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert,
    } as never);

    await expect(resolveAuthSession(session)).resolves.toBe(session);
    expect(insert).toHaveBeenCalledWith({
      id: 'user-123',
      full_name: 'Test User',
      avatar_url: null,
    });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('keeps session when profile insert races with trigger', async () => {
    mockProfilesTable({ profile: null, insertError: { code: '23505' } });

    await expect(resolveAuthSession(session)).resolves.toBe(session);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('signs out when profile insert hits stale auth user foreign key', async () => {
    mockProfilesTable({ profile: null, insertError: { code: '23503' } });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    await expect(resolveAuthSession(session)).resolves.toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('keeps session when profile lookup fails', async () => {
    mockProfilesTable({ profileError: { message: 'network error' } });

    await expect(resolveAuthSession(session)).resolves.toBe(session);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('isStaleAuthUserForeignKey', () => {
  test('matches auth user foreign key violations', () => {
    expect(
      isStaleAuthUserForeignKey({
        code: '23503',
        message:
          'insert or update on table "user_movements" violates foreign key constraint "user_movements_user_id_fkey"',
      }),
    ).toBe(true);
  });

  test('ignores catalog foreign key violations', () => {
    expect(
      isStaleAuthUserForeignKey({
        code: '23503',
        message:
          'insert or update on table "user_movements" violates foreign key constraint "user_movements_functional_movement_id_fkey"',
      }),
    ).toBe(false);
  });

  test('ignores non-foreign-key errors', () => {
    expect(isStaleAuthUserForeignKey({ code: '42501' })).toBe(false);
  });
});

describe('signOutIfStaleAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('signs out on stale auth user foreign key violation', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    await expect(
      signOutIfStaleAuthUser({
        code: '23503',
        message: 'violates foreign key constraint "user_movements_user_id_fkey"',
      }),
    ).resolves.toBe(true);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('does not sign out on catalog foreign key violation', async () => {
    await expect(
      signOutIfStaleAuthUser({
        code: '23503',
        message:
          'violates foreign key constraint "user_movements_functional_movement_id_fkey"',
      }),
    ).resolves.toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  test('ignores other errors', async () => {
    await expect(signOutIfStaleAuthUser({ code: '42501' })).resolves.toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
