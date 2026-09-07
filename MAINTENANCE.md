# Recurring maintenance

A short, repeatable checklist for keeping the site healthy after launch - not a
one-time launch task. Run this monthly at minimum, and immediately after any
notable content push or dependency update.

## Monthly review

1. **Run `/test` and confirm the baseline.** Unlock the admin portal, open
   `/test`, click "Run again." Accepted baseline: 83 passed / 0 skipped / 1
   non-blocking failure (the documented `spacetime-sandbox-simulator.html`
   skin exception - re-verify this is still the *only* failure; a new one is
   a regression). Anything else needs to be understood before you move on.
2. **Re-check Supabase RLS.** Open the Supabase dashboard for the project
   named in `supabase/migration.sql` and confirm every table still shows
   `rowsecurity = true` with the `anon full access` policy. This project's
   RLS is intentionally permissive for now (see `migration.sql`'s own risk
   comment) - the review isn't "is it locked down," it's "has anything
   drifted, and is now the time to tighten it before real user data exists."
3. **Regenerate the sitemap.** Run `node supabase/generate-sitemap.mjs`
   after any content addition, removal, or unpublish, and before any
   production deploy either way - it pulls live Supabase content, so it
   silently goes stale otherwise.
4. **Take a fresh backup.** Run `node supabase/backup.mjs`. Safety net
   before any bulk edit, admin "Reset demo content," or deploy.
5. **Walk the issues queue** (`/admin/issues`). Every open issue should have
   either a concrete plan (linked to a Launch Readiness task, or a note on
   the issue itself) or an explicit "deprioritized, here's why." An issue
   with neither is the thing this review exists to catch.
6. **Check the open ticket/issue counts on `/admin`.** If either has been
   climbing without anyone acknowledging them, that's the actual signal this
   review is meant to surface - the mechanism doesn't help if nobody reads it.

## Content publishing cadence

Recommended starting cadence, based on today's library (26 activities, 15
games, 18 episodes, 9 stories) - adjust once real traffic data exists:

- **Activities/printables:** one new activity roughly every 1-2 weeks. Low
  production cost per item, and the `draft -> review -> approved -> scheduled
  -> published` workflow already in the admin portal supports drafting ahead
  of time and scheduling the actual publish date.
- **Episodes:** roughly monthly. The Launch Readiness task catalog itself
  notes "each two-minute story takes weeks" - don't commit to a faster
  cadence than the animation pipeline can sustain.
- **Stories:** tied to episodes - a story adaptation of an episode is cheaper
  to produce than a wholly new one, so pairing them keeps cadence realistic.
- **Ownership:** whoever holds the admin code today is the de facto owner of
  the publishing calendar until the team grows past one person. Revisit this
  the moment a second regular content contributor exists - the current
  `users` records (`Site Owner`, `Content Editor`) already model that split
  in `db.get().users` for whenever role separation becomes real rather than
  simulated.

## Post-launch retrospective

Schedule a short retro **within 7 days of the first real production
traffic** (not the code deploy date - the traffic date, since that's when
real problems actually surface). Keep it to three questions, using the
Launch Readiness categories as prompts if it stalls:

1. What broke that the checklist didn't catch?
2. What surprised the team (visitor behavior, a support ticket theme, a
   performance issue)?
3. What's the single highest-priority fix for the next two weeks?

Capture the answers as new Launch Readiness tasks or `issues` records so the
retro produces tracked follow-up, not just a conversation.
