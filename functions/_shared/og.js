/* This whole site is a client-rendered SPA: one static index.html, with
   every activity/episode/story/article page filled in by JS after load.
   That's fine for a person's browser, but a link-unfurling bot (Facebook,
   X, Slack, WhatsApp, iMessage, ...) never runs that JS - it only ever
   reads the <head> of the exact HTML byte-for-byte, which means every
   single shared link previews with the one fixed og:title/og:description/
   og:image already baked into index.html (the site's own icon), no matter
   which activity or episode someone actually shared.

   Fixing that for real visitors would mean server-rendering the whole
   app, which this project isn't set up to do. Fixing it for what a
   share preview actually needs is much smaller: a bot only reads meta
   tags, so this only has to run for bots, and only has to change the
   meta tags. A real visitor's request never enters the "isCrawler"
   branch below, so the app they get is byte-for-byte what it always was.

   The anon key here is the exact same one already shipped in index.html's
   own <script> (SUPABASE_ANON_KEY) - it's public by design (RLS gates
   what it can read/write), not a new secret. */

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|Pinterest|Discordbot|TelegramBot|SkypeUriPreview|redditbot|Googlebot|Applebot|Bingbot|vkShare|W3C_Validator|Iframely|Embedly/i;

function isCrawler(request){
  return CRAWLER_UA.test(request.headers.get("user-agent") || "");
}

function getPath(obj, path){
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function absoluteUrl(src, origin){
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return origin.replace(/\/$/, "") + "/" + String(src).replace(/^\/+/, "");
}

/** `table`/`titleKey`/`descKey`/`imageKey` name the one Supabase-backed
    record this route is about and which of its fields hold the title,
    description, and cover image - the same field names the app's own
    admin editors already use for that collection. */
export async function renderWithOg(context, { table, titleKey, descKey, imageKey, fallbackTitle }){
  const response = await context.next();
  if (!isCrawler(context.request)) return response;

  const id = context.params.id;
  if (!id) return response;

  let record = null;
  try {
    const url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id) + "&select=data";
    const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, authorization: "Bearer " + SUPABASE_ANON_KEY } });
    if (res.ok){
      const rows = await res.json();
      record = rows && rows[0] && rows[0].data;
    }
  } catch (_e){
    /* Supabase unreachable - fall through and hand the bot the normal,
       unmodified page rather than failing the request. */
  }

  if (!record || record.status !== "published") return response;

  const origin = new URL(context.request.url).origin;
  const title = (getPath(record, titleKey) || fallbackTitle) + " | Chike's Creative Space";
  const desc = getPath(record, descKey) || "";
  const image = absoluteUrl(getPath(record, imageKey), origin) || (origin + "/assets/icons/icon-512.png");

  return new HTMLRewriter()
    .on('title', { element(el){ el.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element(el){ el.setAttribute("content", title); } })
    .on('meta[property="og:description"]', { element(el){ if (desc) el.setAttribute("content", desc); } })
    .on('meta[property="og:image"]', { element(el){ el.setAttribute("content", image); } })
    .on('meta[name="twitter:title"]', { element(el){ el.setAttribute("content", title); } })
    .on('meta[name="twitter:description"]', { element(el){ if (desc) el.setAttribute("content", desc); } })
    .on('meta[name="twitter:image"]', { element(el){ el.setAttribute("content", image); } })
    .transform(response);
}
