// The home page's Newest game section has room for more than a Play page card's one line: it shows the game's
// optional intro (Doodle Dash's adds its second sentence), and falls back to the short summary.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/doodle-dash-intro.sql", import.meta.url), "utf8");
const INTRO = "Draw your own level, then run and jump through it. Share a six-character code to play in the same world as a friend.";

describe("the Newest game section", () => {
  it("shows the game's intro, or its summary when it has none", () => {
    expect(html).toContain(`quEditable(ng.intro ? "newest-game-intro" : "newest-game-desc", ng.id, E(ng.intro || ng.summary))`);
    expect(html).toContain('{ key:"intro", label:"Home page intro", type:"textarea"');
  });

  it("lets Quick Update change the home page's book panel and new games band", () => {
    expect(html).toContain(`quEditable("amazon-title", rec.id, E(String(rec.title).split(/:\\s+/)[0]))`);
    expect(html).toContain(`quEditable("amazon-why", rec.id, E(rec.why))`);
    expect(html).toContain(`quEditable("home-arcade-heading", homeId, E(heading))`);
    expect(html).toContain(`quEditable("home-arcade-text", homeId, E(text))`);
    expect(html).toContain('"home-arcade-heading": { label:"New games band heading", col:"pages",   fieldKey:"arcadeHeading"');
    expect(html).toContain('pageVal("home", "arcadeHeading", "8 games, one big arcade makeover!")');
  });

  it("gives Doodle Dash its second sentence, and keeps its Play card summary to one line", () => {
    expect(html).toContain('intro:"' + INTRO + '"');
    expect(sql).toContain(INTRO);
    expect(html).toContain('summary:"Draw your own level, then run and jump through it.",');
  });
});
