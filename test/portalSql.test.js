// Applies the real supabase/newsletter-portal.sql to an in-memory Postgres (PGlite) and checks
// the privacy promises it makes: the archive is admin-only, and the token and session tables
// are closed to every browser role. (As with the 2FA SQL tests, PGlite runs as a superuser, so
// row-level security is read from the catalog and grants are checked with has_table_privilege.)
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/newsletter-portal.sql", import.meta.url), "utf8");
let db;
const q = async (text, params) => (await db.query(text, params)).rows;
const can = async (role, table, priv) => (await q("select has_table_privilege($1, $2, $3) as v", [role, table, priv]))[0].v;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function is_active_admin() returns boolean language sql as $$ select false $$;
  `);
  await db.exec(sql);
}, 60000);

describe("newsletter-portal.sql", () => {
  it("can be run again without error", async () => {
    await db.exec(sql);
    await db.exec(sql);
  });

  it("switches row level security on for all three tables", async () => {
    const rows = await q("select relname, relrowsecurity from pg_class where relname in ('portal_entries','portal_tokens','portal_sessions') order by relname");
    expect(rows).toEqual([
      { relname: "portal_entries", relrowsecurity: true },
      { relname: "portal_sessions", relrowsecurity: true },
      { relname: "portal_tokens", relrowsecurity: true },
    ]);
  });

  it("keeps the archive away from the public key and gives it to admins only", async () => {
    for (const p of ["select", "insert", "update", "delete"]) expect(await can("anon", "portal_entries", p)).toBe(false);
    for (const p of ["select", "insert", "update", "delete"]) expect(await can("authenticated", "portal_entries", p)).toBe(true);
    const policies = await q("select policyname, roles, cmd, qual, with_check from pg_policies where tablename = 'portal_entries'");
    expect(policies).toHaveLength(1);
    expect(policies[0].qual).toContain("is_active_admin()");
    expect(policies[0].with_check).toContain("is_active_admin()");
  });

  it("closes the token and session tables to every browser role - and has no policy that could open them", async () => {
    for (const t of ["portal_tokens", "portal_sessions"]) {
      for (const role of ["anon", "authenticated"]) {
        for (const p of ["select", "insert", "update", "delete"]) expect(await can(role, t, p)).toBe(false);
      }
      expect(await q("select 1 from pg_policies where tablename = $1", [t])).toEqual([]);
    }
  });

  it("only allows the two kinds of verification link", async () => {
    await db.exec("insert into portal_tokens (token_hash, purpose, subscriber_id, email_hash, expires_at) values ('h1','login','s','e', now())");
    await expect(db.exec("insert into portal_tokens (token_hash, purpose, subscriber_id, email_hash, expires_at) values ('h2','admin','s','e', now())")).rejects.toThrow();
  });

  it("forgets links and sessions that ran out over a week ago, and only those", async () => {
    await db.exec(`
      delete from portal_tokens; delete from portal_sessions;
      insert into portal_tokens (token_hash, purpose, subscriber_id, email_hash, expires_at) values
        ('old','login','s','e', now() - interval '8 days'), ('recent','login','s','e', now() - interval '1 day'), ('live','login','s','e', now() + interval '1 day');
      insert into portal_sessions (token_hash, subscriber_id, expires_at) values
        ('old','s', now() - interval '8 days'), ('live','s', now() + interval '1 day');
    `);
    await db.exec("select portal_cleanup()");
    expect((await q("select token_hash from portal_tokens order by 1")).map((r) => r.token_hash)).toEqual(["live", "recent"]);
    expect((await q("select token_hash from portal_sessions")).map((r) => r.token_hash)).toEqual(["live"]);
    expect(await can("anon", "portal_entries", "select")).toBe(false);
    const fn = await q("select has_function_privilege('anon', 'portal_cleanup()', 'execute') as a, has_function_privilege('authenticated', 'portal_cleanup()', 'execute') as b");
    expect(fn[0]).toEqual({ a: false, b: false });
  });
});

describe("portal_game_files and the Gravity 4 seed", () => {
  const seedSql = readFileSync(new URL("../supabase/portal-gravity-four.sql", import.meta.url), "utf8");

  it("is closed to the public key and open to admins only", async () => {
    expect((await q("select relrowsecurity r from pg_class where relname = 'portal_game_files'"))[0].r).toBe(true);
    for (const p of ["select", "insert", "update", "delete"]) expect(await can("anon", "portal_game_files", p)).toBe(false);
    const pol = await q("select qual, with_check from pg_policies where tablename = 'portal_game_files'");
    expect(pol).toHaveLength(1);
    expect(pol[0].qual).toContain("is_active_admin()");
    expect(pol[0].with_check).toContain("is_active_admin()");
  });

  it("loads the game and a draft entry, and can be run again without overwriting an edited entry", async () => {
    await db.exec(seedSql);
    const file = (await q("select data from portal_game_files where id = 'gravity-four'"))[0].data;
    const src = readFileSync(new URL("../supabase/private-games/chikes-gravity-four.html", import.meta.url), "utf8").split("\r\n").join("\n");
    expect(file.html).toBe(src);
    const entry = (await q("select data from portal_entries where id = 'portal-gravity-four'"))[0].data;
    expect(entry).toMatchObject({ layout: "game", status: "draft", privateGameId: "gravity-four", gamePath: "", gameId: "" });
    await db.exec("update portal_entries set data = jsonb_set(data, '{title}', '\"Edited\"') where id = 'portal-gravity-four'");
    await db.exec(seedSql);
    expect((await q("select data->>'title' t from portal_entries where id = 'portal-gravity-four'"))[0].t).toBe("Edited");
  });

  it("has no copy on the public site: not in games/, and supabase/ is kept out of the deploy", () => {
    expect(existsSync(new URL("../games/chikes-gravity-four.html", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../assets/games/chikes-gravity-four.html", import.meta.url))).toBe(false);
    const ignore = readFileSync(new URL("../.assetsignore", import.meta.url), "utf8").split("\n").map((l) => l.trim());
    expect(ignore).toContain("supabase/");
    for (const f of ["../sitemap.xml", "../llms.txt", "../sw.js", "../robots.txt"]) {
      expect(readFileSync(new URL(f, import.meta.url), "utf8")).not.toMatch(/gravity[-_ ]?four/i);
    }
  });
});

describe("the rest of the repo agrees with it", () => {
  it("is carried, unchanged, in migration.sql for a fresh project", () => {
    const lf = (text) => text.split("\r\n").join("\n");
    const migration = lf(readFileSync(new URL("../supabase/migration.sql", import.meta.url), "utf8"));
    expect(migration).toContain(lf(sql));
  });
});

describe("game-files.sql", () => {
  const gf = readFileSync(new URL("../supabase/game-files.sql", import.meta.url), "utf8");

  it("applies, can be run again, and is carried in migration.sql", async () => {
    await db.exec(gf);
    await db.exec(gf);
    const lf = (t) => t.split("\r\n").join("\n");
    expect(lf(readFileSync(new URL("../supabase/migration.sql", import.meta.url), "utf8"))).toContain(lf(gf));
  });

  it("lets anyone read a game's code but only an admin change it", async () => {
    expect((await q("select relrowsecurity r from pg_class where relname = 'game_files'"))[0].r).toBe(true);
    expect(await can("anon", "game_files", "select")).toBe(true);
    expect(await can("authenticated", "game_files", "select")).toBe(true);
    for (const p of ["insert", "update", "delete"]) expect(await can("anon", "game_files", p)).toBe(false);
    const pol = await q("select policyname, cmd, qual, with_check from pg_policies where tablename = 'game_files' order by policyname");
    expect(pol.find((x) => x.policyname === "anyone can read").cmd).toBe("SELECT");
    expect(pol.find((x) => x.policyname === "admin writes").qual).toContain("is_active_admin()");
    expect(pol.find((x) => x.policyname === "admin writes").with_check).toContain("is_active_admin()");
  });
});
