// The home page's Newest game section has room for more than a Play page card's one line: it shows the game's
// optional intro (Doodle Dash's adds its second sentence), and falls back to the short summary.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/doodle-dash-intro.sql", import.meta.url), "utf8");
const INTRO = "Draw your own level, then run and jump through it. Share a six-character code to play in the same world as a friend.";

describe("the Newest game section", () => {
  it("shows the game's intro, or its summary when it has none", () => {
    expect(html).toContain(`quEditable(ng.intro ? "newest-game-intro" : "newest-game-desc", ng.id, E(ng.intro || ng.summary))`);
    expect(html).toContain('{ key:"intro", label:"Home page intro", type:"textarea"');
  });

  it("lets Quick Update change the home page's book panel and new games band", () => {
    expect(html).toContain(`quEditable("amazon-title", rec.id, E(String(rec.title).split(/:\\s+/)[0]))`);
    expect(html).toContain(`quEditable("amazon-why", rec.id, E(rec.why))`);
    expect(html).toContain(`quEditable("home-arcade-heading", homeId, E(heading))`);
    expect(html).toContain(`quEditable("home-arcade-text", homeId, E(text))`);
    expect(html).toContain('"home-arcade-heading": { label:"New games band heading", col:"pages",   fieldKey:"arcadeHeading"');
    expect(html).toContain('pageVal("home", "arcadeHeading", "8 games, one big arcade makeover!")');
  });

  it("lets Quick Update change the text under the Create page's heading", () => {
    expect(html).toContain(`'<p class="lede">' + quEditable("create-finder-lede", createId, E(createLede)) + '</p>'`);
    expect(html).toContain('"create-finder-lede":  { label:"Create page intro",      col:"pages",   fieldKey:"finderLede"');
    expect(html).toContain('pageVal("create", "finderLede", "Tell us what you have, what you want to explore, and how much time you have. "');
  });

  it("links the Help page's mention of the Privacy Policy", () => {
    expect(html).toContain(`E(qa[1]).replace(/Privacy Policy/g, '<a href="#/privacy">Privacy Policy</a>')`);
    expect(html).toContain("See the Privacy Policy for the details.");
    expect(html).toContain(`.replace(/Report a problem/g, '<button type="button" class="more__link" data-act="report-problem-open">Report a problem</button>')`);
    expect(html).toContain('"Use Report a problem, at the bottom of every page. It helps to say which activity and which step was unclear."');
  });

  it("lays articles out like the other pages, with headings, charts, a photo and their sources", () => {
    const view = html.split("function viewArticle(")[1].split("\nfunction ")[0];
    expect(view).toContain('<div class="panel article">');
    expect(view).toContain("pageHeader(\"\", quEditable(\"article-title\"");
    const body = html.split("function articleBodyHTML(")[1].split("\nfunction ")[0];
    expect(body).toContain("/^##\\s+/.test(s)");
    expect(body).toContain("s.match(/^\\[chart\\s+(\\d+)\\]$/i)");
    expect(body).toContain("/^\\[photo\\]$/i.test(s)");
    expect(html).toContain('{ key:"photo", label:"Photo in the article", type:"media"');
    expect(html).toContain('{ key:"sources", label:"Sources", type:"lines"');
    expect(html).toContain("return { label: label, url: /^https?:\\/\\//i.test(url) ? url : \"\" };");   /* only real web links */
    expect(html).not.toContain('R({ id:"art-paper"');
    /* an article keeps the Grown-Ups tab row and menu highlight, with a way back to the list */
    expect(html).toContain('if (r.name === "article-detail") return { items: GROWNUP_NAV, current: "articles"');
    expect(html).toContain('"grown-ups": ["grown-ups","help","article-detail"],');
    expect(view).toContain(' Back to News &amp; Articles</a>');
    /* drafts are for admins only: on the list (marked Draft) and on their own page */
    expect(html).toContain('a.status === "published" || (showDrafts && a.status === "draft")');
    expect(view).toContain('(a.status !== "published" && !adminSeesAll())) return notFound("article")');
  });

  it("gives News & Articles a count, a search, pages, and a remembered cards / list switch", () => {
    expect(html).toContain(`'<span class="hl">' + list.length + '</span> ' + (list.length === 1 ? "article" : "articles")`);
    expect(html).toContain('id="art-search" type="search" data-act="art-search"');
    expect(html).toContain('data-act="art-page" data-page="');
    expect(html).toContain('try { localStorage.setItem("ccs_articles_view", AppState.articlesView); } catch(e) {}');
    expect(html).toContain('localStorage.getItem("ccs_articles_view") === "list" ? "list" : "cards"');
    expect(html).toContain("function articleRow(a){");
  });

  it("gives Doodle Dash its second sentence, and keeps its Play card summary to one line", () => {
    expect(html).toContain('intro:"' + INTRO + '"');
    expect(sql).toContain(INTRO);
    expect(html).toContain('summary:"Draw your own level, then run and jump through it.",');
  });
});
