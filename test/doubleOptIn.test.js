// Joining the mailing list is double opt-in: typing an address into a form does not subscribe it. The portal
// function saves it as "pending" and emails a confirm link, and only opening that link subscribes it. So nobody can
// sign someone else up. The server rules are tested in portalFunction.test.js and notify.test.js; this pins the
// page's side of it and the database rules that stop the forms being bypassed.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/double-opt-in.sql", import.meta.url), "utf8");
const portal = readFileSync(new URL("../supabase/functions/portal/index.ts", import.meta.url), "utf8");
const notify = readFileSync(new URL("../supabase/functions/notify/index.ts", import.meta.url), "utf8");
const handler = html.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];

describe("the mailing-list forms on the page", () => {
  it("ask the portal function to start a sign-up, and never save the address themselves", () => {
    expect(handler).toContain('portalCall("request"');
    expect(handler).toContain("join: true");
    expect(handler).toContain("consent: true");
    expect(handler).not.toContain('db.add("subscribers"');
    expect(handler).not.toMatch(/status\s*:\s*["']published["']/);
  });

  it("tell the person to check their email, not that they are already in", () => {
    expect(handler).toContain("newsletterCheckEmailHTML(email)");
    const modal = html.split("function newsletterCheckEmailHTML(")[1].split("\n}\n")[0];
    expect(modal).toContain("Check your email");
    expect(modal).toContain("Tap it to finish joining");
    expect(modal).toContain("nobody is added until the link is used");
    expect(modal).toContain("E(email)");                              // the address is escaped
    expect(html).not.toContain("function newsletterThankYouHTML(");
    expect(html).not.toContain("Thank you for joining us");
  });

  it("show a plain message if the sign-up could not be started, and keep the existing checks", () => {
    expect(handler).toContain("JOIN_ERRORS[sent && sent.error]");
    for (const k of ["invalid_email", "rate_limited", "send_failed"]) expect(html).toContain(k + ":");
    expect(handler).toContain("isFakeEmail(email)");
    expect(handler).toContain("newsletterGate(form)");                // the hidden honeypot field
  });
});

describe("the portal function", () => {
  it("handles join sign-ups: pending first, a longer link, and silence for someone already subscribed", () => {
    expect(portal).toContain("body.join === true");
    expect(portal).toContain("if (join && found.state === \"active\") return json({ ok: true, status: \"consent_sent\" });");
    expect(portal).toContain("JOIN_CONFIRM_MINUTES");
    expect(portal).toContain('status: "pending"');
  });
  it("is the only thing that welcomes a new address, and only once it is confirmed", () => {
    expect(notify).toContain('String(record.status ?? "") === "pending"');
  });
});

describe("the database rules (supabase/double-opt-in.sql)", () => {
  it("take away the public's way of adding a subscriber directly", () => {
    expect(sql).toContain('drop policy if exists "public insert" on subscribers;');
    expect(sql).toContain("revoke insert on subscribers from anon;");
  });
  it("send the welcome email when an address is confirmed", () => {
    expect(sql).toContain("trg_notify_confirmed_subscriber");
    expect(sql).toContain("old.data->>'status' is distinct from 'published' and new.data->>'status' = 'published'");
    expect(sql).toContain("execute function notify_edge_function()");
  });
  it("forget an address that is never confirmed, after 14 days", () => {
    expect(sql).toContain("data->>'status' = 'pending' and created_at < now() - interval '14 days'");
  });
});
