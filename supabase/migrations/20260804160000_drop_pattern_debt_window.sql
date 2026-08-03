-- Pattern-debt ledger Phase 1 cleanup (T8): drop the legacy 7-pattern RPC.
--
-- All shipped callers (PWA bundle index-87a09062+, recommend-session,
-- recommend-program) migrated to pattern_debt_movements in PR #229. This was
-- deliberately deferred so service-worker-cached PWA bundles could keep
-- calling the old function during rollout. Merge only after stale clients
-- have cycled (a few days after #229 reached production).

DROP FUNCTION IF EXISTS public.pattern_debt_window(int, int);
