import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '../constants';
import { supabase } from '../supabaseClient';
import { SpotifyNowPlaying } from './useSpotifyNowPlaying';

export type SpotifyControlAction = 'play' | 'pause' | 'next' | 'previous';

interface SpotifyControlResult {
  ok?: boolean;
  noActiveDevice?: boolean;
  error?: 'premium_required' | 'rate_limited' | 'spotify_error';
}

const invokeControl = async (
  action: SpotifyControlAction,
): Promise<SpotifyControlResult> => {
  const { data, error } = await supabase.functions.invoke<SpotifyControlResult>(
    'spotify-player',
    { body: { action } },
  );

  if (error) throw error;
  return data ?? {};
};

/**
 * Play/pause/next/previous against the user's active Spotify device, with an
 * optimistic isPlaying flip that the next now-playing poll settles.
 */
export const useSpotifyControls = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invokeControl,
    onMutate: (action) => {
      if (action !== 'play' && action !== 'pause') return;
      queryClient.setQueryData<SpotifyNowPlaying>(
        [QUERIES.SPOTIFY_NOW_PLAYING],
        (previous) =>
          previous ? { ...previous, isPlaying: action === 'play' } : previous,
      );
    },
    onSuccess: (result) => {
      if (result.noActiveDevice || result.error) {
        queryClient.invalidateQueries({
          queryKey: [QUERIES.SPOTIFY_NOW_PLAYING],
        });
      }
    },
  });
};
