// A game's page shows when it launched on Chike's Creative Space, just below the Share button (owner, 2026-11-17).
// The date lives on the game record (launchedAt, YYYY-MM-DD), set for live games from the day each was added, and
// editable in the game editor.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("a game's launch date", () => {
  it("shows at the far right of the title when the game has one (owner: \"place it to the far right side of the title\")", () => {
    expect(site).toContain("'<div class=\"game__head\"><h1 style=\"font-size:clamp(2rem,4.6vw,3.2rem)\">' + nameHTML(g.title) + '</h1>'");
    expect(site).toContain(".game__head{ display:flex; align-items:center; justify-content:space-between;");
    expect(site).toContain("+ (g.launchedAt ? '<p class=\"game__launch\">' + ic(\"rocket\") + ' Launched ' + E(portalDate(g.launchedAt)) + '</p>' : \"\")");
    expect(site).toContain(".game__launch{");
  });
  it("can be set in the game editor", () => {
    expect(site).toContain('{ key:"launchedAt", label:"Launch date", type:"date"');
  });
});
