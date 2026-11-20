// The newsletter page's "Who gets it" choice (owner, 2026-11-20: "give me the option to only send to new followers or
// people who hasn't received this message"): everyone, only people who haven't received this newsletter, or only new
// subscribers who joined after a date. The send functions make the same choice on the server; this page counts it, asks
// the server first (a count-only check that cannot send), and records nothing itself. Made-up subscribers only.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => index.split("function " + name + "(")[1].split("\nfunction ")[0];
const sql = readFileSync(new URL("../supabase/newsletter-sends.sql", import.meta.url), "utf8");

describe("counting who gets it on the page", () => {
  const pick = new Function("return function nlAudiencePick(" + fn("nlAudiencePick"))();
  const subs = [
    { id: "s1", email: "a@example.test", status: "published", at: "2026-09-05T10:00:00.000Z" },
    { id: "s2", email: "b@example.test", status: "published", at: "2026-11-18T09:00:00.000Z" },
    { id: "s3", email: "c@example.test", status: "published", at: "2026-11-19T09:00:00.000Z" },
    { id: "s4", email: "d@example.test", status: "pending", at: "2026-11-19T10:00:00.000Z" },
    { id: "s6", email: "f@example.test", status: "published" },
  ];
  const ids = (l) => l.map(s => s.id);
  it("everyone confirmed", () => expect(ids(pick(subs, "all"))).toEqual(["s1", "s2", "s3", "s6"]));
  it("people this newsletter has not reached, once the page knows who it reached", () => {
    expect(ids(pick(subs, "unsent", new Set(["s1", "s2"])))).toEqual(["s3", "s6"]);
    expect(pick(subs, "unsent", undefined)).toBe(null);   /* still finding out */
  });
  it("people who joined after the date, and nobody when the date is missing", () => {
    expect(ids(pick(subs, "new", null, "2026-11-18T14:33:09.163Z"))).toEqual(["s3"]);
    expect(pick(subs, "new", null, "")).toEqual([]);
    expect(pick(subs, "who knows")).toEqual([]);
  });
});

describe("the choice on the newsletter page", () => {
  const page = fn("adminNewsletterCompose");
  it("offers everyone and new subscribers, and 'haven't received this' only once the newsletter has gone out", () => {
    expect(page).toContain("Who gets it");
    expect(page).toContain('audOpt("all", "Everyone on the list")');
    expect(page).toContain('audOpt("unsent", "Only people who haven’t received this newsletter")');
    expect(page).toContain("Only people who haven’t received this newsletter");
    expect(page).toContain("Only new subscribers who joined after");
    expect(page).toContain("(sentBefore ? ");
  });
  it("starts on 'haven't received this' for a newsletter that already went out, so it never resends to everyone by default", () => {
    expect(page).toContain('nc.audience = rec.status === "scheduled" && rec.audience ? rec.audience : rec.status === "sent" ? "unsent" : "all";');
  });
  it("starts the new-subscriber date at when the last newsletter went out", () => {
    expect(page).toContain("nc.audienceSince = (rec && rec.audienceSince) || nlLastSentAt();");
  });
  it("the send button counts only the chosen people", () => {
    expect(page).toContain("' Send to ' + nlCountLabel(chosen)");
  });
});

describe("sending to the chosen people", () => {
  const send = fn("nlSendNow");
  it("asks the server to count first, without a message, so an out-of-date server function could never send", () => {
    expect(send).toContain('body: { dryRun: true, audience: who.audience, newsletterId: nc.editingId || "", since: who.since }');
    expect(send).toContain("if (!(dry.data && dry.data.dryRun === true))");
    expect(send.indexOf("dryRun: true")).toBeLessThan(send.indexOf("confirmSendNewsletter("));
  });
  it("saves a new newsletter first, so the server can record who it reached", () => {
    expect(send).toContain('const rec = await db.add("newsletters", Object.assign({ templateId: nc.templateId, body: html, status: "draft" }, f), true);');
    expect(send).toContain("body: { subject: f.subject, html: html, audience: who.audience, newsletterId: nc.editingId, since: who.since }");
  });
  it("'Sent to N' counts everyone the newsletter has reached across its sends", () => {
    expect(send).toContain("sentCount: (res.data && typeof res.data.reached === \"number\") ? res.data.reached : sent, lastSentCount: sent");
  });
  it("the confirm box says who it goes to", () => {
    expect(fn("confirmSendNewsletter")).toContain("'<span>This sends real email to ' + E(whoText) + ' right now.");
  });
  it("a scheduled newsletter keeps the choice", () => {
    expect(fn("nlSchedule")).toContain('audience: who.audience, audienceSince: who.audience === "new" ? who.since : ""');
  });
});

describe("the record of who each newsletter reached", () => {
  it("is a table only admins can read; only the send functions write to it", () => {
    expect(sql).toContain("create table if not exists public.newsletter_sends (");
    expect(sql).toContain("subscriber_id text not null references public.subscribers(id) on delete cascade,");
    expect(sql).toContain("primary key (newsletter_id, subscriber_id)");
    expect(sql).toContain("revoke all on table public.newsletter_sends from public, anon, authenticated;");
    expect(sql).toContain("grant select on table public.newsletter_sends to authenticated;");
    expect(sql).toContain('create policy "admins read" on public.newsletter_sends for select to authenticated using (is_active_admin());');
  });
  it("fills in past sends from join dates", () => {
    expect(sql).toContain("and (s.data->>'at')::timestamptz <= (n.data->>'sentAt')::timestamptz");
    expect(sql).toContain("on conflict (newsletter_id, subscriber_id) do nothing;");
  });
});
