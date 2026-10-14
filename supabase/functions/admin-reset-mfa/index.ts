// Chike's Creative Space - admin-reset-mfa Edge Function
//
// Lost-phone recovery: an active admin whose own session has passed the
// second factor can reset another admin's two-step verification.
//
// A reset removes the second factor, so anyone who then knows the target's
// password could enroll their OWN authenticator and walk in. That is why
// this does much more than delete a factor. In order:
//   1. authenticate the caller, require is_active_admin() AND a verified
//      second factor (aal2) in their own token - always, even before
//      enforcement is switched on, because this is the most dangerous thing
//      an admin can do to another admin;
//   2. validate the request (validate.ts): the caller's attestation of how
//      they confirmed the person's identity, the target's email typed back,
//      and never resetting yourself;
//   3. check the target is an active admin and the typed email matches;
//   4. begin_mfa_reset() in the database: checks the limits (2 per target,
//      5 per resetting admin, per 24 hours) and records the attempt in ONE
//      atomic step, so parallel requests can't all slip under the limit;
//   5. replace the target's password with a random one FIRST, so a stolen
//      password stops working before anything else changes;
//   6. delete all of the target's sessions (revoke_user_sessions) - because
//      is_active_admin() checks the token's session still exists, their
//      already-issued tokens stop working at once;
//   7. remove every factor;
//   8. mark the attempt completed, then email the target a normal
//      password-reset link (so the real person, who controls the mailbox,
//      sets a new password and then enrolls a new authenticator) and a
//      notice saying who reset them and when. Both emails are best-effort
//      and reported back; failing to send does not undo the reset.
// If a step fails part-way the attempt is marked 'failed' (so it can be
// retried without using up the limit) and the error says exactly what was
// already done, because the target may already be signed out and password-less.
//
// Removing factors, killing sessions and changing passwords all need the
// service_role key, which must never reach the browser - same reason
// admin-invite exists. Deploy: .\supabase\deploy-admin-reset-mfa.ps1
// Optional secrets for the notice email: RESEND_API_KEY, RESEND_FROM (the
// same ones send-newsletter uses). Without them the reset still works.
//
// Called from index.html as:
//   sb.functions.invoke("admin-reset-mfa", { body: { targetId, confirmEmail, verifiedHow } })

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  callerAal,
  emailsMatch,
  limitMessage,
  parseResetRequest,
  randomPassword,
  resetNotificationHtml,
} from "./validate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const SITE_URL = "https://www.chikescreativespace.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM = Deno.env.get("RESEND_FROM");

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: who is calling, verified against Supabase Auth, and an active
  // admin by the one rule used everywhere (see migration.sql) whose own token
  // has passed the second factor.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const callerId = callerData.user.id;

  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }
  if (callerAal(authHeader) !== "aal2") {
    return json({ error: "Resetting someone's 2FA needs your own two-step verification. Sign in with your code first." }, 403);
  }

  // Step 2: the request itself.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const parsed = parseResetRequest(rawBody, callerId);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
  const { targetId, confirmEmail, verifiedHow } = parsed;

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Step 3: the target must exist, be an active admin, and be the account
  // whose email the caller typed.
  const { data: target } = await adminClient
    .from("profiles")
    .select("id, email, name, status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return json({ error: "That admin doesn't exist." }, 404);
  if (target.status !== "active") {
    return json({ error: "Only active admins can have their 2FA reset." }, 400);
  }
  if (!emailsMatch(confirmEmail, target.email)) {
    return json({ error: "That email doesn't match this admin. Type it exactly to confirm." }, 400);
  }

  // Step 4: limits + the audit record, atomically.
  const { data: begun, error: beginErr } = await adminClient.rpc("begin_mfa_reset", {
    target: targetId,
    actor: callerId,
    how: verifiedHow,
  });
  const first = Array.isArray(begun) ? begun[0] : null;
  if (beginErr || !first) return json({ error: "Couldn't record the reset. Nothing was changed." }, 500);
  if (first.code !== "ok") return json({ error: limitMessage(first.code) }, 429);
  const logId: string = first.log_id;

  const markOutcome = async (outcome: "completed" | "failed") => {
    await adminClient.from("mfa_reset_log").update({ outcome }).eq("id", logId);
  };
  // After the first change, a failure leaves the target half-reset, so say so.
  const partial = async (done: string, problem: string) => {
    await markOutcome("failed");
    return json({ error: `Partly done: ${done}. But ${problem}. Press Reset 2FA again to finish.` }, 500);
  };

  const { data: actor } = await adminClient
    .from("profiles").select("name, email").eq("id", callerId).maybeSingle();

  // Step 5: a stolen password must stop working before anything else changes.
  const { error: pwErr } = await adminClient.auth.admin.updateUserById(targetId, { password: randomPassword() });
  if (pwErr) {
    await markOutcome("failed");
    return json({ error: "Couldn't reset the password, so nothing was changed: " + pwErr.message }, 500);
  }

  // Step 6: kill every session of the target.
  const { data: revoked, error: revErr } = await adminClient.rpc("revoke_user_sessions", { target: targetId });
  if (revErr) return partial("their password was reset", "their sessions couldn't be ended (" + revErr.message + ")");

  // Step 7: remove every factor.
  const { data: listData, error: listErr } = await adminClient.auth.admin.mfa.listFactors({ userId: targetId });
  if (listErr) return partial("their password was reset and they were signed out", "their authenticators couldn't be listed (" + listErr.message + ")");
  let removed = 0;
  for (const factor of listData?.factors ?? []) {
    const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetId });
    if (delErr) return partial("their password was reset and they were signed out", "an authenticator couldn't be removed (" + delErr.message + ")");
    removed += 1;
  }

  // Step 8: done. Tell the real person how to get back in, and that it happened.
  await markOutcome("completed");

  let recoverySent = false;
  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error: recErr } = await anonClient.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${SITE_URL}/#/admin/accept-invite`,
    });
    recoverySent = !recErr;
  } catch { /* reported below as recoverySent: false */ }

  let notified = false;
  if (RESEND_API_KEY && RESEND_FROM) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: target.email,
          subject: "Your admin two-step verification was reset",
          html: resetNotificationHtml({
            targetName: target.name,
            actorName: actor?.name || actor?.email || "",
            whenIso: new Date().toISOString(),
          }),
        }),
      });
      notified = res.ok;
    } catch { /* reported below as notified: false */ }
  }

  return json({ ok: true, removed, sessionsRevoked: typeof revoked === "number" ? revoked : 0, recoverySent, notified });
});
