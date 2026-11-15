// Applies the real supabase/sound-space.sql to an in-memory Postgres (PGlite) and checks what it promises:
// members' songs are closed to the public key, they go when the member goes, and the usage counter only takes
// the five known events. (As in test/portalSql.test.js, PGlite runs as a superuser, so row-level security is
// read from the catalog and grants are checked with has_table_privilege; the counter is also called as anon.)
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../supabase/sound-space.sql", import.meta.url);
const sql = existsSync(file) ? readFileSync(file, "utf8") : "";
let db;
const q = async (text, params) => (await db.query(text, params)).rows;
const can = async (role, table, priv) => (await q("select has_table_privilege($1, $2, $3) as v", [role, table, priv]))[0].v;
const countOf = async (ev) => Number((await q("select coalesce(sum(count), 0) as n from sound_space_daily where event = $1", [ev]))[0].n);
const asAnon = async (text) => { await db.exec("set role anon"); try { return await db.exec(text); } finally { await db.exec("reset role"); } };

beforeAll(async () => {
  db = new PGlite();
  // Supabase's starting point: the browser roles, the site's subscribers table (id text primary key, as in
  // supabase/migration.sql), and the default grants Supabase gives those roles on every new table and function.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(sql);
}, 60000);

describe("song table is closed to the public key, follows its member on delete, and the counter only takes known events", () => {
  it("can be run again without error", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
  });

  it("has the columns the sound-cloud function uses", async () => {
    const cols = await q("select column_name, data_type, column_default from information_schema.columns where table_name = 'sound_projects' order by ordinal_position");
    expect(cols.map((c) => c.column_name)).toEqual(["subscriber_id", "project_id", "title", "thumb", "data", "bytes", "updated_ms", "deleted", "created_at"]);
    const pk = await q(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = 'sound_projects'::regclass and i.indisprimary order by a.attname`);
    expect(pk.map((r) => r.attname)).toEqual(["project_id", "subscriber_id"]);
    const fk = await q(`select confrelid::regclass::text as ref, confdeltype from pg_constraint where conrelid = 'sound_projects'::regclass and contype = 'f'`);
    expect(fk).toEqual([{ ref: "subscribers", confdeltype: "c" }]);
  });

  it("switches row level security on, with no policy that could open either table", async () => {
    const rows = await q("select relname, relrowsecurity from pg_class where relname in ('sound_projects','sound_space_daily') order by relname");
    expect(rows).toEqual([
      { relname: "sound_projects", relrowsecurity: true },
      { relname: "sound_space_daily", relrowsecurity: true },
    ]);
    expect(await q("select 1 from pg_policies where tablename in ('sound_projects','sound_space_daily')")).toEqual([]);
  });

  it("anon cannot select, insert, update or delete sound_projects (nor the daily counts)", async () => {
    for (const t of ["sound_projects", "sound_space_daily"]) {
      for (const role of ["anon", "authenticated"]) {
        for (const p of ["select", "insert", "update", "delete"]) expect(await can(role, t, p), `${role} ${p} ${t}`).toBe(false);
      }
    }
    await expect(asAnon("select * from sound_projects")).rejects.toThrow(/permission denied/);
    await expect(asAnon("insert into sound_projects (subscriber_id, project_id) values ('x','y')")).rejects.toThrow(/permission denied/);
  });

  it("deleting a subscriber removes their rows", async () => {
    await db.exec(`
      insert into subscribers (id, data) values ('sub-a', '{}'), ('sub-b', '{}');
      insert into sound_projects (subscriber_id, project_id, title, data, bytes, updated_ms) values
        ('sub-a', 'song-1', 'One', '{}', 2, 1), ('sub-a', 'song-2', 'Two', '{}', 2, 2), ('sub-b', 'song-1', 'Theirs', '{}', 2, 3);
    `);
    const row = (await q("select title, thumb, bytes, deleted, created_at is not null as made from sound_projects where subscriber_id = 'sub-a' and project_id = 'song-1'"))[0];
    expect(row).toEqual({ title: "One", thumb: null, bytes: 2, deleted: false, made: true });
    await db.exec("delete from subscribers where id = 'sub-a'");
    expect(await q("select subscriber_id, project_id from sound_projects order by 1, 2")).toEqual([{ subscriber_id: "sub-b", project_id: "song-1" }]);
    await expect(db.exec("insert into sound_projects (subscriber_id, project_id) values ('nobody', 'x')")).rejects.toThrow();
  });

  it("sound_space_count('hack') adds nothing; sound_space_count('opened') adds 1", async () => {
    const before = await countOf("opened");
    await asAnon("select sound_space_count('hack')");
    await asAnon("select sound_space_count(null)");
    expect(await q("select event from sound_space_daily where event not in ('opened','signin_shown','signed_in','song_played','song_exported')")).toEqual([]);
    await asAnon("select sound_space_count('opened')");
    expect(await countOf("opened")).toBe(before + 1);
    for (const ev of ["signin_shown", "signed_in", "song_played", "song_exported"]) {
      await asAnon(`select sound_space_count('${ev}')`);
      expect(await countOf(ev)).toBe(1);
    }
    expect(await countOf("hack")).toBe(0);
  });

  it("stops counting at 100000 a day", async () => {
    await db.exec("update sound_space_daily set count = 100000 where event = 'opened' and day = (now() at time zone 'utc')::date");
    await asAnon("select sound_space_count('opened')");
    expect(await countOf("opened")).toBe(100000);
  });

  it("the counter is security definer with a fixed search_path, callable by the browser roles", async () => {
    const fn = (await q(`select prosecdef, proconfig from pg_proc where proname = 'sound_space_count'`))[0];
    expect(fn.prosecdef).toBe(true);
    expect((fn.proconfig || []).join(",")).toMatch(/^search_path=/);
    const ex = await q("select has_function_privilege('anon', 'sound_space_count(text)', 'execute') as a, has_function_privilege('authenticated', 'sound_space_count(text)', 'execute') as b");
    expect(ex[0]).toEqual({ a: true, b: true });
  });
});
