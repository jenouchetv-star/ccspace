// The share counter: what gets recorded when someone shares a page (shares.js), what the database
// lets a visitor and an admin do with those rows (share-events.sql), and how index.html wires it
// to the share dialog and the admin Analytics page.
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { SHARE_METHODS, shareEvent, summarizeShares } from "../assets/lib/shares.js";

const ORIGIN = "https://chikescreativespace.com";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/share-events.sql", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("what is recorded for a share", () => {
  it("keeps only the page path, the title and the way it was shared", () => {
    expect(shareEvent(ORIGIN + "/newsletter/gravity-four", "Gravity 4", "copy", ORIGIN))
      .toEqual({ path: "/newsletter/gravity-four", title: "Gravity 4", method: "copy" });
  });

  it("never keeps a query string or fragment, where a private access key could be", () => {
    const e = shareEvent(ORIGIN + "/newsletter/x?k=SECRET#frag", "T", "copy", ORIGIN);
    expect(e.path).toBe("/newsletter/x");
    expect(JSON.stringify(e)).not.toContain("SECRET");
  });

  it("treats the home page and a trailing slash sensibly", () => {
    expect(shareEvent(ORIGIN + "/", "Home", "x", ORIGIN).path).toBe("/");
    expect(shareEvent(ORIGIN, "Home", "x", ORIGIN).path).toBe("/");
    expect(shareEvent(ORIGIN + "/play/doodle-dash/", "D", "x", ORIGIN).path).toBe("/play/doodle-dash");
  });

  it("ignores another site's address and any way of sharing it does not know", () => {
    expect(shareEvent("https://example.com/a", "T", "copy", ORIGIN)).toBeNull();
    expect(shareEvent(ORIGIN + "/a", "T", "carrier-pigeon", ORIGIN)).toBeNull();
    expect(shareEvent(ORIGIN + "/a", "T", "constructor", ORIGIN)).toBeNull();
    expect(shareEvent("http://[", "T", "copy", ORIGIN)).toBeNull();
  });

  it("tidies and shortens the title", () => {
    expect(shareEvent(ORIGIN + "/a", "  Hello \n  there  ", "copy", ORIGIN).title).toBe("Hello there");
    expect(shareEvent(ORIGIN + "/a", "x".repeat(500), "copy", ORIGIN).title).toHaveLength(200);
    expect(shareEvent(ORIGIN + "/a", undefined, "copy", ORIGIN).title).toBe("");
  });

  it("names every way the share dialog offers, and nothing else", () => {
    for (const k of ["native", "copy", "instagram", "facebook", "messenger", "x", "pinterest", "whatsapp", "email", "text"]) expect(SHARE_METHODS[k]).toBeTruthy();
    expect(Object.keys(SHARE_METHODS)).toHaveLength(10);
  });
});

describe("adding shares up", () => {
  const rows = [
    { path: "/play/a", title: "Old name", method: "copy", created_at: "2026-10-20T10:00:00Z" },
    { path: "/play/a", title: "Doodle Dash", method: "facebook", created_at: "2026-10-22T10:00:00Z" },
    { path: "/play/a", title: "Doodle Dash", method: "copy", created_at: "2026-10-21T10:00:00Z" },
    { path: "/newsletter/b", title: "Gravity 4", method: "native", created_at: "2026-10-23T10:00:00Z" },
    { path: "/stories/c", title: "", method: "email", created_at: "2026-10-24T10:00:00Z" },
  ];

  it("ranks pages by how often they were shared, using each page's latest title", () => {
    const s = summarizeShares(rows);
    expect(s.total).toBe(5);
    expect(s.byContent.map((p) => [p.title, p.count])).toEqual([["Doodle Dash", 3], ["/stories/c", 1], ["Gravity 4", 1]]);   /* a tie is listed alphabetically; a page with no title shows its path */
  });

  it("says how each page was shared and ranks the ways overall", () => {
    const s = summarizeShares(rows);
    expect(s.byContent[0].methods).toEqual([{ method: "copy", label: "Copy link", count: 2 }, { method: "facebook", label: "Facebook", count: 1 }]);
    expect(s.byMethod[0]).toEqual({ method: "copy", label: "Copy link", count: 2 });
    expect(s.byMethod.reduce((n, m) => n + m.count, 0)).toBe(5);
  });

  it("copes with nothing", () => {
    expect(summarizeShares([])).toEqual({ total: 0, byContent: [], byMethod: [] });
    expect(summarizeShares(undefined).total).toBe(0);
  });
});

describe("share-events.sql", () => {
  let db;
  const q = async (text, params) => (await db.query(text, params)).rows;
  const can = async (role, priv) => (await q("select has_table_privilege($1, 'share_events', $2) as v", [role, priv]))[0].v;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated;
      create function is_active_admin() returns boolean language sql as $$ select false $$;
    `);
    await db.exec(sql);
  }, 60000);

  it("can be run again without error", async () => { await db.exec(sql); });

  it("lets a visitor add a row and nothing else; only an admin can read or delete", async () => {
    expect((await q("select relrowsecurity from pg_class where relname = 'share_events'"))[0].relrowsecurity).toBe(true);
    expect(await can("anon", "insert")).toBe(true);
    for (const p of ["select", "update", "delete"]) expect(await can("anon", p)).toBe(false);
    expect(await can("authenticated", "select")).toBe(true);
    expect(await can("authenticated", "delete")).toBe(true);
    for (const p of ["insert", "update"]) expect(await can("authenticated", p)).toBe(false);
    const pol = await q("select policyname, roles::text as roles, cmd, qual from pg_policies where tablename = 'share_events' order by policyname");
    expect(pol.map((p) => [p.policyname, p.cmd])).toEqual([["admin delete", "DELETE"], ["admin read", "SELECT"], ["public insert", "INSERT"]]);
    expect(pol.find((p) => p.policyname === "admin read").qual).toContain("is_active_admin()");
    expect(pol.find((p) => p.policyname === "admin delete").qual).toContain("is_active_admin()");
  });

  it("stores no personal data: the columns are the page, its title, the way and the time", async () => {
    const cols = (await q("select column_name from information_schema.columns where table_name = 'share_events' order by ordinal_position")).map((c) => c.column_name);
    expect(cols).toEqual(["id", "created_at", "path", "title", "method"]);
  });

  it("only accepts a real path, a short title and a known way of sharing", async () => {
    await db.exec("insert into share_events (path, title, method) values ('/play/a', 'Doodle Dash', 'copy')");
    await expect(db.exec("insert into share_events (path, method) values ('play/a', 'copy')")).rejects.toThrow();
    await expect(db.exec("insert into share_events (path, method) values ('/a', 'smoke-signal')")).rejects.toThrow();
    await expect(db.exec("insert into share_events (path, title, method) values ('/a', repeat('x', 201), 'copy')")).rejects.toThrow();
    await expect(db.exec("insert into share_events (path, method) values ('/' || repeat('x', 200), 'copy')")).rejects.toThrow();
    expect((await q("select count(*)::int as n from share_events"))[0].n).toBe(1);
  });

  it("allows exactly the ways the page can record", async () => {
    for (const m of Object.keys(SHARE_METHODS)) await db.exec(`insert into share_events (path, method) values ('/a', '${m}')`);
  });
});

describe("share counting in index.html", () => {
  it("imports the counting rules for the page", () => {
    expect(html).toContain('import * as Shares from "./assets/lib/shares.js";');
    expect(html).toContain("Object.assign(window, ActivityFinder, AcceptInvite, Mfa, PlayAll, Portal, Shares);");
  });

  it("counts an actual share, not the dialog being opened", () => {
    expect(html).toContain('await navigator.share({ title: title, text: title, url: url }); recordShare(url, title, "native");');   /* only if it went through */
    expect(html).toContain('recordShare(url, el.getAttribute("data-title") || "", "copy");');
    expect(html).toContain('recordShare(url, el.getAttribute("data-title") || "", "instagram");');
    expect(html.split('"share": (el) => {')[1].split("\n  },")[0]).not.toContain("recordShare");
  });

  it("counts clicks on the send-to links without changing what they do", () => {
    const d = body("shareModalHTML");
    for (const k of ["facebook", "messenger", "x", "pinterest", "whatsapp", "email", "text"]) expect(d).toContain('key:"' + k + '"');
    expect(d).toContain('data-share="\' + l.key + \'"');
    expect(html).toContain('ev.target.closest("a[data-share]")');
    expect(html).toContain('recordShare(link.getAttribute("data-url") || "", link.getAttribute("data-title") || "", link.getAttribute("data-share"));');
  });

  it("is fire-and-forget, and skips admins and local previews so testing never inflates the numbers", () => {
    const r = body("recordShare");
    expect(r).toContain("isActiveAdmin()");
    expect(r).toContain('location.protocol === "file:"');
    expect(r).toContain("localhost");
    expect(r).toContain('sb.from("share_events").insert(row).then(() => {}, () => {});');
    expect(r).toContain("catch(_e)");
  });

  it("shows the counts at the top of the admin Analytics page, loaded alongside the traffic", () => {
    expect(body("adminAnalytics")).toContain("+ adminSharesCard()");
    expect(body("loadAnalytics")).toContain("loadShares(days);");
    const l = body("loadShares");
    expect(l).toContain('sb.from("share_events").select("path, title, method, created_at")');
    const c = body("adminSharesCard");
    for (const t of ["Shared content", "Most shared pages", "How it was shared", "Total shares", "Most shared", "Favourite way", "supabase/share-events.sql", "never who"]) expect(c).toContain(t);
    expect(c).toContain("summarizeShares(s.rows)");
  });
});
