// The admin Subscribers table's three sign-in columns (index.html): "Last signed in", "Signed in" and "Last seen",
// read once per visit to the list from the subscriber_sign_ins() RPC (supabase/parent-sign-ins.sql). This reads the
// page's own code and runs its functions on their own with fakes passed in. All data here is made up.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
const fn = (name, ...deps) => {
  const prefix = deps.length && /^async $/.test(deps[deps.length - 1]) ? deps.pop() : "";
  return (...vals) => new Function(...deps, "return " + prefix + "function " + name + "(" + body(name))(...vals);
};

const NOW = Date.parse("2026-11-21T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60000, DAY = 86400000;
// Date with "now" fixed at NOW; the page's own relTime runs with it
const DateAt = new Proxy(Date, { get: (t, k) => (k === "now" ? () => NOW : t[k]) });
const relTime = fn("relTime", "Date")(DateAt);
const E = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ic = (name) => "<i data-icon=\"" + name + "\"></i>";

const lastCell = fn("signInLastCell", "relTime")(relTime);
const nowCell = fn("signInNowCell", "E", "ic")(E, ic);
const seenCell = fn("signInSeenCell", "relTime", "E", "Date", "ONLINE_NOW_MS")(relTime, E, DateAt, 5 * 60000);

describe("the sign-in cells", () => {
  it("Last signed in: relative time, Never without one, Not available when the RPC failed", () => {
    expect(lastCell({ last_sign_in: ago(3 * DAY), signed_in: false, last_seen: null })).toBe("3 days ago");
    expect(lastCell({ last_sign_in: ago(5 * MIN), signed_in: true, last_seen: null })).toBe("5 min ago");
    expect(lastCell(null)).toBe("Never");
    expect(lastCell("fail")).toBe("Not available");
  });

  it("Signed in: a good badge while signed in, a plain one when signed out", () => {
    const on = nowCell({ last_sign_in: ago(DAY), signed_in: true, last_seen: null });
    expect(on).toContain("admin-badge--good");
    expect(on).toContain("Signed in");
    const off = nowCell({ last_sign_in: ago(40 * DAY), signed_in: false, last_seen: null });
    expect(off).not.toContain("admin-badge--good");
    expect(off).toContain("Signed out");
    expect(nowCell(null)).toContain("Signed out");
    expect(nowCell("fail")).toBe("Not available");
  });

  it("Last seen: Online now with a green dot within 5 minutes, else relative time, Never without one", () => {
    const online = seenCell({ last_sign_in: ago(DAY), signed_in: true, last_seen: ago(2 * MIN) });
    expect(online).toContain("Online now");
    expect(online).toContain("admin-online__dot");
    const offline = seenCell({ last_sign_in: ago(DAY), signed_in: true, last_seen: ago(6 * MIN) });
    expect(offline).toBe("6 min ago");
    expect(seenCell({ last_sign_in: ago(2 * DAY), signed_in: false, last_seen: ago(2 * DAY) })).toBe("2 days ago");
    expect(seenCell({ last_sign_in: ago(DAY), signed_in: true, last_seen: null })).toBe("Never");
    expect(seenCell(null)).toBe("Never");
    expect(seenCell("fail")).toBe("Not available");
  });

  it("subscriberSignIn says loading, failed, none or the row", () => {
    const S = { map: null, failed: false };
    const get = fn("subscriberSignIn", "SubscriberSignIns")(S);
    expect(get("subs-a")).toBeUndefined();
    S.map = { "subs-a": { subscriber_id: "subs-a", signed_in: true } };
    expect(get("subs-a")).toEqual({ subscriber_id: "subs-a", signed_in: true });
    expect(get("subs-b")).toBeNull();
    S.failed = true;
    expect(get("subs-a")).toBe("fail");
  });

  it("Online now is 5 minutes", () => {
    expect(html).toContain("const ONLINE_NOW_MS = 5 * 60000;");
  });

  it("no em dashes and no emojis in the new code", () => {
    const code = ["signInLastCell", "signInNowCell", "signInSeenCell", "subscriberSignIn", "subscriberSignInsVisit", "subscriberSignInsLoad"].map(body).join("\n");
    expect(code.includes(String.fromCharCode(0x2014))).toBe(false);
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("loading the sign-ins", () => {
  const run = async (rpcAnswer) => {
    const S = { visit: 0, loading: false, map: null, failed: false };
    const warns = [], calls = [];
    let renders = 0;
    const sb = { rpc: async (name) => { calls.push(name); if (rpcAnswer instanceof Error) throw rpcAnswer; return rpcAnswer; } };
    await fn("subscriberSignInsLoad", "SubscriberSignIns", "sb", "console", "rerender", "async ")(S, sb, { warn: (...a) => warns.push(a) }, () => { renders += 1; })();
    return { S, warns, calls, renders };
  };

  it("keys the rows by subscriber id and redraws", async () => {
    const rows = [
      { subscriber_id: "subs-mwpeve9z-ov", last_sign_in: ago(DAY), signed_in: true, last_seen: ago(MIN) },
      { subscriber_id: "subs-b", last_sign_in: ago(9 * DAY), signed_in: false, last_seen: null },
    ];
    const r = await run({ data: rows, error: null });
    expect(r.calls).toEqual(["subscriber_sign_ins"]);
    expect(r.S.map).toEqual({ "subs-mwpeve9z-ov": rows[0], "subs-b": rows[1] });
    expect(r.S.failed).toBe(false);
    expect(r.S.loading).toBe(false);
    expect(r.renders).toBe(1);
    expect(r.warns).toEqual([]);
  });

  it("a failed RPC (not deployed yet) shows Not available, warns, and still redraws", async () => {
    for (const answer of [{ data: null, error: { message: "Could not find the function public.subscriber_sign_ins" } }, new Error("offline")]) {
      const r = await run(answer);
      expect(r.S.failed).toBe(true);
      expect(r.S.map).toBe(null);
      expect(r.warns.length).toBe(1);
      expect(r.renders).toBe(1);
      const get = fn("subscriberSignIn", "SubscriberSignIns")(r.S);
      expect(lastCell(get("subs-a"))).toBe("Not available");
      expect(nowCell(get("subs-a"))).toBe("Not available");
      expect(seenCell(get("subs-a"))).toBe("Not available");
    }
  });

  it("an answer that arrives after the admin left the list keeps nothing", async () => {
    const S = { visit: 0, loading: false, map: null, failed: false };
    let release;
    const sb = { rpc: () => new Promise((res) => { release = res; }) };
    let renders = 0;
    const load = fn("subscriberSignInsLoad", "SubscriberSignIns", "sb", "console", "rerender", "async ")(S, sb, console, () => { renders += 1; });
    const visit = fn("subscriberSignInsVisit", "SubscriberSignIns", "subscriberSignInsLoad")(S, load);
    visit(true);
    expect(S.loading).toBe(true);
    visit(true);                       // a redraw while loading does not ask again
    visit(false);                      // left the list
    release({ data: [{ subscriber_id: "subs-a", signed_in: true }], error: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(S.map).toBe(null);
    expect(renders).toBe(0);
  });

  it("loads once per visit: again only after the admin left the list and came back", async () => {
    const S = { visit: 0, loading: false, map: null, failed: false };
    let loads = 0;
    const visit = fn("subscriberSignInsVisit", "SubscriberSignIns", "subscriberSignInsLoad")(S, () => { loads += 1; S.loading = false; S.map = {}; });
    visit(true); visit(true); visit(true);
    expect(loads).toBe(1);
    visit(false); visit(true);
    expect(loads).toBe(2);
  });
});

describe("the Subscribers table", () => {
  it("has the three columns right after Joined", () => {
    const subs = html.split("const LIST_COLS = {")[1].split("\n  subscribers: [")[1].split("\n  ],")[0];
    const labels = [...subs.matchAll(/label:"([^"]+)"/g)].map((m) => m[1]);
    expect(labels.slice(labels.indexOf("Joined"))).toEqual(["Joined", "Last signed in", "Signed in", "Last seen"]);
    expect(subs).toContain("signInLastCell(subscriberSignIn(r.id))");
    expect(subs).toContain("signInNowCell(subscriberSignIn(r.id))");
    expect(subs).toContain("signInSeenCell(subscriberSignIn(r.id))");
  });

  it("loads the sign-ins while the admin is on the Subscribers list", () => {
    expect(body("viewAdmin")).toContain('subscriberSignInsVisit(section === "subscribers");');
    expect(body("renderRoute")).toContain('if (n !== "admin") subscriberSignInsVisit(false);');
  });

  it("styles the Online now dot", () => {
    expect(html).toMatch(/\.admin-online__dot\{[^}]*border-radius:50%[^}]*var\(--admin-good\)/);
  });
});
