# Runtime Feature Flags (PROD-175)

Server-authoritative, per-user flag/assignment mechanism that replaced the
build-time `VITE_FEATURE_*` env vars for **experiment** flags (as opposed to
the release-toggle flags in `~/config/features`, which stay build-time).

- Schema + RPCs in `supabase/migrations/20260713000001_create_feature_flags.sql`; eval
  client in `~/api/useFeatureFlags` (`useFeatureFlags()` hook); app-facing
  flag keys/types and the safe-default mapping in `~/config/experiments`.

* Two tables: `feature_flags` (runtime-toggleable definitions — enabled /
  rollout_percentage / default_variant, client-readable, never client-writable)
  and `feature_flag_assignments` (sticky per-user variant, `user_id, flag_key`
  PK, readable only by its own user, **writable only by the RPC** — no client
  insert/update policy exists, so a user cannot forge their own bucket).
* `evaluate_feature_flag(flag_key)` is `SECURITY DEFINER`: on first eval of an
  enabled flag it buckets the user deterministically
  (`hashtextextended(user_id || flag_key)` mod 100 vs `rollout_percentage`) and
  persists the assignment; every later eval reads that row back, so the bucket
  can't drift even if rollout changes. The batch
  `evaluate_feature_flags(flag_keys[])` is a plain `LANGUAGE sql` wrapper
  (SECURITY INVOKER) that just delegates each key to the singular DEFINER
  function — it does no table DML itself, so the privileged assignment write
  still happens only inside `evaluate_feature_flag`. Disabled flags and unknown
  flag keys resolve to `default_variant`/`control` with no assignment row
  written, so re-enabling later re-buckets fresh.
* `useFeatureFlags()` returns that record alongside an `isPending` gate. It maps
  DB variants to the app-facing `ExperimentFeatures` boolean record
  (`launchpadShell` — the PROD-171 master gate — plus `curatedFirstWorkout`,
  `repeatPrevious`, `recommender`), falling back to
  `SAFE_DEFAULT_FEATURES` (all off) on any query error, while loading, and when
  unauthenticated — the eval client never flips a user into treatment on
  failure. `staleTime: Infinity` since assignment is server-sticky. Owners
  previewing all features (see `~/config/features`) get every experiment feature
  forced on (`ALL_EXPERIMENT_FEATURES_ON`), mirroring `getFeatures()`.
* **App-init gate, not a per-screen skeleton:** `FeatureFlagsGate`
  (`~/app/FeatureFlagsGate.tsx`) resolves flags once, inside `SessionProvider`
  and wrapping `RouterProvider` in `App.tsx` — before any route (or its
  flag-dependent UI) ever mounts. It blocks on the same branded `Loading`
  splash the session-bootstrap gate already uses, cleared on `isPending ===
false` **or** an independent hard timeout (`FLAGS_TIMEOUT_MS`, ~1.75s),
  whichever comes first — `isPending` alone has no wall-clock cap for a
  slow-but-succeeding request, so the timeout is what actually guarantees the
  app never hangs on this splash. If the timeout fires first, `useFeatureFlags()`
  already reads as the safe default until the real result lands, so there's no
  separate fallback path to maintain. Because the underlying query is keyed
  `[QUERIES.FEATURE_FLAGS, userId]` with `staleTime: Infinity`, any later
  consumer (e.g. `StartWorkoutPage`) calling `useFeatureFlags()` just reads the
  already-resolved cache instantly — flags are loaded once per session, not
  re-awaited on navigation. `StartWorkoutPage` itself only tracks
  `programGatePending` (the separate active-program query) for its own
  pending-skeleton handling; it has no flags-pending state left to gate on.
* Migrating another build-time flag onto this mechanism: add its key to
  `EXPERIMENT_FLAG_KEYS`/`KEY_TO_FEATURE` in `~/config/experiments`, add a row
  to the migration's seed `INSERT` (defaulted `enabled = false` to preserve
  current behavior), and swap the read site from `useFeatures()` to
  `useFeatureFlags()`.
