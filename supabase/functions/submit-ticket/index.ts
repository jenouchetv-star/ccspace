// Chike's Creative Space - submit-ticket Edge Function
//
// Gates the two public contact forms (Grown-Ups contact, Business
// inquiries) behind Cloudflare Turnstile before writing to support_tickets.
// Previously both forms wrote straight from the browser to Supabase with
// the anon key - this function is now the only thing that does, with two
// added steps in front: a deterministic content filter, and a Turnstile
// check, both server-side.
//
// The support_tickets write itself still goes through the anon key only -
// no privilege change there, same RLS/rate-limit/fake-email triggers as
// before. blocked_senders is a different story: it's an admin-only table
// (same RLS category as audit_log/issues - anon has no access at all), so
// checking/recording a block uses a service-role client instead, the same
// pattern already established in admin-invite/send-newsletter. That's the
// right split - a visitor's own request can never read or forge the
// blocklist, only this function's own server-side logic can.
//
// Deploy: npx supabase functions deploy submit-ticket
// Secrets required: TURNSTILE_SECRET, SUPABASE_SERVICE_ROLE_KEY
//   (see supabase/functions/submit-ticket/README.md)
// Tables required: blocked_senders, moderation_terms, moderation_settings -
//   all admin-only RLS, all manageable from #/admin/moderation
//   (see supabase/migration.sql)

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTION_BY_KIND: Record<string, string> = { contact: "contact", business: "business_contact" };

// --- Content moderation ---------------------------------------------------
// A deterministic keyword filter, same "pattern-match, no AI" spirit as
// is_fake_email() in migration.sql. Matches profanity, slurs, and violent
// language, including common leetspeak/spacing substitutions meant to dodge
// a plain word list (e.g. "f4ggot", "sh1t", "f u c k"). This runs BEFORE
// Turnstile so a rejected message never spends a real verification attempt.
const BANNED_TERMS = [
  // profanity
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "cock",
  "pussy", "piss", "slut", "whore",
  // violent language / threats (aimed at someone else - a message aimed
  // at the SENDER's own life goes through SELF_HARM_TERMS below instead,
  // flagged for review rather than blocked outright)
  "murder", "rape", "molest", "pedophile", "terrorist", "massacre", "behead",
  "kill you", "kill him", "kill her", "kill them", "gonna kill",
  "shoot up", "shoot you", "stab you", "bomb threat", "burn it down",
  // slurs / derogatory
  "nigger", "nigga", "faggot", "retard", "chink", "spic", "kike", "gook",
  "wetback", "tranny", "dyke",
];

// Self-harm disclosures are handled differently from everything else this
// filter catches: a threat toward someone else, or plain abuse, gets
// blocked outright because there's no legitimate reason to let it
// through. A message about hurting ONESELF might be a real person in
// crisis reaching out - rejecting it and permanently locking them out of
// the only contact channel on the site would be the wrong call. These
// terms are checked separately (see Deno.serve below): a match here never
// blocks the message or the sender - it still saves normally and still
// requires Turnstile like any other message, just flagged so an admin
// sees it immediately instead of it sitting in the ordinary queue.
const SELF_HARM_TERMS = [
  "kill myself", "kill herself", "kill himself",
  "hurt myself", "hurt herself", "hurt himself",
  "cut myself", "cut herself", "cut himself",
  "end my life", "end her life", "end his life",
  "want to die", "wanna die", "wants to die",
  "hang myself", "hang herself", "hang himself",
  "suicidal", "suicide", "self harm",
  "no reason to live", "better off dead",
];

/** Lowercases, undoes common leetspeak substitutions, strips punctuation
    down to letters/spaces, and collapses stretched-out letters
    ("fuuuuck" -> "fuck") so the word list below only has to know real
    words, not every disguised spelling of them. */
function normalizeForFilter(s: string): string {
  return s
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Merges only RUNS of consecutive single-character tokens (e.g.
    "f u c k" -> "fuck") so deliberately spaced-out letters are still
    caught, without merging genuinely separate words together. Naively
    concatenating the whole message (an earlier version of this function
    did exactly that) turns innocent phrases into false matches - "watch
    ink dry" collapses into "...watchinkdry..." which contains "chink",
    and "found a hole" collapses into "...foundahole..." which contains
    "ahole". A real word never looks like a run of 1-letter tokens, so
    this only ever fires on actual letter-by-letter spacing. */
function collapseSpacedLetters(normalized: string): string[] {
  const tokens = normalized.split(" ").filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const tok of tokens) {
    if (tok.length === 1) {
      run += tok;
    } else {
      if (run) { out.push(run); run = ""; }
      out.push(tok);
    }
  }
  if (run) out.push(run);
  return out;
}

/** terms is BANNED_TERMS plus whatever admins have added via
    #/admin/moderation (moderation_terms) - admin-supplied text isn't
    guaranteed regex-safe, so every term is escaped before use here,
    unlike the hand-written BANNED_TERMS above which never needed it. */
function containsBannedContent(text: string, terms: string[]): boolean {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  const tokens = collapseSpacedLetters(normalized);
  for (const raw of terms) {
    const term = normalizeForFilter(raw);
    if (!term) continue;
    const words = term.split(" ").map(escapeRegExp);
    if (words.length > 1) {
      if (new RegExp("\\b" + words.join("\\s+") + "\\b").test(normalized)) return true;
    } else {
      if (new RegExp("\\b" + words[0] + "\\b").test(normalized)) return true;
      // catches letters spaced/punctuated apart within ONE original word,
      // e.g. "f u c k" - only for terms of 4+ letters, since a substring
      // check on anything shorter risks false positives the \b match
      // above already avoids (e.g. "ass" inside "class" is one token,
      // "class" itself, and never matches "ass" via \b or via .includes
      // unless "ass" itself were the whole token).
      if (term.length >= 4 && tokens.some((tok) => tok.includes(term))) return true;
    }
  }
  return false;
}

/** Extra terms added from #/admin/moderation, on top of the fixed
    BANNED_TERMS baseline above (never exposed to the browser - this table
    is admin-only and read here with the service-role client, same as
    blocked_senders). A read failure (e.g. the table not existing yet)
    degrades to "no extra terms" rather than failing the whole request. */
async function loadCustomTerms(client: SupabaseClient): Promise<string[]> {
  const { data } = await client.from("moderation_terms").select("data");
  if (!Array.isArray(data)) return [];
  return data
    .map((r: { data?: { term?: string } }) => String(r?.data?.term ?? "").trim())
    .filter(Boolean);
}

/** The #/admin/moderation "Auto-block on a filter match" switch
    (moderation_settings, row id "global"). A missing row or a read
    failure both default to enabled - fail toward the stricter behavior,
    never toward silently turning protection off. Turning it off never
    lets a banned-content message through, it only stops that match from
    also locking the sender out (see Deno.serve below). */
async function isAutoBlockEnabled(client: SupabaseClient): Promise<boolean> {
  const { data: row } = await client.from("moderation_settings").select("data").eq("id", "global").maybeSingle();
  const settings = row?.data as { autoBlockEnabled?: boolean } | undefined;
  return !settings || settings.autoBlockEnabled !== false;
}

// --- Blocked senders -------------------------------------------------------
// A single flagged submission permanently blocks that sender - by email
// AND by IP - from ever reaching this function's Turnstile/insert steps
// again. blocked_senders is checked first, before Turnstile even runs, so
// a blocked visitor can't "try again" by re-solving the widget.
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || "unknown";
}

async function isBlocked(client: SupabaseClient, email: string, ip: string): Promise<boolean> {
  const checks = [];
  if (ip && ip !== "unknown") {
    checks.push(client.from("blocked_senders").select("id").eq("data->>ip", ip).limit(1));
  }
  if (email) {
    checks.push(client.from("blocked_senders").select("id").eq("data->>email", email).limit(1));
  }
  if (!checks.length) return false;
  const results = await Promise.all(checks);
  return results.some((r) => Array.isArray(r.data) && r.data.length > 0);
}

async function recordBlock(
  client: SupabaseClient,
  email: string,
  ip: string,
  reason: string,
  subject: string,
  message: string,
) {
  await client.from("blocked_senders").insert({
    id: "block-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    data: { email, ip, reason, subject, message, source: "auto", blockedAt: new Date().toISOString() },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET")!;
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: {
    kind?: string; turnstileToken?: string;
    subject?: string; message?: string; email?: string;
    from?: string; type?: string; org?: string; ticketKind?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const kind = body.kind === "business" ? "business" : "contact";
  const expectedAction = ACTION_BY_KIND[kind];
  const email = String(body.email ?? "").trim().toLowerCase();
  const ip = clientIp(req);

  // Step 1: a sender already blocked for a prior violation gets nothing -
  // no Turnstile prompt, no content-filter feedback, just a flat refusal.
  if (await isBlocked(adminClient, email, ip)) {
    return json({ error: "This form is no longer available to you." }, 403);
  }

  // Step 2: deterministic moderation. A self-harm match is checked FIRST
  // and, if found, skips the block/reject check entirely below - flagged
  // is carried through to the inserted ticket instead (Step 5), so the
  // message still reaches a human rather than being silently rejected.
  // Otherwise, a banned-content match blocks this sender going forward
  // and rejects the message outright - it never reaches support_tickets
  // or a Turnstile check.
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const org = String(body.org ?? "").trim();
  const combined = [subject, message, org].join(" ");
  const flagged = containsBannedContent(combined, SELF_HARM_TERMS);
  if (!flagged) {
    const customTerms = await loadCustomTerms(adminClient);
    if (containsBannedContent(combined, BANNED_TERMS.concat(customTerms))) {
      // The message is rejected either way - only whether this ALSO locks
      // the sender out is controlled by the admin's own switch.
      const autoBlock = await isAutoBlockEnabled(adminClient);
      if (autoBlock) {
        await recordBlock(adminClient, email, ip, "Violating our terms of use.", subject, message);
        return json({
          error: "We couldn't send that message because it contains language we don't allow on our forms. This form is no longer available to you.",
        }, 403);
      }
      return json({
        error: "We couldn't send that message because it contains language we don't allow on our forms. Please revise it and try again.",
      }, 403);
    }
  }

  // Step 3: verify the Turnstile token before touching the database.
  const token = String(body.turnstileToken ?? "");
  if (!token || token.length > 2048) {
    return json({ error: "Please complete the verification and try again." }, 400);
  }
  let verify: { success?: boolean; action?: string };
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }),
    });
    if (!r.ok) throw new Error("siteverify " + r.status);
    verify = await r.json();
  } catch {
    return json({ error: "Could not verify the form right now. Please try again." }, 502);
  }
  if (!verify.success || verify.action !== expectedAction) {
    return json({ error: "Please complete the verification and try again." }, 403);
  }

  // Step 4: the same validation the client already did before this
  // function existed - kept here too, since this is now the actual
  // boundary a request has to cross, not just a UI nicety.
  if (!subject || !message) return json({ error: "Add a subject and a message." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "That email doesn't look quite right." }, 400);

  // Step 5: the actual write - same anon key + same table the browser
  // used directly before, so RLS and the rate-limit/fake-email triggers
  // on support_tickets still run exactly as they did.
  const flagFields = flagged
    ? { flagged: true, flagReason: "Possible self-harm language - please review as soon as possible." }
    : {};
  // ip is stored on every ticket, not just blocked_senders, so an admin
  // reviewing an ordinary message in #/admin/support has something to
  // manually block by IP if it comes to that - before this, IP only ever
  // showed up after a block had already happened.
  const record = kind === "business"
    ? {
        subject: subject + (org ? " (" + org + ")" : ""),
        body: message, email, ip,
        from: "business",
        type: String(body.ticketKind ?? "other"),
        priority: "normal", state: "open", at: new Date().toISOString(), status: "published",
        ...flagFields,
      }
    : {
        subject, body: message, email, ip,
        from: String(body.from ?? "other"),
        type: String(body.ticketKind ?? "question"),
        priority: "normal", state: "open", at: new Date().toISOString(), status: "published",
        ...flagFields,
      };

  const { error } = await anonClient.from("support_tickets").insert({
    id: "supp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    data: record,
  });
  if (error) {
    // The rate-limit/fake-email triggers raise a plain-English message
    // (see migration.sql) - surface it as-is, same as every other error
    // path in this project's admin functions.
    return json({ error: error.message }, 400);
  }

  return json({ ok: true });
});
