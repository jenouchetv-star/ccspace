// Chike's Creative Space - get-site-analytics Edge Function
//
// Proxies Cloudflare's GraphQL Analytics API so real visitor traffic
// (page views, top pages, referrers, country) can render inside this
// app's own admin portal instead of requiring a separate login to the
// Cloudflare dashboard - every admin already signs into this portal,
// not all of them have (or should have) Cloudflare account access.
//
// The Cloudflare API token this needs is read-only (Account
// Analytics:Read, scoped to this one account) and lives only as a
// Supabase secret - it is never sent to or readable from the browser.
// Same caller-JWT + is_active_admin() gate as send-newsletter, so this
// data is exactly as protected as everything else in /admin.
//
// Deploy: npx supabase functions deploy get-site-analytics
// Secrets this needs (Studio -> Edge Functions -> get-site-analytics ->
// Secrets, or the CLI):
//   CLOUDFLARE_API_TOKEN   - Account API Token, Account Analytics:Read only,
//                            scoped to this one account (create at
//                            https://dash.cloudflare.com/profile/api-tokens)
//   CLOUDFLARE_ACCOUNT_ID  - 3a72af55deb8e39b2bcc91e2c082e6d5
//   CLOUDFLARE_SITE_TAG    - the token in the beacon snippet's
//                            data-cf-beacon attribute (see index.html) -
//                            aa23b757e3104b1f8953cf3195cc9e2b
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
//   auto-injected by Supabase into every Edge Function - never set by hand.
//
// Called from index.html as:
//   sb.functions.invoke("get-site-analytics", { body: { days: 7 } })

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

// One GraphQL request, four aliased groupings of the same dataset -
// cheaper than four round trips, and Cloudflare's adaptive-groups
// pattern group by whatever `dimensions` fields each alias asks for
// independently, so aliasing is safe here.
const QUERY = `
  query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        totals: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 1
        ) { count sum { visits } }
        byDate: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 100
          orderBy: [date_ASC]
        ) { count sum { visits } dimensions { date } }
        byPath: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 10
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        byReferer: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 10
          orderBy: [count_DESC]
        ) { count dimensions { refererHost } }
        byCountry: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 10
          orderBy: [count_DESC]
        ) { count dimensions { countryName } }
      }
    }
  }
`;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
  const CF_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")!;
  const CF_SITE_TAG = Deno.env.get("CLOUDFLARE_SITE_TAG")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Step 1: verify who is actually calling this, same gate as every other
  // admin-only Edge Function in this project.
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

  // Step 2: how far back to look - default a week, cap at 90 days so this
  // can never accidentally become an unbounded, slow query.
  let body: { days?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine - use the default */ }
  const days = Math.max(1, Math.min(90, Number(body.days) || 7));
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);

  // Step 3: one call to Cloudflare's GraphQL Analytics API.
  let cfJson: any;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          accountTag: CF_ACCOUNT_ID,
          siteTag: CF_SITE_TAG,
          since: isoDate(since),
          until: isoDate(until),
        },
      }),
    });
    cfJson = await res.json();
    if (!res.ok || cfJson.errors) {
      const detail = cfJson.errors ? cfJson.errors.map((e: any) => e.message).join("; ") : `HTTP ${res.status}`;
      return json({ error: "Cloudflare API error: " + detail }, 502);
    }
  } catch (err) {
    return json({ error: "Could not reach Cloudflare: " + (err as Error).message }, 502);
  }

  const account = cfJson?.data?.viewer?.accounts?.[0];
  if (!account) {
    return json({ error: "No analytics account found for this token/account id" }, 502);
  }

  // Step 4: reshape into exactly what the dashboard chart needs - no
  // GraphQL-shaped nesting leaking into the client.
  const totals = account.totals?.[0] || { count: 0, sum: { visits: 0 } };
  const byDate = (account.byDate || []).map((r: any) => ({
    date: r.dimensions.date, views: r.count, visits: r.sum.visits,
  }));
  const byPath = (account.byPath || []).map((r: any) => ({
    path: r.dimensions.requestPath || "/", views: r.count,
  }));
  const byReferer = (account.byReferer || [])
    .filter((r: any) => r.dimensions.refererHost)
    .map((r: any) => ({ host: r.dimensions.refererHost, views: r.count }));
  const byCountry = (account.byCountry || []).map((r: any) => ({
    country: r.dimensions.countryName || "Unknown", views: r.count,
  }));

  return json({
    ok: true,
    since: isoDate(since),
    until: isoDate(until),
    totalViews: totals.count,
    totalVisits: totals.sum?.visits || 0,
    byDate, byPath, byReferer, byCountry,
  });
});
