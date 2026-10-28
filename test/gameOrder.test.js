// The Play page lists online games by an "order" number (lowest first), then New ones, then A to Z.
// A game can also carry a short note, shown on its card and its page (Solar System Sandbox is
// best on a desktop or tablet).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("Play page game order and notes", () => {
  it("sorts by order number first, then New, then title", () => {
    const fn = html.split("function viewPlay(sub){")[1].split("function gamePlate")[0];
    expect(fn).toContain('typeof a.order === "number" ? a.order : 1e9');
    expect(fn).toContain("(b.badge ? 1 : 0) - (a.badge ? 1 : 0)");
    expect(fn).toContain("a.title.localeCompare(b.title)");
  });

  it("the sort rule puts ordered games first and leaves the rest A to Z", () => {
    const key = (g) => (typeof g.order === "number" ? g.order : 1e9);
    const games = [
      { title: "Air Hockey Arcade" },
      { title: "UFO", order: 9 },
      { title: "Doodle Dash", order: 1, badge: "New" },
      { title: "Bounce & Bank", order: 2 },
      { title: "Zebra Zoom" },
    ];
    const sorted = games
      .slice()
      .sort((a, b) => key(a) - key(b) || (b.badge ? 1 : 0) - (a.badge ? 1 : 0) || a.title.localeCompare(b.title))
      .map((g) => g.title);
    expect(sorted).toEqual(["Doodle Dash", "Bounce & Bank", "UFO", "Air Hockey Arcade", "Zebra Zoom"]);
  });

  it("shows a game's note on its card and on its page, and Solar System Sandbox carries one", () => {
    expect(html).toContain('game__note">');
    expect(html).toContain('<div class="callout callout--info game__callout" role="note">');
    expect(html).toContain('slug:"spacetime-sandbox-simulator", note:"Best viewed on desktop or tablet."');
  });
});
