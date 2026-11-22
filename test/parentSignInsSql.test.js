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
    create table portal_sessions (
      token_hash text primary key,
      subscriber_id text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    );
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    grant execute on function is_active_admin() to anon, authenticated;
  `);
  await db.exec(sql);
}, 60000);

beforeEach(async () => {
  await setAdmin(true);
  await db.exec("delete from portal_sessions");
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
    await db.exec(`
      insert into portal_sessions (token_hash, subscriber_id, created_at, expires_at, last_seen_at) values
        ('h1', 'sub-a', '2026-11-01T10:00:00Z', now() - interval '1 day', '2026-11-02T10:00:00Z'),
        ('h2', 'sub-a', '2026-11-10T10:00:00Z', now() + interval '20 days', '2026-11-11T09:00:00Z'),
        ('h3', 'sub-a', '2026-11-05T10:00:00Z', now() + interval '5 days', '2026-11-12T08:00:00Z'),
        ('h4', 'sub-b', '2026-10-01T10:00:00Z', now() - interval '3 days', null),
        ('h5', 'sub-b', '2026-10-03T10:00:00Z', now() - interval '1 hour', null);
    `);
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
