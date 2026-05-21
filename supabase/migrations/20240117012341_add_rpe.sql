create type "public"."RPE" as enum ('noEffort', 'easy', 'ideal', 'hard', 'maxEffort');

alter table "public"."workout_logs" rename column "reps" to "rep_scheme";

alter table "public"."workout_logs" rename column "tasks" to "movements";

alter table "public"."workout_logs" add column "rpe" "RPE" default 'ideal'::"RPE";


