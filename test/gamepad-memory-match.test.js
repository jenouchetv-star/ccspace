// Memory Match (games/memory-match.html) plays with a game controller: the stick or d-pad moves a
// highlight between the cards (or the start / win card's buttons) and A flips or presses. The
// helpers sit between BEGIN/END gamepad markers and touch nothing on the page, so they run here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/memory-match.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN gamepad */")[1].split("/* END gamepad */")[0];
const { padFirst, padVector, padNearest, PAD_DEAD } = new Function(block + "; return { padFirst, padVector, padNearest, PAD_DEAD };")();

const fakePad = (over = {}) => ({
  connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), ...over
});
const press = (gp, ...ids) => { for (const i of ids) gp.buttons[i] = { pressed: true, value: 1 }; return gp; };
// a 5 x 4 board of 100px cards with 10px gaps, as the page lays it out on a wide screen
const grid = Array.from({ length: 20 }, (_, i) => ({ left: (i % 5) * 110, top: Math.floor(i / 5) * 110, width: 100, height: 100 }));

describe("the Memory Match controller", () => {
  it("uses the first connected pad and skips empty slots", () => {
    const gp = fakePad();
    expect(padFirst([null, { connected: false }, gp, null])).toBe(gp);
    expect(padFirst([null, null])).toBe(null);
    expect(padFirst(undefined)).toBe(null);
  });

  it("reads the stick and the d-pad as one direction, with a dead zone", () => {
    expect(padVector(fakePad({ axes: [PAD_DEAD / 2, -0.1, 0, 0] }))).toEqual({ x: 0, y: 0 });
    expect(padVector(fakePad({ axes: [0.9, 0, 0, 0] })).x).toBeCloseTo(0.9);
    expect(padVector(press(fakePad(), 15))).toEqual({ x: 1, y: 0 });
    expect(padVector(press(fakePad(), 14))).toEqual({ x: -1, y: 0 });
    expect(padVector(press(fakePad(), 12))).toEqual({ x: 0, y: -1 });
    expect(padVector(press(fakePad(), 13))).toEqual({ x: 0, y: 1 });
  });

  it("moves the highlight to the next card along the row and the column", () => {
    expect(padNearest(grid, 0, 1, 0)).toBe(1);
    expect(padNearest(grid, 1, -1, 0)).toBe(0);
    expect(padNearest(grid, 0, 0, 1)).toBe(5);
    expect(padNearest(grid, 7, 0, -1)).toBe(2);
    expect(padNearest(grid, 12, 1, 0)).toBe(13);
  });

  it("stays put at the edge of the board instead of jumping rows", () => {
    expect(padNearest(grid, 4, 1, 0)).toBe(-1);
    expect(padNearest(grid, 0, -1, 0)).toBe(-1);
    expect(padNearest(grid, 2, 0, -1)).toBe(-1);
    expect(padNearest(grid, 17, 0, 1)).toBe(-1);
  });

  it("polls every frame and presses with A (button 0), clicking the highlighted card", () => {
    expect(page).toContain("requestAnimationFrame(pollPad);");
    expect(page).toMatch(/if \(hit\(0\)\) \{[\s\S]*?el\.click\(\)/);
    expect(page).toContain("cardGrid.querySelectorAll('.card-wrapper')");
    expect(page).toMatch(/try \{ gp = padFirst\(navigator\.getGamepads/);
  });

  it("draws the site's focus ring while the controller drives", () => {
    expect(page).toMatch(/body\.ccs-pad :focus \{[^}]*outline: 3px solid var\(--ink\) !important;[^}]*box-shadow: 0 0 0 6px var\(--sun\) !important;/);
    expect(page).toContain("document.body.classList.add('ccs-pad')");
  });

  it("leaves the start card's how-to text as it was", () => {
    expect(page).toContain("<li>Tap a card (or press Enter) to flip it over.</li>");
  });
});
