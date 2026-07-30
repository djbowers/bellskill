-- Program release gate (PROD-246): released_at column + RLS gating.
--
-- "Seeded" and "released" have been the same thing: is_public = true puts a
-- shared program in every user's catalog the moment its migration lands,
-- whether or not anyone has run it in the app. Plan A only got its fidelity
-- fix (PROD-245) because live use caught the deviation; the other seeds have
-- no recorded QA status.
--
-- released_at IS NULL means the program is seeded but not yet released: the
-- SELECT policy below hides it from everyone except its owner and the app
-- owner account, who runs the manual test pass and then releases it by
-- setting released_at. Copy-on-enroll clones are owner-owned rows
-- (owner_id = auth.uid()), so existing enrollments — including clones minted
-- from unreleased programs during testing — remain visible to their owners
-- regardless of release state.
--
-- The owner exemption matches on the JWT email mirroring OWNER_EMAILS in
-- src/config/features.ts. Like that list, it reveals catalog content only —
-- not a privilege boundary. Anonymous requests carry no email claim, so the
-- predicate is simply false for them.
--
-- Backfill: only A+A Protocol "Plan A" is released at gate-creation time —
-- it is the one shared program proven through live use. The rest are
-- deliberately left unreleased and will be released one by one after a
-- manual test run each (PROD-246). Local and staging environments release
-- everything via supabase/seed.sql (which never reaches prod) so e2e specs
-- and deploy previews keep seeing the full catalog.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

UPDATE programs SET released_at = now()
  WHERE slug = 'aa-protocol-plan-a' AND is_public;

DROP POLICY "Users can view public or own programs" ON programs;
CREATE POLICY "Users can view released public or own programs" ON programs
  FOR SELECT USING (
    (SELECT auth.uid()) = owner_id
    OR (is_public AND released_at IS NOT NULL)
    OR (is_public AND (SELECT auth.jwt() ->> 'email') = 'daniel_bowers@icloud.com')
  );
