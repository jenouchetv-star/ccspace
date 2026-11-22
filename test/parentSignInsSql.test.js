// Applies the real supabase/parent-sign-ins.sql to an in-memory Postgres (PGlite) and checks what it promises: the
// portal_sessions table gets a last_seen_at column, and subscriber_sign_ins() gives an active admin, per subscriber,
// the newest sign-in, whether any session is still unexpired, and the newest "last seen"; anyone else is refused.
// (As in test/kidProgressSql.test.js, PGlite runs as a superuser, so grants are checked with has_function_privilege,
// and is_active_admin() is a stand-in driven by a one-row table so a test can switch it on and off.)
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../supabase/parent-sign-ins.sql", import.meta.url);
const sql = existsSync(file) ? readFileSync(file, "utf8") : "";
let db;
const q = async (text, params) => (await db.query(text, params)).rows;
const setAdmin = (on) => db.exec(`update test_admin set on_ = ${on ? "true" : "false"}`);
const iso = (v) => (v ? new Date(v).toISOString() : v);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table test_admin (on_ boolean not null);
    insert into test_admin values (true);
    create function is_active_admin() returns boolean language sql security definer set search_path = public stable as $$
      select on_ from test_admin $$;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table portal_sessions (
      token_hash text primary key,
      subscriber_id text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    );
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    grant execute on function is_active_admin() to anon, authenticated;
    -- sessions that exist before the file is applied: the backfill should pick up the newest per member, and skip a
    -- session whose subscriber is gone (portal_sessions has no foreign key)
    insert into subscribers (id, data) values ('sub-old', '{"status":"published"}');
    insert into portal_sessions (token_hash, subscriber_id, created_at, expires_at) values
      ('old1', 'sub-old', '2026-09-01T10:00:00Z', '2026-10-01T10:00:00Z'),
      ('old2', 'sub-old', '2026-09-20T10:00:00Z', '2026-10-20T10:00:00Z'),
      ('ghost', 'sub-ghost', '2026-09-05T10:00:00Z', '2026-10-05T10:00:00Z');
  `);
  await db.exec(sql);
  backfilled = (await q("select subscriber_id, last_sign_in, last_seen from member_activity order by subscriber_id")).map((r) => ({ ...r, last_sign_in: iso(r.last_sign_in) }));
}, 60000);
let backfilled;

const signIn = (hash, sub, createdAt, expires = "now() + interval '30 days'") =>
  db.exec(`insert into portal_sessions (token_hash, subscriber_id, created_at, expires_at) values ('${hash}', '${sub}', '${createdAt}', ${expires})`);
const seen = (hash, at) => db.exec(`update portal_sessions set last_seen_at = '${at}' where token_hash = '${hash}'`);
const activity = async (sub) => {
  const r = (await q("select last_sign_in, last_seen from member_activity where subscriber_id = $1", [sub]))[0];
  return r ? { last_sign_in: iso(r.last_sign_in), last_seen: iso(r.last_seen) } : null;
};

beforeEach(async () => {
  await setAdmin(true);
  await db.exec(`
    delete from portal_sessions; delete from member_activity; delete from subscribers;
    insert into subscribers (id, data) values ('sub-a', '{"status":"published"}'), ('sub-b', '{"status":"published"}');
  `);
});

describe("parent-sign-ins.sql", () => {
  it("can be run again without error", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
    await db.exec(sql);
    const cols = (await q("select column_name from information_schema.columns where table_name = 'portal_sessions' order by ordinal_position")).map((c) => c.column_name);
    expect(cols).toEqual(["token_hash", "subscriber_id", "created_at", "expires_at", "last_seen_at"]);
  });

  it("refuses anyone who is not an active admin", async () => {
    await setAdmin(false);
    await expect(q("select * from subscriber_sign_ins()")).rejects.toThrow(/not allowed/);
  });

  it("is security definer with a fixed search_path; anon cannot execute it, authenticated can", async () => {
    const fn = (await q("select prosecdef, proconfig from pg_proc where proname = 'subscriber_sign_ins'"))[0];
    expect(fn.prosecdef).toBe(true);
    expect((fn.proconfig || []).join(",")).toMatch(/^search_path=public/);
    const r = (await q("select has_function_privilege('anon', 'subscriber_sign_ins()', 'execute') as a, has_function_privilege('authenticated', 'subscriber_sign_ins()', 'execute') as b"))[0];
    expect(r).toEqual({ a: false, b: true });
  });

  it("per subscriber: newest sign-in, signed in only with an unexpired session, newest last seen", async () => {
    await signIn("h1", "sub-a", "2026-11-01T10:00:00Z", "now() - interval '1 day'");
    await signIn("h2", "sub-a", "2026-11-10T10:00:00Z", "now() + interval '20 days'");
    await signIn("h3", "sub-a", "2026-11-05T10:00:00Z", "now() + interval '5 days'");
    await signIn("h4", "sub-b", "2026-10-01T10:00:00Z", "now() - interval '3 days'");
    await signIn("h5", "sub-b", "2026-10-03T10:00:00Z", "now() - interval '1 hour'");
    await seen("h1", "2026-11-02T10:00:00Z");
    await seen("h2", "2026-11-11T09:00:00Z");
    await seen("h3", "2026-11-12T08:00:00Z");
    const rows = (await q("select * from subscriber_sign_ins() order by subscriber_id")).map((r) => ({
      ...r, last_sign_in: iso(r.last_sign_in), last_seen: iso(r.last_seen),
    }));
    expect(rows).toEqual([
      { subscriber_id: "sub-a", last_sign_in: "2026-11-10T10:00:00.000Z", signed_in: true, last_seen: "2026-11-12T08:00:00.000Z" },
      { subscriber_id: "sub-b", last_sign_in: "2026-10-03T10:00:00.000Z", signed_in: false, last_seen: null },
    ]);
  });

  it("returns no rows for subscribers with no sessions", async () => {
    expect(await q("select * from subscriber_sign_ins()")).toEqual([]);
  });
});

describe("parent-sign-ins.sql: member_activity outlives sessions", () => {
  it("backfilled the newest sign-in per member from the sessions that already existed, skipping gone subscribers", () => {
    expect(backfilled).toEqual([{ subscriber_id: "sub-old", last_sign_in: "2026-09-20T10:00:00.000Z", last_seen: null }]);
  });

  it("keeps last sign-in and last seen after the session is deleted (sign-out or clean-up)", async () => {
    await signIn("h1", "sub-a", "2026-11-10T10:00:00Z");
    await seen("h1", "2026-11-11T09:00:00Z");
    await db.exec("delete from portal_sessions where token_hash = 'h1'");
    expect(await activity("sub-a")).toEqual({ last_sign_in: "2026-11-10T10:00:00.000Z", last_seen: "2026-11-11T09:00:00.000Z" });
    const rows = (await q("select * from subscriber_sign_ins()")).map((r) => ({ ...r, last_sign_in: iso(r.last_sign_in), last_seen: iso(r.last_seen) }));
    expect(rows).toEqual([{ subscriber_id: "sub-a", last_sign_in: "2026-11-10T10:00:00.000Z", signed_in: false, last_seen: "2026-11-11T09:00:00.000Z" }]);
  });

  it("a newer sign-in or last seen moves forward; an older one never moves it back", async () => {
    await signIn("h1", "sub-a", "2026-11-10T10:00:00Z");
    await signIn("h2", "sub-a", "2026-11-12T10:00:00Z");
    expect((await activity("sub-a")).last_sign_in).toBe("2026-11-12T10:00:00.000Z");
    await signIn("h3", "sub-a", "2026-11-01T10:00:00Z");
    expect((await activity("sub-a")).last_sign_in).toBe("2026-11-12T10:00:00.000Z");
    await seen("h2", "2026-11-13T10:00:00Z");
    await seen("h1", "2026-11-11T10:00:00Z");
    expect((await activity("sub-a")).last_seen).toBe("2026-11-13T10:00:00.000Z");
    await seen("h1", "2026-11-14T10:00:00Z");
    expect((await activity("sub-a")).last_seen).toBe("2026-11-14T10:00:00.000Z");
    // setting last_seen_at back to null changes nothing
    await db.exec("update portal_sessions set last_seen_at = null where token_hash = 'h1'");
    expect((await activity("sub-a")).last_seen).toBe("2026-11-14T10:00:00.000Z");
  });

  it("a sign-in for a subscriber that does not exist still works and records nothing", async () => {
    await signIn("hx", "sub-nobody", "2026-11-10T10:00:00Z");
    expect(await activity("sub-nobody")).toBe(null);
    expect((await q("select count(*)::int as n from portal_sessions"))[0].n).toBe(1);
  });

  it("returns a member with an unexpired session or an activity row", async () => {
    await signIn("h1", "sub-a", "2026-11-10T10:00:00Z");
    await db.exec("insert into member_activity (subscriber_id, last_sign_in) values ('sub-b', '2026-10-01T10:00:00Z')");
    const rows = (await q("select subscriber_id, signed_in from subscriber_sign_ins() order by subscriber_id"));
    expect(rows).toEqual([{ subscriber_id: "sub-a", signed_in: true }, { subscriber_id: "sub-b", signed_in: false }]);
  });

  it("removing the subscriber removes their activity row", async () => {
    await signIn("h1", "sub-a", "2026-11-10T10:00:00Z");
    expect(await activity("sub-a")).not.toBe(null);
    await db.exec("delete from subscribers where id = 'sub-a'");
    expect(await activity("sub-a")).toBe(null);
  });

  it("member_activity is closed to the browser roles: RLS on, no policies, no grants", async () => {
    expect((await q("select relrowsecurity from pg_class where relname = 'member_activity'"))[0].relrowsecurity).toBe(true);
    expect(await q("select 1 from pg_policies where tablename = 'member_activity'")).toEqual([]);
    for (const role of ["anon", "authenticated"]) {
      for (const p of ["select", "insert", "update", "delete"]) {
        expect((await q("select has_table_privilege($1, 'member_activity', $2) as v", [role, p]))[0].v, `${role} ${p}`).toBe(false);
      }
    }
  });

  it("the trigger functions are security definer with a fixed search_path", async () => {
    const fns = await q("select proname, prosecdef, proconfig from pg_proc where proname like 'member_activity_%' order by proname");
    expect(fns.map((f) => f.proname)).toEqual(["member_activity_on_seen", "member_activity_on_sign_in"]);
    for (const f of fns) {
      expect(f.prosecdef, f.proname).toBe(true);
      expect((f.proconfig || []).join(","), f.proname).toMatch(/^search_path=public/);
    }
  });
});
