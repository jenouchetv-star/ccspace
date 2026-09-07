// Chike's Creative Space - send-scheduled-newsletters Edge Function
//
// Fires on a schedule (see the pg_cron job appended to migration.sql,
// search for "send-scheduled-newsletters") rather than being called from
// index.html or by an admin session - nobody is logged in when a cron
// job runs, so this authenticates the caller the same way the notify
// function does: a shared x-webhook-secret header, not a user JWT/
// is_active_admin() check. Every minute it looks for any newsletter
// whose scheduled time has arrived and sends it via Resend, exactly like
// send-newsletter's immediate "Send now" path does.
//
// Deploy: npx supabase functions deploy send-scheduled-newsletters
// Secrets this needs - all already set for notify/send-newsletter,
// nothing new to configure:
//   RESEND_API_KEY, RESEND_FROM, WEBHOOK_SECRET, SITE_URL
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

const BATCH_SIZE = 100;
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Same shared-secret check as notify - the only thing standing between
  // this function and anyone on the open internet, since there is no
  // admin session to verify here at all.
  const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
  const suppliedSecret = req.headers.get("x-webhook-secret") ?? "";
  if (!WEBHOOK_SECRET || suppliedSecret !== WEBHOOK_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const nowISO = new Date().toISOString();
  const { data: dueRows, error: dueErr } = await adminClient
    .from("newsletters")
    .select("id, data")
    .filter("data->>status", "eq", "scheduled")
    .filter("data->>scheduledAt", "lte", nowISO);
  if (dueErr) return json({ error: dueErr.message }, 500);
  if (!dueRows || !dueRows.length) return json({ ok: true, processed: 0 });

  const results: Record<string, string> = {};

  for (const row of dueRows) {
    const n = row.data as Record<string, unknown>;

    // Atomic claim: only proceed if this row is still "scheduled" right
    // now - a conditional update, not a plain write. If an overlapping
    // run (or a slow previous run) already claimed it, this affects zero
    // rows and we skip it rather than sending the same newsletter twice.
    const claimed = { ...n, status: "sending" };
    const { data: claimResult, error: claimErr } = await adminClient
      .from("newsletters")
      .update({ data: claimed })
      .eq("id", row.id)
      .filter("data->>status", "eq", "scheduled")
      .select("id");
    if (claimErr || !claimResult || !claimResult.length) {
      results[row.id] = "skipped (already claimed)";
      continue;
    }

    try {
      const { data: subRows, error: subErr } = await adminClient.from("subscribers").select("id, data");
      if (subErr) throw new Error(subErr.message);

      const recipients = (subRows ?? [])
        .filter((r) => r.data?.status === "published" && typeof r.data?.email === "string" && r.data.email)
        .map((r) => ({ id: r.id as string, email: r.data.email as string }));

      let sent = 0;
      const errors: string[] = [];

      if (recipients.length) {
        // Same token substitution as send-newsletter's immediate path -
        // the stored body already has a full designed footer with a
        // literal "__UNSUB_URL__" placeholder (see emailShell() in
        // index.html). No browser Origin header exists for a cron-fired
        // request, so SITE_URL is the one place this function is told
        // its own public address.
        const siteOrigin = Deno.env.get("SITE_URL") || "https://www.chikescreativespace.com";
        const emailHtml = String(n.body ?? "");
        const emails = recipients.map((r) => ({
          from: RESEND_FROM,
          to: r.email,
          subject: String(n.subject ?? ""),
          html: emailHtml.split("__UNSUB_URL__").join(`${siteOrigin}/#/unsubscribe/${encodeURIComponent(r.id)}`),
        }));

        for (const batch of chunk(emails, BATCH_SIZE)) {
          const res = await fetch("https://api.resend.com/emails/batch", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          if (res.ok) sent += batch.length;
          else errors.push(`Resend ${res.status}: ${await res.text()}`);
        }
      }

      if (errors.length && sent === 0) {
        await adminClient.from("newsletters").update({
          data: { ...claimed, status: "failed", lastError: errors.join(" | ") },
        }).eq("id", row.id);
        results[row.id] = "failed";
      } else {
        await adminClient.from("newsletters").update({
          data: { ...claimed, status: "sent", sentAt: new Date().toISOString(), sentCount: sent, lastError: errors.join(" | ") },
        }).eq("id", row.id);
        results[row.id] = `sent (${sent})`;
      }
    } catch (err) {
      // Never leave a claimed row stuck on "sending" forever if something
      // above throws - fall back to "failed" with the error recorded so
      // it stays visible and re-editable in the admin panel.
      await adminClient.from("newsletters").update({
        data: { ...claimed, status: "failed", lastError: (err as Error).message },
      }).eq("id", row.id);
      results[row.id] = "failed";
      console.error("send-scheduled-newsletters failed for", row.id, err);
    }
  }

  return json({ ok: true, processed: dueRows.length, results });
});
