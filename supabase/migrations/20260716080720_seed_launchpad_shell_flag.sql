-- Launchpad shell master flag (PROD-171).
--
-- The launchpad "start screen" shell is gated behind ONE master runtime flag on
-- the PROD-175 mechanism, rather than a pile of per-content flags. Treatment =
-- the user lands on the launchpad first; control = they drop straight into the
-- pure custom builder, restoring a true pure-builder baseline. Repeat-previous
-- and curated workouts are content of the shell (routed by population), not
-- their own gates.
--
-- Seeded with the shared defaults (enabled=false, rollout_percentage=0,
-- default_variant='control'), so every user resolves to control (pure builder)
-- until the flag is deliberately toggled via Studio/SQL — production behavior is
-- unchanged. Idempotent on the primary key so a reset/replay is safe.
INSERT INTO public.feature_flags (key, description) VALUES
  ('launchpad_shell', 'Master launchpad start-screen shell (PROD-171).')
ON CONFLICT (key) DO NOTHING;
