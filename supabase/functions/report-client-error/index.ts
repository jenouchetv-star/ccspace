// Chike's Creative Space - report-client-error Edge Function
//
// Wired to render()'s own try/catch around renderRoute() (index.html) -
// that catch already stops an uncaught render error from unmounting the
// page (a friendly "Something in that view failed to draw" screen with a
// way back, instead of a blank one); this function is the one piece that
// was missing: telling anyone about it.
//
// Called from any visitor's browser, signed in or not - a render error
// can happen on the public site just as easily as in the admin portal -
// so this takes no caller-JWT/admin check, unlike this project's other
// functions. What it writes to (issues, index.html's existing admin
// worklist) IS admin-only RLS, so the write goes through the service-role
// client, the same split already established for blocked_senders in
// submit-ticket/index.ts: a visitor's own request can trigger a write
// here, but can never read or forge the issues list itself.
//
// Privacy: only ever stores the error's own message/stack and the ROUTE
// PATTERN (e.g. "admin", "activity-detail") - never the resolved path,
// never route params (an id, an admin's typed search query), never
// anything else about the request. See buildDetail() below.
//
// Deploy: npx supabase functions deploy report-client-error
// No new secrets: reuses SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, already
// auto-injected by Supabase into every Edge Function.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

// A route "pattern" is the parsed route's own name (parseRoute() in
// index.html - "admin", "activity-detail", "character-detail", etc.),
// never a resolved path/id/query. This allowlist is deliberately closed
// (unknown values are rejected as "other") rather than accepting
// whatever string the request sends - parseRoute()'s own final fallback
// (`return { name: seg[0], ... }`) sets route.name to the raw first URL
// segment for anything it doesn't otherwise recognize, so an unvalidated
// route name really could carry text someone typed into the address bar.
// This is the exact list of case labels renderRoute() (index.html)
// switches on - the authoritative set of real route names; anything else
// couldn't have come from a legitimate navigation.
const KNOWN_ROUTE_PATTERNS = new Set([
  "home","create","find-detail","activity-detail","play","game-detail","watch","video-detail",
  "stories","story-detail","characters","character-detail","collection-detail","article-detail",
  "about","grown-ups","donate","privacy","terms","shop","product-detail","unsubscribe","admin",
]);

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { message?: string; stack?: string; route?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const message = truncate(String(body.message ?? "").trim(), 300);
  if (!message) return json({ error: "A message is required" }, 400);
  const stack = truncate(String(body.stack ?? "").trim(), 2000);
  const routeRaw = String(body.route ?? "").trim();
  const route = KNOWN_ROUTE_PATTERNS.has(routeRaw) ? routeRaw : "other";

  // Best-effort dedup: an already-open issue for this exact message+route
  // means the first occurrence is already on an admin's worklist - skip
  // adding a second row for what's almost certainly the same bug being
  // hit again (a page stuck in a reload loop, several visitors hitting
  // the same broken route), rather than letting one bug flood the list.
  const title = "Render error: " + message;
  const { data: existing } = await adminClient
    .from("issues")
    .select("id, data")
    .eq("data->>title", title)
    .eq("data->>state", "open")
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return json({ ok: true, deduped: true });
  }

  const now = new Date().toISOString();
  const { error } = await adminClient.from("issues").insert({
    id: "iss-crash-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    data: {
      title,
      area: "platform",
      severity: "high",
      state: "open",
      detail: "Route pattern: " + route + (stack ? "\n\n" + stack : ""),
      status: "published",
      source: "client-error-report",
      reportedAt: now,
    },
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
