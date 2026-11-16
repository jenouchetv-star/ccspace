// Our partners: each partner sits in a card of its own, and a partner with a website links to it.
// Since 2026-11-16 the partners sit at the bottom of About > About Us, and the Our Partners tab is gone.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const view = index.split("function partnersSection(){")[1].split("\n}\n")[0];
const cfg = index.split('"about/partners": [')[1].split('"about/business": [')[0];

describe("our partners", () => {
  it("puts every partner in its own card instead of one shared panel", () => {
    expect(view).toContain('class="partners"');
    expect(view).toContain("partner-card");
    expect(view).not.toContain('<div class="panel" style="display:flex;flex-wrap:wrap');
    expect(index).toMatch(/\.partners\{[^}]*display:grid/);
  });
  it("links a partner's card to its website in a new tab, and POSCHI to www.poschi.app", () => {
    expect(cfg).toContain('{ key:"url", label:"Website');
    expect(cfg).toContain('url:"https://www.poschi.app"');
    expect(view).toContain('target="_blank" rel="noopener"');
    expect(view).toContain("partnerHref(");
  });
  it("only links real web addresses", () => {
    const fn = index.split("function partnerHref(")[1].split("\n}\n")[0];
    const partnerHref = new Function("return function partnerHref(" + fn + "\n}")();
    expect(partnerHref("https://www.poschi.app")).toBe("https://www.poschi.app");
    expect(partnerHref("www.poschi.app")).toBe("https://www.poschi.app");
    expect(partnerHref("javascript:alert(1)")).toBe("");
    expect(partnerHref("")).toBe("");
    expect(partnerHref(undefined)).toBe("");
  });
});

describe("partners on the About Us page", () => {
  const team = index.split('else if (sub === "team"){')[1].split('else if (sub === "business"){')[0];
  const nav = index.split("const ABOUT_NAV = [")[1].split("];")[0];
  it("puts the partners at the bottom of About Us", () => {
    expect(team).toMatch(/\+ partnersSection\(\);\s*\}\s*$/);
  });
  it("drops the Our Partners tab, and old Our Partners links open About Us", () => {
    expect(nav).not.toContain('sub:"partners"');
    expect(index).not.toContain('leaf("/about/partners", "Our Partners")');
    expect(index).toContain('if (sub === "partners") sub = "team";');
  });
});
