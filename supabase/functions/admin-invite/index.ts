// Chike's Creative Space - admin-invite Edge Function
//
// The one piece of server-side infrastructure this project needs: Supabase's
// auth.admin.inviteUserByEmail() requires the service_role key, which must
// never reach the browser (it bypasses every RLS policy). This function is
// the only place that key is ever used - it lives in this function's own
// Supabase-managed secret storage (set via `supabase secrets set`), never in
// index.html, never in a Node script committed to the repo.
//
// Deploy: npx supabase functions deploy admin-invite
// Secret: SUPABASE_SERVICE_ROLE_KEY must be set on the project before this
// will work (Studio -> Edge Functions -> admin-invite -> Secrets, or via the
// CLI - see the deployment notes handed to the user, not committed here).
//
// Called from index.html as:
//   sb.functions.invoke("admin-invite", { body: { email, name } })
// which automatically attaches the caller's own access token as the
// Authorization header - that token is what step 1 below verifies.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: verify who is actually calling this, cryptographically - never
  // trust a caller-supplied "I'm an admin" claim in the request body. Built
  // with the anon key + the caller's own bearer token, exactly like any
  // other authenticated client-side call.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ error: "Not authenticated" }, 401);
  }

  // Step 2: the only place the service_role key is ever constructed. Used
  // for the privileged profiles lookup below and the actual invite call -
  // never returned to the client, never logged.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.status !== "active") {
    return json({ error: "Not authorized" }, 403);
  }

  // Step 3: validate the request body.
  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!EMAIL_RE.test(email)) {
    return json({ error: "That doesn't look like a valid email address" }, 400);
  }

  // Step 4: the actual invite. The database trigger (handle_new_user, see
  // migration.sql) creates the matching profiles row from this metadata -
  // this function never inserts into profiles directly.
  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { name },
      redirectTo: `${req.headers.get("origin") ?? ""}/#/admin/accept-invite`,
    }
  );

  if (inviteErr) {
    // Supabase returns a specific message for "this email already has an
    // account" - surface it as-is rather than a generic failure, since it's
    // the single most likely real-world error an admin will hit here.
    return json({ error: inviteErr.message }, 400);
  }

  return json({ ok: true, userId: inviteData.user?.id ?? null, email });
});
