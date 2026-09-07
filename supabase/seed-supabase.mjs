// One-time (safely re-runnable) seed script: populates the Supabase tables
// created by migration.sql from a JSON dump of the app's database shape.
//
// Usage:
//   node supabase/seed-supabase.mjs                 (uses seed-data.json - fresh prototype content)
//   node supabase/seed-supabase.mjs --from-backup path/to/backup.json   (a real exportJSON() backup)
//
// Uses plain fetch() against Supabase's PostgREST API with the anon key -
// no npm install required. The anon key can do DML (this script uses
// upsert, which is insert-or-update) once migration.sql's RLS policies are
// in place; it cannot create tables, which is why migration.sql must be
// run first, by hand, in the Supabase SQL Editor.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

// Must match COLLECTION_TABLE / BACKED_COLLECTIONS in index.html.
const COLLECTION_TABLE = {
  amazonProducts: "amazon_products",
  storySubmissions: "story_submissions",
  homepageModules: "homepage_modules",
  mediaAssets: "media_assets",
  supportTickets: "support_tickets",
  auditLog: "audit_log",
  launchReadiness: "launch_readiness"
};
const BACKED_COLLECTIONS = ["users","activities","pages","articles","subscribers","games",
  "videos","stories","characters","products","amazonProducts","collections",
  "storySubmissions","announcements","homepageModules","mediaAssets","supportTickets",
  "auditLog","issues","launchReadiness"];

function tableFor(col){ return COLLECTION_TABLE[col] || col; }

async function upsertRows(table, rows){
  if (!rows.length) return { table, count: 0 };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${table}: ${res.status} ${res.statusText} - ${body}`);
  }
  return { table, count: rows.length };
}

async function main(){
  const args = process.argv.slice(2);
  const backupIdx = args.indexOf("--from-backup");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataPath = backupIdx >= 0 && args[backupIdx + 1]
    ? path.resolve(process.cwd(), args[backupIdx + 1])
    : path.join(here, "seed-data.json");

  console.log(`Reading seed data from ${dataPath}`);
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));

  const jobs = BACKED_COLLECTIONS.map(col => {
    const rows = (data[col] || []).map(rec => ({ id: rec.id, data: rec }));
    return upsertRows(tableFor(col), rows);
  });
  jobs.push(upsertRows("meta", [{ id: "global", data: data.meta }]));

  const results = await Promise.allSettled(jobs);
  let failed = false;
  results.forEach(r => {
    if (r.status === "fulfilled") {
      console.log(`  ok    ${r.value.table.padEnd(20)} ${r.value.count} rows`);
    } else {
      failed = true;
      console.error(`  FAIL  ${r.reason.message}`);
    }
  });

  if (failed) {
    console.error("\nOne or more tables failed. Make sure migration.sql has been run first.");
    process.exit(1);
  }
  console.log("\nSeed complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
