-- Ghost pacing (rail + lap deltas in the workout runner) shipped ungated;
-- gate it behind a runtime flag, defaulted OFF, so rollout is deliberate.
INSERT INTO public.feature_flags (key, description) VALUES
  ('ghost_pacing', 'Ghost pacing rail and lap deltas in the workout runner.')
ON CONFLICT (key) DO NOTHING;
