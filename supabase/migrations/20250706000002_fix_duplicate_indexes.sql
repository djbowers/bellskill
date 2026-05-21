-- Fix duplicate indexes on movements and workout_logs tables
-- The PRIMARY KEY constraint already creates a unique index, so we don't need additional UNIQUE constraints

-- 1. Drop the foreign key constraint on movement_logs that depends on the unique index
ALTER TABLE "public"."movement_logs" DROP CONSTRAINT IF EXISTS "movement_logs_workout_log_id_fkey";

-- 2. Drop the redundant unique constraint on workout_logs
ALTER TABLE "public"."workout_logs" DROP CONSTRAINT IF EXISTS "training_history_id_key";

-- 3. Recreate the foreign key on movement_logs to reference the primary key
ALTER TABLE "public"."movement_logs" ADD CONSTRAINT "movement_logs_workout_log_id_fkey" FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE;

-- 4. Fix movements table: drop the redundant movements_id_key constraint
-- The movements_pkey PRIMARY KEY constraint already provides uniqueness
ALTER TABLE "public"."movements" DROP CONSTRAINT IF EXISTS "movements_id_key"; 