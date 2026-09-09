// Chike's Creative Space - media-upload Worker
//
// Replaces Supabase Storage for new media uploads. R2 has zero egress
// fees, unlike Supabase Storage - which is exactly what blew through
// this project's egress quota in a single day (a handful of 13-40MB
// GIFs, used as full-page backgrounds, re-downloaded on every page
// view). This Worker is the only thing that ever writes to the R2
// bucket - the browser never talks to R2 directly.
//
// Deploy (from this folder): npx wrangler deploy
// Secrets required before it will work:
//   npx wrangler secret put SUPABASE_URL
//   npx wrangler secret put SUPABASE_ANON_KEY
// (Same anon key already used in index.html - this Worker never needs
// the service_role key: `profiles` is readable by any authenticated
// user, per migration.sql, so the caller's own bearer token is enough
// to check admin status without a privileged key on this side too.)
//
// Called from index.html's uploadToStorage() as a plain authenticated
// POST - see the client-side wiring note in that function once this is
// deployed and its real *.workers.dev (or custom domain) URL is known.

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-file-name, x-folder",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    // Step 1: verify the caller's Supabase session is real - never trust
    // a bearer token without checking it against Supabase Auth itself.
    const userRes = await fetch(env.SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return json({ error: "Not authenticated" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "Not authenticated" }, 401);

    // Step 2: verify the caller is an active admin. `profiles` is
    // readable by any authenticated user (RLS: "profiles read" ... using
    // (true)), so the caller's own token is sufficient here - this
    // Worker never needs the service_role key.
    const profileRes = await fetch(
      env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=status",
      { headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY } }
    );
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles[0] || profiles[0].status !== "active") {
      return json({ error: "Not authorized" }, 403);
    }

    // Step 3: the file itself. Sent as a raw body (not multipart) with
    // the name/folder/content-type in headers - mirrors how
    // uploadToStorage() already hands Supabase a raw File, so the
    // client-side change is a same-shape swap, not a rewrite.
    const fileName = req.headers.get("x-file-name") || "upload";
    const folder = (req.headers.get("x-folder") || "media-library").replace(/\/+$/, "");
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const body = await req.arrayBuffer();

    if (body.byteLength === 0) return json({ error: "Empty file" }, 400);
    if (body.byteLength > MAX_UPLOAD_BYTES) {
      return json({
        error: "That file is " + (body.byteLength / (1024*1024)).toFixed(1) + " MB - please keep uploads "
          + "under " + (MAX_UPLOAD_BYTES / (1024*1024)) + " MB."
      }, 400);
    }

    const safeName = fileName.replace(/[^\w.-]/g, "-");
    const key = folder + "/" + Date.now() + "-" + safeName;
    await env.MEDIA_BUCKET.put(key, body, { httpMetadata: { contentType } });

    const publicUrl = env.PUBLIC_BASE_URL.replace(/\/+$/, "") + "/" + key;
    return json({ ok: true, url: publicUrl, path: key });
  },
};
