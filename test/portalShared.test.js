// The rules in supabase/functions/_shared/portal.ts: emails, the signed key inside a newsletter,
// where a verification link may lead, who counts as a subscriber, and what a member may see.
import { describe, it, expect } from "vitest";
import {
  isValidEmail, normalizeEmail, signAccessKey, readAccessKey, personalizePortalLinks, safeReturnPath,
  lookupSubscriber, isLive, toIndexItem, toMemberEntry, sortNewestFirst, overLimit, sha256Hex, randomToken,
  b64url, fromB64url, ACCESS_KEY_MARK,
} from "../supabase/functions/_shared/portal.ts";

const SECRET = "a-long-test-secret-for-signing-keys-0123456789";

describe("email", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeEmail("  Jo@Example.TEST ")).toBe("jo@example.test");
    expect(normalizeEmail(null)).toBe("");
  });
  it("accepts ordinary addresses and rejects the rest", () => {
    for (const ok of ["a@b.co", "first.last+tag@sub.example.test", "X@Y.ORG"]) expect(isValidEmail(ok)).toBe(true);
    for (const bad of ["", "a", "a@b", "a@b.c", "a b@c.test", "a@b@c.test", "<a>@b.test", "a@b.test,c@d.test", "a".repeat(250) + "@b.test", undefined]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe("encoding and hashing", () => {
  it("round-trips base64url without padding or unsafe characters", () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255, 62, 63]);
    const s = b64url(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect([...fromB64url(s)]).toEqual([...bytes]);
  });
  it("hashes the way SHA-256 should", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("makes long, different random tokens", () => {
    const a = randomToken(), b = randomToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
});

describe("the key inside a newsletter", () => {
  const now = Date.UTC(2026, 9, 26, 12);
  it("names the subscriber and works until it expires", async () => {
    const key = await signAccessKey(SECRET, "sub-123-abc", now + 1000);
    expect(await readAccessKey(SECRET, key, now)).toEqual({ ok: true, subscriberId: "sub-123-abc" });
    expect(await readAccessKey(SECRET, key, now + 1000)).toEqual({ ok: false, reason: "expired" });
  });
  it("can be put in a link without escaping trouble", async () => {
    const key = await signAccessKey(SECRET, "sub-1", now + 1000);
    expect(key).toMatch(/^[A-Za-z0-9_.-]+$/);
  });
  it("is useless if changed, forged, signed with another secret, or empty", async () => {
    const key = await signAccessKey(SECRET, "sub-1", now + 1000);
    const [payload, sig] = key.split(".");
    const other = b64url(new TextEncoder().encode("sub-2|" + (now + 1000)));
    expect((await readAccessKey(SECRET, other + "." + sig, now)).ok).toBe(false);
    expect((await readAccessKey(SECRET, payload + ".AAAA" + sig.slice(4), now)).ok).toBe(false);
    expect((await readAccessKey("different-secret-of-some-length-xyz", key, now)).ok).toBe(false);
    for (const junk of ["", ".", "abc", "a.b", null, undefined, "x".repeat(700)]) expect((await readAccessKey(SECRET, junk, now)).ok).toBe(false);
    expect((await readAccessKey("", key, now)).ok).toBe(false);
  });
});

describe("portal links in a newsletter", () => {
  const html = `<a href="https://s.test/newsletter/x?k=${ACCESS_KEY_MARK}">Read</a> <a href="https://s.test/newsletter?k=${ACCESS_KEY_MARK}">Archive</a>`;
  it("gets each recipient's own key", () => {
    const out = personalizePortalLinks(html, "AAA.BBB");
    expect(out).toContain("x?k=AAA.BBB");
    expect(out).not.toContain(ACCESS_KEY_MARK);
  });
  it("is left as a plain link when there is no key (test sends, or no secret set)", () => {
    const out = personalizePortalLinks(html + `<a href="https://s.test/a?z=1&amp;k=${ACCESS_KEY_MARK}">E</a>`, null);
    expect(out).toContain('href="https://s.test/newsletter/x"');
    expect(out).toContain('href="https://s.test/newsletter"');
    expect(out).toContain('href="https://s.test/a?z=1"');
    expect(out).not.toContain(ACCESS_KEY_MARK);
  });
});

describe("where a verification link may lead", () => {
  it("allows the portal and its entries", () => {
    expect(safeReturnPath("/newsletter")).toBe("/newsletter");
    expect(safeReturnPath("/newsletter/spring-update-2")).toBe("/newsletter/spring-update-2");
  });
  it("sends anything else to the portal index", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/admin", "/newsletter/../admin", "/newsletter/a/b", "javascript:alert(1)", "", null, "/newsletter?x=1", "/newsletter/-x"]) {
      expect(safeReturnPath(bad)).toBe("/newsletter");
    }
  });
});

describe("who is a subscriber", () => {
  const rows = [
    { id: "1", data: { email: "A@x.test", status: "unsubscribed" } },
    { id: "2", data: { email: "a@x.test", status: "published" } },
    { id: "3", data: { email: "p@x.test", status: "pending" } },
  ];
  it("lets an active row win over a duplicate", () => expect(lookupSubscriber(rows, "a@X.test")).toEqual({ state: "active", id: "2" }));
  it("treats pending and unsubscribed as not subscribed", () => {
    expect(lookupSubscriber(rows, "p@x.test")).toEqual({ state: "inactive", id: "3" });
    expect(lookupSubscriber([rows[0]], "a@x.test")).toEqual({ state: "inactive", id: "1" });
  });
  it("knows a stranger", () => expect(lookupSubscriber(rows, "z@x.test")).toEqual({ state: "none" }));
});

describe("what a member may see", () => {
  const now = Date.UTC(2026, 9, 26);
  it("is only published entries whose date has come", () => {
    expect(isLive({ status: "published", publishedAt: "2026-10-01" }, now)).toBe(true);
    expect(isLive({ status: "published", publishedAt: "2026-10-26" }, now)).toBe(true);
    expect(isLive({ status: "published", publishedAt: "2026-10-27" }, now)).toBe(false);
    expect(isLive({ status: "draft", publishedAt: "2026-01-01" }, now)).toBe(false);
    expect(isLive({ status: "archived", publishedAt: "2026-01-01" }, now)).toBe(false);
    expect(isLive(undefined, now)).toBe(false);
  });
  it("shows the index as cards and the entry without the team's notes", () => {
    const e = { id: "1", slug: "s", title: "T", description: "D", category: "C", layout: "article", publishedAt: "2026-01-01", body: "<p>x</p>", adminNote: "n", videoUrl: "u" };
    expect(toIndexItem(e)).toEqual({ id: "1", slug: "s", title: "T", description: "D", category: "C", layout: "article", publishedAt: "2026-01-01", cover: undefined });
    const full = toMemberEntry(e);
    expect(full.body).toBe("<p>x</p>");
    expect(full.adminNote).toBeUndefined();
    const withEmail = toMemberEntry({ ...e, email: { on: true, subject: "s" }, emailId: "news-1" });
    expect(withEmail.email).toBeUndefined();     // the team's email plans are not for members
    expect(withEmail.emailId).toBeUndefined();
  });
  it("lists newest first", () => {
    expect(sortNewestFirst([{ publishedAt: "2026-01-01" }, { publishedAt: "2026-03-01" }, { publishedAt: "2026-02-01" }]).map((e) => e.publishedAt))
      .toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
  });
});

describe("request limits", () => {
  it("cuts off at 5 per address or 20 per visitor in an hour", () => {
    expect(overLimit(4, 19)).toBe(false);
    expect(overLimit(5, 0)).toBe(true);
    expect(overLimit(0, 20)).toBe(true);
  });
});
