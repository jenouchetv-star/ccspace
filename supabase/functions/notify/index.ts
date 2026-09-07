// Chike's Creative Space - notify Edge Function
//
// Sends two kinds of transactional email via Resend:
//   - a new-ticket alert to the site's own inbox, whenever a row lands in
//     support_tickets (the Grown-Ups contact form and the business inquiry
//     form both write there)
//   - a welcome email to a new subscriber, whenever a row lands in
//     subscribers (the newsletter form)
//
// This function is never called from index.html. It is called from inside
// Postgres itself, by the two AFTER INSERT triggers appended to
// migration.sql (search that file for "notify Edge Function triggers") -
// see that block for exactly how each insert reaches this function.
//
// Deploy: npx supabase functions deploy notify
// Secrets this needs (Studio -> Edge Functions -> notify -> Secrets, or the
// CLI - see the deployment notes handed to the user, not committed here):
//   RESEND_API_KEY     - from resend.com, once your sending domain is verified
//   RESEND_FROM         - the verified "from" address, e.g. hello@chikescreativespace.com
//   ADMIN_NOTIFY_EMAIL  - where new-ticket alerts are sent (defaults to RESEND_FROM if unset)
//   WEBHOOK_SECRET       - a random string you make up; must match the one
//                          baked into the trigger SQL, so nothing but that
//                          trigger can ever call this function successfully

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
  const payload: Record<string, unknown> = { from: RESEND_FROM, to, subject, html };
  // So "Reply" in the admin's own inbox goes to the visitor who actually
  // wrote in, not back to the site's own no-reply-style sending address.
  if (replyTo) payload.replyTo = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The one thing standing between this function and anyone on the open
  // internet: a shared secret only the trigger SQL and this function know,
  // never sent to or readable from the browser.
  const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
  const suppliedSecret = req.headers.get("x-webhook-secret") ?? "";
  if (!WEBHOOK_SECRET || suppliedSecret !== WEBHOOK_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

  let body: { table?: string; record?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const table = body.table;
  const record = body.record ?? {};

  try {
    if (table === "support_tickets") {
      const adminTo = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("RESEND_FROM")!;
      const from = String(record.from ?? "contact");
      const subject = String(record.subject ?? "(no subject)");
      const msgBody = String(record.body ?? "");
      const replyEmail = String(record.email ?? "");
      const type = String(record.type ?? "");
      await sendEmail(
        adminTo,
        `New ${from === "business" ? "business inquiry" : "contact"} message: ${subject}`,
        `<p><b>From:</b> ${escapeHtml(replyEmail)}</p>` +
          (type ? `<p><b>Type:</b> ${escapeHtml(type)}</p>` : "") +
          `<p><b>Subject:</b> ${escapeHtml(subject)}</p>` +
          `<p>${escapeHtml(msgBody).replace(/\n/g, "<br>")}</p>` +
          `<p style="color:#888;font-size:.85em">Reply directly to this email to write back to ${escapeHtml(replyEmail)}, or open /admin/support.</p>`,
        replyEmail
      );
      return json({ ok: true, sent: "ticket-alert" });
    }

    if (table === "subscribers") {
      const to = String(record.email ?? "");
      if (!to) return json({ error: "No email on this record" }, 400);
      await sendEmail(
        to,
        "Welcome to Chike's Creative Space",
        `<p>Thanks for joining the list! You'll hear from us when a new episode, activity, or story goes up.</p>` +
          `<p>If this wasn't you, you can ignore this email - you won't be signed up for anything else.</p>`
      );
      return json({ ok: true, sent: "welcome" });
    }

    return json({ error: `Unknown table: ${table}` }, 400);
  } catch (err) {
    // Never let a Resend failure show up as a broken insert to the visitor -
    // this function's caller (the trigger, see migration.sql) doesn't roll
    // the insert back on a non-2xx response either way, but log clearly so
    // a silent email failure doesn't stay silent.
    console.error("notify failed:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
