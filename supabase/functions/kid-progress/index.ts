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
//   children      the member's children: [{ id, name, grade }], each grade moved up one for every August 1 since it
//                 was set, never past 6th.
//   child_save    { child: { id?, name, grade } } add a child or change one. Name 1 to 24 letters, spaces, ' - or .;
//                 grade a whole number 0 (Kindergarten) to 6. Six children at most ("full"). -> { ok, id }
//   child_remove  { id } remove a child; everything kept for the child goes with it (cascade).
//   record        { child, kind, item } the child finished an episode, book, entry or activity. One row per child per
//                 item: first_at stays, last_at is now, times goes up by one. 300 an hour per member ("slow_down").
//   report        { child } what the child finished, the facts they came across, the lessons of what they finished,
//                 each fact's STEAMM subject and the 5 newest quizzes.
//
// The six tables (supabase/kid-progress.sql) are service-role only under RLS. Deploy with verify_jwt off.
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

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** The school year a date falls in: from August 1 it is that calendar year, before that the year before (UTC). */
function schoolYear(d: Date) { return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; }
/** A child's grade today: the saved grade, one higher for each August 1 since it was set, never past 6th. */
function movedUpGrade(grade: number, gradeYear: number, d: Date) { return Math.min(6, Math.max(0, grade + schoolYear(d) - gradeYear)); }
/** A child's name as kept: trimmed, 1 to 24 letters, spaces, ' - or . Anything else: "". */
function cleanName(v: unknown) { const s = typeof v === "string" ? v.trim() : ""; return /^[\p{L} '.-]{1,24}$/u.test(s) ? s : ""; }
/** A grade 0 to 6 as a whole number, else -1. */
function cleanGrade(v: unknown) { return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6 ? v : -1; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanItem = (v: unknown) => { const s = typeof v === "string" ? v : ""; return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : ""; };

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
    const { data } = await db.from("portal_sessions").select("subscriber_id, expires_at").eq("token_hash", await sha256Hex(t)).maybeSingle();
    if (!data || Date.parse(data.expires_at) <= now) return null;
    const { data: sub } = await db.from("subscribers").select("id, data").eq("id", data.subscriber_id).maybeSingle();
    if (!sub || sub.data?.status !== "published") return null;
    return { id: sub.id as string, email: String(sub.data.email ?? "") };
  }

  /** One of this member's children, or null (not a child id, not theirs, or gone). Reused by the quiz actions. */
  async function ownChild(memberId: string, id: unknown) {
    if (typeof id !== "string" || !UUID.test(id)) return null;
    const { data, error } = await db.from("children").select("id, name, grade, grade_year").eq("id", id).eq("subscriber_id", memberId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  try {
    const who = await member(body.session);
    if (!who) return fail("no_session");

    if (action === "children") {
      const { data, error } = await db.from("children").select("id, name, grade, grade_year, created_at").eq("subscriber_id", who.id).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return json({ ok: true, children: (data ?? []).map((c) => ({ id: c.id, name: c.name, grade: movedUpGrade(Number(c.grade), Number(c.grade_year), nowDate) })) });
    }

    if (action === "child_save") {
      const c = body.child as Record<string, unknown> | null;
      if (!c || typeof c !== "object" || Array.isArray(c)) return fail("invalid");
      const name = cleanName(c.name), grade = cleanGrade(c.grade);
      if (!name || grade < 0) return fail("invalid");
      const row = { name, grade, grade_year: schoolYear(nowDate) };
      if (c.id !== undefined && c.id !== null) {
        const mine = await ownChild(who.id, c.id);
        if (!mine) return fail("not_found");
        const { error } = await db.from("children").update(row).eq("id", mine.id).eq("subscriber_id", who.id);
        if (error) throw new Error(error.message);
        return json({ ok: true, id: mine.id });
      }
      const { data: kept, error: countError } = await db.from("children").select("id").eq("subscriber_id", who.id);
      if (countError) throw new Error(countError.message);
      if ((kept ?? []).length >= MAX_CHILDREN) return fail("full");
      const { data, error } = await db.from("children").insert({ subscriber_id: who.id, ...row }).select("id").single();
      if (error || !data) throw new Error(error?.message || "child not saved");
      return json({ ok: true, id: data.id });
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
      return json({ ok: true });
    }

    if (action === "report") {
      const child = await ownChild(who.id, body.child);
      if (!child) return fail("not_found");
      const { data: prog, error: progError } = await db.from("child_progress").select("kind, item_id, first_at, last_at, times").eq("child_id", child.id);
      if (progError) throw new Error(progError.message);
      const progress = prog ?? [];
      const prefixes = progress.map((p) => `${p.kind}:${p.item_id}:`);
      const finished = (nuggetId: unknown) => { const id = String(nuggetId); return prefixes.some((p) => id.startsWith(p)); };

      const { data: nug, error: nugError } = await db.from("child_nuggets").select("nugget_id, status, review_step, known_at").eq("child_id", child.id);
      if (nugError) throw new Error(nugError.message);
      const { data: les, error: lesError } = await db.from("nugget_questions").select("nugget_id").eq("level", "lesson");
      if (lesError) throw new Error(lesError.message);
      const { data: subj, error: subjError } = await db.from("nugget_subjects").select("nugget_id, subject");
      if (subjError) throw new Error(subjError.message);
      const { data: quiz, error: quizError } = await db.from("child_quizzes").select("started_at, asked, right_count").eq("child_id", child.id).order("started_at", { ascending: false }).limit(REPORT_QUIZZES);
      if (quizError) throw new Error(quizError.message);

      const subjects: Record<string, string> = {};
      for (const s of subj ?? []) if (finished(s.nugget_id)) subjects[s.nugget_id] = s.subject;
      return json({
        ok: true,
        progress: progress.map((p) => ({ kind: p.kind, item_id: p.item_id, first_at: p.first_at, last_at: p.last_at, times: p.times })),
        nuggets: (nug ?? []).map((n) => ({ nugget_id: n.nugget_id, status: n.status, review_step: n.review_step, known_at: n.known_at })),
        lessons: [...new Set((les ?? []).map((l) => l.nugget_id as string).filter(finished))],
        subjects,
        quizzes: (quiz ?? []).map((q) => ({ started_at: q.started_at, asked: q.asked, right_count: q.right_count })),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("kid-progress:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
