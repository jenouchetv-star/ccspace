// Chike's Creative Space - generate-sitemap Edge Function
//
// Rebuilds sitemap.xml from live Supabase content and publishes it to the
// public "uploads" Storage bucket, so an admin can refresh it on demand from
// the portal with no git push/deploy involved. This is deliberately a
// SEPARATE artifact from the git-committed sitemap.xml at the repo root:
// this site has no live server that can overwrite its own deployed static
// files, so the file the production host actually serves at
// chikescreativespace.com/sitemap.xml only changes on the next deploy of
// supabase/generate-sitemap.mjs's output. This function's copy lives at the
// Storage URL surfaced in the admin UI (Settings -> Data controls) and is
// meant either as a live preview of what the next deploy will contain, or
// as the source a hosting-level redirect for /sitemap.xml can point at, if
// one is ever configured (see the admin UI's own note about this).
//
// Both this function and supabase/generate-sitemap.mjs build the exact same
// XML from the exact same STATIC list and DYNAMIC table/path map - keep all
// three (this file, that script, and index.html's own URL_FOR/COLLECTION_TABLE
// maps) in sync if a route ever changes shape.
//
// Deploy: npx supabase functions deploy generate-sitemap
// No new secrets: reuses SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY,
// already auto-injected by Supabase into every Edge Function (the same three
// admin-invite already depends on).
//
// Called from index.html as:
//   sb.functions.invoke("generate-sitemap")
// which automatically attaches the caller's own access token - that token is
// what step 1 below verifies before anything runs.

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

// www.chikescreativespace.com is where this build actually lives - the bare
// apex domain serves a completely different, unrelated site. Keep in sync
// with supabase/generate-sitemap.mjs's own BASE constant.
const BASE = "https://www.chikescreativespace.com";

const STATIC: Array<[string, string, string]> = [
  ["/", "1.0", "weekly"],
  ["/create", "0.9", "weekly"],
  ["/play/online", "0.8", "weekly"],
  ["/play/offline", "0.8", "weekly"],
  ["/watch", "0.8", "weekly"],
  ["/stories", "0.8", "weekly"],
  ["/characters", "0.7", "monthly"],
  ["/shop/printables", "0.6", "monthly"],
  ["/shop/amazon", "0.5", "monthly"],
  ["/donate", "0.5", "monthly"],
  ["/about/mission", "0.5", "monthly"],
  ["/about/vision", "0.4", "monthly"],
  ["/about/business", "0.4", "monthly"],
  ["/about/team", "0.5", "monthly"],
  ["/grown-ups", "0.7", "weekly"],
  ["/grown-ups/help", "0.6", "monthly"],
  ["/grown-ups/articles", "0.6", "weekly"],
  ["/grown-ups/contact", "0.4", "yearly"],
  ["/privacy", "0.3", "yearly"],
  ["/terms", "0.3", "yearly"],
];

// Table names and path builders must mirror COLLECTION_TABLE / the URL_FOR
// map in index.html - keep both in sync if either changes.
const DYNAMIC: Array<{ table: string; path: (r: Record<string, unknown>) => string }> = [
  { table: "activities", path: (r) => "/activity/" + r.id },
  { table: "games", path: (r) => "/play/" + r.id },
  { table: "videos", path: (r) => "/watch/" + r.id },
  { table: "stories", path: (r) => "/stories/" + r.id },
  { table: "characters", path: (r) => "/characters/" + r.slug },
  { table: "articles", path: (r) => "/article/" + r.id },
  { table: "collections", path: (r) => "/collection/" + r.id },
];

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: verify who is actually calling this, cryptographically - same
  // pattern as admin-invite. Nobody rebuilds the public sitemap on the
  // strength of a client-supplied claim.
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

  // Step 2: build the entry list. Every backed table here stores the full
  // record verbatim under a jsonb `data` column (this project's own
  // {id, data} table shape) - select it and unwrap, exactly like
  // supabase/generate-sitemap.mjs's own fetchTable() does over REST.
  const today = new Date().toISOString().slice(0, 10);
  const isoDate = (d: unknown) => {
    try {
      return new Date(String(d)).toISOString().slice(0, 10);
    } catch (_e) {
      return today;
    }
  };

  const entries = STATIC.map(([p, priority, freq]) => urlEntry(BASE + p, today, freq, priority));
  let dynamicCount = 0;

  for (const d of DYNAMIC) {
    const { data: rows, error: tableErr } = await adminClient.from(d.table).select("data");
    if (tableErr) {
      return json({ error: `Could not read ${d.table}: ${tableErr.message}` }, 500);
    }
    for (const row of rows ?? []) {
      const r = (row as { data: Record<string, unknown> }).data;
      if (r?.status !== "published") continue;
      entries.push(
        urlEntry(BASE + d.path(r), isoDate(r.updatedAt ?? r.createdAt), "monthly", "0.6")
      );
      dynamicCount++;
    }
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join("\n") +
    "\n</urlset>\n";

  // Step 3: publish to the existing public "uploads" bucket (already used
  // for media assets - no new bucket/RLS needed) at a fixed path, so
  // repeated runs overwrite the same URL rather than accumulating copies.
  const STORAGE_PATH = "system/sitemap.xml";
  const { error: uploadErr } = await adminClient.storage.from("uploads").upload(
    STORAGE_PATH,
    new Blob([xml], { type: "application/xml" }),
    { cacheControl: "300", upsert: true, contentType: "application/xml" }
  );
  if (uploadErr) {
    return json({ error: `Could not publish sitemap: ${uploadErr.message}` }, 500);
  }
  const { data: publicUrlData } = adminClient.storage.from("uploads").getPublicUrl(STORAGE_PATH);

  // Step 4: stamp when this last ran, so the admin Dashboard's ops digest
  // (opsVitalsHTML's "Sitemap regeneration" row) reflects a real timestamp
  // instead of "unknown". Best-effort - a failed stamp should never fail
  // the generation itself.
  const generatedAt = new Date().toISOString();
  try {
    const { data: metaRow } = await adminClient.from("meta").select("data").eq("id", "global").single();
    const nextMeta = Object.assign({}, metaRow?.data ?? {}, {
      lastSitemapAt: generatedAt,
      lastSitemapCount: entries.length,
      lastSitemapUrl: publicUrlData.publicUrl,
    });
    await adminClient.from("meta").update({ data: nextMeta }).eq("id", "global");
  } catch (_e) {
    // best-effort, see comment above
  }

  return json({
    ok: true,
    count: entries.length,
    staticCount: STATIC.length,
    dynamicCount,
    generatedAt,
    url: publicUrlData.publicUrl,
  });
});
