// Runs the REAL kid-progress Edge Function (supabase/functions/kid-progress/index.ts) against an in-memory database,
// to check who gets in, that a child is only ever reached by their own family, and what each action keeps and returns.
// All addresses are made-up ones on example.test.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

const db = vi.hoisted(() => ({ tables: {}, rate: { allow: true, calls: [] }, fail: new Set() }));
vi.mock("jsr:@supabase/supabase-js@2", () => {
  const copy = (v) => JSON.parse(JSON.stringify(v));
  class Q {
    constructor(t) { this.t = t; this.op = "select"; this.f = []; this.one = false; this.ord = null; this.lim = null; this.ret = false; }
    select() { if (this.op === "insert") this.ret = true; return this; }
    insert(v) { this.op = "insert"; this.v = v; return this; }
    update(v) { this.op = "update"; this.v = v; return this; }
    delete() { this.op = "delete"; return this; }
    upsert(v, o) { this.op = "upsert"; this.v = v; this.on = o.onConflict.split(","); return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
    order(c, o) { this.ord = { c, asc: !o || o.ascending !== false }; return this; }
    limit(n) { this.lim = n; return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; this.must = true; return this; }
    then(a, b) { return Promise.resolve(this.run()).then(a, b); }
    run() {
      if (db.fail.has(this.t)) return { data: null, error: { message: `relation "public.${this.t}" does not exist` } };
      const rows = (db.tables[this.t] = db.tables[this.t] || []);
      const hit = (r) => this.f.every((f) => f(r));
      if (this.op === "update") { rows.filter(hit).forEach((r) => Object.assign(r, copy(this.v))); return { data: null, error: null }; }
      if (this.op === "delete") {
        const gone = rows.filter(hit);
        db.tables[this.t] = rows.filter((r) => !hit(r));
        // the real tables cascade from children
        if (this.t === "children") for (const c of gone) for (const t of ["child_progress", "child_nuggets", "child_quizzes"]) db.tables[t] = (db.tables[t] || []).filter((r) => r.child_id !== c.id);
        return { data: null, error: null };
      }
      if (this.op === "insert") {
        const row = copy(this.v);
        if (this.t === "children") { row.id = crypto.randomUUID(); row.created_at = new Date(Date.now() + rows.length).toISOString(); }
        rows.push(row);
        return { data: this.ret ? (this.one ? copy(row) : [copy(row)]) : null, error: null };
      }
      if (this.op === "upsert") {
        const same = rows.find((r) => this.on.every((k) => r[k] === this.v[k]));
        if (same) Object.assign(same, copy(this.v)); else rows.push(copy(this.v));
        return { data: null, error: null };
      }
      let found = rows.filter(hit).map(copy);
      if (this.ord) { const { c, asc } = this.ord; found.sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1)); }
      if (this.lim !== null) found = found.slice(0, this.lim);
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
    db.rate.allow = true; db.rate.calls.length = 0; db.fail.clear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("refuses a call with no session, an expired one, or a member who left the list", async () => {
    for (const session of [undefined, "short", TOKEN_GONE, TOKEN_OLD, "z".repeat(40)]) {
      for (const action of ["children", "child_save", "child_remove", "record", "report"]) {
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
});
