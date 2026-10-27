// Runs the REAL `notify` Edge Function (supabase/functions/notify/index.ts) against an in-memory
// database and a stubbed Resend, to check what the welcome email contains. Every address is a
// made-up one on example.test; nothing is sent anywhere (fetch is replaced and only records it).
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resetTables } from "./helpers/fakeSupabase.js";

const ENV = {
  WEBHOOK_SECRET: "hook-secret",
  RESEND_API_KEY: "re_test",
  RESEND_FROM: "Test <no-reply@example.test>",
  SITE_URL: "https://site.example.test",
  SUPABASE_URL: "https://example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};
const BRAND = { postalAddress: "1 Test Street, Testville, TS 00000", email: "info@example.test", site: "www.example.test" };

let handler;
let sent;

const call = (body, secret = ENV.WEBHOOK_SECRET) =>
  handler(new Request("https://fn.example.test/notify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify(body),
  }));
const joined = { table: "subscribers", record: { id: "sub-1", email: "kid@example.test", status: "published" } };

beforeAll(async () => {
  globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };
  await import("../supabase/functions/notify/index.ts");
  expect(typeof handler).toBe("function");
});

beforeEach(() => {
  resetTables({ meta: [{ id: "global", data: { brand: BRAND } }] });
  sent = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, text: async () => "" };
  });
});

describe("the welcome email", () => {
  it("is sent to the new subscriber with the same footer as a newsletter", async () => {
    const res = await call(joined);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    const mail = sent[0];
    expect(mail.to).toBe("kid@example.test");
    expect(mail.subject).toBe("Welcome to Chike's Creative Space");
    expect(mail.html).toContain("Thanks for joining the list!");
    expect(mail.html).toContain("If this wasn't you, you can ignore this email");
    /* the footer: website, contact, postal address, why they got it, archive, unsubscribe */
    expect(mail.html).toContain(">www.example.test</a>");
    expect(mail.html).toContain('href="mailto:info@example.test"');
    expect(mail.html).toContain("1 Test Street, Testville, TS 00000");
    expect(mail.html).toContain("receiving this because you signed up for Chike’s Creative Space updates");
    expect(mail.html).toContain('href="https://site.example.test/newsletter"');
    expect(mail.html).toContain('href="https://site.example.test/#/unsubscribe/sub-1"');
  });

  it("has no Email preferences link", async () => {
    await call(joined);
    expect(sent[0].html).not.toMatch(/email preferences/i);
  });

  it("puts the footer after the message, and the unsubscribe link last", async () => {
    await call(joined);
    const html = sent[0].html;
    expect(html.indexOf("If this wasn't you")).toBeLessThan(html.indexOf("Questions?"));
    expect(html.indexOf("Newsletter archive")).toBeLessThan(html.indexOf("Unsubscribe"));
    expect(html.lastIndexOf("Unsubscribe")).toBeGreaterThan(html.lastIndexOf("Newsletter archive"));
  });

  it("escapes anything it takes from the brand settings or the subscriber's record", async () => {
    resetTables({ meta: [{ id: "global", data: { brand: { ...BRAND, postalAddress: "<script>x</script> 9 Road", email: 'a"b@example.test' } } }] });
    await call({ table: "subscribers", record: { id: 'sub-"<x>', email: "kid@example.test" } });
    const html = sent[0].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt; 9 Road");
    expect(html).toContain("/#/unsubscribe/sub-%22%3Cx%3E");
  });

  it("still goes out, with the default contact details and no address line, if no address is on file", async () => {
    resetTables({ meta: [] });
    const res = await call(joined);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("info@chikescreativespace.com");
    expect(sent[0].html).toContain("Unsubscribe");
    expect(sent[0].html).not.toContain("Test Street");
  });

  it("is only ever sent for a call that carries the webhook secret", async () => {
    const res = await call(joined, "wrong");
    expect(res.status).toBe(401);
    expect(sent).toHaveLength(0);
  });
});

describe("the newsletter footer in index.html", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const shell = html.split("function emailShell(")[1].split("\n}\n")[0];

  it("has the unsubscribe link and no Email preferences link", () => {
    expect(shell).toContain("__UNSUB_URL__");
    expect(shell).toContain("Unsubscribe");
    expect(shell).not.toMatch(/email preferences/i);
  });
});
