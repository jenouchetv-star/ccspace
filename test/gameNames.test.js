// Keeping the games' own names and pieces clear of other companies' games, and saying so on the Terms page.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const blox = readFileSync(new URL("../games/drop-blox.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("DropBlox's shapes", () => {
  const shapes = new Function(blox.match(/const SHAPES = (\{[\s\S]*?\n\s*\});/)[1].replace(/^/, "return ") + ";")();
  const cells = (s) => s.flat().reduce((a, b) => a + b, 0);

  it("are all made of five blocks, so none is one of the seven classic four-block shapes", () => {
    expect(Object.keys(shapes).length).toBeGreaterThanOrEqual(6);
    for (const [k, s] of Object.entries(shapes)) expect(cells(s), "shape " + k).toBe(5);
  });

  it("are all different from each other", () => {
    const norm = (s) => {
      let m = s, out = [];
      for (let i = 0; i < 4; i++) { m = m[0].map((_, c) => m.map((r) => r[c]).reverse()); out.push(JSON.stringify(m), JSON.stringify(m.map((r) => [...r].reverse()))); }
      return out.sort()[0];
    };
    const seen = new Set(Object.values(shapes).map(norm));
    expect(seen.size).toBe(Object.keys(shapes).length);
  });

  it("let a rainbow Master Brick carry every colour: one colour for each of its five blocks", () => {
    expect(blox).toContain("const COLORS = ['#f00000', '#00f000', '#0000f0', '#f0f000', '#a000f0']");
    expect(blox).toContain("const NEXT_BOX_SIZE = 5;");
  });

  it("does not use another game's name anywhere on the page", () => {
    expect(blox.toLowerCase()).not.toContain("tetris");
  });
});

describe("names and pages", () => {
  it("never calls the four-in-a-row game by another company's name", () => {
    expect(index).not.toMatch(/connect[ -]?(four|4)\b/i);
  });

  it("says on the Terms page that other companies' names belong to them and that the games are the site's own", () => {
    expect(index).toContain("Names and logos of other companies that appear or are linked here");
    expect(index).toContain("is not affiliated with, endorsed by, or sponsored by any of them");
    expect(index).toContain("Our games are our own versions of simple, classic ideas, with their own names, art, and code.");
    expect(index).toContain("and we will look into it promptly");
  });

  it("keeps a written name-clearance checklist, with options for a new Bounce & Bank name", () => {
    const doc = readFileSync(new URL("../docs/name-clearance.md", import.meta.url), "utf8");
    expect(existsSync(new URL("../docs/name-clearance.md", import.meta.url))).toBe(true);
    for (const t of ["Pathbuilder", "Gravity 4", "Bounce & Bank", "DropBlox", "not legal advice"]) expect(doc).toContain(t);
    expect((doc.split("## Bounce & Bank")[1].split("##")[0].match(/^\d+\. /gm) || []).length).toBe(10);
  });
});
