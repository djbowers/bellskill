import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '../constants';
import { supabase } from '../supabaseClient';

export interface SpotifyConnectionStatus {
  connected: boolean;
  spotifyUserId: string | null;
}

const fetchSpotifyConnection = async (): Promise<SpotifyConnectionStatus> => {
  const { data, error } = await supabase.rpc('get_spotify_connection_status');

  if (error) throw error;

  const row = data?.[0];
  return {
    connected: row?.connected ?? false,
    spotifyUserId: row?.spotify_user_id ?? null,
  };
};

/** Whether the current user has linked a Spotify account (tokens stay server-side). */
export const useSpotifyConnection = (enabled: boolean = true) =>
  useQuery({
    queryKey: [QUERIES.SPOTIFY_CONNECTION],
    queryFn: fetchSpotifyConnection,
    enabled,
  });
