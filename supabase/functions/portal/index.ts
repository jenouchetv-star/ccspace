// Chike's Creative Space - portal Edge Function
//
// The gatekeeper for the Newsletter Portal (the members-only archive).
// Everything a visitor can do to get in, and the only way to read an entry,
// goes through here:
//
//   request   an email address, wanting in. A subscriber is emailed a
//             one-time link. Someone who is not on the list is first asked
//             for consent; once given they are added as "pending" and sent a
//             confirm link - they only count as subscribed after using it.
//   verify    the one-time link from that email. Single use, 30 minutes.
//             Proves the person controls the inbox, and starts a session.
//   exchange  the private key inside a newsletter's link (?k=...). Signed, so
//             no table lookup is needed to trust it, and tied to one
//             subscriber who must still be subscribed.
//   session   is this session still good?
//   list      the archive index   (needs a good session)
//   entry     one entry, in full  (needs a good session)
//   signout   forget this session
//
// The portal_entries table is admin-only under RLS. This function reads it
// with the service role, and only after a session has been checked - so an
// unverified browser is never sent a single word of the exclusive content.
//
// Expected, ordinary outcomes (wrong link, expired link, not subscribed...)
// come back as HTTP 200 with { ok:false, error:"..." } so the page can show a
// proper message; only a malformed call or a server fault is a non-200.
//
// Deploy: npx supabase functions deploy portal
// Secrets (RESEND_API_KEY / RESEND_FROM / SITE_URL are already set for the
// newsletter functions):
//   PORTAL_LINK_SECRET   a long random string (e.g. `openssl rand -base64 48`).
//                        Signs the private newsletter keys and salts the
//                        stored IP hashes. Set the SAME value for send-newsletter
//                        and send-scheduled-newsletters. Changing it later
//                        retires every key already emailed.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  inDays,
  inMinutes,
  isLive,
  isValidEmail,
  lookupSubscriber,
  normalizeEmail,
  overLimit,
  randomToken,
  readAccessKey,
  safeReturnPath,
  sha256Hex,
  SESSION_DAYS,
  sortNewestFirst,
  toIndexItem,
  toMemberEntry,
  VERIFY_MINUTES,
} from "../_shared/portal.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const fail = (error: string) => json({ ok: false, error });

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The two emails this function sends. Plain, on-brand, one button. */
function mailHtml(o: { heading: string; intro: string; button: string; url: string; note: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF4E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF4E6;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFBF3;border:2px solid #1E2226;border-radius:16px;">
<tr><td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;color:#1E2226;">
<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8A6D00;">Chike&rsquo;s Creative Space</p>
<h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;">${esc(o.heading)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6;">${esc(o.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#F2C230;">
<a href="${esc(o.url)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:800;color:#1E2226;text-decoration:none;border-radius:999px;">${esc(o.button)}</a>
</td></tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#5B6673;">${esc(o.note)}</p>
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#5B6673;word-break:break-all;">Button not working? Paste this into your browser:<br>${esc(o.url)}</p>
</td></tr></table>
</td></tr></table></body></html>`;
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("RESEND_FROM"), to, subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SECRET = Deno.env.get("PORTAL_LINK_SECRET") ?? "";
  if (SECRET.length < 24) return json({ error: "The portal is not configured yet (PORTAL_LINK_SECRET)." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const action = String(body.action ?? "");

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Never taken from a request header: the caller controls Origin, and this
  // origin is put into the emailed sign-in link.
  const siteOrigin = (Deno.env.get("SITE_URL") || "https://www.chikescreativespace.com").replace(/\/+$/, "");
  const now = Date.now();

  async function allSubscribers() {
    const { data, error } = await db.from("subscribers").select("id, data");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; data: Record<string, unknown> }[];
  }

  async function startSession(subscriberId: string) {
    const token = randomToken();
    const expiresAt = inDays(now, SESSION_DAYS);
    const { error } = await db.from("portal_sessions").insert({
      token_hash: await sha256Hex(token),
      subscriber_id: subscriberId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { session: token, expiresAt };
  }

  /** The subscriber behind a session, or null. The subscriber is looked up
      again every time, so someone who unsubscribes loses access at once. */
  async function sessionSubscriber(token: unknown) {
    const t = String(token ?? "");
    if (t.length < 20 || t.length > 200) return null;
    const { data } = await db
      .from("portal_sessions")
      .select("subscriber_id, expires_at")
      .eq("token_hash", await sha256Hex(t))
      .maybeSingle();
    if (!data || Date.parse(data.expires_at) <= now) return null;
    const { data: sub } = await db.from("subscribers").select("id, data").eq("id", data.subscriber_id).maybeSingle();
    if (!sub || sub.data?.status !== "published") return null;
    return { id: sub.id as string, email: String(sub.data.email ?? ""), expiresAt: data.expires_at as string };
  }

  try {
    /* ---------------- request ---------------- */
    if (action === "request") {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return fail("invalid_email");
      const consent = body.consent === true;
      const next = safeReturnPath(body.next);

      const ip = (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0]).trim();
      const emailHash = await sha256Hex(email);
      const ipHash = await sha256Hex(ip + "|" + SECRET);
      const since = new Date(now - 3_600_000).toISOString();
      const [byEmail, byIp] = await Promise.all([
        db.from("portal_tokens").select("token_hash", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", since),
        db.from("portal_tokens").select("token_hash", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
      ]);
      if (overLimit(byEmail.count ?? 0, byIp.count ?? 0)) return fail("rate_limited");
      await db.rpc("portal_cleanup");

      const rows = await allSubscribers();
      const found = lookupSubscriber(rows, email);

      let subscriberId = found.state === "none" ? "" : found.id;
      let purpose: "login" | "subscribe" = "login";

      if (found.state !== "active") {
        // Not on the list (or unsubscribed / never confirmed): needs a clear yes first.
        if (!consent) return json({ ok: true, status: "needs_consent" });
        purpose = "subscribe";
        const stamp = new Date(now).toISOString();
        if (found.state === "none") {
          subscriberId = "sub-" + randomToken(9);
          const { error } = await db.from("subscribers").insert({
            id: subscriberId,
            data: { id: subscriberId, email, source: "newsletter-portal", status: "pending", at: stamp, createdAt: stamp, updatedAt: stamp, consentAt: stamp },
          });
          if (error) throw new Error(error.message);
        } else {
          const row = rows.find((r) => r.id === found.id)!;
          const { error } = await db.from("subscribers").update({
            data: { ...row.data, status: "pending", consentAt: stamp, updatedAt: stamp },
          }).eq("id", found.id);
          if (error) throw new Error(error.message);
        }
      }

      const token = randomToken();
      const { error: tokErr } = await db.from("portal_tokens").insert({
        token_hash: await sha256Hex(token),
        purpose,
        subscriber_id: subscriberId,
        email_hash: emailHash,
        ip_hash: ipHash,
        next_path: next,
        expires_at: inMinutes(now, VERIFY_MINUTES),
      });
      if (tokErr) throw new Error(tokErr.message);

      const url = `${siteOrigin}${next}?v=${encodeURIComponent(token)}`;
      const sent = purpose === "login"
        ? await sendMail(email, "Your link to the Newsletter Archive", mailHtml({
            heading: "Here’s your way in",
            intro: "Tap the button to open the Chike’s Creative Space Newsletter Archive. You’ll stay signed in on this device, so you won’t need to do this for every story.",
            button: "Open the Newsletter Archive",
            url,
            note: `This link works once and expires in ${VERIFY_MINUTES} minutes. If you didn’t ask for it, you can ignore this email – nothing will happen.`,
          }))
        : await sendMail(email, "Please confirm you’d like to join our mailing list", mailHtml({
            heading: "One tap to join the list",
            intro: "You asked to join the Chike’s Creative Space mailing list and unlock the Newsletter Archive. Confirm your email to finish – you’ll get our newsletters, and you can unsubscribe any time.",
            button: "Yes, join the list",
            url,
            note: `This link works once and expires in ${VERIFY_MINUTES} minutes. If you didn’t ask to join, ignore this email and you won’t be subscribed.`,
          }));
      if (!sent) return fail("send_failed");
      return json({ ok: true, status: purpose === "login" ? "sent" : "consent_sent" });
    }

    /* ---------------- verify (the emailed link) ---------------- */
    if (action === "verify") {
      const token = String(body.token ?? "");
      if (token.length < 20 || token.length > 200) return fail("invalid");
      const hash = await sha256Hex(token);
      const stamp = new Date(now).toISOString();

      // Single use: only one caller can flip used_at from null.
      const { data: claimed, error: claimErr } = await db
        .from("portal_tokens")
        .update({ used_at: stamp })
        .eq("token_hash", hash)
        .is("used_at", null)
        .gt("expires_at", stamp)
        .select("purpose, subscriber_id, next_path");
      if (claimErr) throw new Error(claimErr.message);

      if (!claimed || !claimed.length) {
        const { data: tok } = await db.from("portal_tokens").select("used_at, expires_at").eq("token_hash", hash).maybeSingle();
        if (!tok) return fail("invalid");
        return fail(tok.used_at ? "used" : "expired");
      }

      const { purpose, subscriber_id, next_path } = claimed[0];
      const { data: sub } = await db.from("subscribers").select("id, data").eq("id", subscriber_id).maybeSingle();
      if (!sub) return fail("not_subscribed");

      if (purpose === "subscribe") {
        // Confirming the email is what completes a new (or returning) subscription.
        const { error } = await db.from("subscribers").update({
          data: { ...sub.data, status: "published", verifiedAt: stamp, subscribedAt: stamp, updatedAt: stamp, unsubscribedAt: null },
        }).eq("id", sub.id);
        if (error) throw new Error(error.message);
      } else if (sub.data?.status !== "published") {
        return fail("not_subscribed");
      } else if (!sub.data?.verifiedAt) {
        await db.from("subscribers").update({ data: { ...sub.data, verifiedAt: stamp, updatedAt: stamp } }).eq("id", sub.id);
      }

      const s = await startSession(sub.id);
      return json({ ok: true, ...s, email: String(sub.data.email ?? ""), purpose, next: next_path });
    }

    /* ---------------- exchange (the key inside a newsletter) ---------------- */
    if (action === "exchange") {
      const r = await readAccessKey(SECRET, body.key, now);
      if (!r.ok) return fail(r.reason);
      const { data: sub } = await db.from("subscribers").select("id, data").eq("id", r.subscriberId).maybeSingle();
      if (!sub || sub.data?.status !== "published") return fail("not_subscribed");
      const s = await startSession(sub.id);
      return json({ ok: true, ...s, email: String(sub.data.email ?? "") });
    }

    /* ---------------- session ---------------- */
    if (action === "session") {
      const who = await sessionSubscriber(body.session);
      return who ? json({ ok: true, email: who.email, expiresAt: who.expiresAt }) : fail("no_session");
    }

    if (action === "signout") {
      const t = String(body.session ?? "");
      if (t.length >= 20) await db.from("portal_sessions").delete().eq("token_hash", await sha256Hex(t));
      return json({ ok: true });
    }

    /* ---------------- the content ---------------- */
    if (action === "list" || action === "entry") {
      const who = await sessionSubscriber(body.session);
      if (!who) return fail("no_session");
      const { data: rows, error } = await db.from("portal_entries").select("id, data");
      if (error) throw new Error(error.message);
      const live = (rows ?? [])
        .map((r) => ({ ...(r.data as Record<string, unknown>), id: r.id as string }))
        .filter((e) => isLive(e, now));
      if (action === "list") return json({ ok: true, entries: sortNewestFirst(live).map(toIndexItem) });
      const want = String(body.slug ?? "");
      const hit = live.find((e) => e.slug === want || e.id === want);
      if (!hit) return fail("not_found");
      const entry = toMemberEntry(hit);
      /* A members-only game's code is kept in its own admin-only table and is only ever sent here, to a
         verified subscriber, with the entry that uses it. */
      const gameId = typeof hit.privateGameId === "string" ? hit.privateGameId : "";
      if (gameId) {
        const { data: file, error: fileErr } = await db.from("portal_game_files").select("data").eq("id", gameId).maybeSingle();
        if (fileErr) throw new Error(fileErr.message);
        const html = file ? (file.data as Record<string, unknown>).html : "";
        if (typeof html === "string" && html) entry.gameHtml = html;
      }
      return json({ ok: true, entry });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("portal:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
