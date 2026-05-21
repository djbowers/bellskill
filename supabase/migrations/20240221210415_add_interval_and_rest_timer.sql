alter table "public"."exercises" drop constraint "exercises_pkey";

alter table "public"."workouts" drop constraint "workouts_pkey";

drop index if exists "public"."exercises_pkey";

drop index if exists "public"."workouts_pkey";

drop table "public"."exercises";

drop table "public"."workouts";

alter table "public"."workout_logs" add column "interval_timer" smallint not null default '0'::smallint;

alter table "public"."workout_logs" add column "rest_timer" smallint not null default '0'::smallint;


