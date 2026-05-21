create policy "Enable update access for workout logs based on user id"
on "public"."workout_logs"
as permissive
for update
to authenticated
using ((auth.uid() = user_id))
with check (true);



