// Chike's Creative Space - get-site-analytics Edge Function
//
// Proxies Cloudflare's GraphQL Analytics API so real visitor traffic
// (page views, top pages, referrers, country, Core Web Vitals, and a
// vs-last-period delta on each stat) can render inside this app's own
// admin portal instead of requiring a separate login to the Cloudflare
// dashboard - every admin already signs into this portal, not all of
// them have (or should have) Cloudflare account access.
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

// One GraphQL request, several aliased groupings across three datasets -
// cheaper than one round trip per alias, and Cloudflare's adaptive-groups
// pattern groups by whatever `dimensions` fields each alias asks for
// independently, so aliasing is safe here.
//
// rumWebVitalsEventsAdaptiveGroups and rumPerformanceEventsAdaptiveGroups
// are the same Web Vitals data Cloudflare's own dashboard renders under
// Analytics -> Web analytics -> Core Web Vitals for this exact site - real
// numbers, not a stand-in for the zone-level traffic/security/cache stats
// on Cloudflare's separate "Account analytics" page, which this project
// has no access to (this domain has no Cloudflare zone - DNS isn't
// proxied through Cloudflare, only the Web Analytics beacon is installed).
const QUERY = `
  query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!, $prevSince: Date!, $prevUntil: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        totals: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 1
        ) { count sum { visits } }
        prevTotals: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $prevSince, date_leq: $prevUntil, bot: 0 }
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
        webVitals: rumWebVitalsEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 1
        ) { sum {
            lcpGood lcpNeedsImprovement lcpPoor lcpTotal
            inpGood inpNeedsImprovement inpPoor inpTotal
            clsGood clsNeedsImprovement clsPoor clsTotal
        } }
        performance: rumPerformanceEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 1
        ) { quantiles { pageLoadTimeP50 pageLoadTimeP75 pageLoadTimeP90 pageLoadTimeP99 } }
        performanceByDate: rumPerformanceEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0 }
          limit: 100
          orderBy: [date_ASC]
        ) { quantiles { pageLoadTimeP50 pageLoadTimeP75 pageLoadTimeP90 pageLoadTimeP99 } dimensions { date } }
      }
    }
  }
`;

// The most visited page of each kind - articles, activities (their own pages
// and the finder's), ebooks, games and characters - for the admin's "Most
// popular" card. A second request, so a problem with these path filters can
// only blank that card, never the traffic numbers above.
const TOP_CONTENT_QUERY = `
  query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        articles: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/article/%" }
          limit: 5
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        activities: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/activity/%" }
          limit: 5
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        finderActivities: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/find/%" }
          limit: 5
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        ebooks: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/stories/%" }
          limit: 5
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        games: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/play/%" }
          limit: 8
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
        characters: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/characters/%" }
          limit: 5
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
      }
    }
  }
`;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "/article/art-early-start" -> "art-early-start", or "" for anything that is not one item's own page. */
function itemIdFromPath(path: string | undefined, prefix: string) {
  const rest = String(path || "").slice(prefix.length).replace(/\/+$/, "");
  return rest && !rest.includes("/") ? decodeURIComponent(rest) : "";
}

interface TopItem { id: string; views: number }

/** Each kind's pages as [{ id, views }], most visited first. Pages that are lists rather than one item
    (/play/online, /play/offline) are left out, and an id that shows up under two paths is added together. */
function topItems(groups: (CfPageloadGroup[] | undefined)[], prefixes: string[], skip: string[] = []): TopItem[] {
  const views = new Map<string, number>();
  groups.forEach((rows, i) => (rows || []).forEach((r) => {
    const id = itemIdFromPath(r.dimensions?.requestPath, prefixes[i]);
    if (id && !skip.includes(id)) views.set(id, (views.get(id) || 0) + r.count);
  }));
  return [...views.entries()].map(([id, n]) => ({ id, views: n })).sort((a, b) => b.views - a.views).slice(0, 5);
}

// Shapes for the one GraphQL response this function reads - narrow enough to
// cover exactly the aliases requested in QUERY above, not a general GraphQL
// Analytics API client.
interface CfPageloadGroup { count: number; sum: { visits: number }; dimensions?: { date?: string; requestPath?: string; refererHost?: string; countryName?: string } }
interface CfWebVitalsGroup { sum: Record<string, number> }
interface CfQuantiles { pageLoadTimeP50?: number; pageLoadTimeP75?: number; pageLoadTimeP90?: number; pageLoadTimeP99?: number }
interface CfPerformanceGroup { quantiles: CfQuantiles; dimensions?: { date?: string } }
interface CfAccount {
  totals?: CfPageloadGroup[]; prevTotals?: CfPageloadGroup[]; byDate?: CfPageloadGroup[];
  byPath?: CfPageloadGroup[]; byReferer?: CfPageloadGroup[]; byCountry?: CfPageloadGroup[];
  webVitals?: CfWebVitalsGroup[]; performance?: CfPerformanceGroup[]; performanceByDate?: CfPerformanceGroup[];
}
interface CfGraphqlResponse {
  data?: { viewer?: { accounts?: CfAccount[] } };
  errors?: { message: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

  // Active admin AND second factor passed once enforcement is on - see
  // migration.sql, admin_mfa_settings.
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_active_admin");
  if (adminErr || isAdmin !== true) {
    return json({ error: "Not authorized" }, 403);
  }

  // Step 2: how far back to look - default a week, cap at 90 days so this
  // can never accidentally become an unbounded, slow query.
  let body: { days?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine - use the default */ }
  const days = Math.max(1, Math.min(90, Number(body.days) || 7));
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  // The immediately preceding period of equal length, for the "vs last
  // period" deltas on each stat tile - the same comparison Cloudflare's
  // own dashboards show next to every number.
  const prevUntil = new Date(since.getTime() - 86400000);
  const prevSince = new Date(prevUntil.getTime() - (days - 1) * 86400000);

  // Step 3: one call to Cloudflare's GraphQL Analytics API.
  let cfJson: CfGraphqlResponse;
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
          prevSince: isoDate(prevSince),
          prevUntil: isoDate(prevUntil),
        },
      }),
    });
    cfJson = await res.json();
    if (!res.ok || cfJson.errors) {
      const detail = cfJson.errors ? cfJson.errors.map((e) => e.message).join("; ") : `HTTP ${res.status}`;
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
  const prevTotals = account.prevTotals?.[0] || { count: 0, sum: { visits: 0 } };
  const byDate = (account.byDate || []).map((r) => ({
    date: r.dimensions?.date, views: r.count, visits: r.sum.visits,
  }));
  const byPath = (account.byPath || []).map((r) => ({
    path: r.dimensions?.requestPath || "/", views: r.count,
  }));
  const byReferer = (account.byReferer || [])
    .filter((r) => r.dimensions?.refererHost)
    .map((r) => ({ host: r.dimensions?.refererHost, views: r.count }));
  const byCountry = (account.byCountry || []).map((r) => ({
    country: r.dimensions?.countryName || "Unknown", views: r.count,
  }));

  // Cloudflare reports RUM durations in microseconds; every UI (its own
  // dashboard included) shows milliseconds.
  const msFromMicros = (v: number | undefined) => Math.round((v || 0) / 1000);
  const perfQuantiles = account.performance?.[0]?.quantiles || {};
  const pageLoadTimeMs = {
    p50: msFromMicros(perfQuantiles.pageLoadTimeP50),
    p75: msFromMicros(perfQuantiles.pageLoadTimeP75),
    p90: msFromMicros(perfQuantiles.pageLoadTimeP90),
    p99: msFromMicros(perfQuantiles.pageLoadTimeP99),
  };
  // A per-day trend for each percentile - the same sparkline treatment
  // the page-views/visits stat tiles already get, applied to page load
  // time instead of guessing at a shape for data that isn't fetched.
  const pageLoadTimeByDate = (account.performanceByDate || []).map((r) => ({
    date: r.dimensions?.date,
    p50: msFromMicros(r.quantiles?.pageLoadTimeP50),
    p75: msFromMicros(r.quantiles?.pageLoadTimeP75),
    p90: msFromMicros(r.quantiles?.pageLoadTimeP90),
    p99: msFromMicros(r.quantiles?.pageLoadTimeP99),
  }));

  // Step 5: the most visited article, activity, ebook, game and character. Null when Cloudflare refuses or
  // cannot answer, so the dashboard can say so instead of showing empty rankings.
  let topContent: Record<string, TopItem[]> | null = null;
  let topContentError = "";
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TOP_CONTENT_QUERY,
        variables: { accountTag: CF_ACCOUNT_ID, siteTag: CF_SITE_TAG, since: isoDate(since), until: isoDate(until) },
      }),
    });
    const top: { data?: { viewer?: { accounts?: Record<string, CfPageloadGroup[]>[] } }; errors?: { message: string }[] } = await res.json();
    const t = top?.data?.viewer?.accounts?.[0];
    if (top.errors) topContentError = top.errors.map((e) => e.message).join("; ");
    else if (!res.ok) topContentError = `HTTP ${res.status}`;
    if (res.ok && !top.errors && t) {
      topContent = {
        articles: topItems([t.articles], ["/article/"]),
        activities: topItems([t.activities, t.finderActivities], ["/activity/", "/find/"]),
        ebooks: topItems([t.ebooks], ["/stories/"]),
        games: topItems([t.games], ["/play/"], ["online", "offline"]),
        characters: topItems([t.characters], ["/characters/"]),
      };
    }
  } catch (err) { topContentError = (err as Error).message; }

  const wvSum = account.webVitals?.[0]?.sum || {};
  const vitalBreakdown = (prefix: string) => ({
    good: wvSum[prefix + "Good"] || 0,
    needsImprovement: wvSum[prefix + "NeedsImprovement"] || 0,
    poor: wvSum[prefix + "Poor"] || 0,
    total: wvSum[prefix + "Total"] || 0,
  });

  return json({
    ok: true,
    since: isoDate(since),
    until: isoDate(until),
    totalViews: totals.count,
    totalVisits: totals.sum?.visits || 0,
    prevTotalViews: prevTotals.count,
    prevTotalVisits: prevTotals.sum?.visits || 0,
    byDate, byPath, byReferer, byCountry,
    pageLoadTimeMs, pageLoadTimeByDate, topContent, topContentError,
    webVitals: { lcp: vitalBreakdown("lcp"), inp: vitalBreakdown("inp"), cls: vitalBreakdown("cls") },
  });
});
