# Chike's Creative Space

This is the source for [chikescreativespace.com](https://www.chikescreativespace.com) — a kids' activities site (hands-on projects, games, stories, and videos) built as a single-file, no-build vanilla-JS app with a Supabase backend — maintained here for whoever is developing or operating the site.

## Where things live

- `index.html` — the entire public site and the admin portal (routing, views, and styles all in one file, no build step).
- `supabase/` — database schema/migrations and the Edge Functions the app calls (`supabase/functions/*`).
- `games/`, `books/` — standalone HTML games and story-reader pages, loaded in a sandboxed iframe from the main app.
- `MAINTENANCE.md` — the recurring post-launch checklist (run this monthly).
- `.env.example` — every environment variable/secret this project reads, which Edge Function or script needs it, and where to actually set it (nothing here is loaded from a committed file).

## Running it locally

```
python .claude/serve.py 4321
```

then open `http://localhost:4321`. There's no build step — edits to `index.html` show up on refresh. The site itself needs no local secrets to browse; see `.env.example` before deploying or working on an Edge Function.

## Admin two-factor authentication (authenticator app)

Every admin signs in with their password **and** a 6-digit code from a free authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden), using Supabase's built-in TOTP MFA. There is no ongoing cost: Supabase's docs say TOTP MFA is free to use and enabled by default. (Phone/SMS MFA is the paid one and is not used here.)

**How it is enforced.** `is_active_admin()` is the one rule behind every admin database policy, the admin Edge Functions, the Supabase Storage `uploads` policy (which is how admin uploads are protected) and the optional `workers/media-upload` Worker. It requires that the token's session still exists (always, so signing out, "sign out other sessions" and a 2FA reset kill already-issued tokens immediately), and, once enforcement is on, that the session has passed the second factor (`aal2`). Enforcement is a single row (`admin_mfa_settings.enforce_after`), created off. `migration.sql` and `mfa-hardening.sql` only ever create that row if it is missing and never write to it, so re-running them cannot turn enforcement off (tests guard this, including by running the SQL against an in-memory Postgres).

**Do not re-run the whole `migration.sql` on the live project.** It also redefines `notify_edge_function()` and reschedules the newsletter cron job with unfilled placeholders, which would silently break ticket/subscriber emails and scheduled newsletters. On the live project run **`supabase/mfa-hardening.sql`** instead: it contains exactly the 2FA objects, is safe to run repeatedly, and a test fails if it ever differs from `migration.sql`.

**Invitations are hardened** in the same SQL: only an auth user that was actually invited gets a profile, and an invitation can only be accepted within 7 days (then remove the person from the Admins screen and invite them again). To bootstrap a first admin by hand, use the dashboard's "Invite user", or insert the `profiles` row with SQL.

**Enrollment windows:** rollout **3 days** (from running `mfa-enforce.sql` until the database starts requiring the code; edit the interval in that file to change it); invitations **7 days**; after a reset, the recovery email's link lifetime (Supabase "Email OTP expiration", default 1 hour; confirm it in Authentication, Email).

**Enforcement refuses to start while an admin is unenrolled.** `supabase/mfa-enforce.sql` changes nothing if any active admin has no verified authenticator, and lists who is missing. (Otherwise someone holding only that admin's password could enroll their own authenticator and get in.) It also never moves the date later, so running it twice is safe.

**Resetting an admin's 2FA** (a lost phone) is strict, because a reset removes the second factor. In the Admins screen, "Reset 2FA" is only available to an admin who has used their own authenticator this session, and requires saying how you confirmed it is really them (in person, video call, or a call to a number you already had) and typing their email. The server then, in this order: records the attempt and checks the limits atomically (at most 2 resets per admin and 5 per resetting admin in 24 hours), replaces their password with a random one, signs them out everywhere, removes their authenticator, then emails them a link to set a new password plus a notice of who reset them and when. If a step fails part-way the message says what was already done and pressing Reset again finishes it (a failed attempt doesn't count toward the limit). With only one admin, run `node supabase/reset-admin-mfa.mjs you@example.com` (a dry run) and then add `--yes`, with `SUPABASE_SERVICE_ROLE_KEY` set in your terminal. An admin who still has a session can use Profile, "Change authenticator", which also signs out their other sessions.

**Rollout, in this order:**

1. **Throwaway project first.** Create a second free Supabase project, apply the whole `supabase/migration.sql` there (placeholders don't matter on a throwaway), deploy `admin-invite` and `admin-reset-mfa` to it with `.\supabase\deploy-admin-invite.ps1 -ProjectRef <throwaway-ref>` and `.\supabase\deploy-admin-reset-mfa.ps1 -ProjectRef <throwaway-ref>` (without `-ProjectRef` they deploy to the LIVE project), then run the real-account integration tests there. They switch enforcement on and off and create and delete their own disposable users, never your account, and they refuse to run against the live project: set `MFA_IT=1`, `MFA_IT_SUPABASE_URL`, `MFA_IT_ANON_KEY`, `MFA_IT_SERVICE_ROLE_KEY` (the throwaway project's own values), then `npx vitest run test/integration/mfa.integration.test.js`.
2. On the live project's dashboard: Authentication, Multi-Factor Authentication, confirm TOTP enrollment and verification are enabled; Sign In / Providers, confirm "Allow new users to sign up" is off (defence in depth now that invitations are hardened too).
3. **Live project, enforcement still off:** run `supabase/mfa-hardening.sql` in the SQL Editor (not the whole migration), deploy the changed Edge Functions (`admin-invite`, `send-newsletter`, `get-site-analytics`, and the new `.\supabase\deploy-admin-reset-mfa.ps1`), then publish the site. (`generate-sitemap` also changed, but it is not deployed on the live project, so there is nothing to redeploy unless you start using it. The `workers/media-upload` Worker is **not needed**: the site uploads straight to Supabase Storage, so the Worker is unused. If you ever do wire it in, set its real `PUBLIC_BASE_URL` in `wrangler.toml` first, or a deploy will overwrite the live value with the placeholder, then `npx wrangler deploy` from that folder.) Admins are prompted to set up an authenticator at their next sign-in; the database still accepts password-only sessions, but a token whose session has been signed out or revoked is refused straight away.
4. **Prove recovery before enforcing:** invite a disposable test admin, enroll them, then reset them from the Admins screen. Confirm the recovery and notice emails arrive, their old password and session stop working, and they can set a new password and enroll again. Delete the test admin.
5. Every real admin sets up their authenticator.
6. Run `supabase/mfa-enforce.sql`. Enforcement starts 3 days later. To undo at any time, run `supabase/mfa-rollback.sql` (one statement).

Supabase issues no recovery codes, so use an authenticator app that backs up or syncs its codes.
