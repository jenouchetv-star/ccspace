// Chike's Creative Space - sound-cloud Edge Function
//
// Keeps Sound Space songs in a mailing-list member's account, so they show in any browser where that member is
// signed in to the Subscriber's Portal. Free for everyone on the list (during the beta). Copied from art-cloud:
// the same sign-in check, the same actions and the same "newer wins" rule, for the sound_projects table.
//
// Every call carries the portal session (the same one the Subscriber's Portal uses); the member behind it is
// looked up again each time, so someone who leaves the list loses access at once. The member is only ever taken
// from that session, never from the request, and every query is limited to that member's own rows.
//
//   list     the member's songs: id, title, small picture, when last changed, and deleted ones (so other browsers
//            learn to remove them too). No song data.
//   get      one song, in full.
//   put      save one song. An older copy never replaces a newer one (the newer one wins). Limits: 600 saves an
//            hour per member ("slow_down"), 500 KB a song ("too_big"), 200 songs ("full") and 20 MB in all
//            ("storage_full"), unless an admin changed them (studio_limits / studio_member_limits). The small picture
//            must be an SVG or PNG data URL of at most 60 KB, or it is left out.
//   delete   remove one song (a small "deleted" row stays so other browsers remove theirs).
//   usage    how much of the account is used: songs and bytes, with this member's limits (for the space bar on Home).
//   lock     take or renew one song's lock for one browser tab (`holder`), so a song is open in one place at a time
//            (owner, 2026-11-16). Another tab gets { ok:false, error:"locked" }. A lock runs out 75 seconds after the
//            last renewal; the app renews it every 25 seconds while the song is open.
//   unlock   let go of a song's lock, only when this tab holds it.
//
// The sound_projects table is service-role only under RLS; nothing in it is reachable with the public key.
// Ordinary outcomes come back as HTTP 200 with { ok:false, error }; only a malformed call or a fault is non-200.
//
// Deploy: verify_jwt off (the function checks the portal session itself, like the portal and art-cloud functions).
// Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set by Supabase), the portal_sessions and subscribers tables and
// the rate_take() function that art-cloud already uses, and supabase/sound-space.sql (sound_projects, and
// sound_locks with sound_lock_take() for the song locks). supabase/studio-limits.sql
// adds the limits tables; without them the usual limits are used.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (error: string) => json({ ok: false, error });

const MAX_PROJECT_BYTES = 500_000;     // one song's data (a full 16-count song with 8 busy tracks is well under this)
const MAX_THUMB_BYTES = 60_000;        // the small picture shown in Recent
const MAX_PROJECTS = 200;              // songs kept per member
const MAX_ACCOUNT_BYTES = 20_000_000;  // all of a member's songs together
const MAX_SAVES_PER_HOUR = 600;        // the app saves a few seconds after a change, so real music-making stays under this
const MAX_TITLE = 60;                  // the app's own limit (model.validateSong)
const MAX_BODY_BYTES = MAX_PROJECT_BYTES + MAX_THUMB_BYTES + 16_000;   // a whole request, read before anything else

// An admin can change the four limits above for everyone (studio_limits, app 'sound') and a member's songs and total
// space for that member only (studio_member_limits); see supabase/studio-limits.sql. No row, an empty value or a
// value outside these safe ranges means the usual limit above. If the limits can't be read, the usual ones are used
// and a line is logged: a save never fails because of it. A bigger largest song lets a bigger request in; the
// request limit is never smaller than MAX_BODY_BYTES, and never more than the largest song an admin may allow.
const LIMIT_RANGES = { items: [1, 2000], accountBytes: [1_000_000, 1_000_000_000], itemBytes: [50_000, 2_000_000], savesPerHour: [60, 3600] };
const MOST_BODY_BYTES = LIMIT_RANGES.itemBytes[1] + MAX_THUMB_BYTES + 16_000;
type Limits = { items: number; accountBytes: number; itemBytes: number; savesPerHour: number };
const USUAL_LIMITS: Limits = { items: MAX_PROJECTS, accountBytes: MAX_ACCOUNT_BYTES, itemBytes: MAX_PROJECT_BYTES, savesPerHour: MAX_SAVES_PER_HOUR };
/** A saved limit if it is a whole number in its safe range, else the fallback. */
function limitOr(v: unknown, range: number[], fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= range[0] && n <= range[1] ? n : fallback;
}
const THUMB_TYPES = ["data:image/svg+xml;base64,", "data:image/png;base64,"];
const LOCK_SECONDS = 75;               // a song's lock runs out this long after the last renewal (supabase/sound-space.sql)
/** A browser tab's lock id, as the app makes it: 8 to 64 letters, digits, - or _. Anything else: none. */
const cleanHolder = (v: unknown) => { const s = typeof v === "string" ? v : ""; return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : ""; };
/* the fields a song has (model.js SONG_KEYS); anything else is not a song */
const SONG_KEYS = new Set(["schemaVersion", "id", "title", "counts", "tempo", "grid", "loop", "countIn", "volume", "tracks", "updatedMs"]);

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const cleanId = (v: unknown) => { const s = typeof v === "string" ? v : ""; return /^[A-Za-z0-9_-]{4,48}$/.test(s) ? s : ""; };
const byteLength = (s: string) => new TextEncoder().encode(s).length;
/** A small picture the app may show: an SVG or PNG data URL in plain base64, at most 60 KB. Anything else: none. */
function cleanThumb(v: unknown) {
  if (typeof v !== "string" || v.length > MAX_THUMB_BYTES) return null;
  const type = THUMB_TYPES.find((t) => v.startsWith(t));
  if (!type) return null;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(v.slice(type.length)) ? v : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = Date.now();

  /** Sound Space's limits (an admin's saved row over the usual ones), read at most once a call. */
  let appLimits: Promise<Limits> | null = null;
  function soundLimits(): Promise<Limits> {
    appLimits = appLimits || (async () => {
      const lim = { ...USUAL_LIMITS };
      try {
        const { data, error } = await db.from("studio_limits").select("max_items, max_account_bytes, max_item_bytes, max_saves_per_hour").eq("app", "sound").maybeSingle();
        if (error) throw new Error(error.message);
        if (data) {
          lim.items = limitOr(data.max_items, LIMIT_RANGES.items, lim.items);
          lim.accountBytes = limitOr(data.max_account_bytes, LIMIT_RANGES.accountBytes, lim.accountBytes);
          lim.itemBytes = limitOr(data.max_item_bytes, LIMIT_RANGES.itemBytes, lim.itemBytes);
          lim.savesPerHour = limitOr(data.max_saves_per_hour, LIMIT_RANGES.savesPerHour, lim.savesPerHour);
        }
      } catch (e) {
        console.error("sound-cloud: space limits not read, using the usual ones:", e instanceof Error ? e.message : e);
        return { ...USUAL_LIMITS };
      }
      return lim;
    })();
    return appLimits;
  }
  /** The limits for this member: their own songs and space over Sound Space's, over the usual ones. */
  async function limitsFor(memberId: string): Promise<Limits> {
    const lim = { ...(await soundLimits()) };
    try {
      const { data, error } = await db.from("studio_member_limits").select("max_items, max_account_bytes").eq("app", "sound").eq("subscriber_id", memberId).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        lim.items = limitOr(data.max_items, LIMIT_RANGES.items, lim.items);
        lim.accountBytes = limitOr(data.max_account_bytes, LIMIT_RANGES.accountBytes, lim.accountBytes);
      }
    } catch (e) {
      console.error("sound-cloud: member's space limits not read, using Sound Space's:", e instanceof Error ? e.message : e);
    }
    return lim;
  }

  // the size of the whole call is checked before it is read into anything (and, only for a call bigger than the
  // usual request limit, against the largest song an admin allows)
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MOST_BODY_BYTES) return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    const size = byteLength(raw);
    if (size > MOST_BODY_BYTES) return json({ error: "Request too large" }, 413);
    if (size > MAX_BODY_BYTES && size > (await soundLimits()).itemBytes + MAX_THUMB_BYTES + 16_000) return json({ error: "Request too large" }, 413);
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

  try {
    const who = await member(body.session);
    if (!who) return fail("no_session");

    if (action === "list") {
      const { data, error } = await db.from("sound_projects").select("project_id, title, thumb, updated_ms, deleted").eq("subscriber_id", who.id);
      if (error) throw new Error(error.message);
      return json({ ok: true, email: who.email, items: (data ?? []).map((r) => ({
        id: r.project_id, title: r.title, thumb: r.deleted ? "" : (r.thumb || ""), updated: Number(r.updated_ms), deleted: !!r.deleted })) });
    }

    if (action === "usage") {
      const { data, error } = await db.from("sound_projects").select("bytes").eq("subscriber_id", who.id).eq("deleted", false);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const lim = await limitsFor(who.id);
      return json({ ok: true, email: who.email, songs: rows.length, bytes: rows.reduce((n, r) => n + Number(r.bytes || 0), 0),
        maxSongs: lim.items, maxBytes: lim.accountBytes });
    }

    if (action === "lock") {
      const id = cleanId(body.id), holder = cleanHolder(body.holder);
      if (!id || !holder) return fail("invalid");
      const { data: got, error } = await db.rpc("sound_lock_take", { p_sub: who.id, p_project: id, p_holder: holder, p_seconds: LOCK_SECONDS });
      if (error) throw new Error(error.message);
      return got === true ? json({ ok: true, seconds: LOCK_SECONDS }) : fail("locked");
    }

    if (action === "unlock") {
      const id = cleanId(body.id), holder = cleanHolder(body.holder);
      if (!id || !holder) return fail("invalid");
      const { error } = await db.from("sound_locks").delete().eq("subscriber_id", who.id).eq("project_id", id).eq("holder", holder);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "get") {
      const id = cleanId(body.id);
      if (!id) return fail("not_found");
      const { data, error } = await db.from("sound_projects").select("data, updated_ms, deleted").eq("subscriber_id", who.id).eq("project_id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || data.deleted || !data.data) return fail("not_found");
      return json({ ok: true, project: data.data, updated: Number(data.updated_ms) });
    }

    if (action === "put") {
      const p = body.project as Record<string, unknown> | null;
      if (!p || typeof p !== "object" || Array.isArray(p)) return fail("invalid");
      const id = cleanId(p.id);
      const updated = p.updatedMs;
      if (!id || typeof updated !== "number" || !Number.isInteger(updated) || updated <= 0 || updated > now + 86_400_000) return fail("invalid");
      if (typeof p.title !== "string" || p.title.length > MAX_TITLE) return fail("invalid");
      if (!Array.isArray(p.tracks)) return fail("invalid");
      // the song only: the small picture is kept in its own column, and nothing that isn't part of a song is kept
      const { thumb: rawThumb, ...rest } = p;
      if (Object.keys(rest).some((k) => !SONG_KEYS.has(k))) return fail("invalid");
      const lim = await limitsFor(who.id);
      // a steady stream of saves is fine; a flood from one account is not
      const { data: allowed, error: rateError } = await db.rpc("rate_take", { p_bucket: "sound_put", p_key: who.id, p_max: lim.savesPerHour, p_window_seconds: 3600 });
      if (rateError) throw new Error(rateError.message);
      if (allowed === false) return fail("slow_down");
      const bytes = byteLength(JSON.stringify(rest));
      if (bytes > lim.itemBytes) {
        // a lowered limit never stops a song already kept from being saved again at the same or a smaller size
        const { data: kept, error: keptError } = await db.from("sound_projects").select("bytes, deleted").eq("subscriber_id", who.id).eq("project_id", id).maybeSingle();
        if (keptError) throw new Error(keptError.message);
        if (!kept || kept.deleted || bytes > Number(kept.bytes || 0)) return fail("too_big");
      }
      const thumb = cleanThumb(rawThumb);

      const { data: old, error: oldError } = await db.from("sound_projects").select("updated_ms, deleted").eq("subscriber_id", who.id).eq("project_id", id).maybeSingle();
      if (oldError) throw new Error(oldError.message);
      if (old && Number(old.updated_ms) >= updated) return json({ ok: true, stale: true, updated: Number(old.updated_ms), deleted: !!old.deleted });
      // the account's songs and total space, counting this song's new size instead of its old one. An account already
      // over a lowered limit can still save a song again at the same or a smaller size; it just can't grow.
      const { data: sizes, error: sizeError } = await db.from("sound_projects").select("project_id, bytes").eq("subscriber_id", who.id).eq("deleted", false);
      if (sizeError) throw new Error(sizeError.message);
      const live = sizes ?? [];
      if ((!old || old.deleted) && live.length >= lim.items) return fail("full");
      const used = live.reduce((n, r) => r.project_id === id ? n : n + Number(r.bytes || 0), 0);
      const before = live.find((r) => r.project_id === id);
      if (used + bytes > lim.accountBytes && (!before || bytes > Number(before.bytes || 0))) return fail("storage_full");
      const { error } = await db.from("sound_projects").upsert({
        subscriber_id: who.id, project_id: id, title: p.title, thumb, data: rest, bytes, updated_ms: updated, deleted: false,
      }, { onConflict: "subscriber_id,project_id" });
      if (error) throw new Error(error.message);
      return json({ ok: true, updated });
    }

    if (action === "delete") {
      const id = cleanId(body.id);
      if (!id) return fail("not_found");
      // only a song that is in the account needs a "deleted" row
      const { error } = await db.from("sound_projects")
        .update({ title: "", thumb: null, data: null, bytes: 0, updated_ms: now, deleted: true })
        .eq("subscriber_id", who.id).eq("project_id", id);
      if (error) throw new Error(error.message);
      return json({ ok: true, updated: now });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("sound-cloud:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
