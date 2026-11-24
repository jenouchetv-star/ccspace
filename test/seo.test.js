// Search titles, descriptions and crawler-readable pages (owner, 2026-11-24: "so that people can find us when searching
// for kids learning, kids learning games, children ebooks, children books, kid activities, STEM for kids, education
// for kids, fun education for kids"). functions/_middleware.js runs with stand-ins for Cloudflare's HTMLRewriter.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { SEO_PAGES, seoFor, crawlerBody, SECTION_LINKS } from "../functions/_shared/seo.js";
import { onRequest } from "../functions/_middleware.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const appTable = new Function(index.split("/* SEO_PAGES BEGIN */")[1].split("/* SEO_PAGES END */")[0] + "\nreturn SEO_PAGES;")();

describe("the search words", () => {
  it("are the same in the app and for crawlers", () => {
    expect(appTable).toEqual(SEO_PAGES);
  });
  it("cover what families search for", () => {
    const all = Object.values(SEO_PAGES).map(p => p.title + " " + p.desc).join(" ").toLowerCase();
    for (const words of ["learning games for kids", "children's books", "picture books", "kids activities", "stem", "steamm",
      "fun education for kids", "educational games for kids", "videos and cartoons for kids", "ebooks", "kids learning", "art and craft activities for kids"]) expect(all, words).toContain(words);
  });
  it("say STEAMM, and STEM only inside its explanation", () => {
    for (const p of Object.values(SEO_PAGES)) for (const t of [p.title, p.desc]) expect(t.replace(/STEM plus art and music|STEM Plus Art and Music|not just STEM/g, "")).not.toMatch(/\bSTEM\b/);
  });
  it("fit in a search result: a description of 160 characters or less on every page, and no em dashes", () => {
    for (const [k, p] of Object.entries(SEO_PAGES)){
      expect(p.desc.length, k).toBeLessThanOrEqual(160);
      expect(p.desc.length, k).toBeGreaterThan(40);
      expect(p.title.endsWith("Chike's Creative Space") || p.title.startsWith("Chike's Creative Space"), k).toBe(true);
      expect(p.title + p.desc + p.h1, k).not.toContain("—");
    }
  });
  it("start the home page with them, in the head every visitor and crawler first reads", () => {
    const home = SEO_PAGES["/"];
    expect(index).toContain("<title>" + home.title + "</title>");
    expect(index).toContain('<meta name="description" content="' + home.desc + '">');
    expect(index).toContain('<meta property="og:title" content="' + home.title + '">');
    expect(index).toContain('"@type": "WebSite"');
    expect(index).toContain('"audience": { "@type": "PeopleAudience", "suggestedMinAge": 5, "suggestedMaxAge": 11 }');
  });
  it("set the tab title and description as each page opens in the app", () => {
    expect(index).toContain("  applyPageSeo();\n  syncAppManifest();");
    expect(index).toContain('const key = "/" + String(Router.current()).split("?")[0].replace(/^\\/+|\\/+$/g, "");');
    expect(index).toContain('"game-detail": ["games", "summary", "Learning Game for Kids"]');
  });
  it("find a section by its address, with or without a trailing slash", () => {
    expect(seoFor("/play/online/")).toBe(SEO_PAGES["/play/online"]);
    expect(seoFor("/")).toBe(SEO_PAGES["/"]);
    expect(seoFor("/play/game-drop-2048")).toBe(null);
    expect(seoFor("/newsletter")).toBe(null);
    expect(seoFor("/admin")).toBe(null);
  });
});

describe("the page a crawler reads", () => {
  it("has the heading, the description and links to every section, with text made safe", () => {
    const b = crawlerBody({ h1: "Games <for> kids", desc: "Play & learn", image: "https://x.test/a.jpg", imageAlt: 'A "game"' });
    expect(b).toContain("<h1>Games &lt;for&gt; kids</h1><p>Play &amp; learn</p>");
    expect(b).toContain('<img src="https://x.test/a.jpg" alt="A &quot;game&quot;">');
    for (const [href] of SECTION_LINKS) expect(b).toContain('<a href="' + href + '">');
  });
});

function fakeRewriter(){
  const calls = [];
  class HTMLRewriter { on(selector, handlers){ calls.push({ selector, handlers }); return this; } transform(res){ res.__rewritten = calls; return res; } }
  return { HTMLRewriter, calls };
}
const run = (calls, selector) => { const c = calls.find(x => x.selector === selector); if (!c) return null; const set = {}; c.handlers.element({ setAttribute: (k, v) => { set[k] = v; }, setInnerContent: (v, o) => { set.inner = v; set.html = !!(o && o.html); } }); return set; };
const ctx = (ua, path, type = "text/html; charset=utf-8", method = "GET") => ({
  request: new Request("https://www.chikescreativespace.com" + path, { method, headers: { "user-agent": ua } }),
  next: async () => new Response("<html></html>", { headers: { "content-type": type } })
});

describe("the section pages, for crawlers (functions/_middleware.js)", () => {
  let rw;
  beforeEach(() => { rw = fakeRewriter(); globalThis.HTMLRewriter = rw.HTMLRewriter; });
  afterEach(() => { delete globalThis.HTMLRewriter; });

  it("gives the games page its own title, description, address and a readable body", async () => {
    await onRequest(ctx("Mozilla/5.0 (compatible; bingbot/2.0)", "/play/online"));
    const p = SEO_PAGES["/play/online"];
    expect(run(rw.calls, "title").inner).toBe(p.title);
    expect(run(rw.calls, 'meta[name="description"]').content).toBe(p.desc);
    expect(run(rw.calls, 'meta[property="og:title"]').content).toBe(p.title);
    expect(run(rw.calls, "link#canonical-link").href).toBe("https://www.chikescreativespace.com/play/online");
    const body = run(rw.calls, "div#app");
    expect(body.html).toBe(true);
    expect(body.inner).toContain("<h1>Learning games for kids</h1>");
    expect(run(rw.calls, 'meta[property="og:image"]').content).toBeUndefined();   /* keeps the site's share picture */
  });
  it("works for DuckDuckGo and the AI search crawlers too", async () => {
    for (const ua of ["DuckDuckBot/1.1", "Mozilla/5.0 (compatible; OAI-SearchBot/1.0)", "PerplexityBot/1.0"]){
      rw.calls.length = 0;
      await onRequest(ctx(ua, "/stories"));
      expect(run(rw.calls, "title").inner, ua).toBe(SEO_PAGES["/stories"].title);
    }
  });
  it("leaves people's pages, item pages, private pages and files alone", async () => {
    for (const c of [ctx("Mozilla/5.0 (Windows NT 10.0) Chrome/120", "/play/online"), ctx("Googlebot/2.1", "/play/game-drop-2048"),
      ctx("Googlebot/2.1", "/newsletter"), ctx("Googlebot/2.1", "/stories", "image/jpeg"), ctx("Googlebot/2.1", "/stories", "text/html", "HEAD")]){
      const res = await onRequest(c);
      expect(res.__rewritten).toBeUndefined();
    }
    expect(rw.calls).toHaveLength(0);
  });
});
