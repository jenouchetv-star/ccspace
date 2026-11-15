// Applies the real supabase/studio-limits.sql to an in-memory Postgres (PGlite) and checks what it promises:
// the two limits tables are closed to every browser role, only an active admin can read or change them (through
// the RPCs), every value has a safe range, all nulls go back to the usual limits, a member's own limits are set and
// cleared by email and go when the member goes, and sound_space_usage() reports each member's effective limits.
// (As in test/soundSpaceSql.test.js, PGlite runs as a superuser, so grants are checked with has_*_privilege and the
// browser roles are tried with "set role". auth.uid() and is_active_admin() are small stand-ins for Supabase's.)
// All addresses are made-up ones on example.test; nothing here can send an email.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../supabase/studio-limits.sql", import.meta.url);
const sql = existsSync(file) ? readFileSync(file, "utf8") : "";
const soundSql = readFileSync(new URL("../supabase/sound-space.sql", import.meta.url), "utf8");
const ADMIN = "00000000-0000-0000-0000-00000000000a";
const STRANGER = "00000000-0000-0000-0000-00000000000b";
let db;
const q = async (text, params) => (await db.query(text, params)).rows;
const can = async (role, table, priv) => (await q("select has_table_privilege($1, $2, $3) as v", [role, table, priv]))[0].v;
/** Run one statement as a browser role (and, for authenticated, as a given user). */
async function as(role, uid, text, params) {
  await db.query("select set_config('test.uid', $1, false)", [uid || ""]);
  await db.exec("set role " + role);
  try { return (await db.query(text, params)).rows; } finally { await db.exec("reset role"); }
}
const admin = (text, params) => as("authenticated", ADMIN, text, params);
const one = async (text, params) => Object.values((await admin(text, params))[0])[0];
const get = () => one("select studio_limits_get() as v");
const setArt = (items, total, item, saves) => admin("select studio_limits_set('art', $1, $2, $3, $4)", [items, total, item, saves]);
const setSound = (items, total, item, saves) => admin("select studio_limits_set('sound', $1, $2, $3, $4)", [items, total, item, saves]);

// The live art_studio_usage() before this change, as pg_get_functiondef returned it on 2026-11-14 (renamed to
// art_studio_usage_before so both can run side by side): the replacement must return everything this returns.
const ART_USAGE_BEFORE = `CREATE OR REPLACE FUNCTION public.art_studio_usage_before(range_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz constant text := 'America/New_York';
  today date := (now() at time zone tz)::date;
  since date;
  prev_since date;
  result jsonb;
begin
  if not is_active_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if range_days is not null and range_days not in (7, 30, 90) then range_days := 30; end if;
  since := case when range_days is null then null else today - (range_days - 1) end;
  prev_since := case when range_days is null then null else since - range_days end;

  with live as (
    select a.*, (a.created_at at time zone tz)::date as made_day
    from art_projects a join subscribers s on s.id = a.subscriber_id
    where not a.deleted and s.data->>'status' = 'published'
  ),
  in_range as (select * from live where since is null or made_day >= since),
  per_member_days as (
    select subscriber_id, count(distinct made_day) as days from in_range group by subscriber_id
  ),
  counts as (
    select event, sum(count)::int as n from art_studio_daily
    where since is null or day >= since group by event
  ),
  prev_open as (
    select coalesce(sum(count), 0)::int as n from art_studio_daily
    where event = 'opened' and prev_since is not null and day >= prev_since and day < since
  ),
  weeks as (
    select generate_series(date_trunc('week', today::timestamp)::date - 49, date_trunc('week', today::timestamp)::date, interval '7 days')::date as wk
  ),
  week_rows as (
    select w.wk,
      coalesce((select sum(d.count) from art_studio_daily d where d.event = 'opened' and d.day >= w.wk and d.day < w.wk + 7), 0)::int as opened,
      coalesce((select count(*) from live l where l.made_day >= w.wk and l.made_day < w.wk + 7), 0)::int as saved
    from weeks w
  ),
  members as (
    select s.data->>'email' as email,
      count(*)::int as pictures,
      count(*) filter (where l.kind = 'paint')::int as paint,
      count(*) filter (where l.kind = 'pixel')::int as pixel,
      min(l.created_at) as first_at,
      max(l.updated_ms)::bigint as last_ms,
      coalesce(sum(l.bytes), 0)::bigint as bytes
    from live l join subscribers s on s.id = l.subscriber_id
    group by s.data->>'email'
  )
  select jsonb_build_object(
    'range', range_days,
    'today', today,
    'opened', coalesce((select n from counts where event = 'opened'), 0),
    'opened_before', (select n from prev_open),
    'signin_shown', coalesce((select n from counts where event = 'signin_shown'), 0),
    'signed_in', coalesce((select n from counts where event = 'signed_in'), 0),
    'joined', coalesce((select n from counts where event = 'joined'), 0),
    'came_back_members', (select count(*) from per_member_days where days >= 2),
    'active_members', (select count(*) from per_member_days),
    'members', (select count(distinct subscriber_id) from live),
    'active7', (select count(distinct subscriber_id) from live where updated_ms > (extract(epoch from now() - interval '7 days') * 1000)),
    'pictures', (select count(*) from live),
    'paint', (select count(*) from live where kind = 'paint'),
    'pixel', (select count(*) from live where kind = 'pixel'),
    'new7', (select count(*) from live where made_day > today - 7),
    'new30', (select count(*) from live where made_day > today - 30),
    'bytes', (select coalesce(sum(bytes), 0) from live),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'opened', opened, 'saved', saved) order by wk), '[]'::jsonb) from week_rows),
    'by_member', (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'pictures', pictures, 'paint', paint, 'pixel', pixel,
                   'first', first_at, 'last', last_ms, 'bytes', bytes) order by last_ms desc), '[]'::jsonb) from members)
  ) into result;
  return result;
end $function$`;

beforeAll(async () => {
  db = new PGlite();
  // Supabase's starting point: the browser roles, auth.uid(), the admins' profiles and is_active_admin(), the site's
  // subscribers and audit_log tables (id text primary key + data jsonb, as in supabase/migration.sql), Sound Space's
  // tables, and the default grants Supabase gives the browser roles on every new table and function.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table profiles (id uuid primary key, email text not null, name text not null default '', status text not null default 'invited');
    insert into profiles (id, email, name, status) values ('${ADMIN}', 'boss@example.test', 'Boss', 'active');
    create function is_active_admin() returns boolean language sql security definer set search_path = public stable as $$
      select exists (select 1 from profiles where id = auth.uid() and status = 'active') $$;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table audit_log (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table art_projects (subscriber_id text not null references subscribers(id) on delete cascade, project_id text not null, title text not null default '',
      kind text not null default 'paint', thumb text, data jsonb, bytes int not null default 0, updated_ms bigint not null default 0,
      deleted boolean not null default false, created_at timestamptz not null default now(), primary key (subscriber_id, project_id));
    create table art_studio_daily (day date not null, event text not null, count int not null default 0, primary key (day, event));
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function is_active_admin() to anon, authenticated;
  `);
  await db.exec(soundSql);
  await db.exec(ART_USAGE_BEFORE);
  await db.exec(sql);
}, 60000);

beforeEach(async () => {
  await db.exec(`
    delete from studio_member_limits; delete from studio_limits; delete from audit_log; delete from art_projects; delete from art_studio_daily;
    delete from sound_projects; delete from sound_space_daily; delete from subscribers;
    insert into subscribers (id, data) values
      ('sub-a', '{"email":"Parent.One@example.test","status":"published"}'),
      ('sub-b', '{"email":"b@example.test","status":"published"}');
  `);
});

describe("studio-limits.sql: the tables", () => {
  it("can be run again without error", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
    await db.exec(sql);
  });

  it("has the columns the functions and the admin page use, keyed per app and per member", async () => {
    const cols = async (t) => (await q("select column_name from information_schema.columns where table_name = $1 order by ordinal_position", [t])).map((c) => c.column_name);
    expect(await cols("studio_limits")).toEqual(["app", "max_items", "max_account_bytes", "max_item_bytes", "max_saves_per_hour", "updated_at", "updated_by"]);
    expect(await cols("studio_member_limits")).toEqual(["app", "subscriber_id", "max_items", "max_account_bytes", "updated_at", "updated_by"]);
    const fk = await q(`select confrelid::regclass::text as ref, confdeltype from pg_constraint where conrelid = 'studio_member_limits'::regclass and contype = 'f'`);
    expect(fk).toEqual([{ ref: "subscribers", confdeltype: "c" }]);
    await expect(db.exec("insert into studio_limits (app) values ('video')")).rejects.toThrow();
  });

  it("starts with no rows, so nothing changes until an admin saves", async () => {
    await db.exec(sql);
    expect(await q("select * from studio_limits")).toEqual([]);
    expect(await q("select * from studio_member_limits")).toEqual([]);
  });

  it("switches row level security on, with no policy, and gives the browser roles nothing", async () => {
    const rows = await q("select relname, relrowsecurity from pg_class where relname in ('studio_limits','studio_member_limits') order by relname");
    expect(rows).toEqual([{ relname: "studio_limits", relrowsecurity: true }, { relname: "studio_member_limits", relrowsecurity: true }]);
    expect(await q("select 1 from pg_policies where tablename in ('studio_limits','studio_member_limits')")).toEqual([]);
    for (const t of ["studio_limits", "studio_member_limits"]) {
      for (const role of ["anon", "authenticated"]) {
        for (const p of ["select", "insert", "update", "delete"]) expect(await can(role, t, p), `${role} ${p} ${t}`).toBe(false);
      }
      await expect(as("anon", "", `select * from ${t}`)).rejects.toThrow(/permission denied/);
      await expect(admin(`select * from ${t}`)).rejects.toThrow(/permission denied/);
    }
    await expect(admin("insert into studio_limits (app, max_items) values ('art', 5)")).rejects.toThrow(/permission denied/);
  });
});

describe("studio-limits.sql: who may call the RPCs", () => {
  const CALLS = [
    "select studio_limits_get()",
    "select studio_limits_set('art', 5, null, null, null)",
    "select studio_member_limit_set('art', 'b@example.test', 5, null)",
    "select sound_space_usage(30)",
  ];
  const SIGS = ["studio_limits_get()", "studio_limits_set(text, integer, bigint, integer, integer)", "studio_member_limit_set(text, text, integer, bigint)", "sound_space_usage(integer)"];

  it("are security definer with a fixed search_path, and only signed-in users may execute them", async () => {
    for (const name of ["studio_limits_get", "studio_limits_set", "studio_member_limit_set", "sound_space_usage"]) {
      const fn = (await q("select prosecdef, proconfig from pg_proc where proname = $1", [name]))[0];
      expect(fn.prosecdef, name).toBe(true);
      expect((fn.proconfig || []).join(","), name).toBe("search_path=public, pg_temp");
    }
    for (const sig of SIGS) {
      const r = (await q("select has_function_privilege('anon', $1, 'execute') as a, has_function_privilege('authenticated', $1, 'execute') as b", [sig]))[0];
      expect(r, sig).toEqual({ a: false, b: true });
    }
  });

  it("refuses anon outright, and a signed-in user who isn't an active admin", async () => {
    for (const c of CALLS) {
      await expect(as("anon", "", c), c).rejects.toThrow(/permission denied/);
      await expect(as("authenticated", STRANGER, c), c).rejects.toThrow(/not authorized/);
    }
    await db.exec(`update profiles set status = 'revoked' where id = '${ADMIN}'`);
    try { await expect(admin(CALLS[1])).rejects.toThrow(/not authorized/); }
    finally { await db.exec(`update profiles set status = 'active' where id = '${ADMIN}'`); }
    expect(await q("select * from studio_limits")).toEqual([]);
    expect(await q("select * from studio_member_limits")).toEqual([]);
  });

  it("the private defaults helper is not callable from the browser", async () => {
    const r = (await q("select has_function_privilege('anon', 'studio_limit_defaults(text)', 'execute') as a, has_function_privilege('authenticated', 'studio_limit_defaults(text)', 'execute') as b"))[0];
    expect(r).toEqual({ a: false, b: false });
  });
});

describe("studio-limits.sql: changing the limits for everyone", () => {
  it("with no rows, returns the usual limits for both apps, none custom", async () => {
    const v = await get();
    expect(v.art).toMatchObject({ max_items: 200, max_account_bytes: 100000000, max_item_bytes: 3000000, max_saves_per_hour: 600,
      custom: { max_items: false, max_account_bytes: false, max_item_bytes: false, max_saves_per_hour: false } });
    expect(v.sound).toMatchObject({ max_items: 200, max_account_bytes: 20000000, max_item_bytes: 500000, max_saves_per_hour: 600 });
    expect(v.art.defaults).toEqual({ max_items: 200, max_account_bytes: 100000000, max_item_bytes: 3000000, max_saves_per_hour: 600 });
    expect(v.sound.defaults).toEqual({ max_items: 200, max_account_bytes: 20000000, max_item_bytes: 500000, max_saves_per_hour: 600 });
    expect(v.members).toEqual([]);
  });

  it("an admin can set an app's limits; the other app is untouched; it goes in the activity log", async () => {
    const res = await setArt(300, 250000000, 4000000, 900);
    const v = Object.values(res[0])[0];
    expect(v.art).toMatchObject({ max_items: 300, max_account_bytes: 250000000, max_item_bytes: 4000000, max_saves_per_hour: 900,
      custom: { max_items: true, max_account_bytes: true, max_item_bytes: true, max_saves_per_hour: true } });
    expect(v.sound.custom.max_items).toBe(false);
    const row = (await q("select * from studio_limits"))[0];
    expect(row).toMatchObject({ app: "art", max_items: 300, updated_by: "Boss" });
    const log = (await q("select data from audit_log")).map((r) => r.data);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "update", collection: "studio", recordId: "studio-limits-art", actor: "Boss" });
    expect(log[0].label).toBe("Space limits, Art Space: 300 pictures, 250 MB in all, 4 MB largest, 900 saves an hour");
    expect(log[0].id).toBe((await q("select id from audit_log"))[0].id);
    expect(log[0].id).toMatch(/^log-/);
    expect(Number.isNaN(Date.parse(log[0].at))).toBe(false);
    // a second save changes the row in place
    await setArt(250, null, null, null);
    expect((await q("select max_items, max_account_bytes from studio_limits"))).toEqual([{ max_items: 250, max_account_bytes: null }]);
    expect((await get()).art).toMatchObject({ max_items: 250, max_account_bytes: 100000000, custom: { max_items: true, max_account_bytes: false } });
  });

  it("rejects values outside the safe ranges, with the range in plain words, and changes nothing", async () => {
    const bad = [
      [() => setArt(0, null, null, null), /between 1 and 2,000/], [() => setArt(2001, null, null, null), /between 1 and 2,000/],
      [() => setArt(null, 999999, null, null), /between 1 MB and 1,000 MB/], [() => setArt(null, 1000000001, null, null), /between 1 MB and 1,000 MB/],
      [() => setArt(null, null, 99999, null), /between 0.1 MB and 10 MB/], [() => setArt(null, null, 10000001, null), /between 0.1 MB and 10 MB/],
      [() => setSound(null, null, 49999, null), /between 0.05 MB and 2 MB/], [() => setSound(null, null, 2000001, null), /between 0.05 MB and 2 MB/],
      [() => setSound(null, null, null, 59), /between 60 and 3,600/], [() => setSound(null, null, null, 3601), /between 60 and 3,600/],
      [() => admin("select studio_limits_set('video', 5, null, null, null)"), /Unknown app/],
      [() => admin("select studio_limits_set(null, 5, null, null, null)"), /Unknown app/],
    ];
    for (const [fn, msg] of bad) await expect(fn()).rejects.toThrow(msg);
    expect(await q("select * from studio_limits")).toEqual([]);
    expect(await q("select * from audit_log")).toEqual([]);
    // the edges themselves are fine, and 3 MB is a fine largest picture but too big for a song
    await setArt(1, 1000000, 100000, 60);
    await setArt(2000, 1000000000, 10000000, 3600);
    await setSound(null, null, 2000000, null);
    await expect(setSound(null, null, 3000000, null)).rejects.toThrow(/between 0.05 MB and 2 MB/);
  });

  it("all nulls go back to the usual limits (the row goes) and say so in the log", async () => {
    await setSound(100, 5000000, 100000, 120);
    expect((await get()).sound.max_items).toBe(100);
    await setSound(null, null, null, null);
    expect(await q("select * from studio_limits")).toEqual([]);
    const v = await get();
    expect(v.sound).toMatchObject({ max_items: 200, max_account_bytes: 20000000, max_item_bytes: 500000, max_saves_per_hour: 600, custom: { max_items: false } });
    const labels = (await q("select data->>'label' as l from audit_log order by created_at, id")).map((r) => r.l);
    expect(labels).toContain("Space limits, Sound Space: back to the usual limits");
  });
});

describe("studio-limits.sql: one member's own limits", () => {
  it("are set by email (any case), shown in the list, and cleared with nulls", async () => {
    const v = Object.values((await admin("select studio_member_limit_set('sound', '  parent.one@EXAMPLE.test ', 400, 40000000)"))[0])[0];
    expect(v.members).toEqual([{ app: "sound", email: "Parent.One@example.test", max_items: 400, max_account_bytes: 40000000 }]);
    expect((await q("select subscriber_id, updated_by from studio_member_limits"))).toEqual([{ subscriber_id: "sub-a", updated_by: "Boss" }]);
    const log = (await q("select data from audit_log"))[0].data;
    expect(log).toMatchObject({ collection: "studio", recordId: "studio-limits-sound-member", label: "Space limits for Parent.One@example.test, Sound Space: 400 songs, 40 MB in all" });
    // one value left empty uses the standard one for that
    await admin("select studio_member_limit_set('sound', 'parent.one@example.test', null, 30000000)");
    expect((await q("select max_items, max_account_bytes from studio_member_limits"))).toEqual([{ max_items: null, max_account_bytes: 30000000 }]);
    await admin("select studio_member_limit_set('sound', 'parent.one@example.test', null, null)");
    expect(await q("select * from studio_member_limits")).toEqual([]);
    expect((await q("select data->>'label' as l from audit_log")).map((r) => r.l)).toContain("Space limits for Parent.One@example.test, Sound Space: back to standard");
  });

  it("refuses an unknown email and values outside the ranges", async () => {
    await expect(admin("select studio_member_limit_set('art', 'nobody@example.test', 10, null)")).rejects.toThrow(/No member with the email nobody@example.test/);
    await expect(admin("select studio_member_limit_set('art', '', 10, null)")).rejects.toThrow(/No member/);
    await expect(admin("select studio_member_limit_set('art', 'b@example.test', 2001, null)")).rejects.toThrow(/between 1 and 2,000/);
    await expect(admin("select studio_member_limit_set('art', 'b@example.test', null, 999999)")).rejects.toThrow(/between 1 MB and 1,000 MB/);
    await expect(admin("select studio_member_limit_set('game', 'b@example.test', 10, null)")).rejects.toThrow(/Unknown app/);
    expect(await q("select * from studio_member_limits")).toEqual([]);
  });

  it("go when the member is removed from the list", async () => {
    await admin("select studio_member_limit_set('art', 'b@example.test', 300, 300000000)");
    await admin("select studio_member_limit_set('sound', 'b@example.test', 300, 30000000)");
    expect(await q("select count(*)::int as n from studio_member_limits")).toEqual([{ n: 2 }]);
    await db.exec("delete from subscribers where id = 'sub-b'");
    expect(await q("select * from studio_member_limits")).toEqual([]);
  });
});

describe("studio-limits.sql: art_studio_usage() replaced, with each member's limits", () => {
  const NEW_KEYS = ["max_items", "max_bytes", "custom"];
  const strip = (u) => ({ ...u, by_member: u.by_member.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !NEW_KEYS.includes(k)))) });
  beforeEach(async () => {
    const now = Date.now(), day = 86_400_000;
    await db.exec(`
      insert into subscribers (id, data) values
        ('sub-c', '{"email":"gone@example.test","status":"unsubscribed"}'),
        ('sub-d', '{"email":"d@example.test","status":"published"}');
      insert into art_projects (subscriber_id, project_id, kind, data, bytes, updated_ms, deleted, created_at) values
        ('sub-a', 'pic-1', 'paint', '{}', 1000, ${now - 1000}, false, now() - interval '2 days'),
        ('sub-a', 'pic-2', 'pixel', '{}', 2500, ${now - 3 * day}, false, now() - interval '12 days'),
        ('sub-a', 'pic-3', 'paint', null, 0, ${now}, true, now() - interval '1 day'),
        ('sub-b', 'pic-1', 'paint', '{}', 700, ${now - 20 * day}, false, now() - interval '20 days'),
        ('sub-c', 'pic-1', 'paint', '{}', 900, ${now - 500}, false, now() - interval '3 days'),
        ('sub-d', 'pic-1', 'pixel', '{}', 300, ${now - 40 * day}, false, now() - interval '40 days'),
        ('sub-d', 'pic-2', 'paint', '{}', 400, ${now - 39 * day}, false, now() - interval '39 days');
      insert into art_studio_daily (day, event, count) values
        ((now() at time zone 'America/New_York')::date, 'opened', 5), ((now() at time zone 'America/New_York')::date - 3, 'opened', 2),
        ((now() at time zone 'America/New_York')::date - 10, 'opened', 4), ((now() at time zone 'America/New_York')::date - 60, 'opened', 7),
        ((now() at time zone 'America/New_York')::date, 'signin_shown', 3), ((now() at time zone 'America/New_York')::date, 'signed_in', 2),
        ((now() at time zone 'America/New_York')::date - 1, 'joined', 1);
    `);
  });

  it("returns everything the live one did, with the same values, for every range", async () => {
    for (const r of [7, 30, 90, null, 45, 0]) {
      const before = await one("select art_studio_usage_before($1) as v", [r]);
      const after = await one("select art_studio_usage($1) as v", [r]);
      expect(Object.keys(after).sort(), String(r)).toEqual(Object.keys(before).sort());
      expect(strip(after), String(r)).toEqual(before);
    }
    const u = await one("select art_studio_usage(7) as v");
    expect(u).toMatchObject({ range: 7, members: 3, pictures: 5, paint: 3, pixel: 2, bytes: 4900, opened: 7, opened_before: 4, signin_shown: 3, signed_in: 2, joined: 1 });
    expect(await one("select art_studio_usage() as v")).toMatchObject({ range: 30 });   // the default stays 30
    expect(u.by_member.map((m) => m.email)).toEqual(["Parent.One@example.test", "b@example.test", "d@example.test"]);
    expect(Object.keys(u.by_member[0]).sort()).toEqual(["bytes", "custom", "email", "first", "last", "max_bytes", "max_items", "paint", "pictures", "pixel"]);
  });

  it("gives each member their effective limits: their own over Art Space's over the usual ones", async () => {
    const lims = async () => (await one("select art_studio_usage(30) as v")).by_member.map((m) => [m.email, m.max_items, m.max_bytes, m.custom]);
    expect(await lims()).toEqual([
      ["Parent.One@example.test", 200, 100000000, false], ["b@example.test", 200, 100000000, false], ["d@example.test", 200, 100000000, false]]);
    await setArt(300, 250000000, null, null);
    await admin("select studio_member_limit_set('art', 'b@example.test', 500, null)");
    await admin("select studio_member_limit_set('art', 'd@example.test', 50, 5000000)");
    await admin("select studio_member_limit_set('sound', 'parent.one@example.test', 7, 7000000)");   // Sound Space's: ignored here
    expect(await lims()).toEqual([
      ["Parent.One@example.test", 300, 250000000, false], ["b@example.test", 500, 250000000, true], ["d@example.test", 50, 5000000, true]]);
    await setArt(null, null, null, null);
    await admin("select studio_member_limit_set('art', 'd@example.test', null, null)");
    expect((await lims()).map((r) => r.slice(1))).toEqual([[200, 100000000, false], [500, 100000000, true], [200, 100000000, false]]);
  });

  it("is still admins only, security definer, stable, with search_path public, pg_temp", async () => {
    await expect(as("anon", "", "select art_studio_usage(30)")).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", STRANGER, "select art_studio_usage(30)")).rejects.toThrow(/not allowed/);
    const fn = (await q("select prosecdef, provolatile, proconfig from pg_proc where proname = 'art_studio_usage'"))[0];
    expect(fn).toMatchObject({ prosecdef: true, provolatile: "s" });
    expect(fn.proconfig.join(",")).toBe("search_path=public, pg_temp");
    const ex = (await q("select has_function_privilege('anon', 'art_studio_usage(integer)', 'execute') as a, has_function_privilege('authenticated', 'art_studio_usage(integer)', 'execute') as b"))[0];
    expect(ex).toEqual({ a: false, b: true });
  });
});

describe("studio-limits.sql: sound_space_usage()", () => {
  beforeEach(async () => {
    const now = Date.now();
    await db.exec(`
      insert into sound_projects (subscriber_id, project_id, title, data, bytes, updated_ms, deleted, created_at) values
        ('sub-a', 'song-1', 'One', '{}', 1000, ${now - 1000}, false, now() - interval '2 days'),
        ('sub-a', 'song-2', 'Two', '{}', 2000, ${now - 500}, false, now() - interval '40 days'),
        ('sub-a', 'song-3', '', null, 0, ${now}, true, now() - interval '1 day'),
        ('sub-b', 'song-1', 'Theirs', '{}', 500, ${now - 86_400_000 * 20}, false, now() - interval '20 days');
      insert into sound_space_daily (day, event, count) values
        ((now() at time zone 'utc')::date, 'opened', 5), ((now() at time zone 'utc')::date - 3, 'opened', 2),
        ((now() at time zone 'utc')::date - 60, 'opened', 7), ((now() at time zone 'utc')::date, 'song_played', 4),
        ((now() at time zone 'utc')::date, 'signin_shown', 3), ((now() at time zone 'utc')::date, 'signed_in', 1),
        ((now() at time zone 'utc')::date - 1, 'song_exported', 2);
    `);
  });

  it("counts members, songs and space (deleted songs left out), with each member's effective limits", async () => {
    const u = await one("select sound_space_usage(30) as v");
    expect(u).toMatchObject({ members: 2, songs: 3, bytes: 3500, new7: 1, new30: 2, active7: 1,
      opened: 7, signin_shown: 3, signed_in: 1, song_played: 4, song_exported: 2 });
    expect(u.by_member.map((m) => [m.email, m.songs, m.bytes, m.max_items, m.max_bytes, m.custom])).toEqual([
      ["Parent.One@example.test", 2, 3000, 200, 20000000, false],
      ["b@example.test", 1, 500, 200, 20000000, false],
    ]);
    const a = u.by_member[0];
    expect(typeof a.first).toBe("string");
    expect(Number(a.last)).toBeGreaterThan(Date.now() - 60_000);
    expect((await one("select sound_space_usage(0) as v")).opened).toBe(14);   // 0: all time
    expect((await one("select sound_space_usage(null) as v")).opened).toBe(14);
  });

  it("uses the app's saved limits, and a member's own limits over them", async () => {
    await setSound(150, 10000000, null, null);
    await admin("select studio_member_limit_set('sound', 'b@example.test', 400, null)");
    await admin("select studio_member_limit_set('art', 'parent.one@example.test', 5, 5000000)");   // the other app: ignored here
    const u = await one("select sound_space_usage(7) as v");
    expect(u.by_member.map((m) => [m.email, m.max_items, m.max_bytes, m.custom])).toEqual([
      ["Parent.One@example.test", 150, 10000000, false],
      ["b@example.test", 400, 10000000, true],
    ]);
  });
});
