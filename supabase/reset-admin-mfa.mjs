// Rescue helper for the one case the in-app "Reset 2FA" button can't cover:
// the only admin (or every admin) lost their authenticator, so nobody is
// left who can sign in to press that button.
//
// It performs the same steps as the admin-reset-mfa Edge Function, minus the
// interactive identity check (confirming it really is that person is YOUR
// responsibility here), in the same order:
//   - records the reset in the audit log (verified_how "service_role_script"),
//     which also applies the 2-per-admin-per-day limit,
//   - replaces their password with a random one, so a stolen password is dead,
//   - deletes every session of the admin, so any existing login stops working,
//   - removes every authenticator factor.
// If it stops part-way it says exactly what was already done; running it
// again finishes the job.
// They then use "Forgot your password?" on the admin sign-in page to set a new
// password (proving they control the mailbox), and set up a new authenticator.
//
// It needs the service_role key, which bypasses every protection - it is read
// from an environment variable you set in your own terminal, for this session
// only, and is never stored. It does NOTHING unless you pass --yes; without it
// it only prints what it would do.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
//   node supabase/reset-admin-mfa.mjs you@example.com          (dry run)
//   node supabase/reset-admin-mfa.mjs you@example.com --yes    (do it)

import { randomBytes } from "node:crypto";

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const email = (args.find((a) => !a.startsWith("--")) || "").trim().toLowerCase();

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Run:");
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY = "..."');
  process.exit(1);
}
if (!email) {
  console.error("Usage: node supabase/reset-admin-mfa.mjs you@example.com [--yes]");
  process.exit(1);
}

const headers = { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY, "Content-Type": "application/json" };

async function must(res, what) {
  if (!res.ok) {
    console.error(what + " failed: " + res.status + " " + (await res.text()));
    process.exit(1);
  }
  return res;
}

const profRes = await must(
  await fetch(SUPABASE_URL + "/rest/v1/profiles?select=id,status&email=eq." + encodeURIComponent(email), { headers }),
  "Looking up the admin"
);
const profiles = await profRes.json();
if (!Array.isArray(profiles) || !profiles[0]) {
  console.error("No admin profile found for " + email);
  process.exit(1);
}
const { id: userId, status } = profiles[0];
if (status !== "active") {
  console.error(email + " is not an active admin (status: " + status + "). Nothing to reset.");
  process.exit(1);
}

const facRes = await must(await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId + "/factors", { headers }), "Listing factors");
const factorsRaw = await facRes.json();
// Supabase may answer null (not []) for a user with no factors.
const factors = factorsRaw === null ? [] : factorsRaw;
if (!Array.isArray(factors)) {
  console.error("Unexpected factor list: " + JSON.stringify(factorsRaw));
  process.exit(1);
}

if (!confirmed) {
  console.log("DRY RUN - nothing was changed. For " + email + " this would:");
  console.log("  1. record the reset in the audit log (verified_how: service_role_script)");
  console.log("  2. replace their password with a random one");
  console.log("  3. delete all of their sessions");
  console.log("  4. remove " + factors.length + " authenticator factor(s)");
  console.log("Run again with --yes to do it.");
  process.exit(0);
}

// Record the attempt (and apply the limit) in one atomic database call.
const beginRes = await must(
  await fetch(SUPABASE_URL + "/rest/v1/rpc/begin_mfa_reset", {
    method: "POST",
    headers,
    body: JSON.stringify({ target: userId, actor: null, how: "service_role_script" }),
  }),
  "Recording the reset"
);
const begun = (await beginRes.json())[0];
if (!begun || begun.code !== "ok") {
  console.error("Reset limit reached for " + email + " (" + (begun && begun.code) + "). Try again tomorrow.");
  process.exit(1);
}
const logId = begun.log_id;

async function markOutcome(outcome) {
  await fetch(SUPABASE_URL + "/rest/v1/mfa_reset_log?id=eq." + logId, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ outcome }),
  });
}
async function step(res, what, alreadyDone) {
  if (res.ok) return res;
  await markOutcome("failed");
  console.error(what + " failed: " + res.status + " " + (await res.text()));
  if (alreadyDone) console.error("Partly done: " + alreadyDone + ". Run the same command again to finish.");
  process.exit(1);
}

const password = randomBytes(32).toString("base64") + "Aa1!";
await step(
  await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId, { method: "PUT", headers, body: JSON.stringify({ password }) }),
  "Replacing the password",
  null
);

const revRes = await step(
  await fetch(SUPABASE_URL + "/rest/v1/rpc/revoke_user_sessions", { method: "POST", headers, body: JSON.stringify({ target: userId }) }),
  "Ending sessions",
  "their password was replaced"
);
const sessions = await revRes.json();

// List the factors AGAIN now that the sessions are gone, so one enrolled by a live
// session during the steps above can't survive (same order as the Edge Function).
const freshRes = await step(
  await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId + "/factors", { headers }),
  "Listing factors",
  "their password was replaced and their sessions ended"
);
const freshRaw = await freshRes.json();
const freshFactors = freshRaw === null ? [] : freshRaw;
if (!Array.isArray(freshFactors)) {
  await markOutcome("failed");
  console.error("Unexpected factor list: " + JSON.stringify(freshRaw) + "\nPartly done: their password was replaced and their sessions ended. Run the same command again to finish.");
  process.exit(1);
}

let removed = 0;
for (const f of freshFactors) {
  await step(
    await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId + "/factors/" + f.id, { method: "DELETE", headers }),
    "Removing factor " + f.id,
    "their password was replaced and their sessions ended"
  );
  removed += 1;
}
await markOutcome("completed");

console.log("Done for " + email + ": replaced the password, ended " + (typeof sessions === "number" ? sessions : 0) + " session(s), removed " + removed + " factor(s).");
console.log("Next: they open the admin sign-in page, choose \"Forgot your password?\", set a new password from the emailed link, then set up a new authenticator.");
