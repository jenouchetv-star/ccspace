// Remote Lunar Salvage's new look (owner OK'd the drafts, 2026-11-16: docs/mockups/lunar-visuals/draft.png, dash-compare.png,
// rocket-compare.png): a two-step start (grade first, then worlds), the real rover and real-looking planets,
// a 3D steering wheel and pedals in the dashboard's own colors, a digital compass, and a more detailed rocket.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => "function " + name + "(" + game.split("function " + name + "(")[1].split("\n}\n")[0] + "\n}";
const asset = (p) => existsSync(new URL("../assets/games/lunar-salvage/" + p, import.meta.url));

describe("the start screen asks for the grade first, then the worlds", () => {
  it("shows the grade step and the world step as two separate steps", () => {
    expect(game).toContain('<div class="step" id="stepGrade">');
    expect(game).toContain('<div class="step" id="stepWorld"');
    expect(game).toContain("First, what grade are you in?");
    expect(game).toContain('id="bNext"');
  });
  it("labels the grades 1st to 5th", () => {
    const g = fn("gradeButtons");
    expect(g).toContain('["1st", "2nd", "3rd", "4th", "5th"]');
  });
  it("goes to the worlds once a grade is picked, and back with Change", () => {
    const paint = fn("paintStart");
    expect(paint).toContain('$("stepGrade").hidden = onWorlds');
    expect(paint).toContain('$("stepWorld").hidden = !onWorlds');
    expect(game).toContain('$("bNext").onclick');
    expect(game).toContain('$("bChangeGrade").onclick');
    expect(paint).toMatch(/\$\("gradeChip"\)\.textContent = /);
  });
  it("puts a divider between the worlds and the start buttons, and a device icon on the two phone options", () => {
    const step = game.split('<div class="step" id="stepWorld"')[1].split("</div>\n  </div>\n</div>")[0];
    expect(step.indexOf('<hr class="sdiv">')).toBeGreaterThan(step.indexOf('id="worldRow"'));
    expect(step.indexOf('<hr class="sdiv">')).toBeLessThan(step.indexOf('id="bStart"'));
    expect(step).toContain("Use a phone or tablet to drive");
    expect(step).toContain("2 Player Contest: Use 2 phones or tablets");
  });
});

describe("real pictures: the rover and the planets", () => {
  it("shows the real rover, rendered from the game, as the start emblem", () => {
    expect(game).toContain('src="/assets/games/lunar-salvage/rover.png"');
    expect(asset("rover.png")).toBe(true);
  });
  it("shows each world as a real-looking planet (from NASA public-domain maps)", () => {
    for (const id of ["pumice", "glacia", "ember", "gusto", "earth"]) expect(asset("planets/" + id + ".png"), id).toBe(true);
    expect(fn("paintStart")).toContain("'/assets/games/lunar-salvage/planets/' + w.id + '.png'");
  });
});

describe("a 3D steering wheel and pedals, in the dashboard's own colors", () => {
  it("gives the wheel a shaded rim, grips, spokes and a glossy hub", () => {
    const w = game.split("const WHEEL_SVG = ")[1].split(";\n")[0];
    for (const id of ["wRim", "wGrip", "wSpoke", "wHub"]) expect(w).toContain('id="' + id + '"');
    expect(w).toContain('<g id="wheelRot">');
    expect(w).toContain("#dfe6f4");                         // the original light rim color
  });
  it("tilts the pedals like real ones and presses them further down while held", () => {
    expect(game).toMatch(/\.pedal\{[^}]*transform:perspective\(380px\) rotateX\(16deg\)/);
    expect(game).toMatch(/\.pedal\.down\{[^}]*rotateX\(30deg\)/);
    expect(game).toMatch(/\.go\{[^}]*#2f7de1/);                // still the original blue
  });
});

describe("a digital compass on the dashboard", () => {
  /* the compass helpers are one-liners */
  const line = (name) => game.match(new RegExp("function " + name + "\\([^)]*\\)\\{[^\\n]*\\}"))[0];
  const S = new Function(line("compassHeading") + "\n" + line("bearingTo") + "\n" + line("cardinal") + "\nreturn { compassHeading, bearingTo, cardinal };")();
  it("reads north when the rover faces -z, and east toward +x (the way Gusto's wind blows)", () => {
    expect(S.compassHeading(0)).toBeCloseTo(0);
    expect(S.compassHeading(-Math.PI / 2)).toBeCloseTo(90);
    expect(S.compassHeading(Math.PI)).toBeCloseTo(180);
    expect(S.compassHeading(Math.PI / 2)).toBeCloseTo(270);
  });
  it("points to the goal from where the rover is", () => {
    expect(S.bearingTo(0, -5)).toBeCloseTo(0);
    expect(S.bearingTo(5, 0)).toBeCloseTo(90);
    expect(S.bearingTo(-5, 0)).toBeCloseTo(270);
  });
  it("names the eight directions", () => {
    expect([0, 47, 90, 180, 226, 270, 314, 359].map(S.cardinal)).toEqual(["N", "NE", "E", "S", "SW", "W", "NW", "N"]);
  });
  it("sits on the dashboard above the tools and follows the blue beam's goal", () => {
    expect(game).toMatch(/<div class="dc"><div class="cmp" id="cmp"/);
    expect(fn("drawCompass")).toContain("beamTarget()");
    expect(game.split("function frame(now){")[1].split("\n}\n")[0]).toContain("drawCompass(");
  });
});

describe("the more detailed rocket (owner: \"perfect\")", () => {
  it("is built by buildRocketModel and keeps the door hinge, flame, landing and boarding spots", () => {
    expect(game).toContain("function buildRocketModel(base){");
    const r = game.split("const ROCKET = (function(){")[1].split("})();")[0];
    expect(r).toContain("const hinge = buildRocketModel(base);");
    expect(r).toContain("return { g, base, hinge, flame, glow, OPEN, CLOSED, y, foot: { x: p.x + 6.0, z: p.z }, bay: { x: p.x + 0.3, z: p.z } };");
  });
  it("paints its panels in code: seams and rivets, a roll band, CCS-1 lettering and engine scorch", () => {
    const m = fn("buildRocketModel");
    for (const bit of ["panel seams", "roll-pattern band", "CCS-1", "scorch"]) expect(m).toContain(bit);
  });
});

describe("Field Notes: Back to the mission is always in reach (owner, 2026-11-16)", () => {
  it("stays pinned to the bottom of the note instead of scrolling away", () => {
    expect(game).toContain('<div class="bookfoot"><button class="cta blue back" data-close="ovNotes">Back to the mission</button></div>');
    expect(game).toMatch(/\.bookfoot\{position:sticky;bottom:-14px/);
  });
});
