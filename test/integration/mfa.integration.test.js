// Real-account integration tests for admin two-factor authentication.
//
// SKIPPED BY DEFAULT. These talk to a real Supabase project, switch
// enforcement on and off, and create and delete users, so:
//   * run them only with the owner's explicit approval,
//   * run them ONLY against a throwaway project (a second free Supabase
//     project), never the live one - guard.js refuses the live project,
//   * apply supabase/migration.sql to that project first, and deploy the
//     admin-invite and admin-reset-mfa Edge Functions to it.
//
// They create their own two disposable admins (so no factor is ever created
// on a real person's account), generate TOTP codes themselves from the
// secrets Supabase returns, and delete everything at the end. They use raw
// REST calls, so they add no dependency.
//
// How to run (PowerShell), with the throwaway project's own values:
//   $env:MFA_IT = "1"
//   $env:MFA_IT_SUPABASE_URL = "https://<throwaway-ref>.supabase.co"
//   $env:MFA_IT_ANON_KEY = "..."
//   $env:MFA_IT_SERVICE_ROLE_KEY = "..."
//   npx vitest run test/integration/mfa.integration.test.js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { integrationConfig } from "./guard.js";
import { totp } from "../helpers/totp.js";

const cfg = integrationConfig();

// A refused (live-project) configuration must fail loudly, not skip quietly.
if (cfg.refused) {
  describe("2FA integration guard", () => {
    it("refuses to run against the live project", () => { throw new Error(cfg.reason); });
  });
}

const T = 180000;
const runId = randomBytes(4).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { method = "GET", token, key, body, headers = {} } = {}) {
  const apikey = key || cfg.anonKey;
  const res = await fetch(cfg.url + path, {
    method,
    headers: { apikey, Authorization: "Bearer " + (token || apikey), "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}
const svc = (path, o = {}) => call(path, { ...o, key: cfg.serviceKey, token: cfg.serviceKey });
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

async function createUser(label, { admin = true } = {}) {
  const email = `mfa-it-${runId}-${label}@example.test`;
  const password = "Aa1!" + randomBytes(12).toString("base64url");
  const r = await svc("/auth/v1/admin/users", { method: "POST", body: { email, password, email_confirm: true } });
  if (r.status >= 300) throw new Error("createUser(" + label + ") failed: " + r.status + " " + JSON.stringify(r.json));
  const user = { id: r.json.id, email, password, label, factorId: null, secret: null };
  if (admin) {
    const p = await svc("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { id: user.id, email, name: "MFA IT " + label, status: "active" },
    });
    if (p.status >= 300) throw new Error("profile for " + label + " failed: " + p.status + " " + JSON.stringify(p.json));
  }
  return user;
}

const signIn = (u) => call("/auth/v1/token?grant_type=password", { method: "POST", body: { email: u.email, password: u.password } });

async function enrollFactor(token) {
  const r = await call("/auth/v1/factors", { method: "POST", token, body: { factor_type: "totp", friendly_name: "it-" + randomBytes(3).toString("hex") } });
  expect(r.status).toBeLessThan(300);
  return { factorId: r.json.id, secret: r.json.totp.secret };
}

/** Challenge + verify with a code generated from the secret. Retries, because
    the 30-second code can roll over between generating it and Supabase
    checking it. Returns the new (aal2) session. */
const lastStepUsed = new Map();   // secret -> the 30-second step whose code was last submitted
const STEP_MS = 30000;

async function verifyFactor(token, factorId, secret) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Never submit the same code twice: some servers refuse a replayed code, and a
    // second verification of the same factor inside one step would flake. Wait for the next step.
    const step = Math.floor(Date.now() / STEP_MS);
    if (lastStepUsed.get(secret) === step) await sleep((step + 1) * STEP_MS - Date.now() + 500);
    lastStepUsed.set(secret, Math.floor(Date.now() / STEP_MS));

    const ch = await call(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", token, body: {} });
    expect(ch.status).toBeLessThan(300);
    const v = await call(`/auth/v1/factors/${factorId}/verify`, { method: "POST", token, body: { challenge_id: ch.json.id, code: totp(secret) } });
    if (v.status < 300) return v.json;
    await sleep(2000);   // a failure may just be the code rolling over mid-request; the next loop waits for a fresh step
  }
  throw new Error("could not verify factor " + factorId);
}

async function signInVerified(u) {
  const s = await signIn(u);
  expect(s.status).toBe(200);
  return verifyFactor(s.json.access_token, u.factorId, u.secret);
}

async function setEnforce(on) {
  const r = await svc("/rest/v1/admin_mfa_settings?id=eq.true", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    // A fixed date far in the past, so the local clock can't disagree with the database's.
    body: { enforce_after: on ? "2000-01-01T00:00:00Z" : null },
  });
  if (r.status >= 300) throw new Error("setEnforce failed: " + r.status + " " + JSON.stringify(r.json));
}

// Three independent probes of "is this token an admin?", at three layers:
const isAdmin = async (token) => (await call("/rest/v1/rpc/is_active_admin", { method: "POST", token, body: {} })).json === true;
const inviteProbe = async (token) => (await call("/functions/v1/admin-invite", { method: "POST", token, body: { email: "not-an-email" } })).status;   // Edge Function: 403 refused, 400 = got past the admin check
const rpcProbe = async (token) => (await call("/rest/v1/rpc/set_user_status", { method: "POST", token, body: { target_id: randomUUID(), new_status: "active" } })).status;  // SQL function behind RLS: >=400 refused

describe.skipIf(!cfg.enabled)("admin two-factor against a real (throwaway) Supabase project", () => {
  let A, B;
  const toDelete = [];

  beforeAll(async () => {
    await setEnforce(false);
    A = await createUser("a");
    toDelete.push(A.id);
    B = await createUser("b");
    toDelete.push(B.id);
    // Enrol both while enforcement is off, so a password is enough to do it.
    for (const u of [A, B]) {
      const s = await signIn(u);
      expect(s.status).toBe(200);
      const f = await enrollFactor(s.json.access_token);
      await verifyFactor(s.json.access_token, f.factorId, f.secret);
      u.factorId = f.factorId;
      u.secret = f.secret;
    }
  }, T);

  afterAll(async () => {
    try { await setEnforce(false); } catch { /* best effort */ }
    const ids = toDelete.filter(Boolean);
    for (const id of ids) {
      try { await svc("/auth/v1/admin/users/" + id, { method: "DELETE" }); } catch { /* best effort */ }
    }
    if (ids.length) {
      const list = ids.join(",");
      try { await svc(`/rest/v1/mfa_reset_log?target_id=in.(${list})`, { method: "DELETE" }); } catch { /* best effort */ }
      try { await svc(`/rest/v1/mfa_reset_log?actor_id=in.(${list})`, { method: "DELETE" }); } catch { /* best effort */ }
    }
  }, T);

  it("password-only denial: under enforcement an aal1 session is refused at every layer", async () => {
    await setEnforce(true);
    const s = await signIn(A);
    const token = s.json.access_token;
    expect(claims(token).aal).toBe("aal1");
    expect(await isAdmin(token)).toBe(false);
    expect(await inviteProbe(token)).toBe(403);
    expect(await rpcProbe(token)).toBeGreaterThanOrEqual(400);
  }, T);

  it("verified access: after the code, the same admin is allowed at every layer", async () => {
    await setEnforce(true);
    const v = await signInVerified(A);
    expect(claims(v.access_token).aal).toBe("aal2");
    expect(await isAdmin(v.access_token)).toBe(true);
    expect(await inviteProbe(v.access_token)).toBe(400);
    expect(await rpcProbe(v.access_token)).toBeLessThan(300);
  }, T);

  it("rollback: clearing the switch restores password-only access at once, and setting it denies the same token again", async () => {
    await setEnforce(false);
    const s = await signIn(B);
    expect(claims(s.json.access_token).aal).toBe("aal1");
    expect(await isAdmin(s.json.access_token)).toBe(true);
    await setEnforce(true);
    expect(await isAdmin(s.json.access_token)).toBe(false);
  }, T);

  it("sessions: signing out kills the token immediately, even before enforcement", async () => {
    await setEnforce(false);
    const s = await signIn(B);
    expect(await isAdmin(s.json.access_token)).toBe(true);
    const out = await call("/auth/v1/logout", { method: "POST", token: s.json.access_token });
    expect(out.status).toBeLessThan(300);
    expect(await isAdmin(s.json.access_token)).toBe(false);
  }, T);

  it("authenticator replacement: the new factor works, the old is gone, other sessions are signed out", async () => {
    await setEnforce(true);
    const v1 = await signInVerified(A);
    const other = await signInVerified(A);                 // a second, aal2 login that the change must sign out
    expect(await isAdmin(other.access_token)).toBe(true);  // proves it was alive before the change

    const next = await enrollFactor(v1.access_token);
    const v2 = await verifyFactor(v1.access_token, next.factorId, next.secret);
    const del = await call(`/auth/v1/factors/${A.factorId}`, { method: "DELETE", token: v2.access_token });
    expect(del.status).toBeLessThan(300);
    const out = await call("/auth/v1/logout?scope=others", { method: "POST", token: v2.access_token });
    expect(out.status).toBeLessThan(300);

    const refreshed = await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: other.refresh_token } });
    expect(refreshed.status).toBeGreaterThanOrEqual(400);
    expect(await isAdmin(other.access_token)).toBe(false);  // and its unexpired access token is dead too

    const again = await signIn(A);
    const oldTry = await call(`/auth/v1/factors/${A.factorId}/challenge`, { method: "POST", token: again.json.access_token, body: {} });
    expect(oldTry.status).toBeGreaterThanOrEqual(400);          // the old factor no longer exists
    const v3 = await verifyFactor(again.json.access_token, next.factorId, next.secret);
    expect(await isAdmin(v3.access_token)).toBe(true);
    A.factorId = next.factorId;
    A.secret = next.secret;
  }, T);

  it("reset behaviour: refusals, then a real reset kills sessions, password and factors, is logged and is rate-limited", async () => {
    await setEnforce(true);
    const bV = await signInVerified(B);
    const bToken = bV.access_token;
    const aV = await signInVerified(A);                      // an aal2 session of A that the reset must kill
    const reset = (body, token = bToken) => call("/functions/v1/admin-reset-mfa", { method: "POST", token, body });
    const good = { targetId: A.id, confirmEmail: A.email, verifiedHow: "video_call" };

    // resetting needs the caller's own second factor even BEFORE enforcement is switched on
    await setEnforce(false);
    const early = await signIn(B);                                // password-only
    expect((await reset(good, early.json.access_token)).status).toBe(403);
    await setEnforce(true);

    // refused, and none of these is logged
    expect((await reset({ ...good, confirmEmail: "wrong@example.test" })).status).toBe(400);
    expect((await reset({ targetId: A.id, confirmEmail: A.email })).status).toBe(400);                         // no attestation
    expect((await reset({ ...good, verifiedHow: "trust_me" })).status).toBe(400);
    expect((await reset({ targetId: B.id, confirmEmail: B.email, verifiedHow: "video_call" })).status).toBe(400); // yourself
    const passwordOnly = await signIn(A);
    expect((await reset(good, passwordOnly.json.access_token)).status).toBe(403);                              // aal1 caller
    const none = await svc(`/rest/v1/mfa_reset_log?target_id=eq.${A.id}&select=id`);
    expect(none.json).toEqual([]);

    // the real reset
    const ok = await reset(good);
    expect(ok.status).toBe(200);
    expect(ok.json.ok).toBe(true);
    expect(ok.json.sessionsRevoked).toBeGreaterThanOrEqual(1);

    expect(await isAdmin(aV.access_token)).toBe(false);          // the still-unexpired token is dead immediately
    const rt = await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: aV.refresh_token } });
    expect(rt.status).toBeGreaterThanOrEqual(400);
    expect((await signIn(A)).status).toBeGreaterThanOrEqual(400); // the old password is dead
    const facs = await svc(`/auth/v1/admin/users/${A.id}/factors`);
    expect(facs.json ?? []).toEqual([]);                         // every factor removed (Supabase may answer null)

    const log = await svc(`/rest/v1/mfa_reset_log?target_id=eq.${A.id}&select=actor_id,verified_how,outcome`);
    expect(log.json).toEqual([{ actor_id: B.id, verified_how: "video_call", outcome: "completed" }]);

    // rate limit: 2 per target per day
    expect((await reset(good)).status).toBe(200);
    const third = await reset(good);
    expect(third.status).toBe(429);
    expect(third.json.error).toMatch(/twice/);
  }, T);

  it("invitation hardening: an auth user that was not invited gets no profile and can't activate; an invited one does", async () => {
    await setEnforce(false);
    const stranger = await createUser("stranger", { admin: false });
    toDelete.push(stranger.id);
    const prof = await svc(`/rest/v1/profiles?id=eq.${stranger.id}&select=id`);
    expect(prof.json).toEqual([]);                                       // no profile was created for them

    const s = await signIn(stranger);
    expect(s.status).toBe(200);
    const accept = await call("/rest/v1/rpc/accept_invite", { method: "POST", token: s.json.access_token, body: {} });
    expect(accept.status).toBeLessThan(300);                             // a quiet no-op for someone with no profile
    expect((await svc(`/rest/v1/profiles?id=eq.${stranger.id}&select=id`)).json).toEqual([]);
    expect(await isAdmin(s.json.access_token)).toBe(false);

    // a genuinely invited user does get an 'invited' profile
    const inviteEmail = `mfa-it-${runId}-invitee@example.test`;
    // generate_link(type "invite") creates the invited user WITHOUT sending an email, so
    // this works on a project with no mail provider and isn't hit by email rate limits.
    const inv = await svc("/auth/v1/admin/generate_link", { method: "POST", body: { type: "invite", email: inviteEmail } });
    expect(inv.status, JSON.stringify(inv.json)).toBeLessThan(300);
    const inviteeId = inv.json.id || (inv.json.user && inv.json.user.id);
    expect(inviteeId).toBeTruthy();
    toDelete.push(inviteeId);
    const invited = await svc(`/rest/v1/profiles?id=eq.${inviteeId}&select=status`);
    expect(invited.json).toEqual([{ status: "invited" }]);   // the trigger fired, whichever way GoTrue stamps invited_at
  }, T);
});
