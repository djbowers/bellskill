# Launchpad Shell (PROD-171)

The launchpad "start screen" is gated behind **one master runtime flag**,
`launchpad_shell` (seed migration `*_seed_launchpad_shell_flag.sql`), not a pile
of per-content flags. It lives entirely in `StartWorkoutPage.tsx`:

- **Master gate:** `experimentFeatures.launchpadShell` OFF → the pure custom
  builder (the true control baseline); ON → the browse shell. An active program
  still forces browse independently (separate `programs` release feature).
- **Population routing** (derived from `useWorkoutLogs()` count, tri-state
  `isFirstWorkout`): new user (0 logs) → curated first-workout content; returning
  (≥1) → repeat-previous + build-custom, plus the Phase-2 `recommender` nested
  flag. Content is routed by population, **not** by the old `curated_first_workout`
  / `repeat_previous` flags — those are retained in the registry for optionality
  but no longer gate the shell.
- **Exposure logging:** the `launchpad_exposed` analytics event
  (`AnalyticsEvent.LaunchpadExposed`, fired once per mount from a `useEffect`)
  records `{ shell_variant, population, content }`, keyed by `user_id` so it joins
  to the PROD-170 funnel events in `analytics_events`. The sticky assignment
  itself is the server-side `feature_flag_assignments` row. Behavior is covered by
  `StartWorkoutPage.launchpad.test.jsx` (gate + logging) and
  `StartWorkoutPage.recommendations.test.jsx` (population content).
