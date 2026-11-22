// Applies the real supabase/game-answers.sql (after supabase/kid-progress.sql, which it needs) to an in-memory
// Postgres (PGlite) and checks what it promises: child_game_answers exists with the columns the kid-progress function
// writes, is closed to every browser role, goes with its child, and keeps only the six STEAMM subjects and capped
// text. (PGlite runs as a superuser, so grants are checked with has_*_privilege, as in test/kidProgressSql.test.js.)
// All addresses are made-up ones on example.test; nothing here can send an email.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const read = (name) => { const f = new URL(`../supabase/${name}`, import.meta.url); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
const kidSql = read("kid-progress.sql");
const sql = read("game-answers.sql");
let db, child;
const q = async (text, params) => (await db.query(text, params)).rows;
const add = (o = {}) => {
  const r = { game: "solar-system-sandbox", qid: "sun-1", subject: "science", level: "g23", correct: true, question: "What is the Sun?", answer: "A star", why: "It makes its own light.", ...o };
  return db.query(
    "insert into child_game_answers (child_id, game, qid, subject, level, correct, question, answer, why) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [child, r.game, r.qid, r.subject, r.level, r.correct, r.question, r.answer, r.why],
  );
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function is_active_admin() returns boolean language sql stable as $$ select false $$;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(kidSql);
  await db.exec(sql);
}, 60000);

beforeEach(async () => {
  await db.exec(`
    delete from child_game_answers; delete from children; delete from subscribers;
    insert into subscribers (id, data) values ('sub-a', '{"email":"parent@example.test","status":"published"}');
  `);
  child = (await q("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', 'Maya', 2, 2026) returning id"))[0].id;
});

describe("game-answers.sql", () => {
  it("can be run again without error", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
    await db.exec(sql);
  });

  it("has the columns the function writes, an id and a time that fill themselves, and the (child_id, at desc) index", async () => {
    const cols = (await q("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'child_game_answers' order by ordinal_position")).map((c) => c.column_name);
    expect(cols).toEqual(["id", "child_id", "game", "qid", "subject", "level", "correct", "question", "answer", "why", "at"]);
    await add();
    await add({ correct: false });
    const rows = await q("select id, at from child_game_answers order by id");
    expect(rows).toHaveLength(2);
    expect(Number(rows[1].id)).toBeGreaterThan(Number(rows[0].id));
    expect(rows[0].at).toBeInstanceOf(Date);
    const idx = await q("select indexdef from pg_indexes where tablename = 'child_game_answers' and indexname = 'child_game_answers_child_idx'");
    expect(idx[0].indexdef).toMatch(/\(child_id, at DESC\)/);
  });

  it("is closed to anon and authenticated: row level security on, no policies, no grants", async () => {
    expect((await q("select relrowsecurity from pg_class where relname = 'child_game_answers'"))[0].relrowsecurity).toBe(true);
    for (const role of ["anon", "authenticated"]) {
      for (const p of ["select", "insert", "update", "delete"]) {
        expect((await q("select has_table_privilege($1, 'child_game_answers', $2) as v", [role, p]))[0].v, `${role} ${p}`).toBe(false);
      }
      expect((await q("select has_sequence_privilege($1, 'child_game_answers_id_seq', 'usage') as v", [role]))[0].v, `${role} sequence`).toBe(false);
    }
    expect(await q("select 1 from pg_policies where tablename = 'child_game_answers'")).toEqual([]);
  });

  it("removing a child, or the member, removes the child's answers", async () => {
    await add();
    const other = (await q("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', 'Leo', 0, 2026) returning id"))[0].id;
    await q("insert into child_game_answers (child_id, game, qid, subject, correct) values ($1, 'pop-quiz', 'episode:e1:fact', 'math', false)", [other]);
    await q("delete from children where id = $1", [child]);
    expect(await q("select child_id from child_game_answers")).toEqual([{ child_id: other }]);
    await db.exec("delete from subscribers where id = 'sub-a'");
    expect((await q("select count(*)::int as n from child_game_answers"))[0].n).toBe(0);
  });

  it("keeps only the six STEAMM subjects and Reading and Writing, and needs a child", async () => {
    for (const subject of ["science", "technology", "engineering", "art", "math", "music", "reading"]) await add({ subject });
    for (const subject of ["history", "", "Science", "Reading", "writing", null]) await expect(add({ subject }), String(subject)).rejects.toThrow();
    await expect(q("insert into child_game_answers (game, qid, subject, correct) values ('x', 'y', 'math', true)")).rejects.toThrow();
    await expect(q("insert into child_game_answers (child_id, game, qid, subject, correct) values ($1, 'x', 'y', 'math', true)", ["44444444-4444-4444-8444-444444444444"])).rejects.toThrow();
    expect((await q("select count(*)::int as n from child_game_answers"))[0].n).toBe(7);
  });

  it("widens a table made before Reading and Writing (owner, 2026-11-22) and keeps its rows", async () => {
    const old = new PGlite();
    await old.exec(`
      create role anon; create role authenticated; create role service_role;
      create function is_active_admin() returns boolean language sql stable as $$ select false $$;
      create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
      grant usage on schema public to anon, authenticated, service_role;
    `);
    await old.exec(kidSql);
    await old.exec(sql.replace("'music', 'reading')", "'music')").split("-- Reading and Writing")[0]);
    await old.exec("insert into subscribers (id, data) values ('sub-a', '{\"email\":\"parent@example.test\",\"status\":\"published\"}')");
    const kid = (await old.query("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', 'Maya', 2, 2026) returning id")).rows[0].id;
    const ins = (s) => old.query("insert into child_game_answers (child_id, game, qid, subject, correct) values ($1, 'g', 'q', $2, true)", [kid, s]);
    await ins("math");
    await expect(ins("reading")).rejects.toThrow();
    await old.exec(sql);
    await ins("reading");
    await expect(ins("history")).rejects.toThrow();
    expect((await old.query("select subject from child_game_answers order by id")).rows.map((r) => r.subject)).toEqual(["math", "reading"]);
  }, 60000);

  it("caps the text fields at the lengths the function trims to", async () => {
    await add({ game: "g".repeat(40), qid: "q".repeat(200), question: "x".repeat(300), answer: "y".repeat(200), why: "z".repeat(400) });
    await expect(add({ game: "g".repeat(41) })).rejects.toThrow();
    await expect(add({ qid: "q".repeat(201) })).rejects.toThrow();
    await expect(add({ game: "" })).rejects.toThrow();
    await expect(add({ qid: "" })).rejects.toThrow();
    await expect(add({ question: "x".repeat(301) })).rejects.toThrow();
    await expect(add({ answer: "y".repeat(201) })).rejects.toThrow();
    await expect(add({ why: "z".repeat(401) })).rejects.toThrow();
    // the pop quiz keeps a nugget id, which can be longer than a game's own question id, as its qid
    await add({ game: "pop-quiz", qid: "episode:" + "a".repeat(64) + ":discovery" });
    expect((await q("select count(*)::int as n from child_game_answers"))[0].n).toBe(2);
  });
});
