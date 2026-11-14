// Maze Quest (games/maze-quest.html) plays with a game controller: in the maze the stick or d-pad
// holds the arrow keys down, Y shows the hint and Start opens the explorer card; on every card the
// stick moves between the buttons, A presses and B goes back. The helpers sit between BEGIN/END
// gamepad markers and touch nothing on the page, so they run here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/maze-quest.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN gamepad */")[1].split("/* END gamepad */")[0];
const { padFirst, padVector, padArrows, padNearest } = new Function(block + "; return { padFirst, padVector, padArrows, padNearest };")();

const fakePad = (over = {}) => ({
  connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), ...over
});
const press = (gp, ...ids) => { for (const i of ids) gp.buttons[i] = { pressed: true, value: 1 }; return gp; };
const held = (a) => Object.keys(a).filter(k => a[k]).sort();
const poll = page.split("function pollPad(now) {")[1].split("\n        }\n")[0];

describe("the Maze Quest controller", () => {
  it("uses the first connected pad", () => {
    const gp = fakePad();
    expect(padFirst([null, gp])).toBe(gp);
    expect(padFirst([])).toBe(null);
  });

  it("turns the d-pad into the arrow keys", () => {
    expect(held(padArrows(padVector(press(fakePad(), 12))))).toEqual(["ArrowUp"]);
    expect(held(padArrows(padVector(press(fakePad(), 13))))).toEqual(["ArrowDown"]);
    expect(held(padArrows(padVector(press(fakePad(), 14))))).toEqual(["ArrowLeft"]);
    expect(held(padArrows(padVector(press(fakePad(), 15))))).toEqual(["ArrowRight"]);
  });

  it("turns the stick into the arrow keys, ignoring a resting stick and walking diagonals", () => {
    expect(held(padArrows(padVector(fakePad({ axes: [0.2, -0.2, 0, 0] }))))).toEqual([]);
    expect(held(padArrows(padVector(fakePad({ axes: [0.9, 0.05, 0, 0] }))))).toEqual(["ArrowRight"]);
    expect(held(padArrows(padVector(fakePad({ axes: [-0.7, -0.7, 0, 0] }))))).toEqual(["ArrowLeft", "ArrowUp"]);
  });

  it("moves between a card's buttons by where they sit", () => {
    // two buttons side by side ("Play on my own", "Race a friend") under a row of explorer picks
    const boxes = [
      { left: 0, top: 0, width: 80, height: 80 }, { left: 90, top: 0, width: 80, height: 80 },
      { left: 0, top: 200, width: 160, height: 48 }, { left: 180, top: 200, width: 160, height: 48 }
    ];
    expect(padNearest(boxes, 0, 1, 0)).toBe(1);
    expect(padNearest(boxes, 0, 0, 1)).toBe(2);
    expect(padNearest(boxes, 2, 1, 0)).toBe(3);
    expect(padNearest(boxes, 3, 0, -1)).toBe(1);
    expect(padNearest(boxes, 3, 1, 0)).toBe(-1);
    expect(padNearest(boxes, 0, 0, -1)).toBe(-1);
  });

  it("keeps to the row: right from Play on my own is Race a friend, not a closer grade button above", () => {
    // as measured on the explorer card: a grade button sits just above and to the right
    const boxes = [
      { left: 900, top: 806, width: 212, height: 48 },   // Play on my own
      { left: 1125, top: 806, width: 187, height: 48 },  // Race a friend
      { left: 1030, top: 740, width: 44, height: 44 }    // a grade button
    ];
    expect(padNearest(boxes, 0, 1, 0)).toBe(1);
    expect(padNearest(boxes, 0, 0, -1)).toBe(2);
  });

  it("only lets go of the arrow keys the controller itself held", () => {
    expect(page).toContain("else if (pad.held[k]) { keys[k] = false; pad.held[k] = false; }");
    expect(page).toMatch(/function padLetGo\(\) \{\s*for \(const k in pad\.held\) if \(pad\.held\[k\]\) \{ keys\[k\] = false; pad\.held\[k\] = false; \}/);
  });

  it("maps A, B, Y and Start", () => {
    expect(poll).toMatch(/if \(hit\(0\)\) \{[\s\S]*?el\.click\(\)/);
    expect(poll).toContain("if (card.id === 'charModal') closePicker();");
    expect(poll).toContain("else if (card.id === 'roomModal') closeRoomCard();");
    expect(poll).toContain("if (hit(3)) $id('hint-button').click();");
    expect(poll).toContain("if (hit(9)) openPicker();");
  });

  it("reaches every card, and polls on its own loop (the maze loop stops at the cabin)", () => {
    for (const id of ["raceModal", "quizModal", "roomModal", "charModal", "winModal", "leaderboardModal"]) expect(page).toContain("'" + id + "'");
    expect(page).toContain("requestAnimationFrame(pollPad);");
    expect(poll).toContain("requestAnimationFrame(pollPad);");
    expect(poll).toMatch(/try \{ gp = padFirst\(navigator\.getGamepads/);
  });

  it("draws the site's focus ring on the cards while the controller drives", () => {
    expect(page).toMatch(/body\.ccs-pad \.modal :focus \{[^}]*outline: 3px solid #1E2226 !important;[^}]*box-shadow: 0 0 0 6px #F5B921 !important;/);
  });
});
