import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Fruit Drop (the file and its ids still say drop-blox) */
const html = readFileSync(new URL("../games/drop-blox.html", import.meta.url), "utf8");

/* the whole source of one function, found by matching its braces */
function fn(name){
  const i = html.indexOf("function " + name + "(");
  if (i < 0) throw new Error("no function " + name);
  for (let k = html.indexOf("{", i), d = 0; k < html.length; k++){
    if (html[k] === "{") d++;
    else if (html[k] === "}" && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error("unbalanced " + name);
}
const line = (start) => html.slice(html.indexOf(start), html.indexOf("\n", html.indexOf(start)));

/* pollPad() and padHold() from the game, with the game's own functions swapped for recorders */
function setup(mode){
  const pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const log = [];
  const env = {};
  const btn = (id) => ({ id, click(){ log.push("click " + id); }, matches(){ return true; } });
  const go = btn("go"), levels = btn("levels");
  Object.assign(env, {
    S: { mode: mode || "play", g: {}, busy: false, level: 4 },
    cardWrap: { id: "card" }, titleEl: { id: "title" }, scope: null,
    padScope: () => env.scope, padList: () => [go, levels], padDefault: () => go,
    padFocus: (el) => { env.document.activeElement = el; log.push("focus " + el.id); },
    padMove: (list, dx, dy) => log.push("move " + dx + "," + dy),
    act: (a) => log.push(a), pause: () => log.push("pause"), resume: () => log.push("resume"),
    closeCard: () => {}, startLevel: (n) => log.push("restart " + n), showTitle: () => log.push("levels"),
    $: () => ({ open: false }),
    document: { activeElement: null },
    navigator: { getGamepads: () => [pad] }
  });
  const src = [line("var PAD = {"), fn("padHold"), fn("pollPad")].join("\n");
  const api = new Function("env", "with (env) {\n" + src + "\nreturn { PAD, pollPad };\n}")(env);
  const frame = (dt = 1 / 60) => api.pollPad(dt);
  const tap = (i) => { pad.buttons[i].pressed = true; frame(); pad.buttons[i].pressed = false; frame(); };
  return { env, pad, log, frame, tap, go, levels };
}

describe("Fruit Drop with a game controller", () => {
  it("is read every frame from the game's own loop, with getGamepads guarded", () => {
    expect(fn("frame")).toContain("pollPad(dt);\n  requestAnimationFrame(frame);");
    expect(fn("pollPad")).toMatch(/try \{ gp = \[\]\.slice\.call\(navigator\.getGamepads/);
  });

  it("moves once per tap, and keeps moving while the stick or d-pad is held, like the on-screen buttons", () => {
    const t = setup();
    t.tap(14);
    expect(t.log).toEqual(["left"]);
    t.log.length = 0;
    t.pad.axes[0] = 0.9;
    for (let i = 0; i < 30; i++) t.frame(0.01);              // 0.3 s: once now, again after 0.19 s, again 0.085 s later
    expect(t.log).toEqual(["right", "right", "right"]);
    t.pad.axes[0] = 0.3; t.log.length = 0; t.frame();        // a light push is not a move
    expect(t.log).toEqual([]);
  });

  it("turns with A, up, or RB; turns back with B or LB; speeds down; drops with X, Y or RT", () => {
    const t = setup();
    t.tap(0); t.tap(12); t.tap(5); t.tap(1); t.tap(4); t.tap(13); t.tap(2); t.tap(3);
    t.pad.buttons[7].value = 0.8; t.frame(); t.frame(); t.pad.buttons[7].value = 0; t.frame();
    expect(t.log).toEqual(["turn", "turn", "turn", "back", "back", "down", "drop", "drop", "drop"]);
  });

  it("uses the stick's stronger direction, so pushing sideways never turns the piece", () => {
    const t = setup();
    t.pad.axes[0] = -0.9; t.pad.axes[1] = -0.6; t.frame();
    expect(t.log).toEqual(["left"]);
  });

  it("pauses with Start and restarts with Back", () => {
    const t = setup();
    t.tap(9); t.tap(8);
    expect(t.log).toEqual(["pause", "restart 4"]);
  });

  it("on a card: the first A only shows the focus, the next presses it, and the stick moves it", () => {
    const t = setup("won");
    t.env.scope = t.env.cardWrap;
    t.tap(0);
    expect(t.log).toEqual(["focus go"]);
    t.tap(0);
    expect(t.log).toEqual(["focus go", "click go"]);
    t.pad.buttons[15].pressed = true; t.frame();
    expect(t.log.at(-1)).toBe("move 1,0");
  });

  it("B goes back: out of pause it keeps playing, from a result card it opens the levels", () => {
    const p = setup("paused"); p.env.scope = p.env.cardWrap;
    p.tap(1); p.tap(9);
    expect(p.log).toEqual(["resume", "resume"]);
    const w = setup("lost"); w.env.scope = w.env.cardWrap;
    w.tap(1);
    expect(w.log).toEqual(["levels"]);
  });

  it("leaves the keys, the on-screen pad and the Keys list alone", () => {
    expect(html).toContain('var map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "turn", z: "turn", Z: "turn", x: "back", X: "back", ArrowDown: "down", " ": "drop" };');
    expect(html).toContain("<li><kbd>&uarr;</kbd> <kbd>Z</kbd></li><li>Turn</li>");
  });
});
