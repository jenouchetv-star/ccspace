// Family Portal filters show how many posts each one holds (owner, 2026-11-28: "Add the number of content inside the
// badge"; docs/mockups/portal-filter-counts.png).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];
const pfilterCount = new Function("return function pfilterCount(" + fn(html, "pfilterCount"))();
const visible = (s) => s.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");

describe("Family Portal filter counts", () => {
  it("shows the number, and says posts to a screen reader", () => {
    expect(visible(pfilterCount(12))).toBe("12");
    expect(pfilterCount(12)).toContain("12<span class=\"sr-only\"> posts</span>");
    expect(pfilterCount(1)).toContain("> post</span>");
  });

  it("All counts every post; each category counts its own", () => {
    const view = fn(html, "viewNewsletter");
    expect(view).toContain("'\">All' + pfilterCount(list.length)");
    expect(view).toContain("pfilterCount(list.filter(e => e.category === c).length)");
  });

  it("the count sits in its own small badge, light on the picked filter", () => {
    expect(html).toContain(".pfilter__n{");
    expect(html).toContain('.pfilter[aria-pressed="true"] .pfilter__n{');
  });
});
