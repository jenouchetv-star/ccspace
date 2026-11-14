import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../games/Doodle-Dash.html", import.meta.url), "utf8");

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

/* pollPad(), padKeys() and padBack() from the game, run against a fake page and a fake pad */
function setup(){
  const pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const log = [];
  const env = {};
  const el = (id, extra) => Object.assign({ id, hidden: false, click(){ log.push("click " + id); }, matches(){ return true; },
    blur(){ if (env.document.activeElement === this) env.document.activeElement = null; } }, extra);
  const page = {
    "#play": el("play"), "#win": el("win", { hidden: true }), "#how": el("how", { hidden: true }), "#sharePanel": el("sharePanel", { hidden: true }),
    "#camBox": el("camBox", { hidden: true }), "#bPlayBack": el("bPlayBack"), "#bMakeBack": el("bMakeBack"), "#bCamX": el("bCamX"),
    "#bDHome": el("bDHome"), "#bBack": el("bBack"), "#bHowX": el("bHowX"), "#bShClose": el("bShClose")
  };
  const make = { id: "make", classList: { contains: () => false } }, hud = { id: "", classList: { contains: (c) => c === "hud" } };
  const demo = el("bDemo"), draw = el("bDraw");
  Object.assign(env, {
    K: { l: 0, r: 0, j: 0 }, $: (s) => page[s], scope: null,
    padScope: () => (env.scope === "bar" ? (env.PAD.bar ? hud : null) : env.scope),
    padList: (s) => (s === hud ? [page["#bPlayBack"]] : [draw, demo]),
    padDefault: (s, list) => (s === make ? demo : list[0]),
    padFocus: (x) => { env.document.activeElement = x; log.push("focus " + x.id); },
    padMove: (list, dx, dy) => log.push("move " + dx + "," + dy),
    requestAnimationFrame: () => 0, document: { activeElement: null }, navigator: { getGamepads: () => [pad, null] }
  });
  const src = [line("const PAD={"), fn("padBack"), fn("padKeys"), fn("pollPad")].join("\n");
  const api = new Function("env", "with (env) {\n" + src + "\nreturn { PAD, pollPad };\n}")(env);
  env.PAD = api.PAD;
  let t = 1000;
  const frame = () => api.pollPad(t += 16);
  const tap = (i) => { pad.buttons[i].pressed = true; frame(); pad.buttons[i].pressed = false; frame(); };
  return { env, pad, log, frame, tap, page, make, demo };
}

describe("Doodle Dash with a game controller", () => {
  it("polls every frame in its own loop, with getGamepads guarded", () => {
    expect(fn("pollPad")).toMatch(/^function pollPad\(t\)\{\n  requestAnimationFrame\(pollPad\);/);
    expect(fn("pollPad")).toContain("try{gp=[...(navigator.getGamepads?navigator.getGamepads():[])]");
    expect(html).toContain("requestAnimationFrame(pollPad);\nshow('home');");
  });

  it("runs with the stick or d-pad and jumps with A or d-pad up, holding the jump while A is held", () => {
    const t = setup();
    t.pad.axes[0] = 0.8; t.frame();
    expect(t.env.K).toMatchObject({ l: 0, r: 1, j: 0 });
    t.pad.axes[0] = 0; t.pad.buttons[14].pressed = true; t.pad.buttons[0].pressed = true; t.frame(); t.frame();
    expect(t.env.K).toMatchObject({ l: 1, r: 0, j: 1 });
    t.pad.buttons[14].pressed = false; t.pad.buttons[0].pressed = false; t.frame();
    expect(t.env.K).toMatchObject({ l: 0, r: 0, j: 0 });
    t.pad.buttons[12].pressed = true; t.frame();
    expect(t.env.K.j).toBe(1);
  });

  it("only writes a key when the pad changes, so held keyboard keys keep working", () => {
    const t = setup();
    t.frame();
    t.env.K.r = 1;                                           // the right arrow, held on the keyboard
    t.frame(); t.frame();
    expect(t.env.K.r).toBe(1);
  });

  it("the A that pressed a menu button doesn't also jump when the run starts", () => {
    const t = setup();
    t.env.scope = t.make; t.env.document.activeElement = t.demo;
    t.pad.buttons[0].pressed = true; t.frame();
    expect(t.log).toContain("click bDemo");
    t.env.scope = null; t.frame(); t.frame();               // the level is up and A is still down
    expect(t.env.K.j).toBe(0);
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.buttons[0].pressed = true; t.frame();
    expect(t.env.K.j).toBe(1);
  });

  it("on a menu the first A only shows the focus; the next one presses it", () => {
    const t = setup();
    t.env.scope = t.make; t.frame();
    t.tap(0);
    expect(t.log).toEqual(["focus bDemo"]);
    t.tap(0);
    expect(t.log).toEqual(["focus bDemo", "click bDemo"]);
  });

  it("B goes back a screen, closing the camera first", () => {
    const t = setup();
    t.env.scope = t.make; t.frame();
    t.page["#camBox"].hidden = false; t.tap(1);
    t.page["#camBox"].hidden = true; t.tap(1);
    expect(t.log).toEqual(["click bCamX", "click bMakeBack"]);
  });

  it("Start moves the focus up to the top bar and back down to the run", () => {
    const t = setup();
    t.env.scope = "bar";
    t.tap(9);
    expect(t.env.PAD.bar).toBe(true);
    expect(t.env.document.activeElement.id).toBe("bPlayBack");
    t.pad.axes[0] = 1; t.frame();
    expect(t.env.K.r).toBe(0);                               // the run stands still while the bar has the focus
    t.pad.axes[0] = 0; t.frame();
    t.tap(9);
    expect(t.env.PAD.bar).toBe(false);
    expect(t.env.document.activeElement).toBe(null);
  });

  it("leaves the keyboard, touch pad and help text as they were", () => {
    expect(html).toContain("const km={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',' ':'j',ArrowUp:'j',w:'j',W:'j'};");
    expect(html).toContain("Arrow keys or A/D to move, Space or W to jump.");
  });
});
