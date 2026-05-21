-- Fix RLS performance: use (select auth.uid()) instead of auth.uid() per row

-- Update workout_logs policies
DROP POLICY IF EXISTS "Enable read access for users based on their user ID" ON public.workout_logs;
CREATE POLICY "Enable read access for users based on their user ID" ON public.workout_logs
  FOR SELECT TO authenticated
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Enable update access for workout logs based on user id" ON public.workout_logs;
CREATE POLICY "Enable update access for workout logs based on user id" ON public.workout_logs
  FOR UPDATE TO authenticated
  USING (((select auth.uid()) = user_id))
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.workout_logs;
CREATE POLICY "Enable delete for users based on user_id" ON public.workout_logs
  FOR DELETE TO authenticated
  USING (((select auth.uid()) = user_id));

-- Update movement_logs policies
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.movement_logs;
CREATE POLICY "Enable delete for users based on user_id" ON public.movement_logs
  FOR DELETE TO authenticated
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.movement_logs;
CREATE POLICY "Enable read access for authenticated users" ON public.movement_logs
  FOR SELECT TO authenticated
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.movement_logs;
CREATE POLICY "Enable update for authenticated users" ON public.movement_logs
  FOR UPDATE TO authenticated
  USING (((select auth.uid()) = user_id));

-- Update profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (((select auth.uid()) = id));

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (((select auth.uid()) = id));

DROP POLICY IF EXISTS "Users can delete own profile." ON public.profiles;
CREATE POLICY "Users can delete own profile." ON public.profiles
  FOR DELETE USING (((select auth.uid()) = id)); 