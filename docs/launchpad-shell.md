# Launchpad Shell (PROD-171)

The launchpad "start screen" (now the hub) lives entirely in
`StartWorkoutPage.tsx`. The hub **graduated from experiment to baseline** — it
is the default home surface for everyone, no longer gated behind the
`launchpad_shell` flag (that flag is retained only so exposure logging keeps
recording assignment; seed migration `*_seed_launchpad_shell_flag.sql`).

- **Population routing** (derived from `useWorkoutLogs()` count, tri-state
  `isFirstWorkout`): returning users (≥1 log) get the Phase-2 `recommender`
  surface. New users get the bare hub — first-workout guidance is moving to the
  skill tree.
- **Content gates:** hub suggestions sit behind their own runtime flags, routed
  by population — `recommender` (returning users). The `curated_first_workout`
  and `repeat_previous` flag rows remain for experiment history but no longer
  drive any UI: both sections were removed from the hub.
  An active program forces the program hero independently
  (separate `programs` release feature).
- **Exposure logging:** the `launchpad_exposed` analytics event
  (`AnalyticsEvent.LaunchpadExposed`, fired once per mount from a `useEffect`)
  records `{ shell_variant, population, content }`, keyed by `user_id` so it joins
  to the PROD-170 funnel events in `analytics_events`. The sticky assignment
  itself is the server-side `feature_flag_assignments` row, and
  `activation_funnel_by_variant(flag_key, from, to)` reads the funnel per
  variant for the PROD-172 lift measurement. Behavior is covered by
  `StartWorkoutPage.launchpad.test.jsx` (gate + logging) and
  `StartWorkoutPage.recommendations.test.jsx` (population content).
