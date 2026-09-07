// Chike's Creative Space - send-newsletter Edge Function
//
// Sends one admin-written update to every active subscriber via Resend's
// batch send endpoint (up to 100 recipients per call - this function
// chunks the list itself, so it works the same whether there are 3
// subscribers or 3,000).
//
// Every recipient gets a real, working unsubscribe link
// (/#/unsubscribe/<id>) baked into the email - not a courtesy, a
// requirement for any bulk mail like this. It hits the
// unsubscribe_newsletter() Postgres function (see migration.sql), the one
// narrow exception carved into the otherwise admin-only subscribers table
// so a visitor who never had an account can still remove themselves.
//
// Deploy: npx supabase functions deploy send-newsletter
// Secrets this needs (same names as the notify function - Studio ->
// Edge Functions -> send-newsletter -> Secrets, or the CLI):
//   RESEND_API_KEY               - from resend.com
//   RESEND_FROM                  - the verified "from" address
//   SITE_URL                     - https://www.chikescreativespace.com,
//                                   the fallback origin for the
//                                   unsubscribe link if the request's
//                                   own Origin header is missing
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
//   auto-injected by Supabase into every Edge Function - never set by hand.
//
// Called from index.html as:
//   sb.functions.invoke("send-newsletter", { body: { subject, html } })
// which automatically attaches the caller's own access token - that
// token is what step 1 below verifies before anything gets sent.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const RESEND_FROM = Deno.env.get("RESEND_FROM")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: verify who is actually calling this, cryptographically - same
  // pattern as admin-invite. Nobody sends a real email to the whole list
  // on the strength of a client-supplied claim.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }

  // Step 2: validate the request body.
  let body: { subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const subject = String(body.subject ?? "").trim();
  const html = String(body.html ?? "").trim();
  if (!subject || !html) {
    return json({ error: "A subject and a message are both required" }, 400);
  }

  // Step 3: the actual subscriber list. subscribers is admin-only under
  // RLS now (see the RLS cutover in migration.sql), so this - a verified
  // active admin's own request - is exactly the case that table access is
  // meant for. Only "published" rows count as an active subscription,
  // matching db.add()'s own status:"published" when someone joins.
  const { data: rows, error: listErr } = await adminClient
    .from("subscribers")
    .select("id, data");
  if (listErr) return json({ error: listErr.message }, 500);

  const origin = req.headers.get("origin") ?? "";
  const recipients = (rows ?? [])
    .filter((r) => r.data?.status === "published" && typeof r.data?.email === "string" && r.data.email)
    .map((r) => ({ id: r.id as string, email: r.data.email as string }));

  if (!recipients.length) {
    return json({ ok: true, sent: 0, note: "No active subscribers to send to" });
  }

  // The compose page's shell already builds a full, on-brand footer with
  // a literal "__UNSUB_URL__" token in place of the unsubscribe link
  // (see emailShell() in index.html) - substituting it here, per
  // recipient, keeps that link inside the designed footer instead of
  // bolting an extra plain paragraph on after it.
  const siteOrigin = Deno.env.get("SITE_URL") || origin || "https://www.chikescreativespace.com";
  const emails = recipients.map((r) => ({
    from: RESEND_FROM,
    to: r.email,
    subject,
    html: html.split("__UNSUB_URL__").join(`${siteOrigin}/#/unsubscribe/${encodeURIComponent(r.id)}`),
  }));

  let sent = 0;
  const errors: string[] = [];
  for (const batch of chunk(emails, BATCH_SIZE)) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      sent += batch.length;
    } else {
      const detail = await res.text();
      errors.push(`Resend ${res.status}: ${detail}`);
    }
  }

  if (errors.length) {
    // Partial failure still reports how many actually went out, rather
    // than leaving the admin guessing whether "an error happened" means
    // zero or almost-all of the list was reached.
    return json({ ok: sent > 0, sent, total: recipients.length, error: errors.join(" | ") }, sent > 0 ? 207 : 500);
  }

  return json({ ok: true, sent, total: recipients.length });
});
