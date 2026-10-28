// Runs the REAL `notify` Edge Function (supabase/functions/notify/index.ts) against an in-memory
// database and a stubbed Resend, to check what the welcome email contains. Every address is a
// made-up one on example.test; nothing is sent anywhere (fetch is replaced and only records it).
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resetTables } from "./helpers/fakeSupabase.js";

const ENV = {
  WEBHOOK_SECRET: "hook-secret",
  RESEND_API_KEY: "re_test",
  RESEND_FROM: "Test <no-reply@example.test>",
  SITE_URL: "https://site.example.test",
  SUPABASE_URL: "https://example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};
const BRAND = { postalAddress: "1 Test Street, Testville, TS 00000", email: "info@example.test", site: "www.example.test",
  youtube: "https://youtube.example.test/@x", facebook: "https://facebook.example.test/x", instagram: "https://instagram.example.test/x" };

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
  it("is NOT sent to an address that has not confirmed yet (a pending sign-up)", async () => {
    const res = await call({ table: "subscribers", record: { id: "sub-9", email: "stranger@example.test", status: "pending" } });
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe("none");
    expect(sent).toHaveLength(0);
  });

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

  it("starts the footer with the follow-us row: YouTube, Facebook and Instagram, with their pictures", async () => {
    await call(joined);
    const html = sent[0].html;
    expect(html).toContain("For the latest updates, follow us on");
    for (const [url, file, name] of [["https://youtube.example.test/@x", "social-youtube.png", "YouTube"], ["https://facebook.example.test/x", "social-facebook.png", "Facebook"], ["https://instagram.example.test/x", "social-instagram.png", "Instagram"]]) {
      expect(html).toContain('href="' + url + '"');
      expect(html).toContain("https://site.example.test/assets/brand/" + file);
      expect(html).toContain(">" + name + "</a>");
    }
    expect(html.indexOf("For the latest updates")).toBeLessThan(html.indexOf("Questions?"));
  });

  it("leaves out a social link that is not set, or is not an https address", async () => {
    resetTables({ meta: [{ id: "global", data: { brand: { ...BRAND, facebook: "", instagram: "javascript:alert(1)" } } }] });
    await call(joined);
    const html = sent[0].html;
    expect(html).toContain(">YouTube</a>");
    expect(html).not.toContain(">Facebook</a>");
    expect(html).not.toContain(">Instagram</a>");
    expect(html).not.toContain("javascript:");
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

describe("the newsletter button in index.html", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const button = html.split("function emailButton(")[1].split("\n}\n")[0];

  it("is the site's blue with white text, not yellow", () => {
    expect(button).toContain("background:#1273B0");
    expect(button).toContain("color:#FFFFFF");
    expect(button).not.toContain("#F2C230");
  });
});

describe("the newsletter background in index.html", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const shell = html.split("function emailShell(")[1].split("\n}\n")[0];

  it("fades from cool blue to cream, with a plain cream colour first for apps that ignore gradients", () => {
    expect(shell).toContain("linear-gradient(180deg,#E2EDEF 0%,#EEF4F3 26%,#FAF4E6 66%,#FDF8EC 100%)");
    const style = shell.split("background-image:linear-gradient")[0];
    expect(style.endsWith("background:#FAF4E6;")).toBe(true);                /* the solid colour comes first */
    expect(shell).toContain('bgcolor="#FAF4E6"');
  });
});

describe("the newsletter footer in index.html", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const shell = html.split("function emailShell(")[1].split("\n}\n")[0];

  it("starts with the follow-us row, built from the Brand settings links, at the top of the footer", () => {
    const follow = html.split("function emailFollowBlock(")[1].split("\n}\n")[0];
    expect(follow).toContain("For the latest updates, follow us on");
    for (const f of ["BRAND.youtube", "BRAND.facebook", "BRAND.instagram", "social-youtube.png", "social-facebook.png", "social-instagram.png"]) expect(follow).toContain(f);
    expect(follow).toContain('.filter(l => l[1])');                         /* a link that is not set is left out */
    expect(shell).toContain("+ emailFollowBlock()");
    expect(shell.indexOf("emailFollowBlock()")).toBeLessThan(shell.indexOf("BRAND.site"));
    for (const f of ["youtube", "facebook", "instagram"]) expect(existsSync(new URL("../assets/brand/social-" + f + ".png", import.meta.url))).toBe(true);
  });

  it("has the unsubscribe link and no Email preferences link", () => {
    expect(shell).toContain("__UNSUB_URL__");
    expect(shell).toContain("Unsubscribe");
    expect(shell).not.toMatch(/email preferences/i);
  });
});
