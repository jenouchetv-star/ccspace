// Applies the real supabase/child-avatars.sql (after supabase/kid-progress.sql, which it needs) to an in-memory
// Postgres (PGlite): children get an avatar column that keeps only the 20 avatars, children already kept get one
// each, and running it again changes nothing. All addresses are made-up ones on example.test.
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";
import { AVATAR_IDS } from "../assets/lib/avatars.js";

const read = (name) => { const f = new URL(`../supabase/${name}`, import.meta.url); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
const sql = read("child-avatars.sql");
let db;
const q = async (text, params) => (await db.query(text, params)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function is_active_admin() returns boolean language sql stable as $$ select false $$;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(read("kid-progress.sql"));
  await db.exec(`insert into subscribers (id, data) values ('sub-a', '{"email":"parent@example.test","status":"published"}');`);
  for (let i = 0; i < 40; i++) await db.query("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', $1, 2, 2026)", ["Kid" + i]);
}, 60000);

describe("child-avatars.sql", () => {
  it("gives every child already kept one of the 20, at random", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
    const rows = await q("select avatar from children");
    expect(rows).toHaveLength(40);
    for (const r of rows) expect(AVATAR_IDS).toContain(r.avatar);
    expect(new Set(rows.map((r) => r.avatar)).size).toBeGreaterThan(3);
  });

  it("can be run again, and keeps the avatars already given", async () => {
    const before = await q("select id, avatar from children order by id");
    await db.exec(sql);
    expect(await q("select id, avatar from children order by id")).toEqual(before);
  });

  it("keeps only the 20 avatars (or none)", async () => {
    const id = (await q("select id from children limit 1"))[0].id;
    for (const a of AVATAR_IDS) await q("update children set avatar = $1 where id = $2", [a, id]);
    await q("update children set avatar = null where id = $1", [id]);
    for (const bad of ["unicorn", "", "Robot"]) await expect(q("update children set avatar = $1 where id = $2", [bad, id])).rejects.toThrow();
  });

  it("names the same 20 as the site, in its order", () => {
    const lists = sql.match(/'robot'[^)\]]*'star'/g);
    expect(lists).toHaveLength(2);
    for (const l of lists) expect(l.match(/'([a-z]+)'/g).map((s) => s.slice(1, -1))).toEqual([...AVATAR_IDS]);
  });
});
