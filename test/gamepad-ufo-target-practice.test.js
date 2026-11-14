// Cosmic Blast! (games/ufo-target-practice.html) plays with a game controller: in flight the sticks
// or d-pad steer the reticle, A or RT fires, B fires a white bolt and LB / RB switch lasers; on the
// title, level and results cards the stick moves between the buttons, A presses and B goes to Levels.
// The helpers sit between BEGIN/END gamepad markers and touch nothing on the page, so they run here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/ufo-target-practice.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN gamepad */")[1].split("/* END gamepad */")[0];
const { padFirst, padSteer, padNextKind, padNearest, PAD_DEAD } =
  new Function(block + "; return { padFirst, padSteer, padNextKind, padNearest, PAD_DEAD };")();

const fakePad = (over = {}) => ({
  connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), ...over
});
const press = (gp, ...ids) => { for (const i of ids) gp.buttons[i] = { pressed: true, value: 1 }; return gp; };
const poll = page.split("function pollPad(dt) {")[1].split("\n    }\n")[0];
const frame = page.split("function frame(now) {")[1].split("\n    }\n")[0];

describe("the Cosmic Blast! controller", () => {
  it("uses the first connected pad", () => {
    const gp = fakePad();
    expect(padFirst([null, { connected: false }, gp])).toBe(gp);
    expect(padFirst(null)).toBe(null);
  });

  it("steers with no drift inside the dead zone, and full speed at the stick's edge", () => {
    expect(padSteer(fakePad({ axes: [PAD_DEAD * 0.9, -PAD_DEAD * 0.9, 0.1, 0.1] }))).toEqual({ x: 0, y: 0 });
    expect(padSteer(fakePad({ axes: [1, 0, 0, 0] })).x).toBeCloseTo(1);
    expect(padSteer(fakePad({ axes: [0, -1, 0, 0] })).y).toBeCloseTo(-1);
    const half = padSteer(fakePad({ axes: [0.6, 0, 0, 0] })).x;
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.6);
  });

  it("steers with the d-pad and the right stick too, never faster than full", () => {
    expect(padSteer(press(fakePad(), 15))).toEqual({ x: 1, y: 0 });
    expect(padSteer(press(fakePad(), 12))).toEqual({ x: 0, y: -1 });
    expect(padSteer(fakePad({ axes: [0, 0, -1, 0] })).x).toBeCloseTo(-1);
    const both = padSteer(press(fakePad({ axes: [1, 0, 0, 0] }), 13));
    expect(Math.hypot(both.x, both.y)).toBeCloseTo(1);
  });

  it("switches lasers round the three kinds with LB and RB", () => {
    expect(padNextKind("blue", 1)).toBe("white");
    expect(padNextKind("white", 1)).toBe("purple");
    expect(padNextKind("purple", 1)).toBe("blue");
    expect(padNextKind("blue", -1)).toBe("purple");
    expect(poll).toContain("if (hit(4)) { selectKind(padNextKind(selectedKind, -1)); sfx('click'); }");
    expect(poll).toContain("if (hit(5)) { selectKind(padNextKind(selectedKind, 1)); sfx('click'); }");
  });

  it("moves between the level buttons by where they sit", () => {
    const row = Array.from({ length: 8 }, (_, i) => ({ left: (i % 4) * 60, top: Math.floor(i / 4) * 50, width: 54, height: 44 }));
    expect(padNearest(row, 0, 1, 0)).toBe(1);
    expect(padNearest(row, 1, 0, 1)).toBe(5);
    expect(padNearest(row, 3, 1, 0)).toBe(-1);
  });

  it("fires the chosen laser with A or RT, and a white bolt with B, only while it can shoot", () => {
    expect(poll).toContain("if (canShoot()) {");
    expect(poll).toContain("if (b(0) || rt > PAD_TRIGGER) tryFire(selectedKind);");
    expect(poll).toContain("else if (b(1)) tryFire('white');");
    expect(poll).toContain("gp.buttons[7].value");
  });

  it("presses the focused card button with A, and B goes to Levels after a round", () => {
    expect(poll).toMatch(/if \(hit\(0\)\) \{[\s\S]*?el\.click\(\)/);
    expect(poll).toContain("else if (hit(1) && phase === 'over') menuBtn.click();");
    expect(poll).toContain("if (hit(1) || hit(9)) closeEfficiency();");
  });

  it("polls inside the game's own frame loop, guarded against a browser without pads", () => {
    expect(frame).toContain("pollPad(dt);");
    expect(poll).toMatch(/try \{ gp = padFirst\(navigator\.getGamepads/);
  });

  it("draws the site's focus ring on the cards while the controller drives", () => {
    expect(page).toMatch(/body\.ccs-pad \.overlay :focus, body\.ccs-pad #efficiencyModal :focus\{[^}]*outline:3px solid #1E2226 !important;[^}]*box-shadow:0 0 0 6px #F5B921 !important;/);
  });
});
