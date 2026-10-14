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
