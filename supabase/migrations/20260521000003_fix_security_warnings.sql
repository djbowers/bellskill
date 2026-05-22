-- Fix 13 of 15 Supabase Security Advisor warnings.
-- The remaining 2 (anon + authenticated SELECT on progress_items) are cleared
-- by the preceding migration 20260521000002_drop_progress_items_table.sql.

-- 1. Fix RLS INSERT/UPDATE policies that used WITH CHECK (true), which allowed
--    authenticated users to insert/update rows with any user_id.

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.movement_logs;
CREATE POLICY "Enable insert for authenticated users only" ON public.movement_logs
  FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.workout_logs;
CREATE POLICY "Enable insert for authenticated users only" ON public.workout_logs
  FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Enable update access for workout logs based on user id" ON public.workout_logs;
CREATE POLICY "Enable update access for workout logs based on user id" ON public.workout_logs
  FOR UPDATE TO authenticated
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- 2. Revoke all anon table grants. The app requires authentication before any
--    data access; the anon role should have no direct table privileges.

REVOKE ALL ON TABLE public.movement_logs FROM anon;
REVOKE ALL ON TABLE public.movements FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.workout_logs FROM anon;

-- 3. Narrow authenticated table grants from GRANT ALL to only the operations
--    each table actually uses. RLS policies remain the enforcement boundary.

REVOKE ALL ON TABLE public.workout_logs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_logs TO authenticated;

REVOKE ALL ON TABLE public.movement_logs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.movement_logs TO authenticated;

REVOKE ALL ON TABLE public.movements FROM authenticated;
GRANT SELECT ON TABLE public.movements TO authenticated;

REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- 4. Revoke EXECUTE on handle_new_user() from anon and authenticated.
--    This is a trigger function invoked automatically on auth.users INSERT;
--    it is never called directly by client code.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
