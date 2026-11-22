# Parents' Sign-ins in the Admin Subscribers Table: Design

Date: 2026-11-21. Owner: "can I see when a parent logged in? or how long ago they were logged in. And if they are
currently logged in now?" Picked: all three.

## What the admin sees (Subscribers table, new columns)

- **Last signed in:** when the member last entered their 6-digit code ("3 days ago"; "Never" if they never signed in).
- **Signed in:** "Signed in" while at least one of their portal sessions is unexpired (sign-ins last 30 days unless they
  sign out), else "Signed out". Means signed in on some device, not looking right now.
- **Last seen:** the last time a signed-in member had a page of the site open ("5 minutes ago"), with a green
  "Online now" dot when seen in the last 5 minutes.

## How (Claude's calls, owner may overrule)

- `portal_sessions` already has `created_at` (the sign-in) and `expires_at`. Add `last_seen_at timestamptz`.
- Recording "last seen": the site sends a small "seen" call for a saved portal session when a page loads and every
  2 minutes while the tab is visible. The server sets that session's `last_seen_at` (at most once a minute per session).
  It goes through the `kid-progress` Edge Function (a new `seen` action, same session check), not the `portal`
  function, because the portal function's working copy holds other unreleased edits that must not ship with this.
- The admin reads the three values through one new RPC, `subscriber_sign_ins()`, security definer, `is_active_admin()`
  only: per subscriber id, `last_sign_in` = newest `created_at`, `signed_in` = any `expires_at > now()`,
  `last_seen` = newest `last_seen_at`. No session tokens or hashes leave the database.
- Nothing is shown to members; nothing new is emailed. Only a time is stored, no pages or activity.

## Privacy note for the owner

The Privacy Policy may need a sentence that the site records when a signed-in member last visited. The policy is a
database page the owner approves; Claude drafts the sentence on request, does not change it.

## Order of work

1. SQL (column + RPC) with tests; 2. `seen` action with tests; 3. the site's heartbeat and the admin columns with
tests; 4. owner's OK to apply SQL, deploy the function and push.
