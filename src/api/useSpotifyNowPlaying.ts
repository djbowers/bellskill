import { useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '../constants';
import { supabase } from '../supabaseClient';

export interface SpotifyTrack {
  name: string;
  artists: string;
  albumArtUrl: string | null;
}

export interface SpotifyNowPlaying {
  connected?: boolean;
  noActiveDevice?: boolean;
  error?: 'rate_limited' | 'premium_required' | 'spotify_error';
  isPlaying?: boolean;
  track?: SpotifyTrack;
  progressMs?: number;
  durationMs?: number;
}

const POLL_INTERVAL_MS = 5000;

const fetchNowPlaying = async (): Promise<SpotifyNowPlaying> => {
  const { data, error } = await supabase.functions.invoke<SpotifyNowPlaying>(
    'spotify-player',
    { body: { action: 'now-playing' } },
  );

  if (error) throw error;
  return data ?? {};
};

/**
 * Polls the currently-playing track while `enabled` (pass mini-player mount
 * state). React Query pauses the interval when the tab is hidden. When the
 * server reports the connection is gone, the connection query is invalidated
 * so dependent UI unwinds.
 */
export const useSpotifyNowPlaying = (enabled: boolean) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [QUERIES.SPOTIFY_NOW_PLAYING],
    queryFn: async () => {
      const nowPlaying = await fetchNowPlaying();
      if (nowPlaying.connected === false) {
        queryClient.invalidateQueries({
          queryKey: [QUERIES.SPOTIFY_CONNECTION],
        });
      }
      return nowPlaying;
    },
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // Keep the last track on transient errors — no scary states mid-workout.
    placeholderData: (previous) => previous,
    retry: false,
  });
};
