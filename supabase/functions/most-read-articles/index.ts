// Chike's Creative Space - most-read-articles Edge Function
//
// The "Most read" list on the public News & Articles page: page views of each
// article's own page (/article/<id>) over the last 30 days, from the same
// Cloudflare Web Analytics data get-site-analytics shows admins. Public on
// purpose, so it returns nothing but article ids and their view counts - no
// paths, referrers, countries or totals - and the answer is kept for an hour,
// so visitors loading the page never add up to more than one Cloudflare
// request an hour per running copy of this function.
//
// Deploy: npx supabase functions deploy most-read-articles
// Secrets: the same three get-site-analytics uses (CLOUDFLARE_API_TOKEN,
// CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_SITE_TAG) - already set for the project.
//
// Called from index.html as:
//   sb.functions.invoke("most-read-articles")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" },
  });
}

const DAYS = 30;
const KEEP_MS = 3_600_000;

const QUERY = `
  query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        articles: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $siteTag, date_geq: $since, date_leq: $until, bot: 0, requestPath_like: "/article/%" }
          limit: 25
          orderBy: [count_DESC]
        ) { count dimensions { requestPath } }
      }
    }
  }
`;

interface Item { id: string; views: number }
let kept: { at: number; items: Item[] } | null = null;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "/article/art-early-start" -> "art-early-start"; anything deeper or odd-looking is left out. */
function articleId(path: string | undefined) {
  const rest = String(path || "").slice("/article/".length).replace(/\/+$/, "");
  const id = rest && !rest.includes("/") ? decodeURIComponent(rest) : "";
  return /^[a-z0-9-]{1,80}$/i.test(id) ? id : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (kept && Date.now() - kept.at < KEEP_MS) return json({ ok: true, days: DAYS, items: kept.items });

  const until = new Date();
  const since = new Date(until.getTime() - DAYS * 86400000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("CLOUDFLARE_API_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          accountTag: Deno.env.get("CLOUDFLARE_ACCOUNT_ID"),
          siteTag: Deno.env.get("CLOUDFLARE_SITE_TAG"),
          since: isoDate(since),
          until: isoDate(until),
        },
      }),
    });
    const out: { data?: { viewer?: { accounts?: { articles?: { count: number; dimensions?: { requestPath?: string } }[] }[] } }; errors?: unknown[] } = await res.json();
    const rows = out?.data?.viewer?.accounts?.[0]?.articles;
    if (!res.ok || out.errors || !rows) return json({ ok: false, error: "unavailable" }, 502);

    // one article can be counted under two paths (with and without a trailing slash): add them together
    const views = new Map<string, number>();
    rows.forEach((r) => {
      const id = articleId(r.dimensions?.requestPath);
      if (id) views.set(id, (views.get(id) || 0) + r.count);
    });
    const items = [...views.entries()].map(([id, n]) => ({ id, views: n })).sort((a, b) => b.views - a.views).slice(0, 10);
    kept = { at: Date.now(), items };
    return json({ ok: true, days: DAYS, items });
  } catch (_err) {
    return json({ ok: false, error: "unavailable" }, 502);
  }
});
