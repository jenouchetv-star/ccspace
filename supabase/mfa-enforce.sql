-- Turn on server-side enforcement of admin two-factor authentication.
--
-- DO NOT RUN THIS without the owner's go-ahead, and only after:
--   1. supabase/mfa-hardening.sql has been applied (on the LIVE project run
--      that file, not the whole migration.sql),
--   2. the changed Edge Functions and the upload Worker are deployed,
--   3. recovery ("Reset 2FA") has been proven on a disposable admin, and
--   4. every real admin has signed in to the new build and set up an
--      authenticator app.
--
-- What it does: sets the enforcement date. From that moment the database
-- requires every admin session to have passed the second factor (aal2) and
-- to still exist; a password-only session is no longer an admin anywhere.
-- The default below is a 3-day enrollment window: enforcement starts on its
-- own 3 days after you run this, so nobody is locked out mid-enrollment.
--
-- Two safety rules are built into the statement itself:
--   * It REFUSES (changes nothing) while any active admin has no verified
--     authenticator. An admin with only a password could otherwise enroll
--     THEIR OWN authenticator on that account after enforcement begins, which
--     would get a thief straight in. The second query lists who is missing;
--     fix that and run this again.
--   * It never moves the date LATER. Running it again after enforcement has
--     started (for example "just to be sure") leaves it on. To restart the
--     window, run supabase/mfa-rollback.sql first.
--
-- It contains no function definitions on purpose: the rule itself lives in
-- migration.sql / mfa-hardening.sql, so re-running either can never switch
-- enforcement off. To undo this, run supabase/mfa-rollback.sql.

update admin_mfa_settings
   set enforce_after = least(coalesce(enforce_after, now() + interval '3 days'), now() + interval '3 days'),
       updated_at = now()
 where id
   and not exists (
         select 1 from profiles p
          where p.status = 'active'
            and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
       );

-- Active admins who still have NO verified authenticator. This must be empty
-- for the update above to have taken effect:
select p.email as admin_without_authenticator
  from profiles p
 where p.status = 'active'
   and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified');

-- Check it took (enforce_after should now hold a date):
select enforce_after, updated_at from admin_mfa_settings;

-- To enforce immediately instead of after the window (only if every admin has
-- already enrolled), run this instead of the update above (same two rules):
--
--   update admin_mfa_settings
--      set enforce_after = least(coalesce(enforce_after, now()), now()), updated_at = now()
--    where id
--      and not exists (
--            select 1 from profiles p
--             where p.status = 'active'
--               and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
--          );
