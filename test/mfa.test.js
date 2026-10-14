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
