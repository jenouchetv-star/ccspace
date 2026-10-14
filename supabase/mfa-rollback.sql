-- Roll back admin two-factor enforcement.
--
-- Run this if an admin is locked out or enforcement needs to be paused. It
-- clears the enforcement date, so the database goes back to accepting
-- password-only admin sessions, exactly as before enforcement. Nothing is
-- deleted: enrolled authenticators stay enrolled, and the portal still asks
-- for the code at sign-in. Re-run supabase/mfa-enforce.sql to switch it back on.
--
-- Like mfa-enforce.sql it defines no functions, and it is a single statement.

update admin_mfa_settings
   set enforce_after = null,
       updated_at = now()
 where id;

-- Check it took (enforce_after should now be empty):
select enforce_after, updated_at from admin_mfa_settings;
