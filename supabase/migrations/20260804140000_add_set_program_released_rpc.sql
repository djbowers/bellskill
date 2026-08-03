-- Owner-only release toggle for shared catalog programs (follow-up to
-- PROD-246's release gate). Seeded public programs have owner_id NULL, so the
-- "Users can update own programs" policy can't flip released_at from the app;
-- releasing has required raw SQL. This RPC lets the app owner release or pull
-- back a catalog program from the UI.
--
-- The email gate mirrors the owner exemption in the PROD-246 SELECT policy
-- (and OWNER_EMAILS in src/config/features.ts): it controls catalog
-- visibility only, not a privilege boundary. The function touches nothing but
-- released_at on public programs.
CREATE OR REPLACE FUNCTION public.set_program_released(
  p_program_id uuid,
  p_released boolean
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  UPDATE public.programs
  SET released_at = CASE WHEN p_released THEN now() END
  WHERE id = p_program_id
    AND is_public
    AND (SELECT auth.jwt() ->> 'email') = 'daniel_bowers@icloud.com';
$$;

REVOKE EXECUTE ON FUNCTION public.set_program_released(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_program_released(uuid, boolean) TO authenticated;
