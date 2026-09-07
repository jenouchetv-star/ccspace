// Regenerates sitemap.xml from the live Supabase content, so the sitemap
// tracks new/removed activities, games, videos, stories, characters,
// articles, and collections without hand-editing XML.
//
// Usage:
//   node supabase/generate-sitemap.mjs
//
// Run this after any content addition/removal, before deploying, or on a
// schedule (a cron-triggered redeploy step, say) - not automatically on
// every page load, since this is a static file served alongside index.html.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";
const BASE = "https://chikescreativespace.com";

const STATIC = [
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
  ["/terms", "0.3", "yearly"]
];

// Table names and path builders must mirror COLLECTION_TABLE / the URL_FOR
// map in index.html - keep both in sync if either changes.
const DYNAMIC = [
  { table: "activities",  path: r => "/activity/" + r.id },
  { table: "games",       path: r => "/play/" + r.id },
  { table: "videos",      path: r => "/watch/" + r.id },
  { table: "stories",     path: r => "/stories/" + r.id },
  { table: "characters",  path: r => "/characters/" + r.slug },
  { table: "articles",    path: r => "/article/" + r.id },
  { table: "collections", path: r => "/collection/" + r.id }
];

async function fetchTable(table){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${res.statusText} - ${await res.text().catch(() => "")}`);
  const rows = await res.json();
  return rows.map(r => r.data);
}

function urlEntry(loc, lastmod, changefreq, priority){
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function main(){
  const today = new Date().toISOString().slice(0, 10);
  const isoDate = d => { try { return new Date(d).toISOString().slice(0, 10); } catch (_e) { return today; } };

  const entries = STATIC.map(([p, priority, freq]) => urlEntry(BASE + p, today, freq, priority));

  for (const d of DYNAMIC){
    const records = await fetchTable(d.table);
    records.filter(r => r.status === "published").forEach(r => {
      entries.push(urlEntry(BASE + d.path(r), isoDate(r.updatedAt || r.createdAt), "monthly", "0.6"));
    });
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.join("\n")
    + '\n</urlset>\n';

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(here, "..", "sitemap.xml");
  writeFileSync(outPath, xml);
  console.log(`Wrote ${outPath} (${entries.length} URLs)`);

  // Stamp when this last ran, so the admin Dashboard's ops digest (LRC
  // auto-5) can show real sitemap staleness instead of "unknown".
  const metaRes = await fetch(`${SUPABASE_URL}/rest/v1/meta?select=data&id=eq.global`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const metaRows = await metaRes.json().catch(() => []);
  const currentMeta = metaRows[0] ? metaRows[0].data : {};
  const nextMeta = Object.assign({}, currentMeta, { lastSitemapAt: new Date().toISOString() });
  await fetch(`${SUPABASE_URL}/rest/v1/meta?id=eq.global`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: nextMeta })
  }).catch(() => {}); // best-effort - a failed stamp should never fail sitemap generation
}

main().catch(err => { console.error(err); process.exit(1); });
