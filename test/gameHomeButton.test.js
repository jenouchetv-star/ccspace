// A home button sits right beside the pause button in the free arcade games, and takes the player back to the
// game's own title screen (the same as Menu on the pause screen), in one tap.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const GAMES = { "chrono-billiards": ".cb", "echo-matrix": ".em", "word-quest": ".wq" };

describe.each(Object.entries(GAMES))("%s", (name, scope) => {
  const html = readFileSync(new URL("../games/" + name + ".html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const hud = html.split('<header class="hud">')[1].split("</header>")[0];

  it("has a home button straight after pause", () => {
    const pause = hud.indexOf('id="pause-btn"'), home = hud.indexOf('id="home-btn"');
    expect(pause).toBeGreaterThan(-1);
    expect(home).toBeGreaterThan(pause);
    const between = hud.slice(pause, home);
    expect(between.match(/<button/g) || []).toHaveLength(1);   // only the home button's own tag: nothing else in between
  });

  it("goes to the game's menu, like Menu on the pause screen, and says so", () => {
    expect(hud).toContain('<button type="button" class="icon-btn menu-btn" id="home-btn" aria-label="Back to the game menu"');
    expect(html).toMatch(/document\.querySelectorAll\("\.menu-btn"\)\.forEach\(b => b\.addEventListener\("click"/);
    expect(html).toContain("function toMenu(){");
  });

  it("keeps the round buttons a comfortable 44px on a narrow phone", () => {
    expect(html).toContain(scope + " .hud .icon-btn{width:44px !important;height:44px !important;min-height:44px !important}");
  });
});

describe("Chrono Billiards' Hints on a narrow phone", () => {
  const html = readFileSync(new URL("../games/chrono-billiards.html", import.meta.url), "utf8");
  it("shows just the bulb, and still has a name for screen readers", () => {
    expect(html).toContain(".cb .hints-btn .hint-state{display:none}");
    expect(html).toContain('id="hints-btn" aria-pressed="true" aria-label="Hints"');
  });
});
