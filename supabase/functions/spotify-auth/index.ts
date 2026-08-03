// spotify-auth
//
// Authenticated endpoint for the Spotify OAuth lifecycle. The user is derived
// from the JWT (never trusted from the body). The authorization-code exchange
// happens here so the refresh token never reaches the client; tokens are
// written via the service role into spotify_connections (deny-all RLS).

import { createClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  SPOTIFY_ACCOUNTS_URL,
  SPOTIFY_API_URL,
  SPOTIFY_SCOPES,
  requestToken,
  signState,
  verifyState,
} from '../_shared/spotify.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const redirectUri = () => `${Deno.env.get('SITE_URL') ?? ''}/spotify/callback`;

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

    const stateSecret = Deno.env.get('SPOTIFY_STATE_SECRET') ?? '';
    const body = await req.json().catch(() => ({}));

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    switch (body.action) {
      case 'authorize': {
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: Deno.env.get('SPOTIFY_CLIENT_ID') ?? '',
          scope: SPOTIFY_SCOPES,
          redirect_uri: redirectUri(),
          state: await signState(user.id, stateSecret),
        });
        return json({ url: `${SPOTIFY_ACCOUNTS_URL}/authorize?${params}` }, 200);
      }

      case 'callback': {
        const { code, state } = body;
        if (typeof code !== 'string' || typeof state !== 'string') {
          return json({ error: 'Missing code or state' }, 400);
        }
        if (!(await verifyState(state, user.id, stateSecret))) {
          return json({ error: 'Invalid state' }, 400);
        }

        const tokenRes = await requestToken({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(),
        });
        if (!tokenRes.ok) {
          console.error('spotify-auth token exchange failed:', tokenRes.status);
          return json({ error: 'Token exchange failed' }, 502);
        }
        const token = await tokenRes.json();

        const profileRes = await fetch(`${SPOTIFY_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const profile = profileRes.ok ? await profileRes.json() : {};

        const { error: upsertErr } = await admin
          .from('spotify_connections')
          .upsert({
            user_id: user.id,
            refresh_token: token.refresh_token,
            access_token: token.access_token,
            access_token_expires_at: new Date(
              Date.now() + token.expires_in * 1000,
            ).toISOString(),
            spotify_user_id: profile.id ?? null,
            scopes: token.scope ?? SPOTIFY_SCOPES,
            updated_at: new Date().toISOString(),
          });
        if (upsertErr) throw upsertErr;

        return json({ connected: true }, 200);
      }

      case 'disconnect': {
        const { error: deleteErr } = await admin
          .from('spotify_connections')
          .delete()
          .eq('user_id', user.id);
        if (deleteErr) throw deleteErr;
        return json({ connected: false }, 200);
      }

      default:
        return json({ error: 'Invalid action' }, 400);
    }
  } catch (err) {
    console.error('spotify-auth error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
