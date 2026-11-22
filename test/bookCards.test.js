// Book cards (owner, 2026-11-22, a critical bug): a book's description was cut off after two lines, worst on phones.
// The books list shows the whole description, and its title and description sizes follow the screen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = html.split("<style")[1].split("</style>")[0];
const rule = (sel) => { const i = css.indexOf(sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i)); };

describe("the books list", () => {
  it("is its own grid, so the fix stays on the books", () => {
    expect(html).toContain("'<div class=\"grid g-3 grid--compact grid--books\">' + list.map(s => storyCard(s))");
  });

  it("shows the whole description: no two-line cut", () => {
    const p = rule(".grid--books .card__body > p.tiny");
    expect(p).toMatch(/display:block/);
    expect(p).toMatch(/-webkit-line-clamp:unset/);
    expect(p).toMatch(/overflow:visible/);
    // it comes after the compact grid's clamp, which it has to win over (same specificity)
    expect(css.indexOf(".grid--books .card__body > p.tiny{")).toBeGreaterThan(css.indexOf(".grid--compact .card__body > p.tiny{"));
  });

  it("sizes the title and description with the screen, never smaller than easy reading on a phone", () => {
    expect(rule(".grid--books .card__title")).toContain("font-size:clamp(17px");
    expect(rule(".grid--books .card__body > p.tiny")).toContain("font-size:clamp(14.5px");
  });
});
