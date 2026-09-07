// Takes a full, timestamped JSON backup of every table in the live
// Supabase project - the safety net the migration plan's own risk
// callout asks for before any production cutover or "Reset demo content"
// action. Produces the same shape db.exportJSON() downloads from the
// browser, so a file from either source can be restored the same way
// (the admin Settings screen's "Import backup" button, or
// db.importData(JSON.parse(...)) directly).
//
// Usage:
//   node supabase/backup.mjs
//
// Writes to supabase/backups/backup-<timestamp>.json. Run this immediately
// before: a production cutover, a "Reset demo content" click, or a bulk
// import - anything that overwrites the live database.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

const COLLECTION_TABLE = {
  amazonProducts: "amazon_products", storySubmissions: "story_submissions",
  homepageModules: "homepage_modules", mediaAssets: "media_assets",
  supportTickets: "support_tickets", auditLog: "audit_log", launchReadiness: "launch_readiness"
};
const BACKED_COLLECTIONS = ["users","activities","pages","articles","subscribers","games",
  "videos","stories","characters","products","amazonProducts","collections",
  "storySubmissions","announcements","homepageModules","mediaAssets","supportTickets",
  "auditLog","issues","launchReadiness"];
const tableFor = c => COLLECTION_TABLE[c] || c;

async function fetchTable(table){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${res.statusText} - ${await res.text().catch(() => "")}`);
  const rows = await res.json();
  return rows.map(r => r.data);
}

async function main(){
  const out = {};
  for (const col of BACKED_COLLECTIONS) out[col] = await fetchTable(tableFor(col));

  const metaRes = await fetch(`${SUPABASE_URL}/rest/v1/meta?select=data&id=eq.global`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const metaRows = await metaRes.json();
  out.meta = metaRows[0] ? metaRows[0].data : {};

  // Per-browser prototype state, not part of the shared production data -
  // included empty so the file still matches db.importData()'s expected
  // shape if it's ever restored.
  out.dismissedAnnouncements = [];
  out.recentlyViewed = [];

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.join(here, "backups");
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `backup-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  const counts = BACKED_COLLECTIONS.map(c => `${c}:${out[c].length}`).join(" ");
  console.log(`Wrote ${outPath}`);
  console.log(counts);

  // Stamp when this last ran, so the admin Dashboard's ops digest (LRC
  // auto-5) can show real backup staleness instead of "unknown".
  const nextMeta = Object.assign({}, out.meta, { lastBackupAt: new Date().toISOString() });
  await fetch(`${SUPABASE_URL}/rest/v1/meta?id=eq.global`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: nextMeta })
  }).catch(() => {}); // best-effort - a failed stamp should never fail the backup itself
}

main().catch(err => { console.error(err); process.exit(1); });
