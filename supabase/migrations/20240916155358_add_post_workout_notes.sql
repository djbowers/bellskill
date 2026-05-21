alter table "public"."workout_logs" add column "is_one_handed" boolean;
alter table "public"."workout_logs" rename column "notes" to "workout_details";
alter table "public"."workout_logs" add column "workout_notes" text;
