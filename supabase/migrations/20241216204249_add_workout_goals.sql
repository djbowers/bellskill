create type "public"."workout_goal_units" as enum ('minutes', 'rounds');

alter table "public"."workout_logs" rename column "minutes" to "workout_goal";

alter table "public"."workout_logs" add column "workout_goal_units" workout_goal_units not null default 'minutes'::workout_goal_units;
