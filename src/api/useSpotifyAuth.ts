import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '../constants';
import { supabase } from '../supabaseClient';

const invokeSpotifyAuth = async <T>(
  body: Record<string, unknown>,
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>('spotify-auth', {
    body,
  });

  if (error) throw error;
  if (!data) throw new Error('Empty spotify-auth response');

  return data;
};

/** Fetches the Spotify authorize URL; the caller redirects to it. */
export const useConnectSpotify = () =>
  useMutation({
    mutationFn: async () => {
      const { url } = await invokeSpotifyAuth<{ url: string }>({
        action: 'authorize',
      });
      if (!url) throw new Error('No authorize URL returned');
      return url;
    },
  });

/** Completes the OAuth round-trip with the code/state from Spotify's redirect. */
export const useSpotifyCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { code: string; state: string }) =>
      invokeSpotifyAuth<{ connected: boolean }>({
        action: 'callback',
        ...params,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.SPOTIFY_CONNECTION] });
    },
  });
};

export const useDisconnectSpotify = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      invokeSpotifyAuth<{ connected: boolean }>({ action: 'disconnect' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.SPOTIFY_CONNECTION] });
    },
  });
};
