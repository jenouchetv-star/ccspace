// Applies the real supabase/kid-progress.sql to an in-memory Postgres (PGlite) and checks what it promises: the six
// progress-report tables exist and are closed to every browser role, a member's children and everything recorded for
// them go when the member goes, children's names and grades are checked, and the admin question RPCs refuse anyone
// who is not an active admin, check every question and subject, replace only one item's rows, and approve only one
// item's rows. (As in test/soundSpaceSql.test.js, PGlite runs as a superuser, so grants are checked with
// has_*_privilege. is_active_admin() is a stand-in driven by a one-row table so a test can switch it on and off.)
// All addresses are made-up ones on example.test; nothing here can send an email.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../supabase/kid-progress.sql", import.meta.url);
const sql = existsSync(file) ? readFileSync(file, "utf8") : "";
let db;
const q = async (text, params) => (await db.query(text, params)).rows;
const setAdmin = (on) => db.exec(`update test_admin set on_ = ${on ? "true" : "false"}`);
const TABLES = ["children", "child_progress", "child_nuggets", "child_quizzes", "nugget_subjects", "nugget_questions"];

const row = (nugget_id, level, over = {}) => ({
  nugget_id, level, variant: 1, question: "What do plants need?",
  choices: level === "k1" ? ["Sun", "Rocks"] : ["Sun", "Rocks", "Socks"], answer: 0, why: "Plants make food from light.", ...over,
});
const save = (prefix, rows, subjects = {}) =>
  q("select nugget_questions_save($1, $2::jsonb, $3::jsonb) as n", [prefix, JSON.stringify(rows), JSON.stringify(subjects)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table test_admin (on_ boolean not null);
    insert into test_admin values (true);
    create function is_active_admin() returns boolean language sql security definer set search_path = public stable as $$
      select on_ from test_admin $$;
    create table subscribers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    grant execute on function is_active_admin() to anon, authenticated;
  `);
  await db.exec(sql);
}, 60000);

beforeEach(async () => {
  await setAdmin(true);
  await db.exec(`
    delete from nugget_questions; delete from nugget_subjects; delete from child_quizzes; delete from child_nuggets;
    delete from child_progress; delete from children; delete from subscribers;
    insert into subscribers (id, data) values ('sub-a', '{"email":"parent@example.test","status":"published"}');
  `);
});

describe("kid-progress.sql: the tables", () => {
  it("can be run again without error", async () => {
    expect(sql.length).toBeGreaterThan(0);
    await db.exec(sql);
    await db.exec(sql);
  });

  it("has the six tables with the columns above", async () => {
    const cols = async (t) => (await q("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position", [t])).map((c) => c.column_name);
    expect(await cols("children")).toEqual(["id", "subscriber_id", "name", "grade", "grade_year", "created_at"]);
    expect(await cols("child_progress")).toEqual(["child_id", "kind", "item_id", "first_at", "last_at", "times"]);
    expect(await cols("child_nuggets")).toEqual(["child_id", "nugget_id", "status", "review_step", "review_due", "known_at", "last_asked", "last_variant"]);
    expect(await cols("child_quizzes")).toEqual(["id", "child_id", "started_at", "nuggets", "answered", "asked", "right_count"]);
    expect(await cols("nugget_subjects")).toEqual(["nugget_id", "subject"]);
    expect(await cols("nugget_questions")).toEqual(["nugget_id", "level", "variant", "question", "choices", "answer", "why", "approved", "updated_at"]);
  });

  it("closes every table to anon and authenticated", async () => {
    for (const t of TABLES) {
      expect((await q("select relrowsecurity from pg_class where relname = $1", [t]))[0].relrowsecurity, t).toBe(true);
      for (const role of ["anon", "authenticated"]) {
        for (const p of ["select", "insert", "update", "delete"]) {
          expect((await q("select has_table_privilege($1, $2, $3) as v", [role, t, p]))[0].v, `${role} ${p} ${t}`).toBe(false);
        }
      }
    }
    expect(await q("select 1 from pg_policies where tablename = any($1)", [TABLES])).toEqual([]);
  });

  it("removing a subscriber removes their children and everything recorded for them", async () => {
    const c = (await q("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', 'Maya', 2, 2026) returning id"))[0].id;
    await q("insert into child_progress (child_id, kind, item_id) values ($1, 'episode', 'e1')", [c]);
    await q("insert into child_nuggets (child_id, nugget_id) values ($1, 'episode:e1:a')", [c]);
    await q("insert into child_quizzes (child_id, nuggets) values ($1, '{episode:e1:a}')", [c]);
    await db.exec("delete from subscribers where id = 'sub-a'");
    for (const t of ["children", "child_progress", "child_nuggets", "child_quizzes"]) {
      expect((await q(`select count(*)::int as n from ${t}`))[0].n, t).toBe(0);
    }
  });

  it("children names and grades are checked", async () => {
    const add = (name, grade) => db.query("insert into children (subscriber_id, name, grade, grade_year) values ('sub-a', $1, $2, 2026)", [name, grade]);
    await expect(add("", 2)).rejects.toThrow();
    await expect(add("x".repeat(25), 2)).rejects.toThrow();
    await expect(add("Maya", 7)).rejects.toThrow();
    await expect(add("Maya", -1)).rejects.toThrow();
    await add("x".repeat(24), 6);
    await add("Kay", 0);
  });
});

describe("kid-progress.sql: the admin question RPCs", () => {
  const SIGS = ["nugget_questions_for(text)", "nugget_subjects_for(text)", "nugget_questions_save(text, jsonb, jsonb)", "nugget_questions_approve(text)"];

  it("refuse anyone who is not an active admin", async () => {
    await setAdmin(false);
    await expect(q("select * from nugget_questions_for('video:a:')")).rejects.toThrow(/not allowed/);
    await expect(q("select * from nugget_subjects_for('video:a:')")).rejects.toThrow(/not allowed/);
    await expect(save("video:a:", [])).rejects.toThrow(/not allowed/);
    await expect(q("select nugget_questions_approve('video:a:')")).rejects.toThrow(/not allowed/);
  });

  it("are security definer with a fixed search_path, and only signed-in users may execute them", async () => {
    for (const name of ["nugget_questions_for", "nugget_subjects_for", "nugget_questions_save", "nugget_questions_approve"]) {
      const fn = (await q("select prosecdef, proconfig from pg_proc where proname = $1", [name]))[0];
      expect(fn.prosecdef, name).toBe(true);
      expect((fn.proconfig || []).join(","), name).toMatch(/^search_path=public/);
    }
    for (const sig of SIGS) {
      const r = (await q("select has_function_privilege('anon', $1, 'execute') as a, has_function_privilege('authenticated', $1, 'execute') as b", [sig]))[0];
      expect(r, sig).toEqual({ a: false, b: true });
    }
  });

  it("save checks the number of choices per level", async () => {
    await expect(save("video:a:", [row("video:a:one", "k1", { choices: ["A", "B", "C"] })])).rejects.toThrow(/invalid question/);
    await expect(save("video:a:", [row("video:a:one", "g23", { choices: ["A", "B"] })])).rejects.toThrow(/invalid question/);
    await expect(save("video:a:", [row("video:a:one", "g46", { choices: ["A", "B", "C", "D"] })])).rejects.toThrow(/invalid question/);
    expect((await save("video:a:", [row("video:a:one", "g23")]))[0].n).toBe(1);
    expect((await save("video:a:", [row("video:a:one", "k1")]))[0].n).toBe(1);
  });

  it("save refuses an answer outside the choices, a row from another item, and a lesson with a question", async () => {
    await expect(save("video:a:", [row("video:a:one", "g23", { answer: 3 })])).rejects.toThrow(/invalid question/);
    await expect(save("video:a:", [row("video:a:one", "g23", { answer: -1 })])).rejects.toThrow(/invalid question/);
    await expect(save("video:a:", [row("video:b:one", "g23")])).rejects.toThrow(/invalid question/);
    await expect(save("video:a:", [row("video:a:one", "lesson")])).rejects.toThrow(/invalid question/);
    expect((await save("video:a:", [{ nugget_id: "video:a:one", level: "lesson", variant: 1 }]))[0].n).toBe(1);
    expect((await q("select question, choices from nugget_questions"))[0]).toEqual({ question: null, choices: null });
  });

  it("save replaces only that item's rows and leaves them unapproved; approve approves only that prefix", async () => {
    await save("video:a:", [row("video:a:one", "g23"), row("video:a:two", "g23")]);
    await save("video:b:", [row("video:b:one", "g23")]);
    expect((await q("select nugget_questions_approve('video:a:') as n"))[0].n).toBe(2);
    expect(await q("select nugget_id, approved from nugget_questions order by nugget_id")).toEqual([
      { nugget_id: "video:a:one", approved: true }, { nugget_id: "video:a:two", approved: true }, { nugget_id: "video:b:one", approved: false }]);
    // saving item a again replaces its rows (even one sent as approved) and unapproves them; item b is untouched
    await save("video:a:", [row("video:a:one", "g23", { approved: true })]);
    expect(await q("select nugget_id, approved from nugget_questions order by nugget_id")).toEqual([
      { nugget_id: "video:a:one", approved: false }, { nugget_id: "video:b:one", approved: false }]);
    const got = await q("select * from nugget_questions_for('video:a:')");
    expect(got.map((r) => r.nugget_id)).toEqual(["video:a:one"]);
  });

  it("save keeps one STEAMM subject per nugget and refuses any other word", async () => {
    await save("video:a:", [row("video:a:one", "g23")], { "video:a:one": "science", "video:a:two": "music" });
    await save("video:b:", [], { "video:b:one": "art" });
    expect(await q("select * from nugget_subjects_for('video:a:') order by nugget_id")).toEqual([
      { nugget_id: "video:a:one", subject: "science" }, { nugget_id: "video:a:two", subject: "music" }]);
    // saving again replaces this item's subjects and leaves the other item's alone
    await save("video:a:", [row("video:a:one", "g23")], { "video:a:one": "math" });
    expect(await q("select * from nugget_subjects order by nugget_id")).toEqual([
      { nugget_id: "video:a:one", subject: "math" }, { nugget_id: "video:b:one", subject: "art" }]);
    await expect(save("video:a:", [], { "video:a:one": "history" })).rejects.toThrow(/invalid subject/);
    await expect(save("video:a:", [], { "video:b:one": "math" })).rejects.toThrow(/invalid subject/);
    // a refused save changes nothing
    expect((await q("select count(*)::int as n from nugget_subjects"))[0].n).toBe(2);
  });

  it("treats the prefix as plain text, not a pattern, and refuses an empty one", async () => {
    await save("video:a:", [row("video:a:one", "g23")]);
    expect(await q("select * from nugget_questions_for('video:_:')")).toEqual([]);
    expect(await q("select * from nugget_questions_for('%')")).toEqual([]);
    await expect(save("", [])).rejects.toThrow(/invalid/);
    expect((await q("select count(*)::int as n from nugget_questions"))[0].n).toBe(1);
  });
});
