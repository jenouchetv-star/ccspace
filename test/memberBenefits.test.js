// Member benefits (owner, 2026-11-24): a Grown-Ups page on what joining adds and how the progress report works, built
// from the same parts as the About and Guide pages (docs/mockups/grownups-member-benefits-draft-2.png).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { SEO_PAGES } from "../functions/_shared/seo.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const branch = html.slice(html.indexOf('else if (sub === "members"){'), html.indexOf("\n  else {\n    const grownupsRec0"));

describe("Member benefits", () => {
  it("is a Grown-Ups tab, after the Parent & Teacher Guide", () => {
    expect(html).toContain('{ hash:"#/grown-ups",          sub:"",         label:"Parent & Teacher Guide" },\n  { hash:"#/grown-ups/members",  sub:"members",  label:"Member benefits" },');
    expect(SEO_PAGES["/grown-ups/members"].h1).toBe("Member benefits");
    expect(html).toContain('leaf("/grown-ups/members", "Member benefits")');
  });
  it("uses the About and Guide parts: the header band, the story, numbered cards, photo-and-card pairs, the closing card", () => {
    for (const part of ['cmsHeader(M, "Grown-Ups", \'Member <span class="hl-cyan">benefits</span>.\'', '<section class="aboutstory">', '<blockquote class="aboutstory__quote">',
      '<div class="grid guide__steps">', '<div class="guide__pair"><div class="taped guide__photo">', '<div class="panel guide__end">']) expect(branch, part).toContain(part);
  });
  it("asks visitors to join or sign in, and sends members to the portal and the report", () => {
    expect(branch).toContain("const member = portalIsSubscriber();");
    expect(branch).toContain('data-act="open-mailing-list">');
    expect(branch).toContain('data-act="open-mailing-list" data-member data-next="/newsletter"');
    expect(branch).toContain('href="#/newsletter/progress"');
    expect(branch).toContain("member ? mine : join + signIn");
  });
  it("lists the members-only games as they are today, each linked", () => {
    expect(branch).toContain('db.list("games").filter(g => g.kind === "members" && g.status === "published")');
    expect(branch).toContain("'<a href=\"#/play/' + E(g.id) + '\">' + E(g.title) + '</a>'");
  });
  it("keeps every word and picture editable, with a new picture in each photo spot", () => {
    for (const k of ["intro", "storyHeading", "storyQuote", "gamesText", "studioText", "lessonsText", "reportText", "addText", "pickText", "readText",
      "countText", "levelDev", "levelPrac", "levelCons", "levelNone", "infoText", "info1", "info2", "info3", "endTitle", "endText", "endTextMember"]) {
      expect(html, k).toMatch(new RegExp('\\{ key:"' + k + '", section:"'));
    }
    for (const p of ["members-together", "members-drawing", "members-report", "members-phone"]) {
      expect(html).toContain('src:"assets/grownups/' + p + '.jpg"');
      expect(existsSync(new URL("../assets/grownups/" + p + ".jpg", import.meta.url)), p).toBe(true);
    }
  });
  it("the Parent & Teacher Guide points to it", () => {
    expect(html).toContain("'<a class=\"btn btn--cyan\" href=\"#/grown-ups/members\">' + ic(\"sparkles\") + ' ' + slot(G, \"membersButton\") + '</a></div>'");
  });
  it("no em dashes and no he/she", () => {
    const words = branch + html.slice(html.indexOf('"grown-ups/members": ['), html.indexOf('  "grown-ups": ['));
    expect(words).not.toContain("—");
    expect((words.match(/fb:"[^"]*"/g) || []).join(" ")).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
    /* the pictures' descriptions too: never he or she for a child (a grown-up's "his daughter" is fine) */
    expect((words.match(/alt:"[^"]*"/g) || []).join(" ")).not.toMatch(/\b(he|she)\b/i);
  });
});
