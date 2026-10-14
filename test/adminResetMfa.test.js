// The pure rules of the admin 2FA reset (supabase/functions/admin-reset-mfa):
// what a valid request looks like, who may be reset by whom, the rate
// limits, and the emails' escaping. The network and database steps around
// them need a real project, so they are covered by the (opt-in) integration
// tests in test/integration/ instead.
import { describe, it, expect } from "vitest";
import {
  parseResetRequest, emailsMatch, limitMessage, callerAal, escapeHtml, randomPassword,
  resetNotificationHtml, VERIFIED_HOW
} from "../supabase/functions/admin-reset-mfa/validate.ts";

const caller = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const good = { targetId: target, confirmEmail: "them@example.com", verifiedHow: "video_call" };

describe("parseResetRequest", () => {
  it("accepts a complete request and normalises the id", () => {
    const r = parseResetRequest({ ...good, targetId: target.toUpperCase() }, caller);
    expect(r).toEqual({ ok: true, targetId: target, confirmEmail: "them@example.com", verifiedHow: "video_call" });
  });
  it("accepts every allowed way of confirming identity", () => {
    for (const how of VERIFIED_HOW) expect(parseResetRequest({ ...good, verifiedHow: how }, caller).ok).toBe(true);
  });
  it("refuses a missing or unknown way of confirming identity", () => {
    for (const how of [undefined, "", "trust_me", "IN_PERSON", 5, null]) {
      const r = parseResetRequest({ ...good, verifiedHow: how }, caller);
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
    }
  });
  it("refuses a missing or blank confirmation email", () => {
    for (const e of [undefined, "", "   ", 7, null]) {
      expect(parseResetRequest({ ...good, confirmEmail: e }, caller).ok).toBe(false);
    }
  });
  it("refuses resetting yourself, in any letter case", () => {
    const r = parseResetRequest({ ...good, targetId: caller.toUpperCase() }, caller);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(/your own/);
  });
  it("refuses a malformed id and a malformed body", () => {
    expect(parseResetRequest({ ...good, targetId: "not-a-uuid" }, caller).ok).toBe(false);
    expect(parseResetRequest({ ...good, targetId: undefined }, caller).ok).toBe(false);
    for (const body of [null, undefined, "x", 5, []]) expect(parseResetRequest(body, caller).ok).toBe(false);
  });
});

describe("emailsMatch", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(emailsMatch(" Them@Example.com ", "them@example.com")).toBe(true);
  });
  it("rejects a different or empty address", () => {
    expect(emailsMatch("them@example.com", "other@example.com")).toBe(false);
    expect(emailsMatch("", "")).toBe(false);
    expect(emailsMatch("them@example.com", "them@example.com.evil.test")).toBe(false);
  });
});

describe("limitMessage", () => {
  it("explains each limit the database reports", () => {
    expect(limitMessage("target_limit")).toMatch(/twice/);
    expect(limitMessage("actor_limit")).toMatch(/5 times/);
  });
  it("never leaks an unknown code and still refuses", () => {
    expect(limitMessage("surprise")).toMatch(/limit/i);
    expect(limitMessage("surprise")).not.toMatch(/surprise/);
  });
});

describe("callerAal", () => {
  const jwt = (payload) => "Bearer h." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".s";
  it("reads the assurance level from a bearer token", () => {
    expect(callerAal(jwt({ aal: "aal2" }))).toBe("aal2");
    expect(callerAal(jwt({ aal: "aal1" }))).toBe("aal1");
  });
  it("returns null for anything it can't read, so a caller can never pass by sending junk", () => {
    for (const h of ["", "Bearer ", "Bearer x", "Bearer a.b", "Bearer a.%%%.c", jwt({}), jwt({ aal: 2 }), "Basic abc", null, undefined]) {
      expect(callerAal(h), String(h)).toBeNull();
    }
  });
});

describe("escapeHtml and the notification email", () => {
  it("escapes everything that could break out of the markup", () => {
    expect(escapeHtml(`<img src=x onerror="a()">&'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  });
  it("puts only escaped text in the email", () => {
    const html = resetNotificationHtml({ targetName: "<b>Tee</b>", actorName: `Mal"lory<script>`, whenIso: "2026-10-13T12:00:00.000Z" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Tee</b>");
    expect(html).toContain("&lt;b&gt;Tee&lt;/b&gt;");
    expect(html).toContain("2026-10-13");
    expect(html).toMatch(/Forgot your password/);
  });
  it("falls back to a neutral name rather than printing blanks", () => {
    expect(resetNotificationHtml({ targetName: "", actorName: "", whenIso: "2026-10-13T12:00:00.000Z" })).toMatch(/another admin/);
  });
});

describe("randomPassword", () => {
  it("is long, different every time, and satisfies common password rules", () => {
    const a = randomPassword(), b = randomPassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/\d/);
    expect(a).toMatch(/[^A-Za-z0-9]/);
  });
});
