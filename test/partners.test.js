// About > Our Partners: each partner sits in a card of its own, and a partner with a website links to it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const view = index.split('else if (sub === "partners"){')[1].split('else if (sub === "team"){')[0];
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
