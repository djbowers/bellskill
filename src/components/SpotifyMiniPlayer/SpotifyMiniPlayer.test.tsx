import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { SpotifyMiniPlayer } from './SpotifyMiniPlayer';

const track = {
  name: 'Higher Power',
  artists: 'Gryffin',
  albumArtUrl: null,
};

const mockConnection = (connected: boolean) =>
  server.use(
    http.post(
      `${VITE_SUPABASE_URL}/rest/v1/rpc/get_spotify_connection_status`,
      () =>
        HttpResponse.json([
          { connected, spotify_user_id: connected ? 'dj' : null },
        ]),
    ),
  );

const mockPlayer = (nowPlaying: Record<string, unknown>) => {
  const controlActions: string[] = [];
  mockConnection(true);
  server.use(
    http.post(
      `${VITE_SUPABASE_URL}/functions/v1/spotify-player`,
      async ({ request }) => {
        const { action } = (await request.json()) as { action: string };
        if (action === 'now-playing') return HttpResponse.json(nowPlaying);
        controlActions.push(action);
        return HttpResponse.json({ ok: true });
      },
    ),
  );
  return controlActions;
};

const renderPlayer = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SpotifyMiniPlayer />
    </QueryClientProvider>,
  );

describe('SpotifyMiniPlayer', () => {
  test('shows the current track with a pause button while playing', async () => {
    mockPlayer({ isPlaying: true, track, progressMs: 0, durationMs: 1 });
    renderPlayer();

    expect(await screen.findByText('Higher Power')).toBeInTheDocument();
    expect(screen.getByText('Gryffin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  test('shows a play button when paused and sends the play command', async () => {
    const controlActions = mockPlayer({
      isPlaying: false,
      track,
      progressMs: 0,
      durationMs: 1,
    });
    renderPlayer();

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));

    await waitFor(() => expect(controlActions).toEqual(['play']));
  });

  test('sends skip commands', async () => {
    const controlActions = mockPlayer({
      isPlaying: true,
      track,
      progressMs: 0,
      durationMs: 1,
    });
    renderPlayer();

    fireEvent.click(await screen.findByRole('button', { name: 'Next track' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));

    // Request order isn't deterministic across the two concurrent mutations.
    await waitFor(() =>
      expect([...controlActions].sort()).toEqual(['next', 'previous']),
    );
  });

  test('prompts to open Spotify when no device is active', async () => {
    mockPlayer({ noActiveDevice: true });
    renderPlayer();

    const link = await screen.findByRole('link', {
      name: /open spotify to start music/i,
    });
    expect(link).toHaveAttribute('href', 'https://open.spotify.com');
  });

  test('renders nothing when Spotify is not connected', async () => {
    mockConnection(false);
    const { container } = renderPlayer();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  test('disables controls and hints when Spotify Premium is required', async () => {
    mockConnection(true);
    server.use(
      http.post(
        `${VITE_SUPABASE_URL}/functions/v1/spotify-player`,
        async ({ request }) => {
          const { action } = (await request.json()) as { action: string };
          if (action === 'now-playing') {
            return HttpResponse.json({
              isPlaying: true,
              track,
              progressMs: 0,
              durationMs: 1,
            });
          }
          return HttpResponse.json({ error: 'premium_required' });
        },
      ),
    );
    renderPlayer();

    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));

    expect(
      await screen.findByText(/controls need Spotify Premium/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled();
  });
});
