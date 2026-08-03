import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { SpotifyCallbackPage } from './SpotifyCallbackPage';

const renderCallback = (search: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/spotify/callback${search}`]}>
        <Routes>
          <Route path="/spotify/callback" element={<SpotifyCallbackPage />} />
          <Route path="/account" element={<div>Account page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('SpotifyCallbackPage', () => {
  test('completes the connection and navigates to the account page', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(
        `${VITE_SUPABASE_URL}/functions/v1/spotify-auth`,
        async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ connected: true });
        },
      ),
    );

    renderCallback('?code=abc&state=signed-state');

    expect(await screen.findByText('Account page')).toBeInTheDocument();
    await waitFor(() =>
      expect(bodies).toEqual([
        { action: 'callback', code: 'abc', state: 'signed-state' },
      ]),
    );
  });

  test('shows a calm message when the user cancels on Spotify', () => {
    renderCallback('?error=access_denied');

    expect(screen.getByText('Spotify not connected')).toBeInTheDocument();
    expect(screen.getByText(/connection was cancelled/i)).toBeInTheDocument();
  });

  test('shows a retryable error when the exchange fails', async () => {
    server.use(
      http.post(`${VITE_SUPABASE_URL}/functions/v1/spotify-auth`, () =>
        HttpResponse.json({ error: 'Invalid state' }, { status: 400 }),
      ),
    );

    renderCallback('?code=abc&state=bad-state');

    expect(
      await screen.findByText('Spotify not connected'),
    ).toBeInTheDocument();
    expect(screen.getByText(/safe to try again/i)).toBeInTheDocument();
  });
});
