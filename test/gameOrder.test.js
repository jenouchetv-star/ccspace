// The Play page lists every New game first (the newest at the very top), then the rest by an
// "order" number (lowest first), then A to Z. A game can also carry a short note, shown on its card
// and its page (Solar System Sandbox is best on a desktop or tablet).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.split("function playOrder(")[1].split("\nfunction ")[0];
const playOrder = new Function("return function playOrder(" + src)();

describe("Play page game order and notes", () => {
  it("is the sort the Play page uses", () => {
    const fn = html.split("function viewPlay(sub){")[1].split("function gamePlate")[0];
    expect(fn).toContain(".sort(playOrder)");
  });

  it("puts every New game at the top, newest first, then the rest by order number, then A to Z", () => {
    const games = [
      { title: "Air Hockey Arcade" },
      { title: "UFO", order: 9 },
      { title: "Hands-Free Builder", order: 0 },
      { title: "Doodle Dash", order: 1, badge: "New", createdAt: "2026-10-17T18:00:00.000Z" },
      { title: "Word Quest", order: 0, badge: "New", createdAt: "2026-11-07T23:10:00.000Z" },
      { title: "Pathbuilder", order: 0, badge: "New", createdAt: "2026-10-28T06:00:00.000Z" },
      { title: "Bounce & Bank", order: 2 },
      { title: "Zebra Zoom" },
      { title: "Echo Matrix", order: 0, badge: "New", createdAt: "2026-11-08T02:15:00.000Z" },
    ];
    const sorted = games.slice().sort(playOrder).map((g) => g.title);
    expect(sorted).toEqual(["Echo Matrix", "Word Quest", "Pathbuilder", "Doodle Dash", "Hands-Free Builder", "Bounce & Bank", "UFO", "Air Hockey Arcade", "Zebra Zoom"]);
  });

  it("treats any other badge as an ordinary game", () => {
    const sorted = [{ title: "B", badge: "Popular", order: 3 }, { title: "A", order: 1 }].sort(playOrder).map((g) => g.title);
    expect(sorted).toEqual(["A", "B"]);
  });

  it("shows a game's note on its card and on its page, and Solar System Sandbox carries one", () => {
    expect(html).toContain('game__note">');
    expect(html).toContain('<div class="callout callout--info game__callout" role="note">');
    expect(html).toContain('slug:"spacetime-sandbox-simulator", note:"Best viewed on desktop or tablet."');
  });
});
