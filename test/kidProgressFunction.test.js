// Runs the REAL kid-progress Edge Function (supabase/functions/kid-progress/index.ts) against an in-memory database,
// to check who gets in, that a child is only ever reached by their own family, and what each action keeps and returns.
// All addresses are made-up ones on example.test.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

// cap: like hosted PostgREST, a read returns at most 1000 rows, so a read that is not scoped quietly loses rows.
const db = vi.hoisted(() => ({ tables: {}, rate: { allow: true, calls: [] }, fail: new Set(), cap: 1000 }));
vi.mock("jsr:@supabase/supabase-js@2", () => {
  const copy = (v) => JSON.parse(JSON.stringify(v));
  // timestamps written by the function (".000Z") and by the tests ("Z") compare as times
  const cmp = (x, y) => { const a = Date.parse(x), b = Date.parse(y); if (typeof x === "string" && !isNaN(a) && !isNaN(b)) return a - b; return x < y ? -1 : x > y ? 1 : 0; };
  // a LIKE pattern as PostgREST takes it: * (or %) is any run of characters and _ is any one character
  const like = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*").replace(/_/g, ".") + "$");
  class Q {
    constructor(t) { this.t = t; this.op = "select"; this.f = []; this.one = false; this.ord = null; this.lim = null; this.rng = null; this.ret = false; }
    select() { if (this.op === "insert" || this.op === "update") this.ret = true; return this; }
    insert(v) { this.op = "insert"; this.v = v; return this; }
    update(v) { this.op = "update"; this.v = v; return this; }
    delete() { this.op = "delete"; return this; }
    upsert(v, o) { this.op = "upsert"; this.v = v; this.on = o.onConflict.split(","); return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    gt(c, v) { this.f.push((r) => r[c] != null && cmp(r[c], v) > 0); return this; }
    gte(c, v) { this.f.push((r) => r[c] != null && cmp(r[c], v) >= 0); return this; }
    in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
    or(s) {
      const parts = s.split(",").map((p) => {
        const m = p.match(/^(\w+)\.like\.(.+)$/);
        if (!m) throw new Error("the fake only knows like inside or(): " + p);
        const re = like(m[2]);
        return (r) => typeof r[m[1]] === "string" && re.test(r[m[1]]);
      });
      this.f.push((r) => parts.some((p) => p(r)));
      return this;
    }
    order(c, o) { this.ord = { c, asc: !o || o.ascending !== false }; return this; }
    limit(n) { this.lim = n; return this; }
    range(from, to) { this.rng = [from, to]; return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; this.must = true; return this; }
    then(a, b) { return Promise.resolve(this.run()).then(a, b); }
    run() {
      if (db.fail.has(this.t)) return { data: null, error: { message: `relation "public.${this.t}" does not exist` } };
      const rows = (db.tables[this.t] = db.tables[this.t] || []);
      const hit = (r) => this.f.every((f) => f(r));
      if (this.op === "update") {
        const changed = rows.filter(hit);
        changed.forEach((r) => Object.assign(r, copy(this.v)));
        return { data: this.ret ? changed.map(copy) : null, error: null };
      }
      if (this.op === "delete") {
        const gone = rows.filter(hit);
        db.tables[this.t] = rows.filter((r) => !hit(r));
        // the real tables cascade from children
        if (this.t === "children") for (const c of gone) for (const t of ["child_progress", "child_nuggets", "child_quizzes", "child_game_answers"]) db.tables[t] = (db.tables[t] || []).filter((r) => r.child_id !== c.id);
        return { data: null, error: null };
      }
      if (this.op === "insert") {
        const row = copy(this.v);
        if (this.t === "children") { row.id = crypto.randomUUID(); row.created_at = new Date(Date.now() + rows.length).toISOString(); }
        if (this.t === "child_quizzes" && !row.id) row.id = crypto.randomUUID();
        // an identity id and a default time, as the real table fills them
        if (this.t === "child_game_answers") { row.id = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1; row.at = row.at || new Date().toISOString(); }
        rows.push(row);
        return { data: this.ret ? (this.one ? copy(row) : [copy(row)]) : null, error: null };
      }
      if (this.op === "upsert") {
        const same = rows.find((r) => this.on.every((k) => r[k] === this.v[k]));
        if (same) Object.assign(same, copy(this.v)); else rows.push(copy(this.v));
        return { data: null, error: null };
      }
      let found = rows.filter(hit).map(copy);
      if (this.ord) { const { c, asc } = this.ord; found.sort((x, y) => cmp(x[c], y[c]) * (asc ? 1 : -1)); }
      if (this.rng) found = found.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim !== null) found = found.slice(0, this.lim);
      if (db.cap) found = found.slice(0, db.cap);
      if (this.one) return { data: found[0] ?? null, error: null };
      return { data: found, error: null };
    }
  }
  return {
    createClient: () => ({
      from: (t) => new Q(t),
      rpc: async (name, args) => { db.rate.calls.push({ name, args }); return { data: name === "rate_take" ? db.rate.allow : null, error: null }; },
    }),
  };
});

let handler;
const TOKEN_A = "a".repeat(40), TOKEN_B = "b".repeat(40), TOKEN_GONE = "c".repeat(40), TOKEN_OLD = "d".repeat(40);
const A_CHILD = "11111111-1111-4111-8111-111111111111", A_CHILD2 = "22222222-2222-4222-8222-222222222222", B_CHILD = "33333333-3333-4333-8333-333333333333";
async function sha(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function call(body, raw) {
  const res = await handler(new Request("https://fn.example.test/kid-progress", { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
}
const as = (session) => (action, rest = {}) => call({ action, session, ...rest });
const a = as(TOKEN_A), b = as(TOKEN_B);
const table = (t) => db.tables[t] || [];
const rowsOf = (t) => (db.tables[t] = db.tables[t] || []);

// Quiz helpers. A question at grades 2-3 (Maya's level) whose right choice is "two" (index 1).
const quizQ = (nugget_id, o = {}) => ({
  nugget_id, level: "g23", variant: 1, question: `Question about ${nugget_id}`, choices: ["one", "two", "three"], answer: 1, why: `Because of ${nugget_id}`, approved: true, ...o,
});
/** The child finished the item of each nugget, oldest first in the order given, and each nugget gets a question.
 *  specs: [nuggetId, subject or null, question overrides, or false for no question]. */
function seedQuiz(child, specs) {
  for (const [id, subject, o] of specs) {
    const [kind, item_id] = id.split(":");
    if (!table("child_progress").some((p) => p.child_id === child && p.kind === kind && p.item_id === item_id)) {
      const stamp = new Date(Date.UTC(2026, 9, 1 + table("child_progress").length)).toISOString();
      rowsOf("child_progress").push({ child_id: child, kind, item_id, first_at: stamp, last_at: stamp, times: 1 });
    }
    if (o !== false) rowsOf("nugget_questions").push(quizQ(id, o || {}));
    if (subject) rowsOf("nugget_subjects").push({ nugget_id: id, subject });
  }
}
const ids = (r) => r.questions.map((q) => q.nuggetId);
const nug = (child, id) => table("child_nuggets").find((n) => n.child_id === child && n.nugget_id === id);
const quizRow = (id) => table("child_quizzes").find((q) => q.id === id);
const at = (iso) => vi.setSystemTime(new Date(iso));
const NOW = "2026-11-21T12:00:00.000Z";
/** A game_answer body (without the child), as the Solar System Sandbox tours send it. */
const gameAnswer = (o = {}) => ({
  game: "solar-system-sandbox", qid: "sun-1", subject: "science", level: "g23", correct: true,
  question: "What is the Sun?", answer: "A star", why: "It makes its own light.", ...o,
});
/** A child_game_answers row as the tests seed it. */
const answerRow = (child, at, o = {}) => ({
  child_id: child, game: "solar-system-sandbox", qid: "q", subject: "science", level: "g23", correct: true,
  question: "Q", answer: "A", why: "W", at, ...o,
});

describe("kid-progress function", () => {
  beforeAll(async () => {
    globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service" })[k] }, serve: (h) => { handler = h; } };
    await import("../supabase/functions/kid-progress/index.ts");
  });
  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    const later = "2100-01-01T00:00:00Z", earlier = "2000-01-01T00:00:00Z";
    db.tables = {
      subscribers: [
        { id: "sub-a", data: { email: "a@example.test", status: "published" } },
        { id: "sub-b", data: { email: "b@example.test", status: "published" } },
        { id: "sub-gone", data: { email: "gone@example.test", status: "unsubscribed" } },
      ],
      portal_sessions: [
        { token_hash: await sha(TOKEN_A), subscriber_id: "sub-a", expires_at: later },
        { token_hash: await sha(TOKEN_B), subscriber_id: "sub-b", expires_at: later },
        { token_hash: await sha(TOKEN_GONE), subscriber_id: "sub-gone", expires_at: later },
        { token_hash: await sha(TOKEN_OLD), subscriber_id: "sub-a", expires_at: earlier },
      ],
      children: [
        { id: A_CHILD, subscriber_id: "sub-a", name: "Maya", grade: 2, grade_year: 2026, created_at: "2026-09-01T00:00:00Z" },
        { id: A_CHILD2, subscriber_id: "sub-a", name: "Leo", grade: 0, grade_year: 2026, created_at: "2026-09-02T00:00:00Z" },
        { id: B_CHILD, subscriber_id: "sub-b", name: "Zed", grade: 4, grade_year: 2026, created_at: "2026-09-03T00:00:00Z" },
      ],
    };
    db.rate.allow = true; db.rate.calls.length = 0; db.fail.clear(); db.cap = 1000;
  });
  afterEach(() => { vi.useRealTimers(); });

  it("refuses a call with no session, an expired one, or a member who left the list", async () => {
    for (const session of [undefined, "short", TOKEN_GONE, TOKEN_OLD, "z".repeat(40)]) {
      for (const action of ["children", "child_save", "child_remove", "record", "report", "quiz_offer", "quiz_start", "quiz_answer", "game_answer"]) {
        expect((await call({ action, session, child: A_CHILD, id: A_CHILD })).error, action).toBe("no_session");
      }
    }
    expect(table("child_progress")).toEqual([]);
    expect(table("children")).toHaveLength(3);
    expect((await a("children")).ok).toBe(true);
    expect((await a("nope")).status).toBe(400);
  });

  it("lists only the member's own children", async () => {
    expect((await a("children")).children).toEqual([{ id: A_CHILD, name: "Maya", grade: 2 }, { id: A_CHILD2, name: "Leo", grade: 0 }]);
    expect((await b("children")).children).toEqual([{ id: B_CHILD, name: "Zed", grade: 4 }]);
  });

  it("rejects a child that belongs to another member", async () => {
    const before = JSON.stringify(db.tables);
    expect(await b("record", { child: A_CHILD, kind: "episode", item: "abc" })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("report", { child: A_CHILD })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("child_remove", { id: A_CHILD })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("child_save", { child: { id: A_CHILD, name: "Hacked", grade: 1 } })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("quiz_offer", { child: A_CHILD })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("quiz_start", { child: A_CHILD })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("quiz_answer", { child: A_CHILD, quizId: crypto.randomUUID(), nuggetId: "episode:abc:x", choice: 0 })).toMatchObject({ ok: false, error: "not_found" });
    expect(await b("game_answer", { child: A_CHILD, ...gameAnswer() })).toMatchObject({ ok: false, error: "not_found" });
    for (const bad of ["not-a-uuid", "", 5, null, undefined, { id: A_CHILD }]) {
      expect((await a("report", { child: bad })).error, String(bad)).toBe("not_found");
    }
    expect(JSON.stringify(db.tables)).toBe(before);
    expect(db.rate.calls).toEqual([]);
    // the owner can
    expect((await a("report", { child: A_CHILD })).ok).toBe(true);
  });

  it("adds up to 6 children and then says full", async () => {
    for (const n of ["Ann", "Bo", "Cy"]) expect(await b("child_save", { child: { name: n, grade: 1 } })).toMatchObject({ ok: true, id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect((await b("children")).children).toHaveLength(4);
    expect((await b("child_save", { child: { name: "Di", grade: 1 } })).ok).toBe(true);
    expect((await b("child_save", { child: { name: "Ed", grade: 1 } })).ok).toBe(true);
    expect(await b("child_save", { child: { name: "Fay", grade: 1 } })).toMatchObject({ ok: false, error: "full" });
    expect(table("children").filter((c) => c.subscriber_id === "sub-b")).toHaveLength(6);
    // a full family can still change a child, and another family is unaffected
    expect((await b("child_save", { child: { id: B_CHILD, name: "Zed", grade: 5 } })).ok).toBe(true);
    expect((await a("child_save", { child: { name: "Ivy", grade: 3 } })).ok).toBe(true);
    // removing one makes room again
    expect((await b("child_remove", { id: B_CHILD })).ok).toBe(true);
    expect((await b("child_save", { child: { name: "Fay", grade: 1 } })).ok).toBe(true);
  });

  it("checks names and grades", async () => {
    const bad = [
      { name: "", grade: 1 }, { name: "   ", grade: 1 }, { name: "x".repeat(25), grade: 1 }, { name: "<b>", grade: 1 }, { name: "Max7", grade: 1 },
      { name: 5, grade: 1 }, { name: "Mia", grade: 7 }, { name: "Mia", grade: -1 }, { name: "Mia", grade: 2.5 }, { name: "Mia", grade: "2" }, { name: "Mia" },
    ];
    for (const child of bad) expect((await a("child_save", { child })).error, JSON.stringify(child)).toBe("invalid");
    for (const child of [null, [], "Mia", undefined]) expect((await a("child_save", { child })).error).toBe("invalid");
    expect(table("children")).toHaveLength(3);
    // good ones, with the name trimmed, edge lengths and the allowed marks
    for (const [name, grade] of [["  Mia  ", 0], ["x".repeat(24), 6], ["Mary-Jo O'Neil Jr.", 3], ["Zoë", 1]]) {
      const r = await a("child_save", { child: { name, grade } });
      expect(r.ok, name).toBe(true);
    }
    expect(table("children").map((c) => c.name)).toContain("Mia");
    expect(table("children").find((c) => c.name === "Mia")).toMatchObject({ grade: 0, grade_year: 2026, subscriber_id: "sub-a" });
    // a child's own member and id come from the session and the lookup, not from the request
    await a("child_save", { child: { id: A_CHILD, name: "Maya R", grade: 3, subscriber_id: "sub-b" } });
    expect(table("children").find((c) => c.id === A_CHILD)).toMatchObject({ name: "Maya R", grade: 3, subscriber_id: "sub-a" });
  });

  it("grade moves up each August and stops at 6th", async () => {
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    const two = (await a("child_save", { child: { name: "Kay", grade: 2 } })).id;
    const six = (await a("child_save", { child: { name: "Sam", grade: 6 } })).id;
    const gradeOf = async (id) => (await a("children")).children.find((c) => c.id === id).grade;
    expect(await gradeOf(two)).toBe(2);
    vi.setSystemTime(new Date("2027-07-31T23:00:00Z"));
    expect(await gradeOf(two)).toBe(2);
    vi.setSystemTime(new Date("2027-08-01T00:30:00Z"));
    expect(await gradeOf(two)).toBe(3);
    expect(await gradeOf(six)).toBe(6);
    vi.setSystemTime(new Date("2030-09-01T12:00:00Z"));
    expect(await gradeOf(two)).toBe(6);
    // set in the spring, it belongs to the school year that began the August before
    vi.setSystemTime(new Date("2027-03-01T12:00:00Z"));
    const spring = (await a("child_save", { child: { name: "Tia", grade: 1 } })).id;
    expect(table("children").find((c) => c.id === spring).grade_year).toBe(2026);
    vi.setSystemTime(new Date("2027-08-02T12:00:00Z"));
    expect(await gradeOf(spring)).toBe(2);
    // saving again re-sets the grade for the current school year
    await a("child_save", { child: { id: spring, name: "Tia", grade: 2 } });
    expect(await gradeOf(spring)).toBe(2);
  });

  it("removes a child and everything kept for them", async () => {
    await a("record", { child: A_CHILD, kind: "episode", item: "ep-1" });
    db.tables.child_nuggets = [{ child_id: A_CHILD, nugget_id: "episode:ep-1:x", status: "met" }, { child_id: B_CHILD, nugget_id: "episode:ep-1:x", status: "met" }];
    expect((await a("child_remove", { id: A_CHILD })).ok).toBe(true);
    expect((await a("children")).children.map((c) => c.id)).toEqual([A_CHILD2]);
    expect(table("child_progress")).toEqual([]);
    expect(table("child_nuggets").map((r) => r.child_id)).toEqual([B_CHILD]);
  });

  it("recording twice keeps one row", async () => {
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    expect(await a("record", { child: A_CHILD, kind: "episode", item: "ep-1" })).toMatchObject({ ok: true });
    vi.setSystemTime(new Date("2026-11-22T09:30:00Z"));
    expect(await a("record", { child: A_CHILD, kind: "episode", item: "ep-1" })).toMatchObject({ ok: true });
    expect(table("child_progress")).toEqual([{ child_id: A_CHILD, kind: "episode", item_id: "ep-1", first_at: "2026-11-21T12:00:00.000Z", last_at: "2026-11-22T09:30:00.000Z", times: 2 }]);
    await a("record", { child: A_CHILD, kind: "book", item: "ep-1" });          // another kind is another row
    await a("record", { child: A_CHILD2, kind: "episode", item: "ep-1" });      // and another child
    expect(table("child_progress")).toHaveLength(3);
  });

  it("checks the kind and the item, and takes each record from the member's kid_record bucket", async () => {
    for (const [kind, item] of [["game", "x"], ["", "x"], [5, "x"], ["episode", ""], ["episode", "a b"], ["episode", "a:b"], ["episode", "x".repeat(65)], ["episode", 7], ["episode", undefined]]) {
      expect((await a("record", { child: A_CHILD, kind, item })).error, `${kind}/${item}`).toBe("invalid");
    }
    expect(table("child_progress")).toEqual([]);
    expect(db.rate.calls).toEqual([]);
    for (const kind of ["episode", "book", "entry", "activity"]) expect((await a("record", { child: A_CHILD, kind, item: "x".repeat(64) })).ok, kind).toBe(true);
    expect(db.rate.calls[0]).toEqual({ name: "rate_take", args: { p_bucket: "kid_record", p_key: "sub-a", p_max: 300, p_window_seconds: 3600 } });
    db.rate.allow = false;
    expect((await a("record", { child: A_CHILD, kind: "episode", item: "more" })).error).toBe("slow_down");
    expect(table("child_progress")).toHaveLength(4);
  });

  it("answers a fault with a 500 server_error, not a crash", async () => {
    db.fail.add("child_progress");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await a("record", { child: A_CHILD, kind: "episode", item: "ep-1" })).toMatchObject({ status: 500, ok: false, error: "server_error" });
    expect(quiet).toHaveBeenCalledOnce(); quiet.mockRestore();
  });

  it("report returns only this child's rows, the lessons of things they finished, and 5 newest quizzes", async () => {
    db.tables.child_progress = [
      { child_id: A_CHILD, kind: "episode", item_id: "ep-1", first_at: "2026-10-01T00:00:00Z", last_at: "2026-10-05T00:00:00Z", times: 2 },
      { child_id: A_CHILD, kind: "book", item_id: "bk-1", first_at: "2026-10-02T00:00:00Z", last_at: "2026-10-02T00:00:00Z", times: 1 },
      { child_id: A_CHILD2, kind: "entry", item_id: "en-9", first_at: "2026-10-03T00:00:00Z", last_at: "2026-10-03T00:00:00Z", times: 1 },
      { child_id: B_CHILD, kind: "activity", item_id: "ac-1", first_at: "2026-10-04T00:00:00Z", last_at: "2026-10-04T00:00:00Z", times: 1 },
    ];
    db.tables.child_nuggets = [
      { child_id: A_CHILD, nugget_id: "episode:ep-1:discovery", status: "knows", review_step: 1, review_due: "2026-12-01T00:00:00Z", known_at: "2026-10-06T00:00:00Z", last_asked: null, last_variant: 1 },
      { child_id: A_CHILD, nugget_id: "book:bk-1:fact", status: "met", review_step: 0, review_due: null, known_at: null },
      { child_id: A_CHILD2, nugget_id: "entry:en-9:fact", status: "met", review_step: 0, review_due: null, known_at: null },
      { child_id: B_CHILD, nugget_id: "activity:ac-1:fact", status: "met", review_step: 0, review_due: null, known_at: null },
    ];
    db.tables.nugget_questions = [
      { nugget_id: "episode:ep-1:lesson", level: "lesson", variant: 1, approved: true },
      { nugget_id: "episode:ep-1:discovery", level: "g23", variant: 1, approved: true },
      { nugget_id: "book:bk-1:wisdom", level: "lesson", variant: 1, approved: true },
      { nugget_id: "episode:ep-2:lesson", level: "lesson", variant: 1, approved: true },     // not finished by this child
      { nugget_id: "episode:ep-10:lesson", level: "lesson", variant: 1, approved: true },    // "episode:ep-1" is not a prefix of it
      { nugget_id: "entry:en-9:lesson", level: "lesson", variant: 1, approved: true },       // another child's
    ];
    db.tables.nugget_subjects = [
      { nugget_id: "episode:ep-1:discovery", subject: "science" },
      { nugget_id: "book:bk-1:fact", subject: "art" },
      { nugget_id: "episode:ep-2:discovery", subject: "math" },
      { nugget_id: "episode:ep-10:discovery", subject: "music" },
      { nugget_id: "entry:en-9:fact", subject: "technology" },
    ];
    db.tables.child_quizzes = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: "q" + n, child_id: A_CHILD, started_at: `2026-10-0${n}T00:00:00Z`, nuggets: [], answered: [], asked: 3, right_count: n % 4 }));
    db.tables.child_quizzes.push({ id: "qb", child_id: B_CHILD, started_at: "2026-11-01T00:00:00Z", nuggets: [], answered: [], asked: 3, right_count: 3 });

    const r = await a("report", { child: A_CHILD });
    expect(r.ok).toBe(true);
    expect(r.progress).toEqual([
      { kind: "episode", item_id: "ep-1", first_at: "2026-10-01T00:00:00Z", last_at: "2026-10-05T00:00:00Z", times: 2 },
      { kind: "book", item_id: "bk-1", first_at: "2026-10-02T00:00:00Z", last_at: "2026-10-02T00:00:00Z", times: 1 },
    ]);
    expect(r.nuggets).toEqual([
      { nugget_id: "episode:ep-1:discovery", status: "knows", review_step: 1, known_at: "2026-10-06T00:00:00Z" },
      { nugget_id: "book:bk-1:fact", status: "met", review_step: 0, known_at: null },
    ]);
    expect([...r.lessons].sort()).toEqual(["book:bk-1:wisdom", "episode:ep-1:lesson"]);
    expect(r.subjects).toEqual({ "episode:ep-1:discovery": "science", "book:bk-1:fact": "art" });
    expect(r.quizzes).toEqual([7, 6, 5, 4, 3].map((n) => ({ started_at: `2026-10-0${n}T00:00:00Z`, asked: 3, right_count: n % 4 })));
    // nothing private to the table leaks into the answer
    expect(JSON.stringify(r)).not.toMatch(/review_due|last_asked|"id":|sub-a|nuggets":\[\]/);
    // a child with nothing finished gets an empty report
    expect(await a("report", { child: A_CHILD2 })).toMatchObject({ ok: true, lessons: ["entry:en-9:lesson"], subjects: { "entry:en-9:fact": "technology" }, quizzes: [], progress: [{ item_id: "en-9" }] });
    expect(await b("report", { child: B_CHILD })).toMatchObject({ ok: true, lessons: [], quizzes: [{ right_count: 3 }] });
  });

  it("report and quiz read only the rows of things the child finished, however many others there are", async () => {
    db.tables.child_progress = [{ child_id: A_CHILD, kind: "episode", item_id: "ep_1", first_at: "2026-10-01T00:00:00Z", last_at: "2026-10-01T00:00:00Z", times: 1 }];
    const others = Array.from({ length: 1200 }, (_, i) => `episode:other-${i}:`);
    db.tables.nugget_questions = others.flatMap((p) => [quizQ(p + "lesson", { level: "lesson" }), quizQ(p + "fact")]);
    db.tables.nugget_subjects = others.map((p) => ({ nugget_id: p + "fact", subject: "art" }));
    // "_" is a LIKE wildcard, so episode:epX1: matches the like for ep_1, but Maya never finished it
    db.tables.nugget_questions.push(
      quizQ("episode:epX1:lesson", { level: "lesson" }), quizQ("episode:epX1:fact"),
      quizQ("episode:ep_1:lesson", { level: "lesson" }), quizQ("episode:ep_1:a"), quizQ("episode:ep_1:b"),
    );
    db.tables.nugget_subjects.push({ nugget_id: "episode:epX1:fact", subject: "music" }, { nugget_id: "episode:ep_1:a", subject: "math" });

    const r = await a("report", { child: A_CHILD });
    expect(r.lessons).toEqual(["episode:ep_1:lesson"]);
    expect(r.subjects).toEqual({ "episode:ep_1:a": "math" });

    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);   // only ep_1:a and ep_1:b
    db.tables.nugget_questions.push(quizQ("episode:ep_1:c"));
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(true);
    expect(ids(await a("quiz_start", { child: A_CHILD })).sort()).toEqual(["episode:ep_1:a", "episode:ep_1:b", "episode:ep_1:c"]);
  });

  it("report lists only approved lessons", async () => {
    db.tables.child_progress = [{ child_id: A_CHILD, kind: "episode", item_id: "ep-1", first_at: "2026-10-01T00:00:00Z", last_at: "2026-10-01T00:00:00Z", times: 1 }];
    db.tables.nugget_questions = [
      { nugget_id: "episode:ep-1:lesson", level: "lesson", variant: 1, approved: true },
      { nugget_id: "episode:ep-1:kindness", level: "lesson", variant: 1, approved: false },
      { nugget_id: "episode:ep-1:sharing", level: "lesson", variant: 1, approved: null },
    ];
    expect((await a("report", { child: A_CHILD })).lessons).toEqual(["episode:ep-1:lesson"]);
  });

  it("names are kept composed and need at least one letter", async () => {
    for (const name of [".", "-'", " . ", "'", "- -", "...."]) expect((await a("child_save", { child: { name, grade: 1 } })).error, name).toBe("invalid");
    expect(table("children")).toHaveLength(3);
    // "Zoe" with a separate combining diaeresis (U+0308) is the same name as "Zoë"
    const r = await a("child_save", { child: { name: "Zoë", grade: 1 } });
    expect(r.ok).toBe(true);
    expect(table("children").find((c) => c.id === r.id).name).toBe("Zoë");
    expect((await a("child_save", { child: { name: "J.", grade: 1 } })).ok).toBe(true);
  });

  // ---- Chike's pop quiz ----

  it("offers a quiz only with 3 eligible nuggets", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact"], ["episode:e2:fact"]]);
    rowsOf("nugget_questions").push(quizQ("episode:e9:fact"));          // an item Maya did not finish
    seedQuiz(A_CHILD2, [["entry:n1:fact"]]);                             // finished by Leo, not Maya
    seedQuiz(A_CHILD, [["book:b1:fact"]]);                               // known, and not due for review yet
    db.tables.child_nuggets = [{ child_id: A_CHILD, nugget_id: "book:b1:fact", status: "knows", review_step: 1, review_due: "2026-12-01T00:00:00Z", known_at: "2026-11-01T00:00:00Z", last_asked: "2026-11-01T00:00:00Z", last_variant: 1 }];

    expect(await a("quiz_offer", { child: A_CHILD })).toEqual({ status: 200, ok: true, due: false });
    expect(await a("quiz_start", { child: A_CHILD })).toMatchObject({ ok: false, error: "not_due" });
    expect(table("child_quizzes")).toEqual([]);

    db.tables.child_nuggets[0].review_due = "2026-11-21T12:00:00Z";      // the review comes due
    expect(await a("quiz_offer", { child: A_CHILD })).toEqual({ status: 200, ok: true, due: true });
    const r = await a("quiz_start", { child: A_CHILD });
    expect(r).toMatchObject({ ok: true, level: "g23", quizId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(r.questions).toHaveLength(3);
    expect(ids(r).sort()).toEqual(["book:b1:fact", "episode:e1:fact", "episode:e2:fact"]);
    expect(table("child_quizzes")).toEqual([{ id: r.quizId, child_id: A_CHILD, started_at: NOW, nuggets: ids(r), answered: [], asked: 0, right_count: 0 }]);
  });

  it("never asks a nugget whose question is not approved", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact", null, { approved: false }], ["episode:e2:fact"], ["episode:e3:fact"]]);
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    expect((await a("quiz_start", { child: A_CHILD })).error).toBe("not_due");
    // a second way of asking e2 that is not approved yet is never used, even when it is e2's turn for variant 2
    rowsOf("nugget_questions").push(quizQ("episode:e2:fact", { variant: 2, approved: false, question: "Not checked yet" }));
    db.tables.child_nuggets = [{ child_id: A_CHILD, nugget_id: "episode:e2:fact", status: "met", review_step: 0, review_due: null, known_at: null, last_asked: null, last_variant: 1 }];
    seedQuiz(A_CHILD, [["episode:e4:fact"]]);
    const r = await a("quiz_start", { child: A_CHILD });
    expect(ids(r).sort()).toEqual(["episode:e2:fact", "episode:e3:fact", "episode:e4:fact"]);
    expect(JSON.stringify(r)).not.toContain("Not checked yet");
  });

  it("asks the question at the child's level", async () => {
    const items = [["episode:e1:fact", null, false], ["episode:e2:fact", null, false], ["episode:e3:fact", null, false]];
    for (const child of [A_CHILD, A_CHILD2, B_CHILD]) seedQuiz(child, items);
    for (const [id] of items) {
      rowsOf("nugget_questions").push(
        quizQ(id, { level: "k1", question: "k1 question", choices: ["Yes", "No"], answer: 0 }),
        quizQ(id, { level: "g23", question: "g23 question" }),
        quizQ(id, { level: "g46", question: "g46 question", choices: ["a", "b", "c"], answer: 2, why: "needs the why" }),
        quizQ(id, { level: "lesson", question: null, choices: null, answer: null, why: null }),
      );
    }
    const maya = await a("quiz_start", { child: A_CHILD });                // grade 2
    expect(maya).toMatchObject({ ok: true, level: "g23" });
    expect(maya.questions.map((q) => q.question)).toEqual(["g23 question", "g23 question", "g23 question"]);
    const leo = await a("quiz_start", { child: A_CHILD2 });                // Kindergarten
    expect(leo.level).toBe("k1");
    expect(leo.questions.map((q) => q.choices)).toEqual([["Yes", "No"], ["Yes", "No"], ["Yes", "No"]]);
    const zed = await b("quiz_start", { child: B_CHILD });                 // grade 4
    expect(zed.level).toBe("g46");
    // the browser never gets the right answer or the why before answering
    for (const r of [maya, leo, zed]) {
      for (const q of r.questions) expect(Object.keys(q).sort()).toEqual(["choices", "nuggetId", "question", "subject"]);
      expect(JSON.stringify(r)).not.toMatch(/"answer"|"why"|Because|needs the why/);
    }
    // two Augusts later Maya is in 4th grade, so she gets the 4th to 6th grade questions
    at("2028-08-02T12:00:00Z");
    expect(await a("quiz_start", { child: A_CHILD })).toMatchObject({ ok: true, level: "g46", questions: [{ question: "g46 question" }, {}, {}] });
  });

  it("asks the other way of asking than last time, and checks the answer against it", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact"], ["episode:e2:fact"], ["episode:e3:fact"]]);
    rowsOf("nugget_questions").push(
      quizQ("episode:e1:fact", { variant: 2, question: "Second way to ask e1", answer: 2, why: "Second why" }),
      quizQ("episode:e2:fact", { variant: 2, question: "Second way to ask e2" }),
    );
    db.tables.child_nuggets = [
      { child_id: A_CHILD, nugget_id: "episode:e1:fact", status: "met", review_step: 0, review_due: null, known_at: null, last_asked: null, last_variant: 1 },
      { child_id: A_CHILD, nugget_id: "episode:e2:fact", status: "met", review_step: 0, review_due: null, known_at: null, last_asked: null, last_variant: 2 },
    ];
    const r = await a("quiz_start", { child: A_CHILD });
    const byId = Object.fromEntries(r.questions.map((q) => [q.nuggetId, q.question]));
    expect(byId).toEqual({ "episode:e1:fact": "Second way to ask e1", "episode:e2:fact": "Question about episode:e2:fact", "episode:e3:fact": "Question about episode:e3:fact" });
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e1:fact", choice: 2 })).toEqual({ status: 200, ok: true, correct: true, answer: 2, why: "Second why" });
    expect(nug(A_CHILD, "episode:e1:fact").last_variant).toBe(2);
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e2:fact", choice: 1 })).toMatchObject({ correct: true, answer: 1 });
    expect(nug(A_CHILD, "episode:e2:fact").last_variant).toBe(1);
  });

  it("a second quiz in the same week is not due", async () => {
    seedQuiz(A_CHILD, [1, 2, 3, 4, 5, 6].map((n) => [`episode:e${n}:fact`]));
    seedQuiz(A_CHILD2, [1, 2, 3].map((n) => [`book:k${n}:fact`, null, { level: "k1", choices: ["Yes", "No"] }]));
    expect((await a("quiz_start", { child: A_CHILD })).ok).toBe(true);
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    expect(await a("quiz_start", { child: A_CHILD })).toMatchObject({ ok: false, error: "not_due" });
    expect(table("child_quizzes")).toHaveLength(1);
    // another child in the family is not held back
    expect((await a("quiz_offer", { child: A_CHILD2 })).due).toBe(true);
    at("2026-11-28T11:59:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    expect((await a("quiz_start", { child: A_CHILD })).error).toBe("not_due");
    // due again 7 days after the last one started
    at("2026-11-28T12:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(true);
    expect((await a("quiz_start", { child: A_CHILD })).ok).toBe(true);
    expect(table("child_quizzes").filter((q) => q.child_id === A_CHILD)).toHaveLength(2);
  });

  it("an answer counts once", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact"], ["episode:e2:fact"], ["episode:e3:fact"]]);
    const r = await a("quiz_start", { child: A_CHILD });
    const [n1, n2, n3] = ids(r);
    const answer = (nuggetId, choice, child = A_CHILD, quizId = r.quizId) => a("quiz_answer", { child, quizId, nuggetId, choice });
    const right = { status: 200, ok: true, correct: true, answer: 1, why: `Because of ${n1}` };
    expect(await answer(n1, 1)).toEqual(right);
    const kept = JSON.stringify(db.tables);
    expect(await answer(n1, 1)).toEqual(right);
    expect(await answer(n1, 0)).toEqual(right);                          // a different tap after the first changes nothing
    expect(JSON.stringify(db.tables)).toBe(kept);
    expect(quizRow(r.quizId)).toMatchObject({ answered: [n1], asked: 1, right_count: 1 });
    expect(nug(A_CHILD, n1)).toMatchObject({ status: "knows", review_step: 1 });

    const wrong = { status: 200, ok: true, correct: false, answer: 1, why: `Because of ${n2}` };
    expect(await answer(n2, 0)).toEqual(wrong);
    expect(await answer(n2, 1)).toEqual(wrong);
    expect(quizRow(r.quizId)).toMatchObject({ answered: [n1, n2], asked: 2, right_count: 1 });

    const before = JSON.stringify(db.tables);
    for (const [nuggetId, quizId] of [["episode:e9:fact", r.quizId], [n3, crypto.randomUUID()], [n3, "nope"], [5, r.quizId], [undefined, r.quizId]]) {
      expect((await answer(nuggetId, 1, A_CHILD, quizId)).error, `${nuggetId} ${quizId}`).toBe("not_found");
    }
    expect((await answer(n3, 1, A_CHILD2)).error).toBe("not_found");            // the quiz is Maya's, not Leo's
    expect((await b("quiz_answer", { child: B_CHILD, quizId: r.quizId, nuggetId: n3, choice: 1 })).error).toBe("not_found");
    for (const choice of [-1, 1.5, "1", null, undefined, 3, 99]) expect((await answer(n3, choice)).error, String(choice)).toBe("invalid");
    expect(JSON.stringify(db.tables)).toBe(before);
  });

  it("a right answer comes back after 21 days, then 60, then not again", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact"], ["episode:e2:fact"], ["episode:e3:fact"]]);
    const answerAll = async () => {
      const r = await a("quiz_start", { child: A_CHILD });
      expect(ids(r).sort()).toEqual(["episode:e1:fact", "episode:e2:fact", "episode:e3:fact"]);
      for (const nuggetId of ids(r)) expect((await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId, choice: 1 })).correct).toBe(true);
      expect(quizRow(r.quizId)).toMatchObject({ asked: 3, right_count: 3 });
    };
    await answerAll();
    for (const n of table("child_nuggets")) {
      expect(n).toEqual({ child_id: A_CHILD, nugget_id: n.nugget_id, status: "knows", review_step: 1, review_due: "2026-12-12T12:00:00.000Z", known_at: NOW, last_asked: NOW, last_variant: 1 });
    }
    at("2026-12-12T11:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    at("2026-12-12T12:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(true);
    await answerAll();
    for (const n of table("child_nuggets")) expect(n).toMatchObject({ status: "knows", review_step: 2, review_due: "2027-02-10T12:00:00.000Z", known_at: NOW, last_asked: "2026-12-12T12:00:00.000Z" });
    at("2027-02-10T11:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    at("2027-02-10T12:00:00Z");
    await answerAll();
    for (const n of table("child_nuggets")) expect(n).toMatchObject({ status: "knows", review_step: 3, review_due: null, known_at: NOW });
    // still remembered it: never asked again (same school year, so the level is still g23)
    at("2027-07-01T12:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    expect((await a("quiz_start", { child: A_CHILD })).error).toBe("not_due");
  });

  it("a wrong answer goes back to came across it", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact"], ["episode:e2:fact"], ["episode:e3:fact"]]);
    db.tables.child_nuggets = [{ child_id: A_CHILD, nugget_id: "episode:e1:fact", status: "knows", review_step: 2, review_due: "2026-11-01T00:00:00Z", known_at: "2026-09-01T00:00:00Z", last_asked: "2026-09-20T00:00:00Z", last_variant: 1 }];
    const r = await a("quiz_start", { child: A_CHILD });
    expect(ids(r)).toContain("episode:e1:fact");
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e1:fact", choice: 0 })).toEqual({ status: 200, ok: true, correct: false, answer: 1, why: "Because of episode:e1:fact" });
    expect(nug(A_CHILD, "episode:e1:fact")).toMatchObject({ status: "met", review_step: 0, review_due: null, last_asked: NOW, last_variant: 1 });
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e2:fact", choice: 2 })).toMatchObject({ correct: false });
    expect(nug(A_CHILD, "episode:e2:fact")).toEqual({ child_id: A_CHILD, nugget_id: "episode:e2:fact", status: "met", review_step: 0, review_due: null, last_asked: NOW, last_variant: 1 });
    expect(quizRow(r.quizId)).toMatchObject({ asked: 2, right_count: 0 });
  });

  it("asks facts never asked first, then reviews, then ones answered wrong before", async () => {
    seedQuiz(A_CHILD, [1, 2, 3, 4, 5].map((n) => [`episode:e${n}:fact`]));
    const row = (n, o) => ({ child_id: A_CHILD, nugget_id: `episode:e${n}:fact`, review_step: 0, review_due: null, known_at: null, last_asked: null, last_variant: null, ...o });
    db.tables.child_nuggets = [
      row(1, { status: "met", last_asked: "2026-10-10T00:00:00Z", last_variant: 1 }),                         // answered wrong before
      row(2, { status: "knows", review_step: 1, review_due: "2026-11-20T00:00:00Z", last_asked: "2026-10-30T00:00:00Z" }), // due for review
      row(3, { status: "met" }),                                                                                // came across it, never asked
      row(5, { status: "knows", review_step: 1, review_due: "2026-11-20T00:00:00Z", last_asked: "2026-10-30T00:00:00Z" }),
    ];                                                                                                          // e4: never asked
    expect(ids(await a("quiz_start", { child: A_CHILD }))).toEqual(["episode:e3:fact", "episode:e4:fact", "episode:e2:fact"]);
  });

  it("a half-finished quiz still counts for the week", async () => {
    seedQuiz(A_CHILD, [1, 2, 3, 4].map((n) => [`episode:e${n}:fact`]));
    const r = await a("quiz_start", { child: A_CHILD });
    await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: ids(r)[0], choice: 1 });
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    at("2026-11-22T12:00:00Z");
    expect((await a("quiz_offer", { child: A_CHILD })).due).toBe(false);
    expect((await a("quiz_start", { child: A_CHILD })).error).toBe("not_due");
    expect((await a("report", { child: A_CHILD })).quizzes).toEqual([{ started_at: NOW, asked: 1, right_count: 1 }]);
  });

  it("a quiz mixes subjects before repeating one", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact", "science"], ["episode:e2:fact", "science"], ["episode:e3:fact", "math"], ["episode:e4:fact", "music"]]);
    expect(ids(await a("quiz_start", { child: A_CHILD }))).toEqual(["episode:e1:fact", "episode:e3:fact", "episode:e4:fact"]);
    // no subject is a group of its own; once every group has had a turn, a subject may repeat, in order
    const k1 = { level: "k1", choices: ["Yes", "No"] };
    seedQuiz(A_CHILD2, [["book:k1:fact", "science", k1], ["book:k2:fact", "science", k1], ["book:k3:fact", null, k1], ["book:k4:fact", "science", k1]]);
    const leo = await a("quiz_start", { child: A_CHILD2 });
    expect(ids(leo)).toEqual(["book:k1:fact", "book:k3:fact", "book:k2:fact"]);
    // each question says its STEAMM subject, for the label under it on the quiz card ("" when it has none)
    expect(leo.questions.map((q) => q.subject)).toEqual(["science", "", "science"]);
  });

  // ---- answers given inside games, for the report's subject levels ----

  it("game_answer validates and limits", async () => {
    const bad = [
      { game: "" }, { game: "Solar" }, { game: "a b" }, { game: "solar_system" }, { game: "x".repeat(41) }, { game: 5 }, { game: undefined }, { game: "pop-quiz" },
      { subject: ["science"] }, { level: ["g23"] },
      { qid: "" }, { qid: "sun_1" }, { qid: "SUN" }, { qid: "sun:1" }, { qid: "x".repeat(41) }, { qid: null },
      { subject: "history" }, { subject: "Science" }, { subject: "" }, { subject: undefined },
      { level: "g46" }, { level: "lesson" }, { level: "K1" }, { level: "" }, { level: undefined },
      { correct: "true" }, { correct: 1 }, { correct: null }, { correct: undefined },
      { question: "" }, { question: "   " }, { question: 5 }, { question: undefined },
      { answer: "" }, { answer: "  " }, { answer: ["A star"] }, { answer: undefined },
      { why: 5 }, { why: {} },
    ];
    for (const o of bad) expect((await a("game_answer", { child: A_CHILD, ...gameAnswer(o) })).error, JSON.stringify(o)).toBe("invalid");
    expect(table("child_game_answers")).toEqual([]);
    expect(db.rate.calls).toEqual([]);

    // text is trimmed and cut to 300 (question), 200 (answer) and 400 (why) characters; the child comes from the lookup
    const long = gameAnswer({ game: "g".repeat(40), qid: "q".repeat(40), question: "  " + "x".repeat(350) + "  ", answer: "y".repeat(250), why: "z".repeat(500) });
    expect(await a("game_answer", { child: A_CHILD, child_id: B_CHILD, at: "2000-01-01T00:00:00Z", ...long })).toEqual({ status: 200, ok: true });
    expect(table("child_game_answers")).toEqual([{
      id: 1, child_id: A_CHILD, game: "g".repeat(40), qid: "q".repeat(40), subject: "science", level: "g23", correct: true,
      question: "x".repeat(300), answer: "y".repeat(200), why: "z".repeat(400), at: NOW,
    }]);
    expect(db.rate.calls).toEqual([{ name: "rate_take", args: { p_bucket: "kid_answer", p_key: "sub-a", p_max: 200, p_window_seconds: 3600 } }]);
    // the why may be left out; every level and subject is taken
    expect((await a("game_answer", { child: A_CHILD, ...gameAnswer({ question: "  Which one is Mars? ", answer: " The red one ", why: undefined, correct: false, level: "k1", subject: "math" }) })).ok).toBe(true);
    expect(table("child_game_answers")[1]).toMatchObject({ question: "Which one is Mars?", answer: "The red one", why: "", correct: false, level: "k1", subject: "math" });
    for (const subject of ["technology", "engineering", "art", "music"]) expect((await a("game_answer", { child: A_CHILD, ...gameAnswer({ subject, level: "g45" }) })).ok, subject).toBe(true);
    expect(table("child_game_answers")).toHaveLength(6);

    // a flood of answers is held back by the member's kid_answer bucket
    db.rate.allow = false;
    expect(await a("game_answer", { child: A_CHILD, ...gameAnswer() })).toMatchObject({ ok: false, error: "slow_down" });
    expect(table("child_game_answers")).toHaveLength(6);
  });

  it("game_answer is only for the member's own child", async () => {
    for (const child of [A_CHILD, A_CHILD2, "nope", undefined, 5]) {
      expect((await b("game_answer", { child, ...gameAnswer() })).error, String(child)).toBe("not_found");
    }
    expect(table("child_game_answers")).toEqual([]);
    expect(db.rate.calls).toEqual([]);
    expect((await b("game_answer", { child: B_CHILD, ...gameAnswer({ level: "g45" }) })).ok).toBe(true);
    expect(table("child_game_answers").map((r) => r.child_id)).toEqual([B_CHILD]);
    expect(db.rate.calls[0].args.p_key).toBe("sub-b");
    // removing the child removes the child's answers
    expect((await b("child_remove", { id: B_CHILD })).ok).toBe(true);
    expect(table("child_game_answers")).toEqual([]);
  });

  it("quiz_answer also records the answer for the report, once, and only for a fact with a subject", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact", "science"], ["episode:e2:fact", "math"], ["episode:e3:fact", null]]);
    const r = await a("quiz_start", { child: A_CHILD });
    expect(ids(r).sort()).toEqual(["episode:e1:fact", "episode:e2:fact", "episode:e3:fact"]);
    const answer = (nuggetId, choice) => a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId, choice });
    expect((await answer("episode:e1:fact", 1)).correct).toBe(true);
    expect((await answer("episode:e2:fact", 0)).correct).toBe(false);
    expect((await answer("episode:e3:fact", 1)).correct).toBe(true);     // no subject: nothing to count it toward
    const row = (n, subject, correct) => ({
      id: n, child_id: A_CHILD, game: "pop-quiz", qid: `episode:e${n}:fact`, subject, level: "g23", correct,
      question: `Question about episode:e${n}:fact`, answer: "two", why: `Because of episode:e${n}:fact`, at: NOW,
    });
    expect(table("child_game_answers")).toEqual([row(1, "science", true), row(2, "math", false)]);
    // sending an answer again changes nothing, here too
    await answer("episode:e1:fact", 0);
    await answer("episode:e2:fact", 1);
    expect(table("child_game_answers")).toHaveLength(2);
    // the pop quiz is not held back by the game answer bucket
    expect(db.rate.calls).toEqual([]);
  });

  it("a fault while recording a quiz answer for the report never fails the answer", async () => {
    seedQuiz(A_CHILD, [["episode:e1:fact", "science"], ["episode:e2:fact", "math"], ["episode:e3:fact", "art"]]);
    const r = await a("quiz_start", { child: A_CHILD });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    db.fail.add("child_game_answers");
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e1:fact", choice: 1 })).toEqual({ status: 200, ok: true, correct: true, answer: 1, why: "Because of episode:e1:fact" });
    db.fail.delete("child_game_answers"); db.fail.add("nugget_subjects");
    expect(await a("quiz_answer", { child: A_CHILD, quizId: r.quizId, nuggetId: "episode:e2:fact", choice: 0 })).toMatchObject({ status: 200, ok: true, correct: false });
    expect(quiet).toHaveBeenCalledTimes(2); quiet.mockRestore();
    expect(quizRow(r.quizId)).toMatchObject({ answered: ["episode:e1:fact", "episode:e2:fact"], asked: 2, right_count: 1 });
    expect(nug(A_CHILD, "episode:e1:fact")).toMatchObject({ status: "knows", review_step: 1 });
    expect(table("child_game_answers")).toEqual([]);
  });

  it("report sums the last 8 weeks of answers by subject and lists the 10 newest missed", async () => {
    const day = (d) => new Date(Date.UTC(2026, 10, d, 9)).toISOString();     // November 2026
    db.tables.child_game_answers = [
      ...[1, 2, 3].map((d) => answerRow(A_CHILD, day(d))),
      answerRow(A_CHILD, day(20), { game: "pop-quiz", question: "Science miss", answer: "Right one", why: "Why one", correct: false }),
      ...Array.from({ length: 12 }, (_, i) => answerRow(A_CHILD, day(i + 1), { subject: "math", question: `M${i + 1}`, answer: `A${i + 1}`, why: `W${i + 1}`, correct: false })),
      answerRow(A_CHILD, "2026-09-26T12:00:00Z", { subject: "music" }),                       // exactly 8 weeks ago: counts
      answerRow(A_CHILD, "2026-09-26T11:59:59Z", { subject: "art", correct: false, question: "Too old" }),   // just before: not
      answerRow(A_CHILD2, day(10), { subject: "engineering", correct: false, question: "Leo's" }),
      answerRow(B_CHILD, day(10), { subject: "technology", correct: false, question: "Zed's" }),
    ].map((row, i) => ({ ...row, id: i + 1, qid: `q${i + 1}` }));                     // each a different question

    const r = await a("report", { child: A_CHILD });
    expect(r.ok).toBe(true);
    expect(r.answers.bySubject).toEqual({ science: { asked: 4, right: 3 }, math: { asked: 12, right: 0 }, music: { asked: 1, right: 1 } });
    expect(r.answers.missed).toEqual([
      { game: "pop-quiz", question: "Science miss", answer: "Right one", why: "Why one", at: day(20) },
      ...[12, 11, 10, 9, 8, 7, 6, 5, 4].map((n) => ({ game: "solar-system-sandbox", question: `M${n}`, answer: `A${n}`, why: `W${n}`, at: day(n) })),
    ]);
    expect(JSON.stringify(r)).not.toMatch(/Too old|Leo's|Zed's|child_id|"id":|"level"/);
    // every other part of the report is still there
    for (const k of ["progress", "nuggets", "lessons", "subjects", "quizzes"]) expect(r, k).toHaveProperty(k);
    // a child with no answers gets an empty summary, not a level for every subject
    expect((await b("report", { child: B_CHILD })).answers).toEqual({ bySubject: { technology: { asked: 1, right: 0 } }, missed: [{ game: "solar-system-sandbox", question: "Zed's", answer: "A", why: "W", at: day(10) }] });
    db.tables.child_game_answers = [];
    expect((await a("report", { child: A_CHILD })).answers).toEqual({ bySubject: {}, missed: [] });
  });

  it("report counts every answer, past the 1000-row read limit", async () => {
    db.tables.child_game_answers = Array.from({ length: 2300 }, (_, i) => ({ id: i + 1, ...answerRow(A_CHILD, new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString(), { qid: `q${i}`, correct: i % 2 === 0, question: `Q${i}` }) }));
    const r = await a("report", { child: A_CHILD });
    expect(r.answers.bySubject).toEqual({ science: { asked: 2300, right: 1150 } });
    expect(r.answers.missed.map((m) => m.question)).toEqual([2299, 2297, 2295, 2293, 2291, 2289, 2287, 2285, 2283, 2281].map((n) => `Q${n}`));
  });

  it("a replayed question counts once in the report", async () => {
    // a tour shows the right answer and the why after each pick, so replaying it must not turn 1 of 3 into 10 of 12
    const day = (d) => new Date(Date.UTC(2026, 10, d, 9)).toISOString();
    const play = (d, right) => ["t1", "t2", "t3"].map((qid) => answerRow(A_CHILD, day(d), { qid, question: `Q ${qid}`, answer: `A ${qid}`, why: `W ${qid}`, correct: right.includes(qid) }));
    db.tables.child_game_answers = [
      ...play(1, ["t1"]), ...play(2, ["t1", "t2", "t3"]), ...play(3, ["t1", "t2", "t3"]), ...play(4, ["t1", "t2", "t3"]),
      // the same question id in another game is another question
      answerRow(A_CHILD, day(5), { game: "other-game", qid: "t1", question: "Other Q", answer: "Other A", why: "Other W", correct: false }),
    ].map((row, i) => ({ id: i + 1, ...row }));
    const r = await a("report", { child: A_CHILD });
    expect(r.answers.bySubject).toEqual({ science: { asked: 4, right: 1 } });
    expect(r.answers.missed).toEqual([
      { game: "other-game", question: "Other Q", answer: "Other A", why: "Other W", at: day(5) },
      // same time: the later-stored one first
      { game: "solar-system-sandbox", question: "Q t3", answer: "A t3", why: "W t3", at: day(1) },
      { game: "solar-system-sandbox", question: "Q t2", answer: "A t2", why: "W t2", at: day(1) },
    ]);
    // every answer is still kept
    expect(table("child_game_answers")).toHaveLength(13);
  });

  it("the first answer wins even if a later replay is right, or wrong", async () => {
    const t = (m) => new Date(Date.UTC(2026, 10, 1) + m * 60_000).toISOString();
    db.tables.child_game_answers = [
      // stored out of time order: the earliest answer (by time) is the first, whatever its row id
      { id: 1, ...answerRow(A_CHILD, t(10), { qid: "missed-first", correct: true }) },
      { id: 2, ...answerRow(A_CHILD, t(5), { qid: "missed-first", correct: false, question: "Missed first" }) },
      { id: 3, ...answerRow(A_CHILD, t(1), { qid: "right-first", subject: "math", correct: true }) },
      { id: 4, ...answerRow(A_CHILD, t(2), { qid: "right-first", subject: "math", correct: false, question: "Missed on a replay" }) },
      // answered before the window: the first answer inside the window is the one that counts
      { id: 5, ...answerRow(A_CHILD, "2026-09-01T00:00:00Z", { qid: "old", subject: "art", correct: false, question: "Old miss" }) },
      { id: 6, ...answerRow(A_CHILD, t(3), { qid: "old", subject: "art", correct: true }) },
      // replays of one question across more than one page of rows still count once
      ...Array.from({ length: 1500 }, (_, i) => ({ id: 7 + i, ...answerRow(A_CHILD, t(20 + i), { qid: "many", subject: "music", correct: i > 0, question: "Many" }) })),
    ];
    const r = await a("report", { child: A_CHILD });
    expect(r.answers.bySubject).toEqual({ science: { asked: 1, right: 0 }, math: { asked: 1, right: 1 }, art: { asked: 1, right: 1 }, music: { asked: 1, right: 0 } });
    expect(r.answers.missed.map((m) => [m.question, m.at])).toEqual([["Many", t(20)], ["Missed first", t(5)]]);
  });

  it("a fault reading the answers (say game-answers.sql not applied yet) leaves the rest of the report working", async () => {
    db.tables.child_progress = [{ child_id: A_CHILD, kind: "episode", item_id: "ep-1", first_at: "2026-10-01T00:00:00Z", last_at: "2026-10-01T00:00:00Z", times: 1 }];
    db.fail.add("child_game_answers");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await a("report", { child: A_CHILD })).toMatchObject({ status: 200, ok: true, progress: [{ item_id: "ep-1" }], answers: { bySubject: {}, missed: [] } });
    expect(quiet).toHaveBeenCalledOnce(); quiet.mockRestore();
  });

  describe("seen", () => {
    const sessionRow = async (hash) => table("portal_sessions").find((s) => s.token_hash === hash);
    let hashA;
    beforeEach(async () => { hashA = await sha(TOKEN_A); });

    it("sets last_seen_at on that session's row only", async () => {
      at("2026-11-21T12:00:00.000Z");
      expect(await a("seen")).toMatchObject({ status: 200, ok: true });
      expect((await sessionRow(hashA)).last_seen_at).toBe("2026-11-21T12:00:00.000Z");
      // the member's other session and other members' sessions are untouched
      for (const s of table("portal_sessions").filter((r) => r.token_hash !== hashA)) expect(s.last_seen_at).toBeUndefined();
    });

    it("does not write again within 60 seconds", async () => {
      at("2026-11-21T12:00:00.000Z");
      await a("seen");
      at("2026-11-21T12:00:59.000Z");
      expect(await a("seen")).toMatchObject({ ok: true });
      expect((await sessionRow(hashA)).last_seen_at).toBe("2026-11-21T12:00:00.000Z");
    });

    it("writes again once 60 seconds have passed", async () => {
      at("2026-11-21T12:00:00.000Z");
      await a("seen");
      at("2026-11-21T12:01:00.000Z");
      expect(await a("seen")).toMatchObject({ ok: true });
      expect((await sessionRow(hashA)).last_seen_at).toBe("2026-11-21T12:01:00.000Z");
    });

    it("says no_session for a bad, expired or left-the-list token and writes nothing", async () => {
      for (const session of [undefined, "short", "z".repeat(40), TOKEN_OLD, TOKEN_GONE]) {
        expect((await call({ action: "seen", session })).error).toBe("no_session");
      }
      for (const s of table("portal_sessions")) expect(s.last_seen_at).toBeUndefined();
    });
  });
});
