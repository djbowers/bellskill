import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';
import { VITE_SUPABASE_URL } from '~/env';

import { MovementAutocomplete } from './MovementAutocomplete';

const MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/movements`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;

const mockSession = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
    aud: '',
  },
  access_token: '',
  refresh_token: '',
  expires_in: 10000,
  token_type: '',
};

function makeWrapper(withSession = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      withSession
        ? React.createElement(SessionProvider, { value: mockSession }, children)
        : children,
    );
}

function renderAutocomplete(value = '', onChange = vi.fn(), withSession = true) {
  const wrapper = makeWrapper(withSession);
  return render(
    <MovementAutocomplete value={value} onChange={onChange} />,
    { wrapper },
  );
}

describe('MovementAutocomplete', () => {
  beforeEach(() => {
    server.use(
      http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
    );
  });

  test('renders an input with aria-label "Movement Input"', () => {
    renderAutocomplete();
    expect(screen.getByRole('textbox', { name: 'Movement Input' })).toBeInTheDocument();
  });

  test('calls onChange on every keystroke with accumulated value', async () => {
    const onChange = vi.fn();
    renderAutocomplete('', onChange);

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.type(input, 'Swing');

    expect(onChange).toHaveBeenCalledTimes(5);
    // Component maintains internal state, so accumulated value is passed on each keypress
    expect(onChange).toHaveBeenNthCalledWith(1, 'S');
    expect(onChange).toHaveBeenNthCalledWith(2, 'Sw');
    expect(onChange).toHaveBeenNthCalledWith(3, 'Swi');
    expect(onChange).toHaveBeenNthCalledWith(4, 'Swin');
    expect(onChange).toHaveBeenNthCalledWith(5, 'Swing');
  });

  test('shows recent movements when user has movement history', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: null,
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Clean and Press')).toBeInTheDocument();
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  test('filters recent movements as user types', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: null,
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.type(input, 'Swing');

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });
    expect(screen.queryByText('Clean and Press')).not.toBeInTheDocument();
  });

  test('selecting a recent movement calls onChange with the name', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    const onChange = vi.fn();
    renderAutocomplete('', onChange);

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Clean and Press')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Clean and Press'));
    expect(onChange).toHaveBeenCalledWith('Clean and Press');
  });

  test('selecting a catalog movement creates a user_movement record', async () => {
    server.use(
      http.get(MOVEMENTS_URL, () =>
        HttpResponse.json([{ id: 'mov-1', Movement: 'Kettlebell Snatch' }]),
      ),
    );

    let capturedInsert: unknown = null;
    server.use(
      http.post(USER_MOVEMENTS_URL, async ({ request }) => {
        capturedInsert = await request.json();
        return HttpResponse.json([{ id: 'um-new', canonical_name: 'Kettlebell Snatch' }]);
      }),
    );
    server.use(
      http.get(USER_MOVEMENTS_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('canonical_name')) return HttpResponse.json(null);
        return HttpResponse.json([]);
      }),
    );

    const onChange = vi.fn();
    renderAutocomplete('Kettlebell', onChange);

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Snatch')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Kettlebell Snatch'));
    expect(onChange).toHaveBeenCalledWith('Kettlebell Snatch');

    await waitFor(() => {
      expect(capturedInsert).not.toBeNull();
    });
  });

  test('shows custom entry option when no exact match exists', async () => {
    renderAutocomplete('My Custom Move');

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText(/Use.*My Custom Move.*as custom movement/)).toBeInTheDocument();
    });
  });

  test('does not show recent movements when there is no session', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          { id: 'um-1', canonical_name: 'Clean and Press', functional_movement_id: null, created_at: '2026-05-20T10:00:00Z', user_id: 'user-123', is_big_6: false, skill_tree_enabled: false },
        ]),
      ),
    );

    renderAutocomplete('', vi.fn(), false);

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Clean and Press')).not.toBeInTheDocument();
  });
});
