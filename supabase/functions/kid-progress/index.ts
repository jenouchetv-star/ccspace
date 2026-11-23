// Chike's Creative Space - kid-progress Edge Function
//
// Keeps a mailing-list member's children (a first name or nickname and a school grade), what each child has
// finished, and the progress report for each child. Copied from sound-cloud: the same sign-in check, the same
// 200 { ok:false, error } for ordinary outcomes and 500 { ok:false, error:"server_error" } for faults.
//
// Every call carries the portal session; the member behind it is looked up again each time, so someone who leaves
// the list loses access at once. The member is only ever taken from that session, never from the request. A `child`
// (or `id`) in a call must be one of this member's own children, else { ok:false, error:"not_found" } and nothing is
// read or written.
//
//   children      the member's children: [{ id, name, grade, avatar }], each grade moved up one for every August 1
//                 since it was set, never past 6th; avatar one of the 20 AVATARS, or "" when none is kept.
//   child_save    { child: { id?, name, grade, avatar? } } add a child or change one. Name 1 to 24 letters, spaces, ' - or
//                 .; grade a whole number 0 (Kindergarten) to 6; avatar one of the 20 AVATARS. A new child with no avatar
//                 gets one at random, one their brothers and sisters don't have while any are left; a change with no
//                 avatar keeps the one they have. Six children at most ("full"). -> { ok, id, avatar }
//   child_remove  { id } remove a child; everything kept for the child goes with it (cascade).
//   record        { child, kind, item } the child finished an episode, book, entry or activity. One row per child per
//                 item: first_at stays, last_at is now, times goes up by one. 300 an hour per member ("slow_down").
//   game_answer   { child, game, qid, subject, level, correct, question, answer, why } the child answered a question
//                 inside a game. game and qid 1 to 40 of a-z 0-9 - (not "pop-quiz"); subject one of the six STEAMM ids,
//                 or "reading" (Reading and Writing: spelling and word games, beside STEAMM, not one of it);
//                 level k1, g23 or g45; correct true or false; question, answer (the right one) and why trimmed and cut
//                 to 300, 200 and 400 characters (why may be left out). 200 an hour per member ("slow_down"). -> { ok }
//                 For the parent report it may also send given (what the child answered, cut to 200), hints (a whole
//                 number 0 to 20, default 0), tries (1 to 50, default 1), skill (cut to 80) and day (the family's date,
//                 YYYY-MM-DD; kept when within a day of the server's, else the server's date). Each answer is added to
//                 the child's day (child_days, kind "game", the game's name). record takes the same day and marks the
//                 item done on it. A day that cannot be kept is logged and never fails the call.
//   report        { child } what the child finished, the facts they came across, the approved lessons of what they
//                 finished, each fact's STEAMM subject, the 5 newest quizzes, and answers: { bySubject: { <subject>:
//                 { asked, right } }, missed: [{ game, question, answer, why, at }] } over the last 8 weeks, counting
//                 only the first answer to each question (game, qid) so replays cannot inflate a level (only subjects
//                 with answers; missed is the 10 newest questions missed the first time). If the answers cannot be
//                 read, the rest of the report still comes back, with empty answers. For the parent report (owner,
//                 2026-11-23) it also returns answerRows, the last 26 weeks of answers newest first (at most 3000):
//                 { g, q, s, k, c, h, at } (game, qid, subject, skill, correct, hints), plus qt, a, gv, w (question,
//                 right answer, given, why) only for answers missed or right after a hint; and days, the last 26 weeks
//                 of child_days: [{ day, kind, item_id, done, answers, right_count }]. Either is [] when it cannot be read.
//   quiz_offer    { child } -> { ok, due }: due when no quiz started in the last 7 days and 3 or more facts are eligible.
//   quiz_start    { child } -> { ok, quizId, level, questions: [{ nuggetId, question, choices, subject }] } or "not_due"
//                 (subject: the fact's STEAMM subject id, or ""). Never sends the answer or the why.
//   quiz_answer   { child, quizId, nuggetId, choice } -> { ok, correct, answer, why }. Counts once per nugget per quiz;
//                 sending it again returns the first result and changes nothing. The first answer is also kept as a
//                 game answer (game "pop-quiz", qid the nugget id) when the fact has a STEAMM subject; a fault there is
//                 logged and never fails the answer.
//   seen          the signed-in member has a page of the site open: sets this session's portal_sessions.last_seen_at
//                 to now, skipped when it was set less than 60 seconds ago (supabase/parent-sign-ins.sql). -> { ok }
//
// The pop quiz. A fact (nugget '<kind>:<itemId>:<part>') is eligible when the child finished its item, it has an
// approved question at the child's level (grade 0-1 k1, 2-3 g23, 4-6 g46) and the child has never been asked it, got
// it wrong last time, or knows it and a review is due. Never asked come first, then reviews, then wrong before; inside
// each, the item finished first comes first. The 3 picked come from different STEAMM subjects before any repeats (no
// subject is a group of its own). Right: 'knows', next review in 21 days, then 60, then none. Wrong: back to 'met'.
//
// Reads of the shared question and subject tables are scoped to the child's finished items (in batches), because hosted
// PostgREST returns at most 1000 rows; "_" is a LIKE wildcard, so every row is checked again with startsWith.
//
// The six tables (supabase/kid-progress.sql) and child_game_answers (supabase/game-answers.sql) are service-role only
// under RLS. Deploy with verify_jwt off.
// Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, the portal_sessions and subscribers tables, rate_take().

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (error: string) => json({ ok: false, error });

const MAX_BODY_BYTES = 16_000;
const MAX_CHILDREN = 6;
const MAX_RECORDS_PER_HOUR = 300;
const KINDS = ["episode", "book", "entry", "activity"];
const REPORT_QUIZZES = 5;
const QUIZ_SIZE = 3;
const DAY_MS = 86_400_000;
const QUIZ_EVERY_MS = 7 * DAY_MS;
const REVIEW_DAYS = [21, 60];                 // after the 1st and 2nd right answer; after the 3rd, no more reviews
const LAST_REVIEW_STEP = 3;
const SEEN_EVERY_MS = 60_000;                 // a session's last_seen_at is written at most once a minute
const BATCH = 40;                             // prefixes or ids per scoped read, well under the URL and 1000-row limits
const ITEM_PREFIX = /^(episode|book|entry|activity):[A-Za-z0-9_-]{1,64}:$/;
const SUBJECTS = ["science", "technology", "engineering", "art", "math", "music"];
/* what a game's answer may count toward: the six STEAMM subjects, and Reading and Writing for the spelling and word
   games (owner, 2026-11-22), a line of its own on the report beside STEAMM, not one of its subjects */
const ANSWER_SUBJECTS = [...SUBJECTS, "reading"];
const GAME_LEVELS = ["k1", "g23", "g45"];
const GAME_ID = /^[a-z0-9-]{1,40}$/;          // a game's id and its own question ids
const POP_QUIZ = "pop-quiz";                  // the game name of pop quiz answers, kept by quiz_answer only
const MAX_ANSWERS_PER_HOUR = 200;
const ANSWER_WINDOW_MS = 56 * DAY_MS;         // the report sums the last 8 weeks of answers
const REPORT_MISSED = 10;
const PAGE = 1000;                            // rows per page when every answer in the window is read
const CAP = { question: 300, answer: 200, why: 400, given: 200, skill: 80 };
const REPORT_DAYS = 182;                      // the parent report's answer rows and day log: the last 26 weeks
const MAX_ANSWER_ROWS = 3000;
const DAY_KINDS = [...KINDS, "game"];
/** The 20 avatars a child can have (supabase/child-avatars.sql; drawn by assets/lib/avatars.js, the same ids). */
const AVATARS = ["robot", "racecar", "pencil", "rocket", "paintbrush", "guitar", "dinosaur", "planet", "lightbulb", "gear",
  "music", "microscope", "book", "telescope", "drum", "crayon", "magnet", "headphones", "airplane", "star"];

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** The school year a date falls in: from August 1 it is that calendar year, before that the year before (UTC). */
function schoolYear(d: Date) { return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; }
/** A child's grade today: the saved grade, one higher for each August 1 since it was set, never past 6th. */
function movedUpGrade(grade: number, gradeYear: number, d: Date) { return Math.min(6, Math.max(0, grade + schoolYear(d) - gradeYear)); }
/** A child's name as kept: composed (NFC), trimmed, 1 to 24 letters, spaces, ' - or ., with at least one letter. Else "". */
function cleanName(v: unknown) {
  const s = typeof v === "string" ? v.normalize("NFC").trim() : "";
  return /^[\p{L} '.-]{1,24}$/u.test(s) && /\p{L}/u.test(s) ? s : "";
}
/** The quiz level for a grade: 0-1 k1, 2-3 g23, 4-6 g46. */
function levelFor(grade: number) { return grade <= 1 ? "k1" : grade <= 3 ? "g23" : "g46"; }
function inBatches<T>(xs: T[]) { const out: T[][] = []; for (let i = 0; i < xs.length; i += BATCH) out.push(xs.slice(i, i + BATCH)); return out; }
type QuestionRow = { nugget_id: string; variant: number; question: string; choices: unknown[]; answer?: number; why?: string; approved?: boolean };
/** The question to ask: with both variants, the one not asked last time; with one, that one. */
function pickVariant<R extends { variant: number }>(rows: R[], last: unknown): R | undefined {
  const sorted = [...rows].sort((x, y) => x.variant - y.variant);
  return sorted.find((r) => r.variant !== last) ?? sorted[0];
}
/** Up to n in order, one per subject group first (no subject is a group of its own), then any repeats in order. */
function pickMixed<T extends { id: string }>(list: T[], subjectOf: (id: string) => string, n: number) {
  const picked: T[] = [], groups = new Set<string>();
  for (const e of list) { if (picked.length === n) break; const g = subjectOf(e.id); if (!groups.has(g)) { groups.add(g); picked.push(e); } }
  for (const e of list) { if (picked.length === n) break; if (!picked.includes(e)) picked.push(e); }
  return picked;
}
/** A grade 0 to 6 as a whole number, else -1. */
function cleanGrade(v: unknown) { return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6 ? v : -1; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanItem = (v: unknown) => { const s = typeof v === "string" ? v : ""; return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : ""; };
/** Text as kept for the report: trimmed and cut to n characters (whole code points, as char_length counts them). */
const cleanText = (v: string, n: number) => [...v.trim()].slice(0, n).join("").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = Date.now();
  const nowDate = new Date(now);

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (byteLength(raw) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: "Invalid request body" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body" }, 400);
  const action = String(body.action ?? "");

  /** The member behind a portal session, or null (expired, signed out, or no longer on the list). */
  async function member(token: unknown) {
    const t = String(token ?? "");
    if (t.length < 20 || t.length > 200) return null;
    const tokenHash = await sha256Hex(t);
    const { data } = await db.from("portal_sessions").select("subscriber_id, expires_at").eq("token_hash", tokenHash).maybeSingle();
    if (!data || Date.parse(data.expires_at) <= now) return null;
    const { data: sub } = await db.from("subscribers").select("id, data").eq("id", data.subscriber_id).maybeSingle();
    if (!sub || sub.data?.status !== "published") return null;
    return { id: sub.id as string, email: String(sub.data.email ?? ""), tokenHash };
  }

  /** One of this member's children, or null (not a child id, not theirs, or gone). Reused by the quiz actions. */
  async function ownChild(memberId: string, id: unknown) {
    if (typeof id !== "string" || !UUID.test(id)) return null;
    const { data, error } = await db.from("children").select("id, name, grade, grade_year").eq("id", id).eq("subscriber_id", memberId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  /** The '<kind>:<itemId>:' prefixes of what a child finished, with when each was first finished. */
  async function finishedItems(childId: string) {
    const { data, error } = await db.from("child_progress").select("kind, item_id, first_at").eq("child_id", childId);
    if (error) throw new Error(error.message);
    const firstAt = new Map<string, number>();
    for (const p of data ?? []) {
      const prefix = `${p.kind}:${p.item_id}:`;
      if (ITEM_PREFIX.test(prefix)) firstAt.set(prefix, Date.parse(p.first_at) || 0);
    }
    return firstAt;
  }

  /** Rows of a shared table whose nugget_id starts with one of the prefixes, read in scoped batches. */
  async function rowsFor(table: string, columns: string, prefixes: string[], eqs: Record<string, unknown> = {}) {
    // deno-lint-ignore no-explicit-any
    const out: any[] = [];
    for (const part of inBatches(prefixes)) {
      let q = db.from(table).select(columns).or(part.map((p) => `nugget_id.like.${p}*`).join(","));
      for (const [c, v] of Object.entries(eqs)) q = q.eq(c, v);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      // "_" in an item id is a LIKE wildcard, so check each row really starts with a finished item's prefix
      for (const r of data ?? []) if (part.some((p) => String(r.nugget_id).startsWith(p))) out.push(r);
    }
    return out;
  }

  /** Rows of a table where `column` is one of the values, read in batches; `eqs` narrows each read. */
  async function rowsIn(table: string, columns: string, column: string, values: string[], eqs: Record<string, unknown> = {}) {
    // deno-lint-ignore no-explicit-any
    const out: any[] = [];
    for (const part of inBatches(values)) {
      let q = db.from(table).select(columns).in(column, part);
      for (const [c, v] of Object.entries(eqs)) q = q.eq(c, v);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
    }
    return out;
  }

  const NUGGET_STATE = "nugget_id, status, review_step, review_due, known_at, last_asked, last_variant";

  /** True when a quiz for this child started in the last 7 days (answered or not). */
  async function quizThisWeek(childId: string) {
    const { data, error } = await db.from("child_quizzes").select("id").eq("child_id", childId).gt("started_at", new Date(now - QUIZ_EVERY_MS).toISOString()).limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }

  /** The child's quiz level and eligible facts, in the order to ask them (see the header). */
  async function eligibleNuggets(child: { id: string; grade: number; grade_year: number }) {
    const level = levelFor(movedUpGrade(Number(child.grade), Number(child.grade_year), nowDate));
    const firstAt = await finishedItems(child.id);
    const prefixes = [...firstAt.keys()];
    const questions: QuestionRow[] = prefixes.length
      ? await rowsFor("nugget_questions", "nugget_id, variant, question, choices", prefixes, { level, approved: true })
      : [];
    const variants = new Map<string, QuestionRow[]>();
    for (const q of questions) {
      if (!q.question || !Array.isArray(q.choices) || q.choices.length < 2) continue;
      variants.set(q.nugget_id, [...(variants.get(q.nugget_id) ?? []), q]);
    }
    const ids = [...variants.keys()];
    const states = new Map((await rowsIn("child_nuggets", NUGGET_STATE, "nugget_id", ids, { child_id: child.id })).map((s) => [s.nugget_id as string, s]));
    const list = [];
    for (const id of ids) {
      const s = states.get(id);
      let rank: number;
      if (s?.status === "knows") {
        if (!s.review_due || Date.parse(s.review_due) > now) continue;   // not due yet, or no more reviews
        rank = 1;
      } else rank = s?.last_asked ? 2 : 0;                                // answered wrong before, or never asked
      const prefix = prefixes.find((p) => id.startsWith(p))!;
      list.push({ id, rank, first: firstAt.get(prefix) ?? 0, state: s, rows: variants.get(id)! });
    }
    list.sort((x, y) => x.rank - y.rank || x.first - y.first || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    return { level, list };
  }

  /** Keeps a first-time pop quiz answer for the report, when the fact has a STEAMM subject. Never fails the answer:
   *  a fault is logged and the quiz goes on. */
  async function keepQuizAnswer(childId: string, nuggetId: string, level: string, correct: boolean, shown: { question?: unknown; choices?: unknown; answer?: unknown; why?: unknown }) {
    try {
      const { data: s, error: subjectError } = await db.from("nugget_subjects").select("subject").eq("nugget_id", nuggetId).maybeSingle();
      if (subjectError) throw new Error(subjectError.message);
      const subject = String(s?.subject ?? "");
      if (!SUBJECTS.includes(subject)) return;
      const right = Array.isArray(shown.choices) ? shown.choices[Number(shown.answer)] : undefined;
      const { error } = await db.from("child_game_answers").insert({
        child_id: childId, game: POP_QUIZ, qid: nuggetId, subject, level, correct,
        question: cleanText(String(shown.question ?? ""), CAP.question),
        answer: cleanText(String(right ?? ""), CAP.answer),
        why: cleanText(String(shown.why ?? ""), CAP.why),
        at: nowDate.toISOString(),
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error("kid-progress: quiz answer not kept for the report:", e instanceof Error ? e.message : e);
    }
  }

  /** The child's answers over the last 8 weeks, counting only the FIRST answer to each question (game, qid) in the
   *  window: a game shows the right answer and the why after each pick, so a replay would only inflate the level.
   *  Returns asked and right per STEAMM subject (only subjects with answers) and the questions missed the first time,
   *  newest first (even if a later replay got them right). Every answer in the window is read, a page at a time, past
   *  the 1000-row read limit; storing every answer stays as is. */
  async function answerSummary(childId: string) {
    const since = new Date(now - ANSWER_WINDOW_MS).toISOString();
    type Row = { id: number; game: string; qid: string; subject: string; correct: boolean; question: string | null; answer: string | null; why: string | null; at: string };
    const first = new Map<string, Row>();
    const earlier = (x: Row, y: Row) => { const a = Date.parse(x.at), b = Date.parse(y.at); return a !== b ? a < b : Number(x.id) < Number(y.id); };
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("child_game_answers").select("id, game, qid, subject, correct, question, answer, why, at")
        .eq("child_id", childId).gte("at", since).order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) {
        const key = JSON.stringify([r.game, r.qid]);
        const kept = first.get(key);
        if (!kept || earlier(r, kept)) first.set(key, r);
      }
      if ((data ?? []).length < PAGE) break;
    }
    const bySubject: Record<string, { asked: number; right: number }> = {};
    const misses: Row[] = [];
    for (const r of first.values()) {
      if (!ANSWER_SUBJECTS.includes(r.subject)) continue;
      const s = (bySubject[r.subject] ??= { asked: 0, right: 0 });
      s.asked += 1;
      if (r.correct === true) s.right += 1; else misses.push(r);
    }
    misses.sort((x, y) => (earlier(x, y) ? 1 : earlier(y, x) ? -1 : 0));
    return {
      bySubject,
      missed: misses.slice(0, REPORT_MISSED).map((m) => ({ game: m.game, question: m.question ?? "", answer: m.answer ?? "", why: m.why ?? "", at: m.at })),
    };
  }

  const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  /** The family's own date for the day log: the browser's, when it is a real date within a day of the server's
   *  (a family west of UTC is still on yesterday in the evening); otherwise the server's own date. */
  function familyDay(v: unknown) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const t = Date.parse(v + "T12:00:00Z");
      if (!isNaN(t) && isoDay(t) === v && Math.abs(t - Date.parse(isoDay(now) + "T12:00:00Z")) <= DAY_MS) return v;
    }
    return isoDay(now);
  }

  /** Adds to a child's day for the calendar: finished, or a question answered (and whether right). A fault is logged
   *  and never fails the call, so recording keeps working before supabase/progress-days.sql is applied. */
  async function addToDay(childId: string, day: string, kind: string, item: string, add: { done?: boolean; answers?: number; right?: number }) {
    try {
      if (!DAY_KINDS.includes(kind)) return;
      // one statement in the database (child_days_add), so two answers arriving together both count
      const { error } = await db.rpc("child_days_add", {
        p_child: childId, p_day: day, p_kind: kind, p_item: item,
        p_done: Boolean(add.done), p_answers: add.answers || 0, p_right: add.right || 0,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error("kid-progress: day not kept for the report:", e instanceof Error ? e.message : e);
    }
  }

  /** The parent report's answer rows: the last 26 weeks, newest first, at most 3000, in short fields. The words of a
   *  question (question, the right answer, what the child gave, the why) come only with answers to look at: missed,
   *  or right after a hint. */
  async function answerRows(childId: string) {
    const since = new Date(now - REPORT_DAYS * DAY_MS).toISOString();
    // deno-lint-ignore no-explicit-any
    const out: any[] = [];
    // before supabase/progress-days.sql is applied the new columns are missing: read without them rather than nothing
    let columns = "id, game, qid, subject, skill, correct, hints, question, answer, given, why, at";
    for (let from = 0; out.length < MAX_ANSWER_ROWS; from += PAGE) {
      let { data, error } = await db.from("child_game_answers").select(columns)
        .eq("child_id", childId).gte("at", since).order("at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE - 1);
      if (error && /column/i.test(error.message) && columns.includes("skill")) {
        columns = "id, game, qid, subject, correct, question, answer, why, at";
        ({ data, error } = await db.from("child_game_answers").select(columns)
          .eq("child_id", childId).gte("at", since).order("at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE - 1));
      }
      if (error) throw new Error(error.message);
      for (const r of data ?? []) {
        const c = r.correct === true, h = Number(r.hints) || 0;
        const row: Record<string, unknown> = { g: r.game, q: r.qid, s: r.subject, k: r.skill ?? null, c, h, at: r.at };
        if (!c || h > 0) Object.assign(row, { qt: r.question ?? "", a: r.answer ?? "", gv: r.given ?? "", w: r.why ?? "" });
        if (out.length < MAX_ANSWER_ROWS) out.push(row);
      }
      if ((data ?? []).length < PAGE) break;
    }
    return out;
  }

  /** The child's days for the report's calendar, the last 26 weeks, newest first. */
  async function dayRows(childId: string) {
    const { data, error } = await db.from("child_days").select("day, kind, item_id, done, answers, right_count")
      .eq("child_id", childId).gte("day", isoDay(now - REPORT_DAYS * DAY_MS)).order("day", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({ day: d.day, kind: d.kind, item_id: d.item_id, done: d.done === true, answers: Number(d.answers) || 0, right_count: Number(d.right_count) || 0 }));
  }

  try {
    const who = await member(body.session);
    if (!who) return fail("no_session");

    if (action === "seen") {
      // read here, not in member(), so the other actions keep working if parent-sign-ins.sql is not applied yet
      const { data: s, error: seenError } = await db.from("portal_sessions").select("last_seen_at").eq("token_hash", who.tokenHash).maybeSingle();
      if (seenError) throw new Error(seenError.message);
      const last = s?.last_seen_at ? Date.parse(s.last_seen_at) : NaN;
      if (!(now - last < SEEN_EVERY_MS)) {
        const { error } = await db.from("portal_sessions").update({ last_seen_at: nowDate.toISOString() }).eq("token_hash", who.tokenHash);
        if (error) throw new Error(error.message);
      }
      return json({ ok: true });
    }

    if (action === "children") {
      const { data, error } = await db.from("children").select("id, name, grade, grade_year, created_at, avatar").eq("subscriber_id", who.id).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return json({ ok: true, children: (data ?? []).map((c) => ({
        id: c.id, name: c.name, grade: movedUpGrade(Number(c.grade), Number(c.grade_year), nowDate), avatar: AVATARS.includes(c.avatar) ? c.avatar : "",
      })) });
    }

    if (action === "child_save") {
      const c = body.child as Record<string, unknown> | null;
      if (!c || typeof c !== "object" || Array.isArray(c)) return fail("invalid");
      const name = cleanName(c.name), grade = cleanGrade(c.grade);
      const noAvatar = c.avatar === undefined || c.avatar === null;
      if (!name || grade < 0 || (!noAvatar && !AVATARS.includes(c.avatar as string))) return fail("invalid");
      const row: Record<string, unknown> = { name, grade, grade_year: schoolYear(nowDate) };
      if (!noAvatar) row.avatar = c.avatar;
      if (c.id !== undefined && c.id !== null) {
        const mine = await ownChild(who.id, c.id);
        if (!mine) return fail("not_found");
        const { data: saved, error } = await db.from("children").update(row).eq("id", mine.id).eq("subscriber_id", who.id).select("avatar");
        if (error) throw new Error(error.message);
        const avatar = (saved ?? [])[0]?.avatar;
        return json({ ok: true, id: mine.id, avatar: AVATARS.includes(avatar) ? avatar : "" });
      }
      const { data: kept, error: countError } = await db.from("children").select("id, avatar").eq("subscriber_id", who.id);
      if (countError) throw new Error(countError.message);
      if ((kept ?? []).length >= MAX_CHILDREN) return fail("full");
      if (noAvatar) {
        // at random, from the ones no brother or sister has (all 20 when every one is taken)
        const taken = new Set((kept ?? []).map((k) => k.avatar));
        const free = AVATARS.filter((a) => !taken.has(a));
        const from = free.length ? free : AVATARS;
        row.avatar = from[Math.floor(Math.random() * from.length)];
      }
      const { data, error } = await db.from("children").insert({ subscriber_id: who.id, ...row }).select("id").single();
      if (error || !data) throw new Error(error?.message || "child not saved");
      return json({ ok: true, id: data.id, avatar: row.avatar });
    }

    if (action === "child_remove") {
      const child = await ownChild(who.id, body.id);
      if (!child) return fail("not_found");
      const { error } = await db.from("children").delete().eq("id", child.id).eq("subscriber_id", who.id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "record") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      const kind = String(body.kind ?? ""), item = cleanItem(body.item);
      if (!KINDS.includes(kind) || !item) return fail("invalid");
      const { data: allowed, error: rateError } = await db.rpc("rate_take", { p_bucket: "kid_record", p_key: who.id, p_max: MAX_RECORDS_PER_HOUR, p_window_seconds: 3600 });
      if (rateError) throw new Error(rateError.message);
      if (allowed === false) return fail("slow_down");
      const stamp = nowDate.toISOString();
      const { data: old, error: oldError } = await db.from("child_progress").select("first_at, times").eq("child_id", child.id).eq("kind", kind).eq("item_id", item).maybeSingle();
      if (oldError) throw new Error(oldError.message);
      const { error } = await db.from("child_progress").upsert({
        child_id: child.id, kind, item_id: item, first_at: old?.first_at || stamp, last_at: stamp, times: Number(old?.times || 0) + 1,
      }, { onConflict: "child_id,kind,item_id" });
      if (error) throw new Error(error.message);
      await addToDay(child.id, familyDay(body.day), kind, item, { done: true });
      return json({ ok: true });
    }

    if (action === "game_answer") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const game = str(body.game), qid = str(body.qid), subject = str(body.subject), level = str(body.level);
      const question = cleanText(str(body.question), CAP.question), answer = cleanText(str(body.answer), CAP.answer);
      const whyOk = body.why === undefined || body.why === null || typeof body.why === "string";
      // the parent report's optional fields: what the child gave, hints shown, tries taken, the skill practiced
      const none = (v: unknown) => v === undefined || v === null;
      const whole = (v: unknown, lo: number, hi: number, dflt: number) => none(v) ? dflt : (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? v as number : NaN);
      const hints = whole(body.hints, 0, 20, 0), tries = whole(body.tries, 1, 50, 1);
      const textOk = (v: unknown) => none(v) || typeof v === "string";
      if (!GAME_ID.test(game) || game === POP_QUIZ || !GAME_ID.test(qid) || !ANSWER_SUBJECTS.includes(subject) || !GAME_LEVELS.includes(level)
        || typeof body.correct !== "boolean" || !question || !answer || !whyOk
        || isNaN(hints) || isNaN(tries) || !textOk(body.given) || !textOk(body.skill)) return fail("invalid");
      const { data: allowed, error: rateError } = await db.rpc("rate_take", { p_bucket: "kid_answer", p_key: who.id, p_max: MAX_ANSWERS_PER_HOUR, p_window_seconds: 3600 });
      if (rateError) throw new Error(rateError.message);
      if (allowed === false) return fail("slow_down");
      const row = {
        child_id: child.id, game, qid, subject, level, correct: body.correct, question, answer,
        why: cleanText(str(body.why), CAP.why), at: nowDate.toISOString(),
      };
      const extra = { given: cleanText(str(body.given), CAP.given) || null, hints, tries, skill: cleanText(str(body.skill), CAP.skill) || null };
      let { error } = await db.from("child_game_answers").insert({ ...row, ...extra });
      // before supabase/progress-days.sql is applied the new columns are missing: keep the answer without them
      if (error && /column/i.test(error.message)) ({ error } = await db.from("child_game_answers").insert(row));
      if (error) throw new Error(error.message);
      await addToDay(child.id, familyDay(body.day), "game", game, { answers: 1, right: body.correct ? 1 : 0 });
      return json({ ok: true });
    }

    if (action === "report") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      const { data: prog, error: progError } = await db.from("child_progress").select("kind, item_id, first_at, last_at, times").eq("child_id", child.id);
      if (progError) throw new Error(progError.message);
      const progress = prog ?? [];
      const prefixes = progress.map((p) => `${p.kind}:${p.item_id}:`).filter((p) => ITEM_PREFIX.test(p));

      const { data: nug, error: nugError } = await db.from("child_nuggets").select("nugget_id, status, review_step, known_at").eq("child_id", child.id);
      if (nugError) throw new Error(nugError.message);
      const les = await rowsFor("nugget_questions", "nugget_id", prefixes, { level: "lesson", approved: true });
      const subj = await rowsFor("nugget_subjects", "nugget_id, subject", prefixes);
      const { data: quiz, error: quizError } = await db.from("child_quizzes").select("started_at, asked, right_count").eq("child_id", child.id).order("started_at", { ascending: false }).limit(REPORT_QUIZZES);
      if (quizError) throw new Error(quizError.message);

      const subjects: Record<string, string> = {};
      for (const s of subj) subjects[s.nugget_id] = s.subject;
      // read on its own, so the rest of the report keeps working if game-answers.sql is not applied yet
      let answers: Awaited<ReturnType<typeof answerSummary>> = { bySubject: {}, missed: [] };
      try { answers = await answerSummary(child.id); } catch (e) {
        console.error("kid-progress: answers not read for the report:", e instanceof Error ? e.message : e);
      }
      // the parent report's raw rows; each read on its own so a missing table or column never fails the report
      // deno-lint-ignore no-explicit-any
      let rows: any[] = [], days: Awaited<ReturnType<typeof dayRows>> = [];
      try { rows = await answerRows(child.id); } catch (e) {
        console.error("kid-progress: answer rows not read for the report:", e instanceof Error ? e.message : e);
      }
      try { days = await dayRows(child.id); } catch (e) {
        console.error("kid-progress: days not read for the report:", e instanceof Error ? e.message : e);
      }
      return json({
        ok: true,
        progress: progress.map((p) => ({ kind: p.kind, item_id: p.item_id, first_at: p.first_at, last_at: p.last_at, times: p.times })),
        nuggets: (nug ?? []).map((n) => ({ nugget_id: n.nugget_id, status: n.status, review_step: n.review_step, known_at: n.known_at })),
        lessons: [...new Set(les.map((l) => l.nugget_id as string))],
        subjects,
        quizzes: (quiz ?? []).map((q) => ({ started_at: q.started_at, asked: q.asked, right_count: q.right_count })),
        answers,
        answerRows: rows,
        days,
      });
    }

    if (action === "quiz_offer") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      if (await quizThisWeek(child.id)) return json({ ok: true, due: false });
      const { list } = await eligibleNuggets(child);
      return json({ ok: true, due: list.length >= QUIZ_SIZE });
    }

    if (action === "quiz_start") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      if (await quizThisWeek(child.id)) return fail("not_due");
      const { level, list } = await eligibleNuggets(child);
      if (list.length < QUIZ_SIZE) return fail("not_due");
      const subj = await rowsIn("nugget_subjects", "nugget_id, subject", "nugget_id", list.map((e) => e.id));
      const subjects = new Map(subj.map((s) => [s.nugget_id as string, String(s.subject)]));
      const picked = pickMixed(list, (id) => subjects.get(id) ?? "", QUIZ_SIZE);
      const { data, error } = await db.from("child_quizzes").insert({
        child_id: child.id, started_at: nowDate.toISOString(), nuggets: picked.map((e) => e.id), answered: [], asked: 0, right_count: 0,
      }).select("id").single();
      if (error || !data) throw new Error(error?.message || "quiz not saved");
      return json({
        ok: true, quizId: data.id, level,
        questions: picked.map((e) => {
          const q = pickVariant(e.rows, e.state?.last_variant)!;
          return { nuggetId: e.id, question: q.question, choices: q.choices, subject: subjects.get(e.id) ?? "" };
        }),
      });
    }

    if (action === "quiz_answer") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      const quizId = body.quizId, nuggetId = typeof body.nuggetId === "string" ? body.nuggetId : "", choice = body.choice;
      if (typeof quizId !== "string" || !UUID.test(quizId) || !nuggetId) return fail("not_found");
      if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0) return fail("invalid");
      const level = levelFor(movedUpGrade(Number(child.grade), Number(child.grade_year), nowDate));
      // A double tap can race; the quiz row is claimed with its `asked` count, and a lost claim reads again.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: quiz, error: quizError } = await db.from("child_quizzes").select("id, nuggets, answered, asked, right_count").eq("id", quizId).eq("child_id", child.id).maybeSingle();
        if (quizError) throw new Error(quizError.message);
        if (!quiz || !(quiz.nuggets ?? []).includes(nuggetId)) return fail("not_found");
        const { data: qs, error: qsError } = await db.from("nugget_questions").select("variant, question, choices, answer, why, approved").eq("nugget_id", nuggetId).eq("level", level);
        if (qsError) throw new Error(qsError.message);
        const { data: state, error: stateError } = await db.from("child_nuggets").select(NUGGET_STATE).eq("child_id", child.id).eq("nugget_id", nuggetId).maybeSingle();
        if (stateError) throw new Error(stateError.message);
        const rows = qs ?? [];

        if ((quiz.answered ?? []).includes(nuggetId)) {
          // already answered in this quiz: the same result as the first time, nothing changes
          const shown = rows.find((r) => r.variant === state?.last_variant) ?? pickVariant(rows.filter((r) => r.approved === true), state?.last_variant);
          if (!shown) return fail("not_found");
          return json({ ok: true, correct: state?.status === "knows", answer: shown.answer, why: shown.why ?? "" });
        }

        const shown = pickVariant(rows.filter((r) => r.approved === true), state?.last_variant);
        if (!shown) return fail("not_found");
        if (!Array.isArray(shown.choices) || choice >= shown.choices.length) return fail("invalid");
        const correct = choice === Number(shown.answer);

        const { data: claimed, error: claimError } = await db.from("child_quizzes").update({
          answered: [...(quiz.answered ?? []), nuggetId], asked: Number(quiz.asked || 0) + 1, right_count: Number(quiz.right_count || 0) + (correct ? 1 : 0),
        }).eq("id", quiz.id).eq("child_id", child.id).eq("asked", quiz.asked).select("id");
        if (claimError) throw new Error(claimError.message);
        if (!claimed || claimed.length === 0) continue;

        const stamp = nowDate.toISOString();
        const step = correct ? Math.min(LAST_REVIEW_STEP, Number(state?.review_step || 0) + 1) : 0;
        const days = REVIEW_DAYS[step - 1];
        const next = correct
          ? { status: "knows", review_step: step, review_due: days ? new Date(now + days * DAY_MS).toISOString() : null, known_at: state?.known_at || stamp }
          : { status: "met", review_step: 0, review_due: null };
        const { error } = await db.from("child_nuggets").upsert({
          child_id: child.id, nugget_id: nuggetId, ...next, last_asked: stamp, last_variant: shown.variant,
        }, { onConflict: "child_id,nugget_id" });
        if (error) throw new Error(error.message);
        await keepQuizAnswer(child.id, nuggetId, level, correct, shown);
        return json({ ok: true, correct, answer: shown.answer, why: shown.why ?? "" });
      }
      throw new Error("quiz answer kept changing");
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("kid-progress:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
