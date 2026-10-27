// Runs the REAL `portal` Edge Function (supabase/functions/portal/index.ts) against an
// in-memory database and a stubbed Resend, to check what it DOES: who gets in, who does
// not, and that nothing exclusive is ever returned before a verified session.
//
// Every address below is a made-up one on example.test; no real subscriber's email is
// used, and no email is sent anywhere (fetch is replaced and only records the message).
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { tables, resetTables } from "./helpers/fakeSupabase.js";
import { signAccessKey } from "../supabase/functions/_shared/portal.ts";

const ENV = {
  PORTAL_LINK_SECRET: "test-secret-".repeat(5),
  SUPABASE_URL: "https://example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  RESEND_API_KEY: "re_test",
  RESEND_FROM: "Test <no-reply@example.test>",
  SITE_URL: "https://site.example.test",
};
const MEMBER = "member@example.test";
const GONE = "gone@example.test";
const NEWBIE = "newbie@example.test";
const NOW = new Date("2026-10-26T12:00:00Z");

let handler;
let mail;

const seed = () => ({
  subscribers: [
    { id: "sub-a", data: { id: "sub-a", email: MEMBER, status: "published" } },
    { id: "sub-b", data: { id: "sub-b", email: GONE, status: "unsubscribed" } },
  ],
  portal_entries: [
    { id: "e1", data: { id: "e1", slug: "older", title: "Older story", description: "d", category: "Stories", layout: "article", publishedAt: "2026-09-01", status: "published", body: "<p>Secret older</p>", adminNote: "team only" } },
    { id: "e2", data: { id: "e2", slug: "newer", title: "Newer video", description: "d", category: "Videos", layout: "video", publishedAt: "2026-10-01", status: "published", videoUrl: "https://youtu.be/abcdefghijk" } },
    { id: "e3", data: { id: "e3", slug: "draft-one", title: "Unfinished", description: "d", category: "Stories", layout: "article", publishedAt: "2026-10-02", status: "draft", body: "nope" } },
    { id: "e4", data: { id: "e4", slug: "later", title: "Not yet", description: "d", category: "Stories", layout: "article", publishedAt: "2027-01-01", status: "published", body: "nope" } },
  ],
  portal_tokens: [],
  portal_sessions: [],
  portal_game_files: [
    { id: "g1", data: { html: "<!doctype html><title>Secret game</title>" } },
  ],
});

async function call(body, headers) {
  const res = await handler(new Request("https://fn.example.test/portal", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  }));
  return { status: res.status, ...(await res.json()) };
}
const lastToken = () => {
  const html = mail[mail.length - 1].html;
  return decodeURIComponent(html.match(/\?v=([^"&<\s]+)/)[1]);
};
const subscriber = (id) => tables.subscribers.find((r) => r.id === id).data;
async function signIn(email = MEMBER) {
  await call({ action: "request", email });
  const r = await call({ action: "verify", token: lastToken() });
  return r.session;
}

beforeAll(async () => {
  globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };
  await import("../supabase/functions/portal/index.ts");
  expect(typeof handler).toBe("function");
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetTables(seed());
  mail = [];
  ENV.PORTAL_LINK_SECRET = "test-secret-".repeat(5);
  globalThis.fetch = vi.fn(async (url, init) => {
    mail.push({ url: String(url), ...JSON.parse(init.body) });
    return { ok: true, text: async () => "" };
  });
});

describe("asking for a link", () => {
  it("rejects a bad email without sending anything", async () => {
    for (const bad of ["", "nope", "a@b", "a b@c.test", null]) {
      expect(await call({ action: "request", email: bad })).toMatchObject({ ok: false, error: "invalid_email" });
    }
    expect(mail).toHaveLength(0);
  });

  it("emails a subscriber a one-time link, storing only a hash of it and of their address", async () => {
    const r = await call({ action: "request", email: "  Member@Example.TEST " });
    expect(r).toMatchObject({ ok: true, status: "sent" });
    expect(mail).toHaveLength(1);
    expect(mail[0].url).toBe("https://api.resend.com/emails");
    expect(mail[0].to).toBe(MEMBER);
    const token = lastToken();
    expect(mail[0].html).toContain("https://site.example.test/newsletter?v=");
    const row = tables.portal_tokens[0];
    expect(row.purpose).toBe("login");
    expect(row.token_hash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain("example.test");
  });

  it("asks someone who is not on the list for consent first, and sends nothing yet", async () => {
    const r = await call({ action: "request", email: NEWBIE });
    expect(r).toMatchObject({ ok: true, status: "needs_consent" });
    expect(mail).toHaveLength(0);
    expect(tables.subscribers).toHaveLength(2);
  });

  it("adds a consenting newcomer as pending - not subscribed until they confirm", async () => {
    const r = await call({ action: "request", email: NEWBIE, consent: true });
    expect(r).toMatchObject({ ok: true, status: "consent_sent" });
    const added = tables.subscribers.find((s) => s.data.email === NEWBIE);
    expect(added.data).toMatchObject({ status: "pending", source: "newsletter-portal" });
    expect(added.data.consentAt).toBeTruthy();
    expect(tables.portal_tokens[0].purpose).toBe("subscribe");
    expect(mail[0].subject).toMatch(/confirm/i);

    const v = await call({ action: "verify", token: lastToken() });
    expect(v).toMatchObject({ ok: true, purpose: "subscribe", email: NEWBIE });
    expect(subscriber(added.id)).toMatchObject({ status: "published" });
    expect(subscriber(added.id).verifiedAt).toBeTruthy();
  });

  it("treats a returning, unsubscribed address like a newcomer: consent, then confirmation", async () => {
    expect(await call({ action: "request", email: GONE })).toMatchObject({ status: "needs_consent" });
    expect(await call({ action: "request", email: GONE, consent: true })).toMatchObject({ status: "consent_sent" });
    expect(subscriber("sub-b").status).toBe("pending");
    await call({ action: "verify", token: lastToken() });
    expect(subscriber("sub-b").status).toBe("published");
    expect(tables.subscribers).toHaveLength(2);
  });

  it("only ever sends the link back to the portal's own pages", async () => {
    await call({ action: "request", email: MEMBER, next: "https://evil.example/steal" });
    expect(mail[0].html).toContain("https://site.example.test/newsletter?v=");
    await call({ action: "request", email: MEMBER, next: "/newsletter/newer" });
    expect(mail[1].html).toContain("https://site.example.test/newsletter/newer?v=");
    await call({ action: "request", email: MEMBER, next: "//evil.example" });
    expect(mail[2].html).toContain("https://site.example.test/newsletter?v=");
  });

  it("slows down repeated requests for one address", async () => {
    for (let i = 0; i < 5; i++) expect((await call({ action: "request", email: MEMBER })).ok).toBe(true);
    expect(await call({ action: "request", email: MEMBER })).toMatchObject({ ok: false, error: "rate_limited" });
    expect(mail).toHaveLength(5);
    vi.setSystemTime(new Date(NOW.getTime() + 61 * 60_000));
    expect((await call({ action: "request", email: MEMBER })).ok).toBe(true);
  });

  it("reports a failed send instead of pretending", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, text: async () => "boom" }));
    expect(await call({ action: "request", email: MEMBER })).toMatchObject({ ok: false, error: "send_failed" });
  });
});

describe("using the emailed link", () => {
  it("works once and starts a session", async () => {
    await call({ action: "request", email: MEMBER });
    const token = lastToken();
    const first = await call({ action: "verify", token });
    expect(first).toMatchObject({ ok: true, purpose: "login", email: MEMBER, next: "/newsletter" });
    expect(first.session.length).toBeGreaterThan(30);
    expect(JSON.stringify(tables.portal_sessions)).not.toContain(first.session);
    expect(await call({ action: "verify", token })).toMatchObject({ ok: false, error: "used" });
  });

  it("lets only one of two simultaneous tries through", async () => {
    await call({ action: "request", email: MEMBER });
    const token = lastToken();
    const [a, b] = await Promise.all([call({ action: "verify", token }), call({ action: "verify", token })]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });

  it("expires after 30 minutes", async () => {
    await call({ action: "request", email: MEMBER });
    const token = lastToken();
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60_000));
    expect(await call({ action: "verify", token })).toMatchObject({ ok: false, error: "expired" });
  });

  it("rejects a made-up or mangled link", async () => {
    expect(await call({ action: "verify", token: "x".repeat(43) })).toMatchObject({ ok: false, error: "invalid" });
    expect(await call({ action: "verify", token: "short" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await call({ action: "verify" })).toMatchObject({ ok: false, error: "invalid" });
  });

  it("does not let someone who unsubscribed in the meantime in", async () => {
    await call({ action: "request", email: MEMBER });
    subscriber("sub-a").status = "unsubscribed";
    expect(await call({ action: "verify", token: lastToken() })).toMatchObject({ ok: false, error: "not_subscribed" });
  });
});

describe("the private key inside a newsletter", () => {
  const key = (id, ms) => signAccessKey(ENV.PORTAL_LINK_SECRET, id, ms);

  it("opens a session for the subscriber it was made for", async () => {
    const r = await call({ action: "exchange", key: await key("sub-a", NOW.getTime() + 86_400_000) });
    expect(r).toMatchObject({ ok: true, email: MEMBER });
    expect((await call({ action: "list", session: r.session })).ok).toBe(true);
  });

  it("refuses a forged, tampered, expired or unsubscribed key", async () => {
    const good = await key("sub-a", NOW.getTime() + 86_400_000);
    expect(await call({ action: "exchange", key: good.slice(0, -3) + "AAA" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await call({ action: "exchange", key: "nonsense" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await call({ action: "exchange", key: await signAccessKey("another-secret-".repeat(4), "sub-a", NOW.getTime() + 1e9) })).toMatchObject({ ok: false, error: "invalid" });
    expect(await call({ action: "exchange", key: await key("sub-a", NOW.getTime() - 1000) })).toMatchObject({ ok: false, error: "expired" });
    expect(await call({ action: "exchange", key: await key("sub-b", NOW.getTime() + 1e9) })).toMatchObject({ ok: false, error: "not_subscribed" });
    expect(await call({ action: "exchange", key: await key("nobody", NOW.getTime() + 1e9) })).toMatchObject({ ok: false, error: "not_subscribed" });
  });
});

describe("the exclusive content", () => {
  it("is never returned without a verified session", async () => {
    for (const session of [undefined, "", "garbage", "x".repeat(43)]) {
      for (const body of [{ action: "list", session }, { action: "entry", session, slug: "older" }]) {
        const r = await call(body);
        expect(r).toMatchObject({ ok: false, error: "no_session" });
        expect(JSON.stringify(r)).not.toMatch(/Secret older|Older story|Newer video/);
      }
    }
  });

  it("gives a verified subscriber the published entries that are live, newest first", async () => {
    const session = await signIn();
    const r = await call({ action: "list", session });
    expect(r.entries.map((e) => e.slug)).toEqual(["newer", "older"]);
    const card = ["category", "cover", "description", "id", "layout", "publishedAt", "slug", "title"];
    for (const e of r.entries) expect(Object.keys(e).every((k) => card.includes(k))).toBe(true);   // the index carries cards, not bodies
    expect(JSON.stringify(r)).not.toMatch(/Unfinished|Not yet|Secret older|youtu\.be/);
  });

  it("serves one entry in full without the team's notes, and nothing unpublished or scheduled", async () => {
    const session = await signIn();
    const ok = await call({ action: "entry", session, slug: "older" });
    expect(ok.entry.body).toContain("Secret older");
    expect(ok.entry.adminNote).toBeUndefined();
    expect((await call({ action: "entry", session, slug: "e1" })).ok).toBe(true);
    for (const slug of ["draft-one", "later", "missing"]) {
      expect(await call({ action: "entry", session, slug })).toMatchObject({ ok: false, error: "not_found" });
    }
  });

  it("takes access away at once when someone unsubscribes, and when they sign out", async () => {
    const session = await signIn();
    expect((await call({ action: "session", session })).ok).toBe(true);
    subscriber("sub-a").status = "unsubscribed";
    expect(await call({ action: "list", session })).toMatchObject({ ok: false, error: "no_session" });
    subscriber("sub-a").status = "published";
    expect((await call({ action: "list", session })).ok).toBe(true);
    await call({ action: "signout", session });
    expect(await call({ action: "list", session })).toMatchObject({ ok: false, error: "no_session" });
  });

  it("ends a session after 30 days", async () => {
    const session = await signIn();
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 86_400_000));
    expect(await call({ action: "list", session })).toMatchObject({ ok: false, error: "no_session" });
  });
});

describe("the function itself", () => {
  it("refuses to run with no signing secret", async () => {
    ENV.PORTAL_LINK_SECRET = "";
    const r = await call({ action: "request", email: MEMBER });
    expect(r.status).toBe(500);
    expect(mail).toHaveLength(0);
  });

  it("rejects an unknown action and a non-JSON body", async () => {
    expect((await call({ action: "dance" })).status).toBe(400);
    const res = await handler(new Request("https://fn.example.test/portal", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
    expect((await handler(new Request("https://fn.example.test/portal", { method: "GET" }))).status).toBe(405);
  });

  it("only ever talks to Resend", async () => {
    await call({ action: "request", email: MEMBER });
    await call({ action: "request", email: NEWBIE, consent: true });
    expect(mail.every((m) => m.url === "https://api.resend.com/emails")).toBe(true);
  });
});

describe("a members-only game", () => {
  const withGame = () => tables.portal_entries.push(
    { id: "e5", data: { id: "e5", slug: "the-game", title: "The game", description: "d", category: "New games", layout: "game", publishedAt: "2026-10-03", status: "published", privateGameId: "g1", gameMode: "launch" } },
    { id: "e6", data: { id: "e6", slug: "unpublished-game", title: "Hidden game", description: "d", category: "New games", layout: "game", publishedAt: "2026-10-04", status: "draft", privateGameId: "g1" } });

  it("hands its code only to a verified subscriber, with the entry that uses it", async () => {
    withGame();
    const session = await signIn();
    const r = await call({ action: "entry", session, slug: "the-game" });
    expect(r.entry.gameHtml).toContain("Secret game");
    expect(r.entry.title).toBe("The game");
  });

  it("never sends the code to anyone without a session, in the list, or for an unpublished entry", async () => {
    withGame();
    for (const session of [undefined, "", "garbage"]) {
      expect(JSON.stringify(await call({ action: "entry", session, slug: "the-game" }))).not.toContain("Secret game");
    }
    const session = await signIn();
    expect(JSON.stringify(await call({ action: "list", session }))).not.toContain("Secret game");
    expect(JSON.stringify(await call({ action: "entry", session, slug: "unpublished-game" }))).not.toContain("Secret game");
    expect(await call({ action: "entry", session, slug: "unpublished-game" })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("still serves the entry, without a game, when its code has gone missing", async () => {
    withGame();
    tables.portal_game_files.length = 0;
    const session = await signIn();
    const r = await call({ action: "entry", session, slug: "the-game" });
    expect(r.ok).toBe(true);
    expect(r.entry.gameHtml).toBeUndefined();
  });

  it("reads the code only after the session has been checked", () => {
    const src = readFileSync(new URL("../supabase/functions/portal/index.ts", import.meta.url), "utf8");
    expect(src.match(/from\("portal_game_files"\)/g)).toHaveLength(1);
    expect(src.indexOf('from("portal_game_files")')).toBeGreaterThan(src.indexOf("sessionSubscriber(body.session)"));
  });
});

describe("the newsletter senders", () => {
  const read = (f) => readFileSync(new URL("../supabase/functions/" + f + "/index.ts", import.meta.url), "utf8");

  it("give every recipient their own key, and send test emails without one", () => {
    for (const f of ["send-newsletter", "send-scheduled-newsletters"]) {
      const src = read(f);
      expect(src).toContain('from "../_shared/portal.ts"');
      expect(src).toContain("signAccessKey(portalSecret, r.id, keyExpires)");
      expect(src).toContain("personalizePortalLinks(");
    }
    expect(read("send-newsletter")).toContain("personalizePortalLinks(html.split(\"__UNSUB_URL__\").join(siteOrigin), null)");
  });

  it("never builds the emailed sign-in link from a request header", () => {
    const src = read("portal");
    expect(src).not.toMatch(/headers\.get\(["']origin["']\)/i);
    expect(src).toContain('Deno.env.get("SITE_URL") || "https://www.chikescreativespace.com"');
  });

  it("only read the archive after a session has been checked", () => {
    const src = read("portal");
    const content = src.slice(src.indexOf('if (action === "list" || action === "entry")'));
    expect(content.indexOf("sessionSubscriber(body.session)")).toBeGreaterThan(-1);
    expect(content.indexOf("sessionSubscriber(body.session)")).toBeLessThan(content.indexOf('from("portal_entries")'));
    expect(src.match(/from\("portal_entries"\)/g)).toHaveLength(1);
  });
});
