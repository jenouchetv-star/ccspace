// The homepage's "N activities with full instructions" must match the Create page's two cards added together (owner,
// 2026-11-20: "29? 22+13=35"). The subscribers-only activities (AI lessons, portal games like Air Harp) are on the
// Digital Activities card, so the homepage counts them too.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("homepage activity count", () => {
  it("the hero counts every published activity, the same list the Create cards split in two", () => {
    const hero = index.split('if (on("hero")){')[1].split("const heroStats")[0];
    expect(hero).toContain("const acts = createActivities().length;");
  });
  it("the site check that compares the hero numbers counts the same way", () => {
    const check = index.split("heroStatsAreDynamic(){")[1].split("\n  },")[0];
    expect(check).toContain("const acts = createActivities().length;");
  });
});
