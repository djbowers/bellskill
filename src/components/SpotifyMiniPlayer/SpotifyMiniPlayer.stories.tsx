import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';

import { VITE_SUPABASE_URL } from '~/env';

import { SpotifyMiniPlayer } from './SpotifyMiniPlayer';

const playerHandlers = (
  response: Record<string, unknown>,
  connected = true,
) => [
  http.post(
    `${VITE_SUPABASE_URL}/rest/v1/rpc/get_spotify_connection_status`,
    () => HttpResponse.json([{ connected, spotify_user_id: 'dj' }]),
  ),
  http.post(`${VITE_SUPABASE_URL}/functions/v1/spotify-player`, () =>
    HttpResponse.json(response),
  ),
];

const track = {
  name: 'Higher Power',
  artists: 'Gryffin',
  albumArtUrl: null,
};

export default {
  component: SpotifyMiniPlayer,
  decorators: [
    (Story: React.ComponentType) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export const Playing = {
  parameters: {
    msw: {
      handlers: playerHandlers({
        isPlaying: true,
        track,
        progressMs: 30_000,
        durationMs: 180_000,
      }),
    },
  },
};

export const Paused = {
  parameters: {
    msw: {
      handlers: playerHandlers({
        isPlaying: false,
        track,
        progressMs: 30_000,
        durationMs: 180_000,
      }),
    },
  },
};

export const NoActiveDevice = {
  parameters: {
    msw: { handlers: playerHandlers({ noActiveDevice: true }) },
  },
};

export const Disconnected = {
  parameters: {
    msw: { handlers: playerHandlers({ connected: false }, false) },
  },
};
