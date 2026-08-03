// Shared helpers for the Spotify edge functions: state signing for the OAuth
// round-trip and token refresh with rotation persistence.

import { SupabaseClient } from '@supabase/supabase-js';

export const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
export const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const encoder = new TextEncoder();

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

/** Opaque OAuth `state` binding the round-trip to a user, with an expiry. */
export async function signState(userId: string, secret: string): Promise<string> {
  const payload = `${userId}|${Date.now()}`;
  return `${btoa(payload)}.${await hmac(payload, secret)}`;
}

export async function verifyState(
  state: string,
  userId: string,
  secret: string,
): Promise<boolean> {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return false;

  let payload: string;
  try {
    payload = atob(encoded);
  } catch {
    return false;
  }
  if ((await hmac(payload, secret)) !== signature) return false;

  const [stateUserId, timestamp] = payload.split('|');
  if (stateUserId !== userId) return false;
  return Date.now() - Number(timestamp) < STATE_MAX_AGE_MS;
}

function basicAuthHeader(): string {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') ?? '';
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export async function requestToken(
  params: Record<string, string>,
): Promise<Response> {
  return fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
}

export interface SpotifyConnection {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
}

/**
 * Returns a usable access token for the connection, refreshing (and persisting
 * the new token, including a rotated refresh token) when the cached one is
 * expired or about to expire. Returns null when Spotify reports the grant is
 * revoked — the caller should delete the connection row.
 */
export async function getAccessToken(
  admin: SupabaseClient,
  connection: SpotifyConnection,
): Promise<string | null> {
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (connection.access_token && expiresAt > Date.now() + 30_000) {
    return connection.access_token;
  }

  const response = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body?.error === 'invalid_grant') return null;
    throw new Error(`Spotify token refresh failed: ${response.status}`);
  }

  const token = await response.json();
  const { error } = await admin
    .from('spotify_connections')
    .update({
      access_token: token.access_token,
      access_token_expires_at: new Date(
        Date.now() + token.expires_in * 1000,
      ).toISOString(),
      refresh_token: token.refresh_token ?? connection.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.user_id);
  if (error) throw error;

  return token.access_token;
}
