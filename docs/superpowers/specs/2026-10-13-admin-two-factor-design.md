# Two-factor authentication for admins (authenticator app, free)

> Revision 3. Revision 1 used an authenticator app (TOTP). Revision 2 switched to SMS, but
> Supabase's phone MFA needs a paid add-on (about $75/month) plus a texting provider, and the
> owner needs a free option. This revision returns to the authenticator app, which costs
> nothing, and keeps what was learned in revision 2: lost-device recovery, a "change
> authenticator" option, hardened error handling, and the sign-up safety check.

> Revision 4 (owner-approved scope for local implementation and testing; **not** production
> deployment). Adds: server-side invitation hardening; a stronger MFA-reset procedure (identity
> check, session invalidation, password invalidation, audit trail, notification); enforcement
> that survives re-running `migration.sql`; defined enrollment windows; recovery deployed and
> tested **before** enforcement; and approved real-account integration tests. Implementation is
> native, followed by an independent whole-branch review. Nothing is deployed, no factor is
> created on the owner's account, the enforcement SQL is not run, and nothing is committed
> without the owner's explicit approval.

## Context

Admins sign in with an email and password through Supabase Auth
(`sb.auth.signInWithPassword`, `index.html:20523`). Whether that session may do anything is
decided in two places, and both only look at `profiles.status = 'active'`:

- **Database / storage RLS.** `is_active_admin()` (`supabase/migration.sql:131`) backs every
  admin write policy, the admin-only tables, and the `uploads` storage bucket.
- **Server code that checks the profile row itself, not through `is_active_admin()`:**
  `supabase/functions/admin-invite`, `send-newsletter`, `get-site-analytics`,
  `generate-sitemap` (each calls `auth.getUser()` then reads `profiles.status` with the
  service-role client), and the Cloudflare Worker `workers/media-upload/index.js:56-66`.

So today a stolen or guessed password is enough to publish content, send newsletters to the
whole list, upload files, and invite more admins. The idle-lock PIN is not a second factor
(it only re-proves presence to a session that is still signed in) and stays as it is.

The owner chose **mandatory 2FA for every admin** and requires it to be **free**.

## Goal and success criteria

A password alone must no longer get anyone into the admin portal or past any admin-gated
server check, at no ongoing cost.

- After the password step, an admin must enter a 6-digit code from an authenticator app
  before the portal renders or any admin data loads.
- An admin with no authenticator yet is made to set one up at sign-in. New admins do it as
  part of accepting their invite.
- The verified session (`aal2`) is enforced **server-side** (RLS, storage, Edge Functions,
  upload Worker), not just in the browser.
- Losing the phone (and so the authenticator) has a recovery path that doesn't need
  hand-editing the database.
- Rolling this out cannot lock every admin out. Nothing is deployed and enforcement is not
  switched on until the owner approves.

Non-goals: SMS, WhatsApp or emailed codes, "remember this device", a self-service "turn off
2FA" button, and showing 2FA status per admin on the Admins screen.

## Cost: $0

Supabase's documentation says TOTP (App Authenticator) MFA is free to use and enabled by
default on projects. Nothing in this design needs a paid plan, an add-on, or a texting
provider. Authenticator apps (Google Authenticator, Microsoft Authenticator, Authy, 1Password,
Bitwarden) are free; each admin installs one.

Two caveats, both checked by the owner in the dashboard before rollout:

- One community config file suggests MFA is a Pro feature. Supabase's own pages only say TOTP
  is free and enabled by default, and only the *phone* add-on carries a price, but plan gating
  was not confirmed from here (the Supabase connection failed this session). The rollout
  checklist includes a one-minute check: Authentication, Multi-Factor Authentication shows
  TOTP enrollment and verification enabled. If the dashboard shows otherwise, stop and tell us.
- Supabase's **phone** MFA, which this revision does not use, is what costs money: the
  Advanced MFA Phone add-on is about $75/month (first project, not covered by the Spend Cap)
  plus the texting provider's per-message fees.

## What replaces SMS's concerns

- **SIM-swap risk** (a real weakness of SMS) does not apply: codes are generated on the
  device and never travel over the phone network.
- **Resend limits and delivery failures** do not exist: nothing is sent. The limits that
  remain are Supabase's: MFA challenge and verify are limited to 15 requests per minute per IP
  (fixed), so the UI also stops a stuck screen from hammering the endpoint.
- **Lost phone or new phone:** see "Recovery". Supabase issues no recovery codes, and its docs
  suggest registering a backup factor; "Change authenticator" below lets an admin add the new
  device before removing the old.

## Approach

Use **Supabase's built-in TOTP MFA** (`sb.auth.mfa.enroll({ factorType: "totp" })`,
`mfa.challengeAndVerify({ factorId, code })`, `mfa.getAuthenticatorAssuranceLevel()`,
`mfa.listFactors()`). A session's JWT carries `aal`: `aal1` after the password, `aal2` after a
verified code. Everything keys off that one claim. Rejected: a hand-rolled TOTP check in an
Edge Function (a second auth system to secure) and emailed codes (only proves inbox access).

## Design

### 1. Sign-in flow (browser)

`AuthState` gains `aal` (`"aal1" | "aal2" | null`), `hasFactor` (a verified TOTP factor
exists) and `totpFactor` (`{ id }` of it, for the code screen). `refreshAuthState()` fills them
from `sb.auth.mfa.getAuthenticatorAssuranceLevel()` and `sb.auth.mfa.listFactors()` (the
`totp` list, which Supabase limits to verified factors).

`isActiveAdmin()` becomes `profile.status === "active" && AuthState.aal === "aal2"`. Every
existing gate reads it (the admin route, realtime sync, quick-update panel, idle lock, profile
menu), so an `aal1` session renders none of the portal and loads none of its data. An unknown
level (the lookup failed) is treated as not verified.

After `signInWithPassword` succeeds, `handleSubmit("admin-signin")` calls
`refreshAuthState()` and branches on `mfaStep()`:

| Session state | Screen |
|---|---|
| no verified authenticator | **Set up**: QR code, the secret as typed text, a field for a first code |
| verified authenticator, `aal1` | **Enter code**: one 6-digit field |
| `aal2` | continue exactly as today |

Set-up removes any unverified factor left by an abandoned attempt, calls `mfa.enroll`, shows
the QR (an SVG data URL, allowed by the site's `img-src 'self' data: https:` policy) and
verifies the first code with `mfa.challengeAndVerify`, which upgrades the session to `aal2`.
A failed enrollment shows an error with a "Try again" button and never retries by itself, so a
network outage can't loop. The accept-invite and password-reset flows route to the same
screens afterwards.

### 2. Error handling

`classifyMfaError` (keyed on supabase-js's `error.code`) maps what Supabase says no with:

| Supabase code | Shown |
|---|---|
| `mfa_verification_failed` | "That code didn't work. Check the 6 digits in your authenticator app and try again." |
| `mfa_challenge_expired` | "That code timed out. Enter the current code from your app." |
| `over_request_rate_limit`, any 429 | "Too many tries. Wait a minute, then try again." |
| `mfa_totp_enroll_not_enabled`, `mfa_totp_verify_not_enabled` | "Authenticator-app verification isn't switched on for this site yet. Tell the site owner." |
| `mfa_ip_address_mismatch` | "Your connection changed during setup. Start over." |
| `too_many_enrolled_mfa_factors` | "This account has too many authenticators set up. Ask another admin to reset your two-step verification." |
| anything else | "Something went wrong. Try again in a moment." |

### 3. Server-side enforcement

All of the following require the session's `aal` claim to be `aal2`:

- **`is_active_admin()`** covers every admin RLS policy and the `uploads` storage policy.
  **Enforcement is data, not code**: a single-row table `admin_mfa_settings (enforce_after
  timestamptz)` holds the switch (`null` = off). The function is defined in `migration.sql`
  itself: active profile AND the token's `session_id` still exists in `auth.sessions` (always,
  so sign-out, "sign out others" and a 2FA reset kill already-issued tokens immediately, before
  enforcement too) AND, once `enforce_after` has passed, `aal = 'aal2'`. A token with no
  `session_id` claim is only accepted before enforcement. Because the function lives in
  `migration.sql` and reads a persistent switch that `migration.sql` only ever creates with
  `if not exists` / `on conflict do nothing`, **re-running the migration cannot turn enforcement
  off** (static tests guard the text, and a test runs the real SQL in an in-memory Postgres).
  The live project applies these objects with the standalone `supabase/mfa-hardening.sql`
  (a drift test keeps it identical), because re-running the whole `migration.sql` live would
  overwrite the working email-trigger settings with placeholders.
- **`admin-invite`, `send-newsletter`, `get-site-analytics`, `generate-sitemap`**: replace the
  direct `profiles.status` read with `callerClient.rpc("is_active_admin")`.
- **`workers/media-upload`**: replace the `profiles?select=status` call with a POST to
  `/rest/v1/rpc/is_active_admin` using the caller's token; anything but a literal `true` is a
  403.
- `send-scheduled-newsletters` (cron, service role) and the public `submit-ticket`,
  `report-client-error`, `notify` functions are unaffected.

### 4. Rollout order (nothing happens until the owner approves each step)

Recovery is deployed and proven **before** enforcement, never after.

1. **Owner approves** this spec, the plan and the local build.
2. **Throwaway test project** (a second free Supabase project, see section 8): apply the
   updated `migration.sql`, deploy the functions, and run the integration tests there. They
   switch enforcement on and off, so they must never run against the live project.
3. Owner checks the live dashboard (TOTP enabled; "Allow new users to sign up" off).
4. **Live project, enforcement still off:** run `supabase/mfa-hardening.sql` (NOT the whole
   `migration.sql`; it adds the switch, the hardened invitation functions and the reset audit
   table, and makes signed-out or revoked tokens stop working at once; nothing else changes
   until step 7), deploy the changed Edge Functions (including `admin-reset-mfa`), then publish
   the site. (The `workers/media-upload` Worker is not deployed and not needed: the site
   uploads to Supabase Storage, whose policy already uses `is_active_admin()`.) Admins are
   prompted to set up an authenticator at sign-in.
5. **Prove recovery on the live project before enforcing:** the owner (or a second admin)
   exercises "Reset 2FA" against a disposable test admin invited for the purpose, confirms the
   reset email arrives, that the old password and sessions are dead, and that the test admin
   can re-enroll. Then delete the test admin.
6. Every real admin enrolls inside the **enrollment window** (below).
7. Owner runs **`supabase/mfa-enforce.sql`**, which sets `enforce_after` (default: now + 3 days,
   so enforcement starts automatically when the window ends). **It refuses (changes nothing)
   while any active admin has no verified authenticator** and lists who is missing, because
   anyone holding only that admin's password could otherwise enroll their own authenticator
   after enforcement begins; and it **never moves the date later**, so running it twice can't
   switch enforcement off. Rollback is `supabase/mfa-rollback.sql` (one statement). Neither
   file defines any function, so neither can be undone by a migration re-run.

### 4a. Enrollment windows (defined, short)

- **Rollout window: 3 days.** From the moment the owner runs `mfa-enforce.sql` to the moment
  the database starts requiring `aal2`. The browser already requires it from deploy, so admins
  enroll at their next sign-in; the window only protects against a lockout. Changeable by
  editing one interval in that file.
- **Invitation window: 7 days.** An invited profile can only activate itself within 7 days of
  its invitation (section 8). After that, an admin removes them from the Admins screen and
  invites them again (a plain re-invite is refused for someone who already confirmed).
- **Post-reset window:** the recovery email's link lifetime (Supabase "Email OTP expiration",
  default 1 hour; the rollout checklist asks the owner to confirm it). After a reset the old
  password is dead, so the only way back in is that emailed link, then a fresh enrollment.

### 5. Recovery if an admin loses their phone (and so their authenticator)

- **Still signed in somewhere (an `aal2` session):** "Change authenticator" in the profile
  modal enrolls and verifies the new device first, and only then removes the old one, so there
  is never a gap with no working factor.
- **Another admin resets you.** A "Reset 2FA" button per admin on the Admins screen (not on
  your own row) calls the `admin-reset-mfa` Edge Function. **Why it is strict:** a reset
  removes the second factor, so anyone who then knows the target's password could enroll their
  own authenticator. The procedure therefore does not just delete the factor:
  1. *Identity check by the resetting admin.* The dialog requires choosing how they confirmed
     it really is the person (in person, video call, or a call to a number already known
     to them) and typing the target's email to confirm. The server rejects a missing or wrong
     value. This is an attestation recorded in the audit log, not something the code can verify.
  2. *Caller rules.* An active admin **whose own token has passed the second factor (`aal2`),
     always, even before enforcement is switched on**; never the target themselves; and the
     target must be an `active` admin.
  3. *Rate limits, atomically.* The database function `begin_mfa_reset()` checks the limits
     (at most 2 resets per target and 5 per resetting admin in 24 hours) and records the
     attempt in one step, serialised with advisory locks, so parallel requests can't all slip
     under the limit. A reset counts once it completed, or while in flight (10 minutes); a
     reset that failed part-way is marked `failed` and doesn't count, so it can be retried.
  4. *Password invalidation first.* The target's password is replaced with a random one before
     anything else changes, so a stolen password stops working immediately and cannot be used
     to log in between steps.
  5. *Session invalidation.* All of the target's sessions are deleted
     (`revoke_user_sessions`, service-role only). Because `is_active_admin()` checks the
     token's session still exists, their already-issued tokens stop working at once.
  6. *Then* every factor of the target is removed.
  7. *Emails.* The attempt is marked `completed`, then the standard recovery email is sent so the
     real person (who controls the mailbox) can set a new password and then enroll a new
     authenticator, and a separate notice tells them who reset them and when. Both are
     best-effort and reported back; a failure to send does not undo the reset.
  If a step after the first fails, the error says exactly what was already done ("Partly done:
  their password was reset ... Press Reset 2FA again to finish") rather than implying nothing
  happened.
- **Only one admin, or every admin lost their device:** `supabase/reset-admin-mfa.mjs <email>`
  with the service-role key from an environment variable (dry run unless `--yes`). It performs
  the same steps 3 to 6 in the same order (logging the actor as `service_role_script`), minus
  the interactive identity check, which is the owner's own responsibility there.
- **Changing authenticator** also signs the account out of its other sessions
  (`signOut({ scope: "others" })`), so an attacker's session does not survive the change.
- Tip for admins: most authenticator apps (1Password, Bitwarden, Authy, Microsoft
  Authenticator) back up or sync codes, which makes a lost phone a non-event. Google
  Authenticator can sync to the Google account too.

### 6. Admin UI

- Profile modal: a "Two-step verification: On" row and "Change authenticator". There is no
  "turn off" control.
- Admins screen: the "Reset 2FA" action from section 5.
- Code inputs use `autocomplete="one-time-code"` and `inputmode="numeric"`.

### 7. Testing

- Vitest unit tests for `assets/lib/mfa.js` (screen choice, code validation, error
  classification), the Worker's admin gate, a TOTP generator (RFC 6238 test vectors) used by
  the integration tests, and **static guards on the SQL**: re-running `migration.sql` can
  never clear `enforce_after` (no `drop table`, `truncate`, `delete` or `update` of the
  switch; the only insert is `on conflict do nothing`), the hardened functions in
  `migration.sql` and `supabase/mfa-hardening.sql` are identical, and the enforce/rollback
  files redefine no function.
- A mocked-client pass in the browser pane drives the screens, including enrollment failure
  (no retry loop), a stale unverified factor, the change-authenticator ordering and the
  reset dialog's identity check.
- No factor is created on a real account by any automated step in this build.

### 7a. Approved real-account integration tests (`test/integration/`)

Written now, **run only with the owner's explicit approval, and only against a throwaway
Supabase project**, never the live one, because they switch enforcement on and off. They
create their own two disposable admin users through the admin API (so no factor is ever
created on the owner's account), generate TOTP codes themselves, and delete everything at the
end. They are skipped unless `MFA_IT=1`, so `npx vitest run` stays green and offline. They
cover: password-only denial under enforcement; verified (`aal2`) access; authenticator
replacement (the new factor works, the old one is gone, other sessions are signed out);
reset behaviour (wrong confirmation email, self-reset and the rate limit are refused; after a
reset the target's refresh token and old password stop working and their factors are gone;
the reset is logged); and rollback (clearing `enforce_after` restores password-only access).
The test refuses to run if `SUPABASE_URL` is the live project.

## 8. Invitation hardening (server-side, in `migration.sql`)

- `handle_new_user()` creates a profile **only when the new auth user carries `invited_at`**
  (which only the invite flow sets). Any other way an auth user appears (a self-service
  sign-up, if that setting were ever switched on) gets no profile at all.
- `accept_invite()` only activates a profile whose auth user has `invited_at` set and within
  the last **7 days**. After that the admin must be re-invited.
- `admin-invite` already requires `is_active_admin()` (so, under enforcement, an `aal2` admin).
- Bootstrapping a first admin by hand is still possible: use the dashboard's "Invite user",
  or insert the `profiles` row with SQL. (Existing admins already have profiles and are
  untouched.)
- This removes the dependency on "Allow new users to sign up" being off; the rollout still
  asks the owner to confirm it, as defence in depth.

## Files touched

- `index.html`: `AuthState`, `refreshAuthState`, `isActiveAdmin`, the set-up and code screens,
  error handling, sign-in/invite/profile wiring, change-authenticator flow, Admins-screen
  reset action.
- `assets/lib/mfa.js` (new) and `test/mfa.test.js` (new).
- `supabase/migration.sql` (the settings table, the MFA-aware `is_active_admin()`, hardened
  `handle_new_user()` / `accept_invite()`, `mfa_reset_log`, `revoke_user_sessions()`),
  `supabase/mfa-hardening.sql` (new, the same blocks standalone, with a drift test),
  `supabase/mfa-enforce.sql` and `supabase/mfa-rollback.sql` (new, data-only).
- `supabase/functions/admin-reset-mfa/index.ts` (new), `supabase/deploy-admin-reset-mfa.ps1`
  (new), `supabase/reset-admin-mfa.mjs` (new).
- `test/integration/*` (new, skipped by default), `test/helpers/totp.js` (new), SQL guard tests.
- `supabase/functions/{admin-invite,send-newsletter,get-site-analytics,generate-sitemap}/index.ts`,
  `workers/media-upload/index.js`, `test/mediaUploadAuth.test.js` (new).
- `sw.js` cache version; `README.md` rollout and recovery.
