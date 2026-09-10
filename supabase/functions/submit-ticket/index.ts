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
// Tables required: blocked_senders, moderation_terms - both admin-only RLS,
//   both manageable from #/admin/moderation (see supabase/migration.sql)

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
  // violent language / threats
  "murder", "rape", "molest", "pedophile", "terrorist", "massacre", "behead",
  "kill you", "kill him", "kill her", "kill them", "kill myself", "gonna kill",
  "shoot up", "shoot you", "stab you", "bomb threat", "burn it down",
  // slurs / derogatory
  "nigger", "nigga", "faggot", "retard", "chink", "spic", "kike", "gook",
  "wetback", "tranny", "dyke",
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

/** terms is BANNED_TERMS plus whatever admins have added via
    #/admin/moderation (moderation_terms) - admin-supplied text isn't
    guaranteed regex-safe, so every term is escaped before use here,
    unlike the hand-written BANNED_TERMS above which never needed it. */
function containsBannedContent(text: string, terms: string[]): boolean {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  // catches letters spaced/punctuated apart to dodge a whole-word match,
  // e.g. "f u c k" - only applied to single words of 4+ letters, since a
  // substring check on anything shorter risks false positives (e.g. "ass"
  // inside "class") that \b word-boundary matching below already avoids.
  const collapsed = normalized.replace(/\s+/g, "");
  for (const raw of terms) {
    const term = normalizeForFilter(raw);
    if (!term) continue;
    const words = term.split(" ").map(escapeRegExp);
    if (words.length > 1) {
      if (new RegExp("\\b" + words.join("\\s+") + "\\b").test(normalized)) return true;
    } else {
      if (new RegExp("\\b" + words[0] + "\\b").test(normalized)) return true;
      if (term.length >= 4 && collapsed.includes(term)) return true;
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
    data: { email, ip, reason, subject, message, blockedAt: new Date().toISOString() },
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

  // Step 2: deterministic moderation. A match blocks this sender going
  // forward and rejects the message outright - it never reaches
  // support_tickets or a Turnstile check.
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const org = String(body.org ?? "").trim();
  const combined = [subject, message, org].join(" ");
  const customTerms = await loadCustomTerms(adminClient);
  if (containsBannedContent(combined, BANNED_TERMS.concat(customTerms))) {
    await recordBlock(adminClient, email, ip, "disallowed language", subject, message);
    return json({
      error: "We couldn't send that message because it contains language we don't allow on our forms. This form is no longer available to you.",
    }, 403);
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
  const record = kind === "business"
    ? {
        subject: subject + (org ? " (" + org + ")" : ""),
        body: message, email,
        from: "business",
        type: String(body.ticketKind ?? "other"),
        priority: "normal", state: "open", at: new Date().toISOString(), status: "published",
      }
    : {
        subject, body: message, email,
        from: String(body.from ?? "other"),
        type: String(body.ticketKind ?? "question"),
        priority: "normal", state: "open", at: new Date().toISOString(), status: "published",
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
