// spotify-player
//
// Authenticated proxy for Spotify Connect playback: the client never holds a
// Spotify token. Reads the connection row via the service role, refreshes the
// cached access token as needed, and maps Spotify's error shapes into calm,
// typed payloads the mini-player can render without scary states.

import { createClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  SPOTIFY_API_URL,
  SpotifyConnection,
  getAccessToken,
} from '../_shared/spotify.ts';

type PlayerAction = 'now-playing' | 'play' | 'pause' | 'next' | 'previous';

const CONTROL_REQUESTS: Record<
  Exclude<PlayerAction, 'now-playing'>,
  { method: string; path: string }
> = {
  play: { method: 'PUT', path: '/me/player/play' },
  pause: { method: 'PUT', path: '/me/player/pause' },
  next: { method: 'POST', path: '/me/player/next' },
  previous: { method: 'POST', path: '/me/player/previous' },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as PlayerAction;
    if (action !== 'now-playing' && !(action in CONTROL_REQUESTS)) {
      return json({ error: 'Invalid action' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: connection, error: connErr } = await admin
      .from('spotify_connections')
      .select('user_id, refresh_token, access_token, access_token_expires_at')
      .eq('user_id', user.id)
      .maybeSingle<SpotifyConnection>();
    if (connErr) throw connErr;
    if (!connection) return json({ connected: false }, 200);

    const accessToken = await getAccessToken(admin, connection);
    if (!accessToken) {
      // Grant revoked at Spotify — drop the stale connection.
      await admin.from('spotify_connections').delete().eq('user_id', user.id);
      return json({ connected: false }, 200);
    }

    if (action === 'now-playing') {
      const res = await fetch(`${SPOTIFY_API_URL}/me/player`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 204) return json({ noActiveDevice: true }, 200);
      if (res.status === 429) {
        const retryAfterMs =
          Number(res.headers.get('Retry-After') ?? '5') * 1000;
        return json({ error: 'rate_limited', retryAfterMs }, 200);
      }
      if (!res.ok) {
        console.error('spotify-player now-playing failed:', res.status);
        return json({ error: 'spotify_error' }, 502);
      }

      const player = await res.json();
      const item = player.item;
      if (!item) return json({ noActiveDevice: true }, 200);

      return json(
        {
          isPlaying: player.is_playing === true,
          track: {
            name: item.name,
            artists: (item.artists ?? [])
              .map((artist: { name: string }) => artist.name)
              .join(', '),
            // Smallest image is last in Spotify's size-descending list.
            albumArtUrl: item.album?.images?.at(-1)?.url ?? null,
          },
          progressMs: player.progress_ms ?? 0,
          durationMs: item.duration_ms ?? 0,
        },
        200,
      );
    }

    const control = CONTROL_REQUESTS[action];
    const res = await fetch(`${SPOTIFY_API_URL}${control.path}`, {
      method: control.method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok || res.status === 204) return json({ ok: true }, 200);
    if (res.status === 404) return json({ noActiveDevice: true }, 200);
    if (res.status === 403) return json({ error: 'premium_required' }, 200);
    if (res.status === 429) {
      const retryAfterMs = Number(res.headers.get('Retry-After') ?? '5') * 1000;
      return json({ error: 'rate_limited', retryAfterMs }, 200);
    }

    console.error(`spotify-player ${action} failed:`, res.status);
    return json({ error: 'spotify_error' }, 502);
  } catch (err) {
    console.error('spotify-player error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
