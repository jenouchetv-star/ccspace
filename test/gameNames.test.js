// Keeping the games' own names and pieces clear of other companies' games, and saying so on the Terms page.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/* games/drop-blox.html is Fruit Drop now (it was DropBlox); its own rules are tested in fruitDrop.test.js */
const fruit = readFileSync(new URL("../games/drop-blox.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("Fruit Drop's name", () => {
  it("is the game's own: no other company's game is named anywhere on the page", () => {
    const low = fruit.toLowerCase();
    for (const other of ["tetris", "candy crush", "puyo", "bejeweled"]) expect(low, other).not.toContain(other);
  });

  it("calls its specials by its own names: striped fruit, wrapped fruit and the golden star", () => {
    for (const t of ["striped fruit", "wrapped fruit", "golden star"]) expect(fruit.toLowerCase()).toContain(t);
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
