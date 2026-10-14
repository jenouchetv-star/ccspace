# Admin Two-Factor Authentication (Authenticator App, Free) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: revision 4. The owner approved the direction for local implementation and testing (not production deployment) and chose native execution plus an independent whole-branch review. See "Revision 4 amendments" at the end of this file, which supersede conflicting parts of Tasks 4, 6, 7 and 8.** No task deploys anything, changes any Supabase setting, creates a factor on the owner's account, runs enforcement SQL, or commits without the owner's explicit approval. Those are the owner's steps (Task 8, Step 5).

**Goal:** Every admin must enter a 6-digit code from a free authenticator app after their password, and that verified session (`aal2`) is enforced server-side (RLS, storage, Edge Functions, upload Worker), not just in the browser. Cost: $0.

**Architecture:** Supabase's built-in TOTP MFA (`factorType: "totp"`). A session's JWT carries `aal` (`aal1` after the password, `aal2` after a verified code). The browser's `isActiveAdmin()` and the database's `is_active_admin()` both require `aal2`; the four admin Edge Functions and the upload Worker stop reading `profiles.status` themselves and call `is_active_admin()` instead. A separate SQL file turns database enforcement on only after every admin has enrolled.

**Tech Stack:** Vanilla JS single-file SPA (`index.html`), `@supabase/supabase-js@2.112.4` (browser, from unpkg), Supabase Edge Functions (Deno, `jsr:@supabase/supabase-js@2`), a Cloudflare Worker (`workers/media-upload`), Postgres RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-admin-two-factor-design.md`

## Global Constraints

- TOTP only, via `sb.auth.mfa.*` with `factorType: "totp"`. No SMS, no emailed codes, no custom TOTP implementation, nothing that needs a paid Supabase add-on or a third-party service.
- 2FA is **mandatory for every admin**. There is **no** self-service "turn off 2FA" control anywhere.
- Server-side enforcement is the requirement; the browser gate alone is not acceptable.
- `supabase/mfa-enforce.sql` is a **separate file**. Never add the `aal2` condition to `migration.sql`.
- Resetting 2FA: another active `aal2` admin via the `admin-reset-mfa` Edge Function (refuses `target === caller`), or `supabase/reset-admin-mfa.mjs` with the service-role key from an environment variable.
- Code input uses `autocomplete="one-time-code"` and `inputmode="numeric"`. Wrong-code copy: "That code didn't work. Check the 6 digits in your authenticator app and try again."
- Enrollment never retries by itself: a failure shows an error and a "Try again" button.
- `index.html` is precached by the service worker; bump `CACHE_VERSION` in `sw.js` once, in Task 8 (`ccs-v4` to `ccs-v5`). While testing locally, unregister the service worker and hard-reload so a stale `index.html` isn't served.
- Match the surrounding code: HTML built as strings, escaped with `E()`, icons with `ic()`, clicks through `data-act` in `ACTIONS`, forms through `if (act === "...")` branches in `handleSubmit`.
- Commit steps show the message to use. This repo's owner asks for commits explicitly, so run a commit step only when asked; otherwise leave the work staged and say so.
- Never create a real MFA factor on the owner's production admin account from automated steps. Browser checks monkey-patch `sb.auth.mfa` in the page.

## Review Focus

Most likely first. Each line has a test in the task named in brackets.

1. A code copied from an authenticator app with a space or dash ("123 456", "123-456") must be accepted. [Task 1]
2. A code with 5 or 7 digits, letters, empty/null input, or look-alike digits (Arabic-Indic "١٢٣٤٥٦", full-width "１２３４５６") must be rejected with the 6-digit message and never sent to Supabase. [Task 1, Task 3]
3. If Supabase can't report the assurance level, an active admin must be treated as **not** signed in. [Task 1, Task 2]
4. If enrollment keeps failing (network down), the set-up screen shows an error and a retry button and calls `enroll` once per attempt, never looping on re-render. [Task 3]
5. A reload mid-setup leaves an unverified factor behind; the next set-up removes it first so it can't block setup. [Task 3]
6. Double-tapping "Verify" sends one verification, not two. [Task 3]
7. The upload Worker answers 403 when `is_active_admin` fails, returns `false`, a non-boolean, or non-JSON. It never falls through to "allowed". [Task 5]
8. Changing authenticator must never leave an admin with no working factor: the new one is verified before the old is removed. [Task 4]

---

## File structure

| File | Responsibility |
|---|---|
| `assets/lib/mfa.js` (new) | Pure decisions: screen choice (`mfaStep`), code validation, error classification. No DOM, no network. |
| `test/mfa.test.js` (new) | Vitest tests for `mfa.js`. |
| `index.html` | `AuthState` gains `aal`/`hasFactor`/`totpFactor`; `isActiveAdmin()` requires `aal2`; set-up and code screens; change-authenticator modal; Admins-screen reset action. |
| `sw.js` | `CACHE_VERSION` bump (Task 8). |
| `workers/media-upload/index.js`, `test/mediaUploadAuth.test.js` (new) | Admin gate becomes an `is_active_admin` rpc call, with tests. |
| `supabase/functions/{admin-invite,send-newsletter,get-site-analytics,generate-sitemap}/index.ts` | Admin check becomes `callerClient.rpc("is_active_admin")`. |
| `supabase/mfa-enforce.sql` (new) | Redefines `is_active_admin()` with the `aal2` condition, plus the one-statement rollback. |
| `supabase/functions/admin-reset-mfa/index.ts`, `supabase/deploy-admin-reset-mfa.ps1`, `supabase/reset-admin-mfa.mjs` (new) | Lost-device recovery. |
| `README.md` | Rollout, free-cost check, recovery. |

---

### Task 1: The decision logic (`assets/lib/mfa.js`)

**Files:**
- Create: `assets/lib/mfa.js`
- Create: `test/mfa.test.js`

**Interfaces:**
- Produces (exposed as globals by Task 2):
  - `mfaStep({ authed, status, aal, hasFactor }) -> "signin" | "setup" | "verify" | "done"`
  - `validateTotpCode(raw) -> { ok, code, error }`
  - `classifyMfaError(error) -> { kind, message }` with `kind` one of `rate_limited | wrong_code | expired | not_enabled | restart | too_many | other`

- [ ] **Step 1: Write the failing tests**

Create `test/mfa.test.js`:

```js
// The deterministic decisions in the admin 2FA flow: which screen a
// signed-in person should see, whether a typed code is worth sending to
// Supabase, and what to tell the person when Supabase says no. The network
// calls (enroll / challengeAndVerify) need a real project, so they are
// deliberately not tested here - same split as test/acceptInvite.test.js.
import { describe, it, expect } from "vitest";
import { mfaStep, validateTotpCode, classifyMfaError } from "../assets/lib/mfa.js";

const base = { authed: true, status: "active", aal: "aal1", hasFactor: true };

describe("mfaStep", () => {
  it("shows the normal sign-in form when nobody is signed in", () => {
    expect(mfaStep({ ...base, authed: false })).toBe("signin");
  });
  it("leaves invited and revoked accounts to the existing handling", () => {
    expect(mfaStep({ ...base, status: "invited" })).toBe("signin");
    expect(mfaStep({ ...base, status: "revoked" })).toBe("signin");
  });
  it("asks for a code when an authenticator exists but only the password passed", () => {
    expect(mfaStep({ ...base, aal: "aal1", hasFactor: true })).toBe("verify");
  });
  it("makes an admin with no authenticator set one up", () => {
    expect(mfaStep({ ...base, aal: "aal1", hasFactor: false })).toBe("setup");
  });
  it("lets a fully verified admin through", () => {
    expect(mfaStep({ ...base, aal: "aal2" })).toBe("done");
  });
  it("fails closed when the assurance level is unknown", () => {
    expect(mfaStep({ ...base, aal: null, hasFactor: true })).toBe("verify");
    expect(mfaStep({ ...base, aal: undefined, hasFactor: false })).toBe("setup");
  });
  it("never reports 'done' for an aal2 session whose profile isn't active", () => {
    expect(mfaStep({ ...base, aal: "aal2", status: "revoked" })).toBe("signin");
  });
});

describe("validateTotpCode", () => {
  it("accepts six digits", () => {
    expect(validateTotpCode("123456")).toEqual({ ok: true, code: "123456", error: null });
  });
  it("accepts a code pasted with a space, a dash or surrounding whitespace", () => {
    expect(validateTotpCode("123 456").code).toBe("123456");
    expect(validateTotpCode("123-456").code).toBe("123456");
    expect(validateTotpCode("  123456\n").code).toBe("123456");
  });
  it("rejects the wrong length", () => {
    for (const bad of ["12345", "1234567", "", "   "]) {
      const r = validateTotpCode(bad);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("Enter the 6-digit code from your authenticator app.");
    }
  });
  it("rejects letters mixed into the code", () => {
    expect(validateTotpCode("12345a").ok).toBe(false);
  });
  it("rejects null and undefined without throwing", () => {
    expect(validateTotpCode(null).ok).toBe(false);
    expect(validateTotpCode(undefined).ok).toBe(false);
  });
  it("rejects non-ASCII digits instead of passing them to the server", () => {
    expect(validateTotpCode("١٢٣٤٥٦").ok).toBe(false);
    expect(validateTotpCode("１２３４５６").ok).toBe(false);
  });
});

describe("classifyMfaError", () => {
  it("maps a wrong code and a timed-out code", () => {
    const w = classifyMfaError({ code: "mfa_verification_failed" });
    expect(w).toEqual({ kind: "wrong_code", message: "That code didn’t work. Check the 6 digits in your authenticator app and try again." });
    expect(classifyMfaError({ code: "mfa_challenge_expired" }).kind).toBe("expired");
  });
  it("treats every rate-limit shape as rate_limited", () => {
    for (const e of [{ code: "over_request_rate_limit" }, { code: "over_sms_send_rate_limit" }, { status: 429 }]) {
      const c = classifyMfaError(e);
      expect(c.kind).toBe("rate_limited");
      expect(c.message).toBe("Too many tries. Wait a minute, then try again.");
    }
  });
  it("maps the not-switched-on, restart and too-many cases", () => {
    expect(classifyMfaError({ code: "mfa_totp_enroll_not_enabled" }).kind).toBe("not_enabled");
    expect(classifyMfaError({ code: "mfa_totp_verify_not_enabled" }).kind).toBe("not_enabled");
    expect(classifyMfaError({ code: "mfa_ip_address_mismatch" }).kind).toBe("restart");
    expect(classifyMfaError({ code: "too_many_enrolled_mfa_factors" }).kind).toBe("too_many");
  });
  it("falls back for anything else, including null", () => {
    for (const e of [{ code: "weird" }, {}, null, undefined]) {
      expect(classifyMfaError(e)).toEqual({ kind: "other", message: "Something went wrong. Try again in a moment." });
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/mfa.test.js`
Expected: FAIL (cannot resolve `../assets/lib/mfa.js`).

- [ ] **Step 3: Write the implementation**

Create `assets/lib/mfa.js`:

```js
// Chike's Creative Space - admin two-factor decisions (authenticator app)
//
// Pure functions, kept out of index.html so the exact code that runs in
// the browser is also what the tests import (same reason as
// acceptInvite.js and activityFinder.js). Everything that talks to
// Supabase (enroll / challengeAndVerify) stays in index.html.

/** Which sign-in screen a visitor should see right now. "done" is only
    ever returned for an active admin whose session has passed the second
    factor (aal2). An unknown assurance level (null / undefined, e.g. the
    lookup failed) is treated as NOT verified - the safe direction to be
    wrong in. */
export function mfaStep({ authed, status, aal, hasFactor }) {
  if (!authed) return "signin";
  if (status !== "active") return "signin";
  if (aal === "aal2") return "done";
  return hasFactor ? "verify" : "setup";
}

/** Authenticator apps show codes as "123 456", so strip spaces and dashes
    before checking. Only ASCII 0-9 counts (/\d/ without the u flag), so
    look-alike digits never reach the server. */
export function validateTotpCode(raw) {
  const code = String(raw == null ? "" : raw).replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, code: "", error: "Enter the 6-digit code from your authenticator app." };
  }
  return { ok: true, code, error: null };
}

/** One plain sentence for each thing Supabase can say no with. */
export function classifyMfaError(error) {
  const code = error && error.code ? String(error.code) : "";
  const status = error && error.status;
  if (code === "over_request_rate_limit" || code === "over_sms_send_rate_limit" || status === 429) {
    return { kind: "rate_limited", message: "Too many tries. Wait a minute, then try again." };
  }
  if (code === "mfa_verification_failed") {
    return { kind: "wrong_code", message: "That code didn’t work. Check the 6 digits in your authenticator app and try again." };
  }
  if (code === "mfa_challenge_expired") {
    return { kind: "expired", message: "That code timed out. Enter the current code from your app." };
  }
  if (code === "mfa_totp_enroll_not_enabled" || code === "mfa_totp_verify_not_enabled") {
    return { kind: "not_enabled", message: "Authenticator-app verification isn’t switched on for this site yet. Tell the site owner." };
  }
  if (code === "mfa_ip_address_mismatch") {
    return { kind: "restart", message: "Your connection changed during setup. Start over." };
  }
  if (code === "too_many_enrolled_mfa_factors") {
    return { kind: "too_many", message: "This account has too many authenticators set up. Ask another admin to reset your two-step verification." };
  }
  return { kind: "other", message: "Something went wrong. Try again in a moment." };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/mfa.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add assets/lib/mfa.js test/mfa.test.js
git commit -m "Add the admin 2FA decision logic and tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Make the browser gate require the verified session

**Files:**
- Modify: `index.html` (module import block ~3090; `AuthState`/`isActiveAdmin`/`refreshAuthState` ~3118-3138)

**Interfaces:**
- Consumes: Task 1's exports (exposed on `window`).
- Produces: `AuthState.aal` (`"aal1" | "aal2" | null`), `AuthState.hasFactor` (boolean), `AuthState.totpFactor` (`{ id } | null`), `refreshMfaState()`, `clearMfaState()`, and an `isActiveAdmin()` that is true only for an active profile at `aal2`.

- [ ] **Step 1: Expose the module on `window`**

In `index.html`, replace:

```js
  import * as AcceptInvite from "./assets/lib/acceptInvite.js";
  Object.assign(window, ActivityFinder, AcceptInvite);
```

with:

```js
  import * as AcceptInvite from "./assets/lib/acceptInvite.js";
  import * as Mfa from "./assets/lib/mfa.js";
  Object.assign(window, ActivityFinder, AcceptInvite, Mfa);
```

- [ ] **Step 2: Track the assurance level and require `aal2`**

Replace:

```js
let AuthState = { session: null, profile: null };
```

with:

```js
let AuthState = { session: null, profile: null, aal: null, hasFactor: false, totpFactor: null };
```

Replace:

```js
function isActiveAdmin(){ return !!(AuthState.profile && AuthState.profile.status === "active"); }
```

with:

```js
/* An admin is only "active" in the app once the session has passed the
   second factor (aal2). Every gate in the app reads this one function, so
   a password-only (aal1) session renders none of the portal and loads
   none of its data. The database's is_active_admin() enforces the same
   rule server-side (supabase/mfa-enforce.sql). */
function isActiveAdmin(){
  return !!(AuthState.profile && AuthState.profile.status === "active" && AuthState.aal === "aal2");
}
```

Replace the whole `refreshAuthState` function (from `async function refreshAuthState(){` to its closing `}`) with:

```js
async function refreshAuthState(){
  const { data: { session } } = await sb.auth.getSession();
  AuthState.session = session;
  if (!session){ AuthState.profile = null; clearMfaState(); return; }
  const { data: profile } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  AuthState.profile = profile || null;
  if (profile && profile.status === "revoked"){
    await sb.auth.signOut();
    AuthState.session = null;
    AuthState.profile = null;
    clearMfaState();
    return;
  }
  await refreshMfaState();
}

function clearMfaState(){
  AuthState.aal = null;
  AuthState.hasFactor = false;
  AuthState.totpFactor = null;
}

/** Reads the session's assurance level and the admin's verified
    authenticator. If either lookup fails the level stays null, which the
    rest of the app treats as "not verified" - never as signed in. */
async function refreshMfaState(){
  clearMfaState();
  try {
    const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    AuthState.aal = aalData ? aalData.currentLevel : null;
    const { data: fData } = await sb.auth.mfa.listFactors();
    const totps = (fData && fData.totp) || [];
    AuthState.hasFactor = totps.length > 0;
    AuthState.totpFactor = totps[0] ? { id: totps[0].id } : null;
  } catch (_e){ /* leave aal null: fail closed */ }
}
```

- [ ] **Step 3: Syntax-check the inline script**

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');const m=[...s.matchAll(/<script(?![^>]*type=\"module\")[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).sort((a,b)=>b.length-a.length)[0];require('fs').writeFileSync(process.env.TEMP+'/ccs-inline.js',m)" && node --check "$TEMP/ccs-inline.js" && echo OK
```
Expected: `OK`

- [ ] **Step 4: Verify the gate in the browser**

Start the dev server with `preview_start` (`{name: "creative-space"}`), open `http://localhost:4321/#/admin`, unregister the service worker and hard-reload, then run in the page (`javascript_tool`):

```js
const fake = { session: { user: { email: "a@b.c" } }, profile: { status: "active", id: "x" }, totpFactor: null };
const out = {};
AuthState = { ...fake, aal: "aal1", hasFactor: true };  out.aal1 = isActiveAdmin();
AuthState = { ...fake, aal: "aal2", hasFactor: true };  out.aal2 = isActiveAdmin();
AuthState = { ...fake, aal: null,   hasFactor: true };  out.unknown = isActiveAdmin();
AuthState = { session: null, profile: null, aal: null, hasFactor: false, totpFactor: null };
out.helpers = [typeof mfaStep, typeof validateTotpCode, typeof classifyMfaError].join("/");
out
```
Expected: `aal1: false, aal2: true, unknown: false, helpers: "function/function/function"`. `read_console_messages({onlyErrors:true})` is clean, and signed-out `#/admin` still shows the normal sign-in card.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Require the verified session (aal2) for the browser's admin gate

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The set-up and code screens, wired into sign-in, invite and profile

**Files:**
- Modify: `index.html`: new state and screens after `let ADMIN_FORGOT_SENT = "";` (~14883); `adminLoginView()` (~14899); `handleSubmit()` `admin-signin` (~20517) and `accept-invite-submit` (~20548) branches; `ACTIONS` after `admin-back-to-signin` (~19624); `open-profile` modal (~19656-19667)

**Interfaces:**
- Consumes: Task 1's `mfaStep`, `validateTotpCode`, `classifyMfaError`; Task 2's `AuthState`, `isActiveAdmin`, `refreshAuthState`.
- Produces: state `MFA_ERROR`, `MFA_ENROLL` (`{ factorId, qr, secret } | null`), `MFA_BUSY`; functions `removeUnverifiedTotpFactors()`, `startMfaEnroll()`, `adminMfaView(step)`; actions `mfa-sign-out`, `mfa-retry`; form branches `mfa-setup-submit`, `mfa-verify-submit`.

- [ ] **Step 1: Add the state, enrollment function and the two screens**

In `index.html`, directly after the line `let ADMIN_FORGOT_SENT = "";` add:

```js
/* Second-factor screens. MFA_ENROLL holds the in-progress authenticator
   enrollment ({ factorId, qr, secret }) between creating it and verifying
   the first code. MFA_BUSY stops a second tap, or a re-render, from
   starting a second request while one is in flight. */
let MFA_ERROR = "";
let MFA_ENROLL = null;
let MFA_BUSY = false;

/** Removes any unverified authenticator left behind by an abandoned or
    reloaded set-up, so a half-finished attempt can never block the next. */
async function removeUnverifiedTotpFactors(){
  const { data: fData } = await sb.auth.mfa.listFactors();
  const stale = ((fData && fData.all) || []).filter(f => f.factor_type === "totp" && f.status === "unverified");
  for (const f of stale) await sb.auth.mfa.unenroll({ factorId: f.id });
}

/** Creates a fresh authenticator enrollment for the signed-in admin. Runs
    once per call; a failure leaves MFA_ENROLL null with MFA_ERROR set, and
    the screen then offers a "Try again" button instead of retrying. */
async function startMfaEnroll(){
  if (MFA_BUSY) return;
  MFA_BUSY = true;
  try {
    await removeUnverifiedTotpFactors();
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + new Date().toISOString() });
    if (error) throw error;
    MFA_ENROLL = { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
    MFA_ERROR = "";
  } catch (err){
    MFA_ERROR = classifyMfaError(err).message;
  }
  MFA_BUSY = false;
  render();
}

function mfaErrorHint(){
  return MFA_ERROR ? '<span class="admin-hint" role="alert" style="color:var(--admin-bad);font-weight:600">' + E(MFA_ERROR) + '</span>' : "";
}

function mfaCodeField(){
  return '<div class="admin-field" style="margin-top:14px"><label for="mfa-code">6-digit code</label>'
    + '<input class="admin-input" id="mfa-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder=" " required>'
    + mfaErrorHint() + '</div>';
}

function adminMfaView(step){
  const email = E((AuthState.session && AuthState.session.user && AuthState.session.user.email) || "");
  const signOut = '<button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" style="margin-top:14px" data-act="mfa-sign-out">Sign out</button>';
  const eyebrow = '<span class="admin-eyebrow">Two-step verification</span>';

  if (step === "verify"){
    return adminShellFrame('<div class="admin-card">' + eyebrow
      + '<h1 class="admin-page-title" style="margin-top:6px;text-transform:none;font-size:1.4rem">Enter your code.</h1>'
      + '<p class="admin-meta">Signed in as ' + email + '. Open your authenticator app and type the 6-digit code for Chike’s Creative Space.</p>'
      + '<form data-act="mfa-verify-submit" style="margin-top:18px">' + mfaCodeField()
      + '<button class="admin-btn admin-btn--primary admin-btn--block" style="margin-top:16px" type="submit">' + ic("check") + ' Verify</button>'
      + '</form>' + signOut + '</div>');
  }

  /* step === "setup" */
  if (!MFA_ENROLL){
    if (MFA_ERROR){
      return adminShellFrame('<div class="admin-card">' + eyebrow
        + '<h1 class="admin-page-title" style="margin-top:6px;text-transform:none;font-size:1.4rem">Set up two-step verification.</h1>'
        + '<div class="admin-callout admin-callout--bad" style="margin-top:14px">' + ic("triangle-alert") + '<span>' + E(MFA_ERROR) + '</span></div>'
        + '<button type="button" class="admin-btn admin-btn--primary" style="margin-top:14px" data-act="mfa-retry">' + ic("rotate-ccw") + ' Try again</button>'
        + signOut + '</div>');
    }
    startMfaEnroll();
    return adminShellFrame('<div class="admin-card"><p class="admin-meta">Preparing two-step verification…</p></div>');
  }
  return adminShellFrame('<div class="admin-card">' + eyebrow
    + '<h1 class="admin-page-title" style="margin-top:6px;text-transform:none;font-size:1.4rem">Set up two-step verification.</h1>'
    + '<p class="admin-meta">Admin accounts need a second step. Scan this with a free authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password), then type the 6-digit code it shows.</p>'
    + '<div style="display:flex;justify-content:center;margin:16px 0"><img src="' + E(MFA_ENROLL.qr) + '" alt="QR code to add this account to your authenticator app" width="180" height="180" style="background:#fff;padding:8px;border-radius:8px"></div>'
    + '<p class="admin-meta" style="text-align:center">Can’t scan? Enter this key instead:<br><code style="font-size:.85rem;word-break:break-all">' + E(MFA_ENROLL.secret) + '</code></p>'
    + '<form data-act="mfa-setup-submit" style="margin-top:14px">' + mfaCodeField()
    + '<button class="admin-btn admin-btn--primary admin-btn--block" style="margin-top:16px" type="submit">' + ic("check") + ' Turn on and sign in</button>'
    + '</form>' + signOut + '</div>');
}
```

- [ ] **Step 2: Route `adminLoginView()` to those screens**

In `adminLoginView()`, directly after its opening line `function adminLoginView(){`, insert:

```js
  const mfa = mfaStep({
    authed: isAuthed(),
    status: AuthState.profile && AuthState.profile.status,
    aal: AuthState.aal,
    hasFactor: AuthState.hasFactor
  });
  if (mfa === "setup" || mfa === "verify") return adminMfaView(mfa);
```

`viewAdmin()` already sends any non-`isActiveAdmin()` visitor to `adminLoginView()`, so this also covers a reload at `aal1`, the invite flow and the password-reset flow.

- [ ] **Step 3: Branch the sign-in after the password**

In `handleSubmit`, in the `admin-signin` branch, replace:

```js
    if (isInvitedAdmin()){ Router.go("#/admin/accept-invite"); return; }
```

with:

```js
    if (isInvitedAdmin()){ Router.go("#/admin/accept-invite"); return; }
    if (AuthState.profile && AuthState.profile.status === "active"){
      /* Password was right; the second step is still to come. */
      ADMIN_LOGIN_ERROR = "";
      MFA_ERROR = "";
      MFA_ENROLL = null;
      render();
      return;
    }
```

- [ ] **Step 4: Send finished invites on to the second step**

In the `accept-invite-submit` branch, replace:

```js
    ADMIN_ACCEPT_ERROR = "";
    await refreshAuthState();
    await realDb.hydrate();
```

with:

```js
    ADMIN_ACCEPT_ERROR = "";
    await refreshAuthState();
    if (!isActiveAdmin()){ MFA_ERROR = ""; MFA_ENROLL = null; Router.go("#/admin"); return; }
    await realDb.hydrate();
```

- [ ] **Step 5: Add the form branch**

In `handleSubmit`, directly before `if (act === "accept-invite-submit"){`, insert:

```js
  if (act === "mfa-setup-submit" || act === "mfa-verify-submit"){
    const check = validateTotpCode(form.elements["code"].value);
    if (!check.ok){ MFA_ERROR = check.error; render(); return; }
    let factorId;
    if (act === "mfa-setup-submit"){
      if (!MFA_ENROLL){ MFA_ERROR = "Setup expired. Try again."; render(); return; }
      factorId = MFA_ENROLL.factorId;
    } else {
      if (!AuthState.totpFactor){ MFA_ERROR = "No authenticator found for this account."; render(); return; }
      factorId = AuthState.totpFactor.id;
    }
    if (MFA_BUSY) return;
    MFA_BUSY = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: check.code });
    MFA_BUSY = false;
    if (error){ MFA_ERROR = classifyMfaError(error).message; render(); return; }
    MFA_ERROR = "";
    MFA_ENROLL = null;
    await refreshAuthState();
    if (isActiveAdmin()){
      await realDb.hydrate();
      startAdminRealtimeSync();
      toast("Signed in.");
      Router.go("#/admin");
      return;
    }
    MFA_ERROR = "Couldn’t finish signing in. Try again.";
    render();
    return;
  }

```

- [ ] **Step 6: Add the two actions**

In `ACTIONS`, directly after the `"admin-back-to-signin"` action, insert:

```js
  "mfa-sign-out": async () => {
    MFA_ENROLL = null;
    MFA_ERROR = "";
    await sb.auth.signOut();
    await refreshAuthState();
    render();
  },

  "mfa-retry": () => {
    MFA_ERROR = "";
    MFA_ENROLL = null;
    render();
  },
```

- [ ] **Step 7: Show the status in the profile modal**

In the `open-profile` action, replace:

```js
      + '<div style="border-top:1px solid var(--admin-border);margin:22px 0"></div>'

      + '<h4 class="admin-section-title" style="font-size:.95rem;margin:0 0 6px">Quick-access PIN</h4>'
```

with:

```js
      + '<div style="border-top:1px solid var(--admin-border);margin:22px 0"></div>'

      + '<h4 class="admin-section-title" style="font-size:.95rem;margin:0 0 6px">Two-step verification</h4>'
      + '<div class="admin-callout admin-callout--ok" style="margin-bottom:6px">' + ic("check")
      + '<span>On. Required for every admin account.</span></div>'
      + '<p class="admin-meta" style="margin:0">Lost your phone? Another admin can reset this from the Admins screen.</p>'

      + '<div style="border-top:1px solid var(--admin-border);margin:22px 0"></div>'

      + '<h4 class="admin-section-title" style="font-size:.95rem;margin:0 0 6px">Quick-access PIN</h4>'
```

- [ ] **Step 8: Syntax-check**

Run the inline-script check from Task 2 Step 3. Expected: `OK`.

- [ ] **Step 9: Verify the screens in the browser with a mocked MFA client**

Unregister the service worker, hard-reload `http://localhost:4321/#/admin`, then run in the page (`javascript_tool`):

```js
// Mocked MFA client - no real factor is created on any account.
window.__c = { enroll: 0, unenroll: 0, verify: [] };
sb.auth.mfa.listFactors = async () => ({ data: { all: [{ id: "stale1", factor_type: "totp", status: "unverified" }], totp: [], phone: [] } });
sb.auth.mfa.unenroll = async () => { __c.unenroll++; return { data: {}, error: null }; };
sb.auth.mfa.enroll = async () => { __c.enroll++; return { data: { id: "f1", totp: { qr_code: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>", secret: "ABCD2345" } }, error: null }; };
sb.auth.mfa.challengeAndVerify = async (a) => { __c.verify.push(a); await new Promise(r => setTimeout(r, 200)); return { error: { code: "mfa_verification_failed", status: 422, message: "bad" } }; };
AuthState = { session: { user: { email: "a@b.c" } }, profile: { status: "active", id: "x" }, aal: "aal1", hasFactor: false, totpFactor: null };
MFA_ENROLL = null; MFA_ERROR = ""; MFA_BUSY = false;
location.hash = "#/admin"; render(); render(); render();
await new Promise(r => setTimeout(r, 400));
render(); render();
({ text: document.body.innerText.slice(0, 300), enroll: __c.enroll, unenroll: __c.unenroll, qr: !!document.querySelector('img[alt^="QR code"]') })
```
Expected: the page shows "Set up two-step verification." with the secret `ABCD2345`; `enroll: 1, unenroll: 1, qr: true` (several renders, one enrollment, one stale factor removed: Review Focus 4 and 5).

Check the failure path does not loop:

```js
MFA_ENROLL = null; MFA_ERROR = ""; __c.enroll = 0;
sb.auth.mfa.enroll = async () => { __c.enroll++; return { data: null, error: { code: "over_request_rate_limit", status: 429, message: "x" } }; };
render(); await new Promise(r => setTimeout(r, 400)); render(); render(); render();
const afterFail = { enrollCalls: __c.enroll, hasRetry: !!document.querySelector('[data-act="mfa-retry"]'), rate: document.body.innerText.includes("Too many tries") };
document.querySelector('[data-act="mfa-retry"]').click(); await new Promise(r => setTimeout(r, 400));
({ afterFail, afterRetryClick: __c.enroll })
```
Expected: `afterFail: { enrollCalls: 1, hasRetry: true, rate: true }` and `afterRetryClick: 2` (one more call, only because of the click).

Check codes: a short one never reaches Supabase, a pasted one is normalised, and a double-tap verifies once:

```js
sb.auth.mfa.enroll = async () => { __c.enroll++; return { data: { id: "f1", totp: { qr_code: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>", secret: "ABCD2345" } }, error: null }; };
MFA_ENROLL = null; MFA_ERROR = ""; render(); await new Promise(r => setTimeout(r, 400));
let f = document.querySelector('form[data-act="mfa-setup-submit"]');
f.elements.code.value = "12345"; f.requestSubmit(); await new Promise(r => setTimeout(r, 100));
const shortMsg = document.body.innerText.includes("Enter the 6-digit code from your authenticator app.");
const verifiedShort = __c.verify.length;
f = document.querySelector('form[data-act="mfa-setup-submit"]');
f.elements.code.value = "123 456"; f.requestSubmit(); f.requestSubmit(); await new Promise(r => setTimeout(r, 500));
({ shortMsg, verifiedShort, verify: __c.verify, wrong: document.body.innerText.includes("didn’t work") })
```
Expected: `shortMsg: true, verifiedShort: 0, verify: [{factorId:"f1", code:"123456"}]` (exactly one call despite two submits: Review Focus 6), `wrong: true`.

Check the returning-admin screen and a correct code opening the gate:

```js
MFA_ENROLL = null; MFA_ERROR = "";
AuthState = { session: { user: { email: "a@b.c" } }, profile: { status: "active", id: "x" }, aal: "aal1", hasFactor: true, totpFactor: { id: "p1" } };
render();
const onVerify = document.body.innerText.includes("Enter your code.");
sb.auth.mfa.challengeAndVerify = async () => { AuthState.aal = "aal2"; return { error: null }; };
const realRefresh = refreshAuthState; refreshAuthState = async () => {};   // stubbed for this mocked check only
const vf = document.querySelector('form[data-act="mfa-verify-submit"]');
vf.elements.code.value = "654321"; vf.requestSubmit(); await new Promise(r => setTimeout(r, 400));
refreshAuthState = realRefresh;
({ onVerify, active: isActiveAdmin() })
```
Expected: `onVerify: true, active: true`. Reload to discard every mock. `read_console_messages({onlyErrors:true})` shows nothing unexpected. Take a `screenshot` of the set-up screen and the code screen.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "Add the admin two-step set-up and code screens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Change authenticator (profile modal)

**Files:**
- Modify: `index.html`: new state/functions after `adminMfaView`; `handleSubmit` (one branch); `ACTIONS` (one action); `open-profile` modal (one button)

**Interfaces:**
- Consumes: `validateTotpCode`, `classifyMfaError` (Task 1); `removeUnverifiedTotpFactors` (Task 3); `isActiveAdmin()`, `refreshAuthState()`.
- Produces: `TOTP_CHANGE` state, `changeTotpModalHTML()`, `showTotpChange()`, `startTotpChange()`; action `change-totp`; form branch `change-totp-verify`.

Optional: without it, an admin getting a new phone needs another admin's reset (Task 7). It needs an `aal2` session, so it can't be used to bypass the second factor. Supabase allows up to 10 factors per user, so the new device can be added before the old is removed.

- [ ] **Step 1: Add the state, helpers and modal**

In `index.html`, directly after the `adminMfaView` function (added in Task 3), add:

```js
/* Change authenticator (from the profile modal, so always an aal2
   session). The NEW authenticator is enrolled and verified first; only
   then is the old one removed, so there is never a moment with no working
   factor. */
let TOTP_CHANGE = null;   // { error, factorId, qr, secret }

function showTotpChange(){
  closeModal();
  openModal(changeTotpModalHTML(), null, "admin-modal");
}

function changeTotpModalHTML(){
  const tc = TOTP_CHANGE || { error: "", factorId: null };
  const err = tc.error ? '<span class="admin-hint" role="alert" style="color:var(--admin-bad);font-weight:600">' + E(tc.error) + '</span>' : "";
  const head = '<div class="admin-scope" style="font-family:var(--admin-font-body);color:var(--admin-ink)">'
    + '<div class="modal__head"><div><span class="admin-eyebrow">Your account</span>'
    + '<h3 class="admin-section-title" style="margin-top:4px;text-transform:none">Change authenticator</h3></div>'
    + '<button type="button" class="admin-btn admin-btn--ghost admin-btn--icon" data-act="close-modal" aria-label="Close">' + ic("x","i-lg") + '</button></div>';
  if (!tc.factorId){
    return head + '<div class="modal__body">'
      + (tc.error
          ? '<div class="admin-callout admin-callout--bad">' + ic("triangle-alert") + '<span>' + E(tc.error) + '</span></div>'
          : '<p class="admin-meta">Preparing…</p>')
      + '</div><div class="modal__foot"><button type="button" class="admin-btn admin-btn--ghost" data-act="close-modal">Cancel</button>'
      + (tc.error ? '<button type="button" class="admin-btn admin-btn--primary" data-act="change-totp">' + ic("rotate-ccw") + ' Try again</button>' : '')
      + '</div></div>';
  }
  return head + '<form data-act="change-totp-verify"><div class="modal__body">'
    + '<p class="admin-meta">Your current authenticator keeps working until the new one is confirmed. Scan this with the new device, then type the 6-digit code it shows.</p>'
    + '<div style="display:flex;justify-content:center;margin:14px 0"><img src="' + E(tc.qr) + '" alt="QR code to add this account to your new authenticator" width="160" height="160" style="background:#fff;padding:8px;border-radius:8px"></div>'
    + '<p class="admin-meta" style="text-align:center">Can’t scan? Enter this key instead:<br><code style="font-size:.85rem;word-break:break-all">' + E(tc.secret) + '</code></p>'
    + '<div class="admin-field" style="margin-top:12px"><label for="change-code">6-digit code</label>'
    + '<input class="admin-input" id="change-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder=" " required>' + err + '</div>'
    + '</div><div class="modal__foot"><button type="button" class="admin-btn admin-btn--ghost" data-act="close-modal">Cancel</button>'
    + '<button type="submit" class="admin-btn admin-btn--primary">' + ic("check") + ' Confirm new authenticator</button></div></form></div>';
}

async function startTotpChange(){
  TOTP_CHANGE = { error: "", factorId: null, qr: "", secret: "" };
  openModal(changeTotpModalHTML(), null, "admin-modal");
  try {
    await removeUnverifiedTotpFactors();
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + new Date().toISOString() });
    if (error) throw error;
    TOTP_CHANGE = { error: "", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
  } catch (err){
    TOTP_CHANGE = { error: classifyMfaError(err).message, factorId: null, qr: "", secret: "" };
  }
  showTotpChange();
}
```

- [ ] **Step 2: Add the form branch**

In `handleSubmit`, directly before `if (act === "mfa-setup-submit" || act === "mfa-verify-submit"){`, insert:

```js
  if (act === "change-totp-verify"){
    const check = validateTotpCode(form.elements["code"].value);
    if (!check.ok){ TOTP_CHANGE.error = check.error; showTotpChange(); return; }
    if (!isActiveAdmin()){ toast("Sign in again first.", "bad"); return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: TOTP_CHANGE.factorId, code: check.code });
    if (error){ TOTP_CHANGE.error = classifyMfaError(error).message; showTotpChange(); return; }
    /* The new authenticator is verified. Only now remove the old one(s). */
    const { data: fData } = await sb.auth.mfa.listFactors();
    const old = ((fData && fData.totp) || []).filter(f => f.id !== TOTP_CHANGE.factorId);
    for (const f of old) await sb.auth.mfa.unenroll({ factorId: f.id });
    TOTP_CHANGE = null;
    await refreshAuthState();
    closeModal();
    toast("Authenticator updated.");
    return;
  }

```

- [ ] **Step 3: Add the action and the button**

In `ACTIONS`, directly after the `"mfa-retry"` action, insert:

```js
  "change-totp": () => { startTotpChange(); },
```

In the `open-profile` modal, replace the line added in Task 3 Step 7:

```js
      + '<p class="admin-meta" style="margin:0">Lost your phone? Another admin can reset this from the Admins screen.</p>'
```

with:

```js
      + '<button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" style="margin:8px 0" data-act="change-totp">' + ic("smartphone") + ' Change authenticator</button>'
      + '<p class="admin-meta" style="margin:0">Lost your phone? Another admin can reset this from the Admins screen.</p>'
```

- [ ] **Step 4: Syntax-check, then verify the ordering in the browser with a mocked client**

Run the inline-script check from Task 2 Step 3 (`OK`). Hard-reload `http://localhost:4321/#/admin`, then:

```js
window.__log = [];
AuthState = { session: { user: { email: "a@b.c" } }, profile: { status: "active", id: "x", name: "A" }, aal: "aal2", hasFactor: true, totpFactor: { id: "old1" } };
let totps = [{ id: "old1" }];
sb.auth.mfa.listFactors = async () => ({ data: { all: [], totp: totps, phone: [] } });
sb.auth.mfa.enroll = async () => { __log.push(["enroll"]); totps = totps.concat([{ id: "new1" }]); return { data: { id: "new1", totp: { qr_code: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>", secret: "NEWSECRET" } }, error: null }; };
sb.auth.mfa.challengeAndVerify = async (a) => { __log.push(["verify", a.factorId, a.code]); return { error: null }; };
sb.auth.mfa.unenroll = async (a) => { __log.push(["unenroll", a.factorId]); totps = totps.filter(p => p.id !== a.factorId); return { data: {}, error: null }; };
const realRefresh = refreshAuthState; refreshAuthState = async () => {};
ACTIONS["open-profile"]();
const hasButton = !!document.querySelector('[data-act="change-totp"]');
ACTIONS["change-totp"](); await new Promise(r => setTimeout(r, 500));
const atCode = document.body.innerText.includes("NEWSECRET");
const f = document.querySelector('form[data-act="change-totp-verify"]');
f.elements.code.value = "111 222"; f.requestSubmit(); await new Promise(r => setTimeout(r, 500));
refreshAuthState = realRefresh;
({ hasButton, atCode, log: __log })
```
Expected: `hasButton: true, atCode: true`, and `log` is exactly, in order: `["enroll"]`, `["verify","new1","111222"]`, `["unenroll","old1"]`. The `verify` entry must come **before** the `unenroll` entry (Review Focus 8). Then re-run with `challengeAndVerify` returning `{ error: { code: "mfa_verification_failed" } }` and confirm `log` has **no** `unenroll` entry. Reload to discard the mocks.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Let admins change their authenticator (verify the new one first)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Server paths ask `is_active_admin()` instead of reading the profile

**Files:**
- Modify: `workers/media-upload/index.js:56-67` and header comment (lines 14-17)
- Create: `test/mediaUploadAuth.test.js`
- Modify: `supabase/functions/send-newsletter/index.ts:90-100`
- Modify: `supabase/functions/get-site-analytics/index.ts:157-166`
- Modify: `supabase/functions/generate-sitemap/index.ts:111-121`
- Modify: `supabase/functions/admin-invite/index.ts:~60-72`

**Interfaces:**
- Consumes: the database function `is_active_admin()` (`boolean`; gets the `aal2` condition only when the owner runs Task 6's SQL).
- Produces: nothing new; each path now trusts that one function. Until Task 6's SQL is run the rule is unchanged, so deploying these changes early is safe.

- [ ] **Step 1: Write the failing Worker tests**

Create `test/mediaUploadAuth.test.js`:

```js
// The upload Worker's admin gate. It must ask Supabase's is_active_admin()
// (which, once supabase/mfa-enforce.sql is applied, also requires a
// verified second factor) and must answer 403 on anything other than a
// literal `true` - including a failed or malformed answer.
import { describe, it, expect, afterEach } from "vitest";
import worker from "../workers/media-upload/index.js";

const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function mockSupabase(rpcResponse) {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    }
    if (String(url).endsWith("/rest/v1/rpc/is_active_admin")) return rpcResponse();
    throw new Error("unexpected fetch: " + url);
  };
  return seen;
}

function upload() {
  return new Request("https://w.example/", {
    method: "POST",
    headers: { Authorization: "Bearer tok", "content-type": "image/png" },
    body: new Uint8Array(0),
  });
}

describe("media-upload admin gate", () => {
  it("rejects when is_active_admin returns false", async () => {
    mockSupabase(() => new Response("false", { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects when the rpc call itself fails", async () => {
    mockSupabase(() => new Response("{}", { status: 500 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects a non-boolean answer such as the string 'true'", async () => {
    mockSupabase(() => new Response('"true"', { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects a non-JSON answer", async () => {
    mockSupabase(() => new Response("<html>oops</html>", { status: 200 }));
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("rejects when the rpc request throws", async () => {
    mockSupabase(() => { throw new Error("network"); });
    expect((await worker.fetch(upload(), env)).status).toBe(403);
  });
  it("lets a true answer through to the next step (an empty body is then a 400)", async () => {
    const seen = mockSupabase(() => new Response("true", { status: 200 }));
    const res = await worker.fetch(upload(), env);
    expect(res.status).toBe(400);
    expect(seen.some(u => u.includes("/rest/v1/profiles"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/mediaUploadAuth.test.js`
Expected: FAIL (the Worker still calls `/rest/v1/profiles`, so the mock throws "unexpected fetch").

- [ ] **Step 3: Change the Worker**

In `workers/media-upload/index.js`, replace the whole of Step 2:

```js
    // Step 2: verify the caller is an active admin. `profiles` is
    // readable by any authenticated user (RLS: "profiles read" ... using
    // (true)), so the caller's own token is sufficient here - this
    // Worker never needs the service_role key.
    const profileRes = await fetch(
      env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=status",
      { headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY } }
    );
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles[0] || profiles[0].status !== "active") {
      return json({ error: "Not authorized" }, 403);
    }
```

with:

```js
    // Step 2: verify the caller is an active admin by asking the same
    // database function every RLS policy uses, with the caller's own token
    // (so it sees the real session). Once supabase/mfa-enforce.sql is
    // applied that function also requires a verified second factor, so
    // this check can't drift from the rest of the app. Anything other
    // than a literal `true` - a failed call, a non-boolean, non-JSON -
    // is a refusal.
    let isAdmin = false;
    try {
      const adminRes = await fetch(env.SUPABASE_URL + "/rest/v1/rpc/is_active_admin", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY, "content-type": "application/json" },
        body: "{}",
      });
      isAdmin = adminRes.ok && (await adminRes.json()) === true;
    } catch (_e) {
      isAdmin = false;
    }
    if (!isAdmin) return json({ error: "Not authorized" }, 403);
```

Replace the header comment:

```js
// (Same anon key already used in index.html - this Worker never needs
// the service_role key: `profiles` is readable by any authenticated
// user, per migration.sql, so the caller's own bearer token is enough
// to check admin status without a privileged key on this side too.)
```

with:

```js
// (Same anon key already used in index.html - this Worker never needs
// the service_role key: it asks the is_active_admin() database function
// with the caller's own bearer token.)
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run test/mediaUploadAuth.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Change `send-newsletter`**

In `supabase/functions/send-newsletter/index.ts`, replace:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }
```

with:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Same rule as every RLS policy: an active admin whose session has also
  // passed the second factor (see supabase/mfa-enforce.sql). Asked with
  // the caller's own token so the function sees their real session.
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }
```

- [ ] **Step 6: Change `get-site-analytics`**

In `supabase/functions/get-site-analytics/index.ts`, replace:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }
```

with:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Active admin AND second factor passed - see supabase/mfa-enforce.sql.
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }
```

Then run `grep -n "adminClient" supabase/functions/get-site-analytics/index.ts`. If the only mention left is the `const adminClient = ...` line you just kept, delete that line (and, if `SERVICE_ROLE_KEY` is then unused, its `const SERVICE_ROLE_KEY = ...` line too).

- [ ] **Step 7: Change `generate-sitemap`**

In `supabase/functions/generate-sitemap/index.ts`, replace:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }
```

with:

```ts
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Active admin AND second factor passed - see supabase/mfa-enforce.sql.
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }
```

(`adminClient` is used further down for reading tables, so it stays.)

- [ ] **Step 8: Change `admin-invite`**

In `supabase/functions/admin-invite/index.ts`, replace:

```ts
  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }
```

with:

```ts
  // Active admin AND second factor passed - see supabase/mfa-enforce.sql.
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }
```

Also update the comment above it: replace `// Step 2: the only place the service_role key is ever constructed. Used\n  // for the privileged profiles lookup below and the actual invite call -` with `// Step 2: the only place the service_role key is ever constructed. Used\n  // for the actual invite call -`.

- [ ] **Step 9: Verify nothing still reads the profile directly, and every file parses**

```bash
grep -rn 'callerProfile' supabase/functions workers; echo "grep exit $? (1 = none left, good)"
for f in send-newsletter get-site-analytics generate-sitemap admin-invite; do node --check supabase/functions/$f/index.ts && echo "$f ok"; done
npx vitest run
```
Expected: no `callerProfile` lines (grep exit 1), four `ok` lines, and the whole Vitest suite passing.

- [ ] **Step 10: Commit**

```bash
git add workers/media-upload/index.js test/mediaUploadAuth.test.js supabase/functions
git commit -m "Gate admin Edge Functions and the upload Worker on is_active_admin()

They read profiles.status directly, which a password-only session would
satisfy. They now ask the one database rule instead.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The enforcement SQL (separate; the owner runs it last, after approval)

**Files:**
- Create: `supabase/mfa-enforce.sql`

**Interfaces:**
- Produces: a redefined `is_active_admin()` that also requires `auth.jwt() ->> 'aal' = 'aal2'`. No task runs it.

- [ ] **Step 1: Write the file**

Create `supabase/mfa-enforce.sql`:

```sql
-- Turn on server-side enforcement of admin two-factor authentication.
--
-- RUN THIS LAST, and only with the owner's go-ahead. Only after every admin
-- has signed in to the new build and set up an authenticator app. Until
-- then the portal prompts for a code but the database still accepts
-- password-only sessions.
--
-- What it does: is_active_admin() - the one rule behind every admin RLS
-- policy, the uploads storage policy, the Edge Functions and the upload
-- Worker - additionally requires the session's JWT to carry aal = 'aal2'
-- (a verified second factor). A password-only session (aal1) is no longer
-- an admin anywhere.
--
-- Do NOT fold this into migration.sql: re-running migration.sql before
-- everyone has enrolled would lock them out.

create or replace function is_active_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'active'
  )
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ROLLBACK (one statement; paste and run if anyone is locked out):
--
-- create or replace function is_active_admin() returns boolean
-- language sql security definer set search_path = public stable as $$
--   select exists (
--     select 1 from profiles where id = auth.uid() and status = 'active'
--   );
-- $$;
```

- [ ] **Step 2: Check it against the existing definition**

Run: `grep -n "is_active_admin() returns boolean" -A 5 supabase/migration.sql`
Expected: the existing definition has the same signature, `language sql security definer set search_path = public stable`, and the same `from profiles where id = auth.uid() and status = 'active'` body, so the rollback block is exactly the current definition. If either differs, fix the rollback block to match `migration.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/mfa-enforce.sql
git commit -m "Add the (separately run) SQL that enforces admin 2FA in the database

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Lost-phone recovery (admin reset function, Admins-screen button, rescue script)

**Files:**
- Create: `supabase/functions/admin-reset-mfa/index.ts`
- Create: `supabase/deploy-admin-reset-mfa.ps1`
- Create: `supabase/reset-admin-mfa.mjs`
- Modify: `index.html`: `adminAdmins()` (~14087-14092) and `ACTIONS` (after `delete-admin-confirm`, ~19790)

**Interfaces:**
- Consumes: `is_active_admin()` (Tasks 5, 6), `loadAdminRoster()`, `openModal()`, `toast()`, `db.log()`.
- Produces: the Edge Function `admin-reset-mfa` taking `{ targetId: string }` and returning `{ ok: true, removed: number }`; actions `reset-admin-mfa` and `reset-admin-mfa-confirm`.

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/admin-reset-mfa/index.ts`:

```ts
// Chike's Creative Space - admin-reset-mfa Edge Function
//
// Lost-phone recovery: an active admin whose own session has passed the
// second factor can remove another admin's authenticator enrollment, so
// that person sets up a new one at their next sign-in. Removing factors
// needs the service_role key, which must never reach the browser - same
// reason admin-invite exists.
//
// Deploy: .\supabase\deploy-admin-reset-mfa.ps1
//
// Called from index.html as:
//   sb.functions.invoke("admin-reset-mfa", { body: { targetId } })

import { createClient } from "jsr:@supabase/supabase-js@2";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: who is calling, verified against Supabase Auth.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ error: "Not authenticated" }, 401);
  }

  // Step 2: an active admin with a verified second factor (the same rule
  // as everywhere else - see supabase/mfa-enforce.sql).
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }

  // Step 3: validate the request. Nobody resets their own 2FA this way.
  let body: { targetId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const targetId = String(body.targetId ?? "");
  if (!UUID_RE.test(targetId)) return json({ error: "Invalid admin id" }, 400);
  if (targetId === callerData.user.id) {
    return json({ error: "You can't reset your own two-step verification." }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: target } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return json({ error: "That admin doesn't exist." }, 404);

  // Step 4: remove every factor the target has.
  const { data: listData, error: listErr } = await adminClient.auth.admin.mfa.listFactors({ userId: targetId });
  if (listErr) return json({ error: listErr.message }, 500);

  let removed = 0;
  for (const factor of listData?.factors ?? []) {
    const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetId });
    if (delErr) return json({ error: delErr.message, removed }, 500);
    removed += 1;
  }

  return json({ ok: true, removed });
});
```

- [ ] **Step 2: Write the deploy script**

Create `supabase/deploy-admin-reset-mfa.ps1`:

```powershell
# One-shot deploy for the admin-reset-mfa Edge Function.
#
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are reserved
# names that Supabase auto-injects into every deployed Edge Function, so
# this script only needs your personal access token, to link and deploy.
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-admin-reset-mfa.ps1
#
# Nothing is written to disk by this script - closing the terminal clears
# the token, and it is safe to keep this file in the repo as-is.

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "SUPABASE_ACCESS_TOKEN is not set. Run:" -ForegroundColor Red
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."' -ForegroundColor Yellow
  exit 1
}

Write-Host "Linking project..." -ForegroundColor Cyan
npx supabase link --project-ref wdctkfhwygwwulipwnys
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Deploying admin-reset-mfa..." -ForegroundColor Cyan
npx supabase functions deploy admin-reset-mfa
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done." -ForegroundColor Green
}
```

- [ ] **Step 3: Write the sole-admin rescue script**

Create `supabase/reset-admin-mfa.mjs`:

```js
// Rescue helper for the one case the in-app "Reset 2FA" button can't cover:
// the only admin (or every admin) lost their authenticator, so nobody is
// left who can sign in to press that button.
//
// It removes every authenticator factor for one admin, so that person sets
// up a new one at their next sign-in. It needs the service_role key, which
// bypasses every protection - it is read from an environment variable you
// set in your own terminal, for this session only, and is never stored.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
//   node supabase/reset-admin-mfa.mjs you@example.com

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] || "").trim().toLowerCase();

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Run:");
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY = "..."');
  process.exit(1);
}
if (!email) {
  console.error("Usage: node supabase/reset-admin-mfa.mjs you@example.com");
  process.exit(1);
}

const headers = { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY };

const profRes = await fetch(
  SUPABASE_URL + "/rest/v1/profiles?select=id&email=eq." + encodeURIComponent(email),
  { headers }
);
const profiles = await profRes.json();
if (!profRes.ok || !Array.isArray(profiles) || !profiles[0]) {
  console.error("No admin profile found for " + email);
  process.exit(1);
}
const userId = profiles[0].id;

const facRes = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId + "/factors", { headers });
const factors = await facRes.json();
if (!facRes.ok || !Array.isArray(factors)) {
  console.error("Could not list factors: " + JSON.stringify(factors));
  process.exit(1);
}

let removed = 0;
for (const f of factors) {
  const del = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + userId + "/factors/" + f.id, { method: "DELETE", headers });
  if (!del.ok) {
    console.error("Could not remove factor " + f.id + ": " + (await del.text()));
    process.exit(1);
  }
  removed += 1;
}
console.log("Removed " + removed + " factor(s) for " + email + ". They will set up a new authenticator at their next sign-in.");
```

Check they parse: `node --check supabase/reset-admin-mfa.mjs && node --check supabase/functions/admin-reset-mfa/index.ts && echo ok`. Expected: `ok`.

- [ ] **Step 4: Add the Reset button to the Admins screen**

In `adminAdmins()`, replace:

```js
          + (self ? '' : '<div class="row" style="gap:6px;flex-wrap:wrap">'
              + (p.status === "revoked"
```

with:

```js
          + (self ? '' : '<div class="row" style="gap:6px;flex-wrap:wrap">'
              + (p.status === "active"
                  ? '<button class="admin-btn admin-btn--sm admin-btn--ghost" data-act="reset-admin-mfa" data-id="' + E(p.id) + '" data-name="' + E(p.name || p.email) + '">' + ic("smartphone") + ' Reset 2FA</button>'
                  : '')
              + (p.status === "revoked"
```

- [ ] **Step 5: Add the two actions**

In `ACTIONS`, directly after the `"delete-admin-confirm"` action, insert:

```js
  "reset-admin-mfa": (el) => {
    const id = el.getAttribute("data-id");
    const name = el.getAttribute("data-name") || "This admin";
    openModal('<div class="admin-scope" style="font-family:var(--admin-font-body);color:var(--admin-ink)">'
      + '<div class="modal__head"><div><span class="admin-eyebrow">Admins</span>'
      + '<h3 class="admin-section-title" style="margin-top:4px;text-transform:none">Reset 2FA for ' + E(name) + '?</h3></div>'
      + '<button type="button" class="admin-btn admin-btn--ghost admin-btn--icon" data-act="close-modal" aria-label="Close">' + ic("x","i-lg") + '</button></div>'
      + '<div class="admin-callout">' + ic("info")
      + '<span>Use this if they lost their phone. Their current authenticator stops working, and they set up a new one the next time they sign in. Their password is unchanged.</span></div>'
      + '<div class="modal__foot"><button type="button" class="admin-btn admin-btn--ghost" data-act="close-modal">Cancel</button>'
      + '<button type="button" class="admin-btn admin-btn--danger" data-act="reset-admin-mfa-confirm" data-id="' + E(id) + '" data-name="' + E(name) + '">' + ic("smartphone") + ' Reset 2FA</button></div></div>',
      null, "admin-modal");
  },

  "reset-admin-mfa-confirm": async (el) => {
    const id = el.getAttribute("data-id");
    const name = el.getAttribute("data-name") || "admin";
    closeModal();
    const res = await sb.functions.invoke("admin-reset-mfa", { body: { targetId: id } });
    /* Same unwrap as "send-newsletter": a non-2xx response's error.message
       is a generic wrapper; the function's own {error} body is on
       error.context. */
    let detail = res.error ? res.error.message : (res.data && res.data.error);
    if (res.error){
      try {
        if (res.error.context && typeof res.error.context.json === "function"){
          const body = await res.error.context.json();
          if (body && body.error) detail = body.error;
        }
      } catch(_e){ /* keep the generic message */ }
    }
    if (detail){ toast("Could not reset 2FA: " + detail, "bad"); return; }
    db.log("reset-2fa", "admins", id, "Reset two-step verification for " + name);
    toast("2FA reset. " + name + " will set it up again at next sign-in.");
  },
```

- [ ] **Step 6: Syntax-check, then verify the button and dialog in the browser**

Run the inline-script check from Task 2 Step 3 (`OK`). Hard-reload `http://localhost:4321/#/admin`, then:

```js
AuthState = { session: { user: { email: "me@x.c" } }, profile: { status: "active", id: "me" }, aal: "aal2", hasFactor: true, totpFactor: null };
ADMIN_ROSTER = [
  { id: "me", email: "me@x.c", name: "Me", status: "active" },
  { id: "u2", email: "two@x.c", name: "Two", status: "active" },
  { id: "u3", email: "three@x.c", name: "Three", status: "invited" }
];
document.getElementById("app").innerHTML = adminAdmins();
({ resetButtons: [...document.querySelectorAll('[data-act="reset-admin-mfa"]')].map(b => b.dataset.id) })
```
Expected: `resetButtons: ["u2"]` (not the signed-in admin, not the invited one). Then `ACTIONS["reset-admin-mfa"]({ getAttribute: k => ({ "data-id": "u2", "data-name": "Two" })[k] })` and `screenshot` to confirm the dialog reads correctly. Close it with Cancel. Reload to discard the fakes.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/admin-reset-mfa supabase/deploy-admin-reset-mfa.ps1 supabase/reset-admin-mfa.mjs index.html
git commit -m "Add lost-phone recovery for admin 2FA

An aal2 admin can reset another admin's authenticator from the Admins
screen; a script covers the sole-admin case.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Document, bump the cache, run every check, and hand the owner their steps

**Files:**
- Modify: `README.md` (append a section)
- Modify: `sw.js:12` (`CACHE_VERSION`)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Document the rollout, the free-cost check and recovery**

Append to `README.md`:

```markdown

## Admin two-factor authentication (authenticator app)

Every admin signs in with their password **and** a 6-digit code from a free authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden), using Supabase's built-in TOTP MFA. The code is enforced in the database and the admin Edge Functions, not just in the browser. There is no ongoing cost: Supabase's docs say TOTP MFA is free to use and enabled by default. (Phone/SMS MFA is the paid one and is not used here.)

**Before rollout (owner, two minutes):**

1. Supabase dashboard, Authentication, Multi-Factor Authentication: confirm TOTP enrollment and verification are enabled.
2. Authentication, Sign In / Providers: confirm **"Allow new users to sign up" is OFF**. (`handle_new_user` gives any new auth user a profile and `accept_invite()` can activate it, so this switch is what keeps strangers out.)

**Rollout, in this order** (so nobody gets locked out):

1. Deploy the site, then the changed Edge Functions (`admin-invite`, `send-newsletter`, `get-site-analytics`, `generate-sitemap`), the new `admin-reset-mfa` function (`.\supabase\deploy-admin-reset-mfa.ps1`), and the upload Worker (`npx wrangler deploy` in `workers/media-upload`). Admins are now prompted to set up an authenticator at their next sign-in, but the database still accepts password-only sessions.
2. Every admin signs in and sets up their authenticator.
3. Run `supabase/mfa-enforce.sql` in the Supabase SQL Editor. From then on a password-only session is rejected everywhere. The rollback (one statement) is at the bottom of that file.

**Lost phone:** if still signed in, Profile, "Change authenticator". Otherwise another admin presses "Reset 2FA" on the Admins screen. If there is only one admin, run `node supabase/reset-admin-mfa.mjs you@example.com` with `SUPABASE_SERVICE_ROLE_KEY` set in your terminal. Supabase issues no recovery codes, so use an authenticator app that backs up or syncs its codes.
```

- [ ] **Step 2: Bump the service-worker cache**

In `sw.js` change `const CACHE_VERSION = "ccs-v4";` to `const CACHE_VERSION = "ccs-v5";`.

- [ ] **Step 3: Run the whole test suite and every syntax check**

```bash
npx vitest run
node -e "const s=require('fs').readFileSync('index.html','utf8');const m=[...s.matchAll(/<script(?![^>]*type=\"module\")[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).sort((a,b)=>b.length-a.length)[0];require('fs').writeFileSync(process.env.TEMP+'/ccs-inline.js',m)" && node --check "$TEMP/ccs-inline.js" && echo "inline OK"
for f in admin-invite send-newsletter get-site-analytics generate-sitemap admin-reset-mfa; do node --check supabase/functions/$f/index.ts && echo "$f ok"; done
node --check workers/media-upload/index.js && node --check supabase/reset-admin-mfa.mjs && echo "scripts ok"
grep -rn 'callerProfile' supabase/functions workers; echo "grep exit $? (1 = good)"
```
Expected: all Vitest tests pass (the existing files plus `mfa.test.js` and `mediaUploadAuth.test.js`), `inline OK`, five function `ok` lines, `scripts ok`, grep exit 1.

- [ ] **Step 4: Confirm the public site is unaffected**

Unregister the service worker, hard-reload `http://localhost:4321/#/` (signed out) and click through Home, Create, Watch, Play and Shop in the Browser pane. `read_console_messages({onlyErrors:true})` shows no errors. Open `#/admin` and confirm the normal email/password sign-in card still renders.

- [ ] **Step 5: Commit, then hand the owner their steps (this plan stops here)**

```bash
git add README.md sw.js
git commit -m "Document the admin 2FA rollout, the free-cost check and recovery

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

In the final message to the owner, list exactly what is theirs and in what order, and say that **none of it has been done**: (1) approve the plan; (2) check TOTP is enabled and "Allow new users to sign up" is off (README, "Before rollout"); (3) deploy the site, Edge Functions and Worker with their own tokens; (4) sign in and set up their own authenticator, and have every other admin do the same; (5) only then run `supabase/mfa-enforce.sql`. State plainly that the real enrollment and verification against the live Supabase project is unverified until the owner's first sign-in, and that plan gating of TOTP on the free tier was not confirmable from here (check the dashboard in step 2).

---

# Revision 4 amendments (owner-approved; these supersede conflicting parts of Tasks 4, 6, 7 and 8)

Approved by the owner for **local implementation and testing, not production deployment**. Execution: **native**, then one independent whole-branch review. **Standing prohibitions for this whole revision:** do not deploy anything, do not create a factor on the owner's account, do not run `mfa-enforce.sql` (or any SQL against a real project), do not run the integration tests, and **do not commit**, until the owner explicitly approves each. Work stays in the working tree.

## Added Global Constraints

- Enforcement lives in **data** (`admin_mfa_settings.enforce_after`), read by an `is_active_admin()` that is defined in `migration.sql` itself. Re-running `migration.sql` must never clear the switch. `mfa-enforce.sql` and `mfa-rollback.sql` contain **no function definitions**, only an `update` of that one row.
- Every definition changed in `migration.sql` sits inside `-- BEGIN MFA-HARDENING:<name>` / `-- END MFA-HARDENING:<name>` markers and is repeated byte-for-byte in `supabase/mfa-hardening.sql`; a test fails on drift.
- Enrollment windows: rollout 3 days, invitation 7 days, post-reset = the recovery-email lifetime.
- The reset procedure is: identity attestation + typed email, caller rules, rate limits (2 per target and 5 per resetting admin per 24h, logged before acting), session deletion, password invalidation, recovery email, notification email, then factor removal.
- Integration tests live in `test/integration/`, are skipped unless `MFA_IT=1`, use `MFA_IT_*` environment variables (never `SUPABASE_*`), create their own disposable users, and refuse to run against project ref `wdctkfhwygwwulipwnys`.

## Task 4 amendment (change authenticator)

In the `change-totp-verify` branch, after the old factors are unenrolled and before `refreshAuthState()`, add:

```js
    /* An attacker's session must not survive the change. */
    try { await sb.auth.signOut({ scope: "others" }); } catch(_e){ /* best effort */ }
```

and in the Task 4 browser check, add a mocked `sb.auth.signOut = async (o) => { __log.push(["signOut", o && o.scope]); return { error: null }; }` and expect `["signOut","others"]` **after** `["unenroll","old1"]`.

## Task 6R (replaces Task 6): migration-resident enforcement, invitation hardening, audit and session functions

**Files:** modify `supabase/migration.sql` (in place); create `supabase/mfa-hardening.sql`, `supabase/mfa-enforce.sql`, `supabase/mfa-rollback.sql`, `test/mfaSql.test.js`.

- [ ] **Step 1: Write the failing SQL guard tests** (`test/mfaSql.test.js`): (a) `migration.sql` contains exactly one `create or replace function is_active_admin`, and it mentions `admin_mfa_settings`, `aal2` and `auth.sessions`; (b) nothing in `migration.sql` matches `drop table ... admin_mfa_settings`, `truncate`, `delete from admin_mfa_settings`, or `update admin_mfa_settings`, and every `insert into admin_mfa_settings` is followed by `on conflict (id) do nothing`; (c) the marked blocks of `migration.sql` and `mfa-hardening.sql` are identical and cover `settings`, `is_active_admin`, `handle_new_user`, `accept_invite`, `reset_log`; (d) `mfa-enforce.sql` and `mfa-rollback.sql` contain no `function`/`create` keyword and each contains an `update admin_mfa_settings`; (e) no other `supabase/*.sql` defines `is_active_admin`. Run: `npx vitest run test/mfaSql.test.js`; expected FAIL.
- [ ] **Step 2: Edit `migration.sql`.** Before the `-- Reused by every other table's RLS` comment add the `settings` block; replace the old `is_active_admin()` with the `is_active_admin` block; replace `handle_new_user()` and its trigger with the `handle_new_user` block (the trigger fires on `insert or update of invited_at`, so it works whether Supabase sets `invited_at` at insert or just after); replace `accept_invite()` with the `accept_invite` block (silent no-op unless the profile is `invited`; if it is `invited` but the auth user has no `invited_at`, or the invitation is older than 7 days, it raises "This invitation has expired. Ask an admin to send a new one."); after `delete_admin()` add the `reset_log` block (`mfa_reset_log`, and `revoke_user_sessions(uuid)` executable by `service_role` only). Mirror all five blocks into `supabase/mfa-hardening.sql`.
- [ ] **Step 3: Write `mfa-enforce.sql`** (`update admin_mfa_settings set enforce_after = now() + interval '3 days' ...` plus a commented "enforce now" variant) and **`mfa-rollback.sql`** (`... set enforce_after = null`).
- [ ] **Step 4: Run** `npx vitest run test/mfaSql.test.js`; expected PASS.
- [ ] **Step 5: Commit** (only when the owner asks).

## Task 7R (replaces Task 7): strengthened lost-device recovery

**Files:** create `supabase/functions/admin-reset-mfa/index.ts`, `supabase/deploy-admin-reset-mfa.ps1`, `supabase/reset-admin-mfa.mjs`; modify `index.html` (`adminAdmins()` and `ACTIONS`/`handleSubmit`).

- [ ] **Step 1: Edge Function.** Body `{ targetId, confirmEmail, verifiedHow }`; `verifiedHow` is one of `in_person | video_call | known_phone_number`. Order: authenticate caller; `is_active_admin` rpc; validate (UUID, not self, `verifiedHow`); load the target profile (must exist and be `active`; `confirmEmail` must equal its email, case-insensitive); rate-limit from `mfa_reset_log` (target >= 2 or caller >= 5 in 24h gives 429; a failed count query gives 500); **insert the log row**; revoke sessions (`rpc revoke_user_sessions`); replace the password with a random one (`auth.admin.updateUserById`); remove every factor; send the recovery email (`resetPasswordForEmail`, redirect `https://www.chikescreativespace.com/#/admin/accept-invite`); send the notification email through Resend when `RESEND_API_KEY` and `RESEND_FROM` exist (HTML-escaped actor name and time); respond `{ ok, removed, sessionsRevoked, recoverySent, notified }`. Any failure before the factor removal returns 500 (the attempt is already logged).
- [ ] **Step 2: Rescue script** performs the same steps without the interactive check: it prints what it would do and does nothing unless `--yes` is passed; logs the actor as `service_role_script`; revokes sessions, replaces the password, removes factors; tells the owner to use "Forgot your password?".
- [ ] **Step 3: UI.** "Reset 2FA" opens a **form** dialog with a required "How did you confirm it's really them?" select, a required "Type their email to confirm" field, and a warning that their password and sessions are also reset. Submit (`reset-admin-mfa-submit`) re-checks the typed email against the row's `data-email`, then invokes the function; the toast reports what happened, including a fallback line when `recoverySent` is false.
- [ ] **Step 4: Verify** with `node --check` on all three files and a mocked-client browser check: the dialog refuses a wrong email without calling the function; a correct submission calls it with exactly `{ targetId, confirmEmail, verifiedHow }`.
- [ ] **Step 5: Commit** (only when the owner asks).

## Task 9: approved real-account integration tests (written now, **not run**)

**Files:** create `test/helpers/totp.js`, `test/totp.test.js`, `test/integration/guard.js`, `test/integration/guard.test.js`, `test/integration/mfa.integration.test.js`.

- [ ] **Step 1: TOTP helper + RFC 6238 vectors** (`test/totp.test.js`: secret `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`; at 59s the 6-digit code is `287082`, at 1111111109s `081804`, at 1111111111s `050471`, at 1234567890s `005924`, at 2000000000s `279037`, at 20000000000s `353130`). Run; FAIL; implement; PASS.
- [ ] **Step 2: Guard** (`integrationConfig(env)`): disabled unless `MFA_IT=1`; needs `MFA_IT_SUPABASE_URL`, `MFA_IT_ANON_KEY`, `MFA_IT_SERVICE_ROLE_KEY`; **refuses** any URL containing `wdctkfhwygwwulipwnys`; requires `https://<ref>.supabase.co`. Unit-tested with fake env objects.
- [ ] **Step 3: Integration test** against the throwaway project, using raw REST (no new dependency), creating two disposable admins (A and B) through the admin API and generating their TOTP codes locally: **password-only denial** (A at `aal1`: `is_active_admin` false, `admin-invite` 403, `set_user_status` rejected); **verified access** (A at `aal2`: true, 400 from `admin-invite` for a bad email, `set_user_status` accepted); **authenticator replacement** (second factor enrolled and verified, old removed, `logout?scope=others` kills a second session's refresh token, sign-in now needs the new factor's code); **reset behaviour** (wrong confirmation email, missing `verifiedHow`, self-reset and an `aal1` caller are refused; a correct reset returns `ok`, then A's existing `aal2` token is denied immediately, A's refresh token and old password stop working, A has no factors, `mfa_reset_log` has the row, the third reset in a day returns 429); **rollback** (clearing `enforce_after` restores password-only access, setting it denies again). Cleanup always switches enforcement off and deletes both users and their log rows.
- [ ] **Step 4:** `npx vitest run` (the integration file is skipped without `MFA_IT=1`; the suite stays green). **Do not set `MFA_IT=1`** without the owner's approval and a throwaway project.

## Task 8 amendment (documentation and hand-off)

README rollout now follows spec section 4 (throwaway-project integration run, then live project with enforcement off, **recovery proven on a disposable admin**, enrollment window, then `mfa-enforce.sql`); add the enrollment windows, the invitation hardening note, the reset procedure, and how to run the integration tests. The final hand-off lists the owner's steps and states that nothing was deployed, run against a real project, or committed. After Task 9, run the **independent whole-branch review** (one fresh reviewer on the most capable model over the working-tree diff plus new files), fix what it finds, and report its findings and the fixes.

## Review follow-ups (applied after the independent whole-branch review)

The reviewer's findings were fixed in the working tree (still uncommitted). In summary:

- **README told the owner to re-run the whole `migration.sql` on the live project**, which overwrites `notify_edge_function()` and the cron job with unfilled placeholders. The live step is now `supabase/mfa-hardening.sql`; the deploy scripts gained `-ProjectRef` (default live) so the throwaway-project step can actually target the throwaway project.
- **`is_active_admin()`**: the session-exists check is now unconditional (revocation works before enforcement), and a token with no `session_id` claim is only accepted before enforcement.
- **`mfa-enforce.sql`** refuses while any active admin has no verified authenticator, and never moves the date later (re-running it can no longer switch enforcement off).
- **Reset**: the caller must be `aal2` always; limits and the audit record are one atomic database call (`begin_mfa_reset`, advisory locks, outcome tracking so a failed attempt can be retried); order is password, sessions, factors, then emails; partial failures say what was done; the rescue script matches and handles a `null` factor list.
- **Tests**: the SQL guard also catches schema-qualified and quoted writes and scans `mfa-hardening.sql`; the real SQL now runs in an in-memory Postgres (new dev-only dependency `@electric-sql/pglite`, `test/mfaSqlBehavior.test.js`); the integration test uses a genuine second `aal2` session, never reuses a TOTP code within a 30-second step, uses a fixed past enforcement date, cleans up user A if user B fails, creates the invitee without sending email, and covers pre-enforcement sign-out and pre-enforcement reset refusal.
- **Browser**: MFA state is swapped in atomically (no "set up" flash for an enrolled admin), `MFA_BUSY` can't stick, change-authenticator has an in-flight guard and no longer re-opens a closed dialog, the verify screen says what to do about a lost phone, and invitation acceptance now refuses an expired invitation before setting a password.
