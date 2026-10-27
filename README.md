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

## Newsletter portal (members-only archive)

A blog-style archive at `/newsletter` (and `/newsletter/<address>` for each entry) that only verified mailing-list subscribers can read. Signed-in admins go straight in from **Admin, Operations, Newsletter portal** (manage entries) or **Open the portal**.

**How access works.** Nothing exclusive is ever sent to a browser until the `portal` Edge Function has checked a verified session. The blurred screen behind the "Join our mailing list" box is drawn from empty placeholder shapes, so there is nothing to read by removing it. The box cannot be closed (Escape does nothing, the page behind it is made inert and Tab stays inside), and has a "Back to the public website" link. A visitor gets in one of three ways:

- **A newsletter's private key.** Each email carries `/newsletter/<entry>?k=<key>`, a signed key made for that one subscriber (valid 60 days). The page swaps it for a session and removes it from the address bar. Opening it on any device works: it is the key, not the inbox, that proves access.
- **An emailed sign-in link.** Someone on the list enters their email and is sent a one-time link (30 minutes, single use).
- **Joining.** Someone not on the list ticks a consent box, is added as `pending` (newsletters are only sent to `published`), and becomes a subscriber when they use the confirmation link.

A verified session lasts 30 days on that device. It is checked against the subscriber list on every request, so unsubscribing ends access at once.

**Sharing** always uses the plain `/newsletter/<address>` page, never a private key; anyone who follows it goes through the gate.

**Entries** have a title, cover image, description, date, category and one of five layouts (article, embedded video, game launch, ebook launch, photo gallery). Publish and Unpublish are buttons in the list. A newsletter's button can be pointed at an entry in the newsletter composer ("Or link the button to a members-only entry"); every newsletter also gets a "Newsletter archive" link in its footer.

**One thing to know.** Asking "is this address on the list?" necessarily tells the visitor whether it is (existing subscribers get a sign-in link, others are invited to join). Requests are limited to 5 per address and 20 per visitor per hour. Files linked for download are ordinary storage files, so anyone who is given the exact file address can open it; the page only shows it to members.

**Go live, in this order** (nothing here is run for you):

1. Run `supabase/newsletter-portal.sql` in the SQL Editor (safe to repeat; it changes no existing table).
2. `npx supabase secrets set PORTAL_LINK_SECRET=<48+ random characters>` (see `.env.example`).
3. `.\supabase\deploy-portal.ps1` deploys `portal` and the two newsletter senders.
4. Publish the site. Add entries in the admin, preview them (the eye icon), then Publish.

Tests (`npx vitest run test/portal*.test.js`) run the real `portal` function against an in-memory database and a stubbed email service, and the SQL against an in-memory Postgres. They use made-up `example.test` addresses only; nothing contacts a real subscriber.

## Copilot (admin assistant)

A **Copilot** tab sits on the right edge of every admin page. It is a chat panel that knows what is on the site and which admin screen you are on, and it runs on the **Ollama on your own computer** (nothing you write or paste leaves it; the page only talks to `localhost:11434`). It can:

- **Add a YouTube video**: paste one or more links. It reads the title and thumbnail from YouTube and drafts the episode text (description, what a child discovers, theme, cast).
- **Add to the Newsletter Archive**: describe it, paste a YouTube link, or name a game, book or episode already on the site. It writes the archive entry and the email that goes with it (using the real title and cover of what you named) and saves a **draft** entry; publishing it in the editor then prepares the email for you to review.
- **Add a game**: paste the game's HTML code. It checks it (size, files that won't be there, saving to the browser, phone sizing), writes the listing and rules, and adds it as a draft.
- **Write a newsletter** or **a story**: describe it in a sentence. Newsletters become an email draft that opens for review; stories become a draft with simple text pages, ready for pictures in the story builder.
- **Revise what is already there.** Say "make the Doodle Dash summary friendlier" (or shorten, simplify, proofread...) and it shows the current text beside a rewrite you can edit, with an "Update the live page" button (or "Save the change" for a draft). An edit that would leave a page unable to be published is refused. It only rewrites descriptive text, never titles or addresses.
- **Revise text you give it.** Paste any copy with an instruction ("shorten this", "make it warmer") and get a rewrite with a Copy button.
- **Write missing picture descriptions (alt text).** It finds every picture with no description, looks at each one with a vision model if you have one (for example `qwen2.5vl`), and proposes descriptions you can edit and tick off. Without a vision model it writes them from the page's title and text and says so.
- **Suggest tags** for activities that have none, reusing the tags already on the site.
- **Show what needs attention**: the same publishing checks the editor runs, across the whole site (no model needed). Each record has **Help me fix** (and the list has **Help me fix these**, five at a time), or just type "address the issues for <page>". It drafts the missing steps, headlines, summaries and picture descriptions for you to edit and tick off, then says what is left. Anything that is a decision (a video not marked Live, a link to something deleted, an age range) is handed back to you rather than guessed.
- **Answer questions** about the site's content.

The panel is a true side panel: drag its left edge to change the width (or focus the handle and use the arrow keys; double-click or Enter resets it). The width is remembered.

Every result is a proposal card you can edit. Nothing is saved until you press its button, everything is saved as a **draft**, and sending or publishing is always a separate step you take.

**Games added from pasted code** keep their code in a small `game_files` table (not in `games`, which every visitor loads), fetched only when someone presses Play, and run in a sealed box that cannot read the site's storage or sign-ins. Run `supabase/game-files.sql` in the SQL Editor once before using "Add a game" (safe to repeat; a test checks it matches `migration.sql`). Until then the Copilot says so and adds nothing.

**Guided setup for admins without Ollama.** Each admin who wants the AI help needs Ollama on their own computer. When it is not set up, the Admin Assistant panel shows a step-by-step setup in place of the chat (and the Writing helper in every editor shows a **Set up the AI helper** button): install Ollama (with steps for Windows, Mac or Linux), allow this site (one copy-and-paste command with the site's address filled in), then download the writing model with a progress bar. It checks every few seconds, so each step ticks off by itself and the chat appears when it is ready. "Skip for now" keeps the parts that need no AI. The manual version: install Ollama, run `ollama pull qwen2.5:7b`, and (on the live site) set `OLLAMA_ORIGINS` to the site's address.

Original setup note: install Ollama, run `ollama pull qwen2.5:7b`, and (on the live site) set `OLLAMA_ORIGINS` to the site's address and restart Ollama. Tests: `npx vitest run test/copilot.test.js test/writer.test.js`.

**Writing helper in every editor.** Every content editor (pages, games, episodes, stories, activities, articles, characters...) has a **Writing helper** card: **Draft it for me** fills the empty text boxes from what is already there (and what you tell it), **Revise with my words** and **Improve the box I'm in** rewrite one box, and the **Help me fix** button in the red problem box drafts what is missing, describes pictures, and offers one-click proposals where there is one obvious answer (a decision, like marking an episode Live, starts unticked). It only fills in the form on screen: nothing is saved until you press Save. It also suggests the next few words as you type (Tab adds them, Esc skips). It never writes in web addresses, links or picture-description boxes by guessing, and legal pages show a reminder to read every change carefully.
