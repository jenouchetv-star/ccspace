import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../games/bounce-and-bank.html", import.meta.url), "utf8");

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

/* the game's controller code, run against a fake page and a fake pad; `with` lets each test change
   shopOpen / isGameOver between frames the way the game does */
function setup(){
  const pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const clicks = [];
  const env = {};
  const btn = (id, x, y) => ({ id, offsetParent: {}, click(){ clicks.push(id); }, focus(){ env.document.activeElement = this; },
    matches(){ return true; }, scrollIntoView(){}, getBoundingClientRect(){ return { left: x, top: y, width: 10, height: 10 }; } });
  const items = [btn("buy25", 0, 0), btn("buy45", 50, 0), btn("buy75", 100, 0)];
  const start = btn("start", 50, 60), deposit = btn("deposit", 50, 60), sound = btn("sound", 200, 200);
  Object.assign(env, {
    shopOpen: false, isGameOver: false, mousePos: { x: 200 }, BALL_RADIUS: 8, drops: 0,
    getCanvasWidth: () => 400, dropBall(){ env.drops++; },
    ballShopModal: { querySelectorAll: () => items.concat(start) }, gameOverScreen: { querySelectorAll: () => [deposit] },
    startRoundBtn: start, depositAndPlayAgainBtn: deposit, soundToggle: sound,
    document: { body: { id: "body" }, activeElement: null },
    navigator: { getGamepads: () => [null, pad] }, now: 1000, performance: { now: () => env.now },
    queueMicrotask: (f) => f()
  });
  env.document.activeElement = env.document.body;
  const src = [line("const PAD_DEAD"), line("const pad = {"), "padMenu", "padList", "padDefault", "padFocus", "padMove", "padPress", "pollPad"]
    .map((s) => s.startsWith("const") ? s : fn(s)).join("\n");
  const api = new Function("env", "with (env) {\n" + src + "\nreturn { pad, pollPad };\n}")(env);
  const frame = (ms = 16) => { env.now += ms; api.pollPad(); };
  return { env, pad, clicks, api, frame, items, start, deposit };
}

describe("Bounce & Bank with a game controller", () => {
  it("is read every frame from the game's own loop, with getGamepads guarded", () => {
    expect(fn("gameLoop")).toMatch(/^function gameLoop\(\) \{\s*pollPad\(\);/);
    expect(fn("pollPad")).toMatch(/try \{ gp = \[\.\.\.\(navigator\.getGamepads/);
  });

  it("moves the ball with the stick or d-pad, scaled by how far the stick is pushed", () => {
    const t = setup();
    t.frame();                                               // the first frame only starts the clock
    t.pad.axes[0] = 1; t.frame(50);
    expect(t.env.mousePos.x).toBeCloseTo(200 + 400 * 0.9 * 0.05);
    const x = t.env.mousePos.x;
    t.pad.axes[0] = -0.5; t.frame(50);
    expect(t.env.mousePos.x).toBeCloseTo(x - 0.5 * 400 * 0.9 * 0.05);
    t.pad.axes[0] = 0.2; const y = t.env.mousePos.x; t.frame(50);
    expect(t.env.mousePos.x).toBe(y);                        // inside the dead zone
    t.pad.axes[0] = 0; t.pad.buttons[14].pressed = true;
    for (let i = 0; i < 40; i++) t.frame(50);
    expect(t.env.mousePos.x).toBe(8);                        // stops at the edge, like the arrow keys
  });

  it("drops one ball per press of A or d-pad down", () => {
    const t = setup();
    t.pad.buttons[0].pressed = true; t.frame(); t.frame(); t.frame();
    expect(t.env.drops).toBe(1);
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.buttons[13].pressed = true; t.frame();
    expect(t.env.drops).toBe(2);
  });

  it("works the ball shop: the first press shows the focus, A buys, B or Start starts the round", () => {
    const t = setup();
    t.env.shopOpen = true;
    t.pad.buttons[0].pressed = true; t.frame();
    expect(t.env.document.activeElement.id).toBe("start");   // the first press only shows where the focus is
    expect(t.clicks).toEqual([]);
    expect(t.env.drops).toBe(0);
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.axes[0] = -1; t.frame();                           // stick left from Start Playing
    expect(t.env.document.activeElement.id).toBe("buy25");
    t.pad.axes[0] = 0; t.frame();
    t.pad.axes[0] = 1; t.frame();
    expect(t.env.document.activeElement.id).toBe("buy45");
    t.pad.axes[0] = 0; t.frame();
    t.pad.buttons[0].pressed = true; t.frame();
    expect(t.clicks).toEqual(["buy45"]);
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.buttons[1].pressed = true; t.frame();
    expect(t.clicks).toEqual(["buy45", "start"]);
    t.pad.buttons[1].pressed = false; t.frame();
    t.pad.buttons[9].pressed = true; t.frame();
    expect(t.clicks).toEqual(["buy45", "start", "start"]);
  });

  it("puts the focus back on Start Playing when a bought ball greys its button out", () => {
    const t = setup();
    t.env.shopOpen = true;
    t.pad.buttons[0].pressed = true; t.frame(); t.pad.buttons[0].pressed = false; t.frame();
    t.env.document.activeElement = t.env.document.body; t.frame();
    expect(t.env.document.activeElement.id).toBe("start");
  });

  it("presses Deposit & Play Again (or Try Again) on the result screen with A or Start, never dropping a ball", () => {
    const t = setup();
    t.env.isGameOver = true;
    t.frame();
    t.pad.buttons[0].pressed = true; t.frame();              // the screen opened: this press shows the focus
    expect(t.env.document.activeElement.id).toBe("deposit");
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.buttons[0].pressed = true; t.frame();
    expect(t.clicks).toEqual(["deposit"]);
    t.pad.buttons[0].pressed = false; t.frame();
    t.pad.buttons[9].pressed = true; t.frame();
    expect(t.clicks).toEqual(["deposit", "deposit"]);
    expect(t.env.drops).toBe(0);
  });

  it("presses buttons just after the frame, so a restart never leaves two game loops running", () => {
    expect(fn("padPress")).toContain("queueMicrotask(() => el.click())");
    expect(fn("pollPad")).not.toMatch(/\.click\(\)/);
  });

  it("leaves the keyboard and mouse controls as they were", () => {
    expect(html).toContain("canvas.addEventListener('click', dropBall);");
    expect(html).toContain("if (e.key === 'ArrowLeft') {");
    expect(html).toContain("<p id=\"instructions\">Use <kbd>&larr;</kbd> <kbd>&rarr;</kbd> keys to move, <kbd>&darr;</kbd> or click to drop!</p>");
  });
});
