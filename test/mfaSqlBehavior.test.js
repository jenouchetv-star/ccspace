// Runs the REAL admin-2FA SQL (supabase/mfa-hardening.sql, mfa-enforce.sql,
// mfa-rollback.sql) against an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's auth schema, and checks what it DOES, not just what
// it says: the is_active_admin() truth table, immediate session revocation,
// that re-running the SQL cannot turn enforcement off, invitation hardening,
// the reset limits, and the enforce/rollback files.
//
// Limits: PGlite runs as a superuser, so row-level security itself is not
// exercised here (the privilege grants are); the real RLS/Edge-Function path is
// covered by the opt-in integration tests in test/integration/.
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../supabase/" + name, import.meta.url), "utf8");
const migration = read("migration.sql");
const hardening = read("mfa-hardening.sql");
const enforce = read("mfa-enforce.sql");
const rollback = read("mfa-rollback.sql");

let db;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const raises = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return String(e.message); } };
const as = (uid, claims) => db.exec(`select set_config('request.jwt.claim.sub', '${uid || ""}', false), set_config('request.jwt.claims', '${JSON.stringify(claims || {})}', false);`);
const isAdmin = async () => (await q("select is_active_admin() as v"))[0].v;
const setEnforce = (expr) => db.exec(`update admin_mfa_settings set enforce_after = ${expr} where id;`);
const enforceAfter = async () => (await q("select enforce_after from admin_mfa_settings"))[0].enforce_after;
const mkUser = async (email, invitedAt) => (await q("insert into auth.users (email, invited_at) values ($1, $2) returning id", [email, invitedAt]))[0].id;
const mkSession = async (uid) => (await q("insert into auth.sessions (user_id) values ($1) returning id", [uid]))[0].id;
const mkAdmin = async (email) => {
  const id = await mkUser(email, new Date().toISOString());
  await db.exec(`update profiles set status = 'active' where id = '${id}'`);
  return id;
};
const mkFactor = (uid, status = "verified") => db.exec(`insert into auth.mfa_factors (user_id, status, factor_type) values ('${uid}', '${status}', 'totp')`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, invited_at timestamptz);
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, status text not null, factor_type text not null);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  `);
  // The real profiles table, lifted from migration.sql so it can't drift.
  await db.exec(migration.match(/create table if not exists profiles \([\s\S]*?\n\);/)[0]);
  await db.exec(hardening);
}, 60000);

describe("hardening SQL applies", () => {
  it("re-applies cleanly (idempotent)", async () => {
    await db.exec(hardening);
    await db.exec(hardening);
    expect((await q("select count(*)::int c from admin_mfa_settings"))[0].c).toBe(1);
  });
});

describe("is_active_admin()", () => {
  let admin, sess;
  beforeAll(async () => {
    admin = await mkAdmin("admin@example.test");
    sess = await mkSession(admin);
  });

  it("enforcement off: an aal1 admin with a live session is allowed", async () => {
    await setEnforce("null");
    await as(admin, { sub: admin, aal: "aal1", session_id: sess });
    expect(await isAdmin()).toBe(true);
  });
  it("enforcement off: a token with no session claim is still allowed (old-style token)", async () => {
    await as(admin, { sub: admin, aal: "aal1" });
    expect(await isAdmin()).toBe(true);
  });
  it("enforcement off: a token whose session is gone is denied (sign-out / revoke work before enforcement too)", async () => {
    await as(admin, { sub: admin, aal: "aal1", session_id: "00000000-0000-0000-0000-000000000000" });
    expect(await isAdmin()).toBe(false);
  });
  it("inside the enrollment window: aal1 is still allowed", async () => {
    await setEnforce("now() + interval '3 days'");
    await as(admin, { sub: admin, aal: "aal1", session_id: sess });
    expect(await isAdmin()).toBe(true);
  });
  it("enforced: aal1 is denied, aal2 with a live session is allowed", async () => {
    await setEnforce("now() - interval '1 second'");
    await as(admin, { sub: admin, aal: "aal1", session_id: sess });
    expect(await isAdmin()).toBe(false);
    await as(admin, { sub: admin, aal: "aal2", session_id: sess });
    expect(await isAdmin()).toBe(true);
  });
  it("enforced: aal2 without a session claim, or with an unknown session, is denied", async () => {
    await as(admin, { sub: admin, aal: "aal2" });
    expect(await isAdmin()).toBe(false);
    await as(admin, { sub: admin, aal: "aal2", session_id: "00000000-0000-0000-0000-000000000000" });
    expect(await isAdmin()).toBe(false);
  });
  it("enforced: no user, or a revoked profile, is denied even at aal2", async () => {
    await as(null, {});
    expect(await isAdmin()).toBe(false);
    const revoked = await mkUser("revoked@example.test", new Date().toISOString());
    await db.exec(`update profiles set status = 'revoked' where id = '${revoked}'`);
    const rs = await mkSession(revoked);
    await as(revoked, { sub: revoked, aal: "aal2", session_id: rs });
    expect(await isAdmin()).toBe(false);
  });
  it("another user's session id can't be borrowed", async () => {
    const other = await mkAdmin("other@example.test");
    const otherSess = await mkSession(other);
    await as(admin, { sub: admin, aal: "aal2", session_id: otherSess });
    expect(await isAdmin()).toBe(false);
  });
  it("revoking sessions denies the same unexpired token immediately", async () => {
    await as(admin, { sub: admin, aal: "aal2", session_id: sess });
    expect(await isAdmin()).toBe(true);
    const n = (await q("select public.revoke_user_sessions($1) as n", [admin]))[0].n;
    expect(n).toBe(1);
    expect(await isAdmin()).toBe(false);
  });
});

describe("re-running the SQL cannot remove enforcement", () => {
  it("keeps enforce_after through repeated runs of the hardening SQL", async () => {
    await setEnforce("now() - interval '1 second'");
    const before = await enforceAfter();
    await db.exec(hardening);
    await db.exec(hardening);
    const after = await enforceAfter();
    expect(after).not.toBeNull();
    expect(String(after)).toBe(String(before));
    expect((await q("select count(*)::int c from admin_mfa_settings"))[0].c).toBe(1);
  });
});

describe("privileges", () => {
  it("keeps the switch, the log and the reset functions away from anon and authenticated", async () => {
    expect((await q("select has_table_privilege('authenticated','admin_mfa_settings','select') as v"))[0].v).toBe(false);
    expect((await q("select has_table_privilege('anon','admin_mfa_settings','select') as v"))[0].v).toBe(false);
    expect((await q("select has_table_privilege('authenticated','mfa_reset_log','insert') as v"))[0].v).toBe(false);
    for (const fn of ["public.revoke_user_sessions(uuid)", "public.begin_mfa_reset(uuid,uuid,text)"]) {
      expect((await q(`select has_function_privilege('authenticated','${fn}','execute') as v`))[0].v, fn).toBe(false);
      expect((await q(`select has_function_privilege('anon','${fn}','execute') as v`))[0].v, fn).toBe(false);
      expect((await q(`select has_function_privilege('service_role','${fn}','execute') as v`))[0].v, fn).toBe(true);
    }
  });
});

describe("invitation hardening", () => {
  it("gives no profile to an auth user that was not invited", async () => {
    const stranger = await mkUser("stranger@example.test", null);
    expect((await q("select count(*)::int c from profiles where id = $1", [stranger]))[0].c).toBe(0);
    await as(stranger, { sub: stranger });
    expect(await raises("select public.accept_invite()")).toBeNull();                 // quiet no-op
    expect((await q("select count(*)::int c from profiles where id = $1", [stranger]))[0].c).toBe(0);
  });
  it("creates an 'invited' profile for an invited user, whether invited_at is set at insert or just after", async () => {
    const atInsert = await mkUser("invited@example.test", new Date().toISOString());
    expect((await q("select status from profiles where id = $1", [atInsert]))[0].status).toBe("invited");
    const late = await mkUser("late@example.test", null);
    expect((await q("select count(*)::int c from profiles where id = $1", [late]))[0].c).toBe(0);
    await db.exec(`update auth.users set invited_at = now() where id = '${late}'`);
    expect((await q("select status from profiles where id = $1", [late]))[0].status).toBe("invited");
  });
  it("activates a fresh invitation", async () => {
    const id = await mkUser("fresh@example.test", new Date().toISOString());
    await as(id, { sub: id });
    await db.exec("select public.accept_invite()");
    expect((await q("select status from profiles where id = $1", [id]))[0].status).toBe("active");
  });
  it("refuses an 8-day-old invitation, with a clear message, and leaves it 'invited'", async () => {
    const id = await mkUser("stale@example.test", new Date(Date.now() - 8 * 86400000).toISOString());
    await as(id, { sub: id });
    expect(await raises("select public.accept_invite()")).toMatch(/expired/i);
    expect((await q("select status from profiles where id = $1", [id]))[0].status).toBe("invited");
  });
  it("refuses a profile whose auth user has no invited_at", async () => {
    const id = await mkUser("forged@example.test", new Date().toISOString());
    await db.exec(`update auth.users set invited_at = null where id = '${id}'`);
    await as(id, { sub: id });
    expect(await raises("select public.accept_invite()")).not.toBeNull();
  });
  it("is a quiet no-op for someone already active", async () => {
    const id = await mkAdmin("already@example.test");
    await as(id, { sub: id });
    expect(await raises("select public.accept_invite()")).toBeNull();
  });
});

describe("begin_mfa_reset(): limits and the audit log", () => {
  const begin = async (target, actor, how = "video_call") => (await q("select * from public.begin_mfa_reset($1, $2, $3)", [target, actor, how]))[0];
  const setOutcome = (id, outcome) => db.exec(`update mfa_reset_log set outcome = '${outcome}' where id = '${id}'`);
  let actor, target;
  beforeAll(async () => {
    actor = await mkAdmin("resetter@example.test");
    target = await mkAdmin("resetee@example.test");
  });

  it("records an attempt and returns its id", async () => {
    const r = await begin(target, actor);
    expect(r.code).toBe("ok");
    expect(r.log_id).toBeTruthy();
    const row = (await q("select target_id, actor_id, verified_how, outcome from mfa_reset_log where id = $1", [r.log_id]))[0];
    expect(row).toEqual({ target_id: target, actor_id: actor, verified_how: "video_call", outcome: "started" });
    await setOutcome(r.log_id, "completed");
  });
  it("stops the third reset of one target in a day, and counts a recent in-flight one", async () => {
    const second = await begin(target, actor);
    expect(second.code).toBe("ok");                         // 1 completed -> allowed; now 1 completed + 1 in flight
    expect((await begin(target, actor)).code).toBe("target_limit");
    await setOutcome(second.log_id, "completed");
    expect((await begin(target, actor)).code).toBe("target_limit");
  });
  it("lets a failed attempt be retried, and ignores an old abandoned one", async () => {
    const t2 = await mkAdmin("t2@example.test");
    const failed = await begin(t2, actor);
    await setOutcome(failed.log_id, "failed");
    const again = await begin(t2, actor);
    expect(again.code).toBe("ok");
    await setOutcome(again.log_id, "completed");
    const old = await begin(t2, actor);
    await db.exec(`update mfa_reset_log set created_at = now() - interval '2 hours' where id = '${old.log_id}'`);   // abandoned long ago, still 'started'
    expect((await begin(t2, actor)).code).toBe("ok");       // 1 completed + 0 in flight (the old one doesn't count)
  });
  it("stops a resetting admin after 5 completed resets in a day", async () => {
    const busy = await mkAdmin("busy@example.test");
    for (let i = 0; i < 5; i++) {
      const t = await mkAdmin(`victim${i}@example.test`);
      const r = await begin(t, busy);
      expect(r.code).toBe("ok");
      await setOutcome(r.log_id, "completed");
    }
    const t = await mkAdmin("victim-last@example.test");
    expect((await begin(t, busy)).code).toBe("actor_limit");
  });
  it("lets the rescue script (no actor) through without an actor limit", async () => {
    const t = await mkAdmin("rescued@example.test");
    const r = await begin(t, null, "service_role_script");
    expect(r.code).toBe("ok");
  });
});

describe("the enforce and rollback files", () => {
  it("rollback clears the date", async () => {
    await setEnforce("now() + interval '1 day'");
    await db.exec(rollback);
    expect(await enforceAfter()).toBeNull();
  });
  it("enforce REFUSES while an active admin has no verified authenticator", async () => {
    await db.exec(rollback);
    await db.exec(enforce);
    expect(await enforceAfter()).toBeNull();
    const missing = await q(`select p.email from profiles p where p.status = 'active' and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified') order by 1 limit 1`);
    expect(missing.length).toBe(1);                         // there really is someone unenrolled
  });
  it("an unverified factor doesn't count as enrolled", async () => {
    const rows = await q(`select id from profiles where status = 'active'`);
    for (const r of rows) await mkFactor(r.id, "unverified");
    await db.exec(rollback);
    await db.exec(enforce);
    expect(await enforceAfter()).toBeNull();
  });
  it("enforce sets a date about 3 days out once every active admin is enrolled", async () => {
    const rows = await q(`select id from profiles where status = 'active'`);
    for (const r of rows) await mkFactor(r.id, "verified");
    await db.exec(rollback);
    await db.exec(enforce);
    const s = Number((await q("select extract(epoch from (enforce_after - now())) as s from admin_mfa_settings"))[0].s);
    expect(s).toBeGreaterThan(2.99 * 86400);
    expect(s).toBeLessThan(3.01 * 86400);
  });
  it("re-running enforce never pushes the date later, even after enforcement has started", async () => {
    const soon = await enforceAfter();
    await db.exec(enforce);
    expect(String(await enforceAfter())).toBe(String(soon));      // still the earlier date
    await setEnforce("now() - interval '1 hour'");                // enforcement already in force
    const started = await enforceAfter();
    await db.exec(enforce);
    expect(String(await enforceAfter())).toBe(String(started));   // not reset to +3 days
  });
  it("rollback works again at the end", async () => {
    await db.exec(rollback);
    expect(await enforceAfter()).toBeNull();
  });
});
