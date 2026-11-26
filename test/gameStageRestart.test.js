// One Start over per game (owner, 2026-11-26: "solar system sandbox has 2 start over buttons"): a game with its own
// Start over in its toolbar gets no second one in the site's game bar.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("the game bar's Start over", () => {
  it("is left out for games that have their own, starting with Solar System Sandbox", () => {
    expect(html).toContain('const OWN_RESTART_SLUGS = ["solar-system-sandbox"];');
    const stage = html.split("function gameStage(g){")[1].split("\nfunction ")[0];
    expect(stage).toContain('(g.ownRestart ? "" : \'<button class="btn btn--sm btn--paper gamestage__iconbtn" data-act="game-reload"');
  });
  it("is worked out from the portal name or the private game file, on both ways a portal game opens", () => {
    expect(html).toContain("const ownRestart = OWN_RESTART_SLUGS.indexOf(slug) >= 0");
    expect(html).toContain("ownRestart: ownRestart }); return; }");
    expect(html).toContain('ownRestart: OWN_RESTART_SLUGS.indexOf(e.slug) >= 0 || OWN_RESTART_SLUGS.indexOf(String(e.privateGameId || "").replace(/^pg-/, "")) >= 0 });');
  });
});
