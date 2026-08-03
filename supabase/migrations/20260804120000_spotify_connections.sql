-- Spotify remote-control integration: per-user OAuth tokens.
--
-- Tokens are server-only. RLS is enabled with NO client policies (deny-all);
-- only the service role (edge functions) reads or writes this table. Clients
-- learn connection status via the security-definer RPC below, which never
-- exposes token columns.

create table public.spotify_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  spotify_user_id text,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spotify_connections enable row level security;

create or replace function public.get_spotify_connection_status()
returns table (connected boolean, spotify_user_id text)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) > 0 as connected,
    max(sc.spotify_user_id) as spotify_user_id
  from public.spotify_connections sc
  where sc.user_id = auth.uid();
$$;

revoke all on function public.get_spotify_connection_status() from anon;
grant execute on function public.get_spotify_connection_status() to authenticated;
