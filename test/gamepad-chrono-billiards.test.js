// Chrono Billiards plays with a game controller (standard mapping): the left stick points the shot, the d-pad or
// right stick turns it a degree at a time, the right trigger squeezes the speed and letting go shoots, a tap of A
// shoots and a held A charges the speed. Menus move by focus. The speed helpers live in the page's pure block;
// pollPad() is lifted out of the page and run against small stand-ins for the game around it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/chrono-billiards.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(block + "; return { PAD, MAX_LEVEL, padDead, triggerLevel, releaseLevel, chargeLevel };")();
const pollSrc = "function pollPad(dt){" + page.split("function pollPad(dt){")[1].split("\n  addEventListener(")[0];

/* a fake controller: 17 buttons and four axes, all at rest */
function makePad() {
  return { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}

/* runs the page's pollPad() with the game around it swapped for a small recorder */
function harness(o = {}) {
  const gp = makePad();
  const calls = [];
  let now = 1000;
  const st = { screen: o.screen || "game", aim: { on: !!o.aimOn, deg: o.deg || 0, level: o.level || 0 }, pred: null, hints: true };
  const focused = { id: "focused", click: () => calls.push(["click", "focused"]) };
  const scope = o.menu ? { id: o.menu } : null;
  const doc = { activeElement: focused, body: { classList: { add: () => {}, remove: () => {} } } };
  const env = {
    navigator: { getGamepads: o.throws ? () => { throw new Error("blocked"); } : () => [o.noPad ? null : gp, null, null, null] },
    document: doc,
    performance: { now: () => now },
    pad: { prev: [], nav: 0, rep: 0, fine: 0, hist: [], rt: false, a: null },
    padScope: () => scope,
    padFocusables: () => [focused],
    padMove: (s, dx, dy) => calls.push(["move", dx, dy]),
    resume: () => calls.push(["resume"]),
    pause: () => calls.push(["pause"]),
    $: (id) => ({ id, hidden: false, disabled: false, click: () => calls.push(["click", id]) }),
    st,
    setHints: (on) => calls.push(["hints", on]),
    canAim: () => o.canAim !== false,
    padAimDeg: () => (o.stickDeg === undefined ? 90 : o.stickDeg),
    padAim: (deg, level) => { st.aim.on = true; st.aim.deg = ((Math.round(deg) % 360) + 360) % 360; st.aim.level = level; calls.push(["aim", st.aim.deg, level]); },
    setStep: () => {},
    isDuo: () => false,
    sendAim: () => {},
    fire: () => { calls.push(["fire", st.aim.deg, st.aim.level]); st.aim.on = false; }
  };
  const names = Object.keys(env);
  const pollPad = new Function(...names, "PAD", "padDead", "triggerLevel", "releaseLevel", "chargeLevel", "MAX_LEVEL", pollSrc + "\nreturn pollPad;")(
    ...names.map((k) => env[k]), R.PAD, R.padDead, R.triggerLevel, R.releaseLevel, R.chargeLevel, R.MAX_LEVEL);
  const tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { now += dt * 1000; pollPad(dt); } };
  return { gp, calls, st, tick, fires: () => calls.filter((c) => c[0] === "fire") };
}

describe("the speed helpers", () => {
  it("the trigger is speed 1 for a light squeeze and 10 all the way, 0 at rest", () => {
    expect(R.triggerLevel(0)).toBe(0);
    expect(R.triggerLevel(0.05)).toBe(0);
    expect(R.triggerLevel(0.1)).toBe(1);
    expect(R.triggerLevel(0.7)).toBe(7);
    expect(R.triggerLevel(1)).toBe(R.MAX_LEVEL);
  });
  it("letting go keeps the strongest squeeze of the last moment, not the spring back", () => {
    const hist = [{ t: 0, level: 9 }, { t: 0.5, level: 6 }, { t: 0.6, level: 6 }, { t: 0.65, level: 3 }];
    expect(R.releaseLevel(hist, 0.7, 0.15)).toBe(6);
    expect(R.releaseLevel([{ t: 1, level: 10 }, { t: 1.05, level: 4 }], 1.1, 0.15)).toBe(10);
    expect(R.releaseLevel([], 1, 0.15)).toBe(0);
  });
  it("holding A charges 1 up to 10 and back down to 1, round and round", () => {
    const P = R.PAD.CHARGE;
    expect(R.chargeLevel(0, P)).toBe(1);
    expect(R.chargeLevel(P, P)).toBe(R.MAX_LEVEL);
    expect(R.chargeLevel(2 * P, P)).toBe(1);
    for (let t = 0; t < P; t += 0.05) expect(R.chargeLevel(t + 0.05, P)).toBeGreaterThanOrEqual(R.chargeLevel(t, P));
  });
  it("the dead zone ignores a resting stick", () => {
    expect(R.padDead(0.2, 0.25)).toBe(0);
    expect(R.padDead(-0.6, 0.25)).toBe(-0.6);
  });
});

describe("pollPad on the table", () => {
  it("the left stick points the shot, keeping speed 5 when none is set yet", () => {
    const h = harness();
    h.gp.axes[0] = 0; h.gp.axes[1] = -1; h.tick();
    expect(h.calls).toContainEqual(["aim", 90, 5]);
    expect(h.fires()).toHaveLength(0);
  });
  it("the d-pad turns a degree a press (right turns clockwise, like the arrow keys) and changes the speed", () => {
    const h = harness({ aimOn: true, deg: 40, level: 5 });
    h.gp.buttons[15].pressed = true; h.tick(); h.gp.buttons[15].pressed = false; h.tick();
    expect(h.st.aim.deg).toBe(39);
    h.gp.buttons[14].pressed = true; h.tick(); h.gp.buttons[14].pressed = false; h.tick();
    h.gp.buttons[14].pressed = true; h.tick(); h.gp.buttons[14].pressed = false; h.tick();
    expect(h.st.aim.deg).toBe(41);
    h.gp.buttons[12].pressed = true; h.tick(); h.gp.buttons[12].pressed = false; h.tick();
    expect(h.st.aim.level).toBe(6);
  });
  it("the right trigger sets the speed and shoots on release at the squeeze, not the spring back", () => {
    const h = harness({ aimOn: true, deg: 30, level: 5 });
    const rt = h.gp.buttons[7];
    rt.pressed = true; rt.value = 0.7; h.tick(10);
    expect(h.st.aim.level).toBe(7);
    rt.value = 0.3; h.tick();
    rt.value = 0; rt.pressed = false; h.tick();
    expect(h.fires()).toEqual([["fire", 30, 7]]);
  });
  it("a tap of A shoots at the speed on show; with no aim yet it only shows the aim", () => {
    const h = harness({ aimOn: true, deg: 10, level: 4 });
    h.gp.buttons[0].pressed = true; h.tick(3); h.gp.buttons[0].pressed = false; h.tick();
    expect(h.fires()).toEqual([["fire", 10, 4]]);
    const g = harness();
    g.gp.buttons[0].pressed = true; g.tick(3); g.gp.buttons[0].pressed = false; g.tick();
    expect(g.fires()).toHaveLength(0);
    expect(g.st.aim.on).toBe(true);
  });
  it("holding A charges the speed and letting go shoots; B while charging calls it off", () => {
    const h = harness({ aimOn: true, deg: 0, level: 2 });
    h.gp.buttons[0].pressed = true; h.tick(60);
    expect(h.st.aim.level).toBeGreaterThan(2);
    const charged = h.st.aim.level;
    h.gp.buttons[0].pressed = false; h.tick();
    expect(h.fires()).toEqual([["fire", 0, charged]]);

    const b = harness({ aimOn: true, deg: 0, level: 2 });
    b.gp.buttons[0].pressed = true; b.tick(60);
    b.gp.buttons[1].pressed = true; b.tick(); b.gp.buttons[1].pressed = false;
    b.gp.buttons[0].pressed = false; b.tick(3);
    expect(b.fires()).toHaveLength(0);
    expect(b.st.aim.level).toBe(2);
  });
  it("Start pauses and Y switches the hints", () => {
    const h = harness();
    h.gp.buttons[3].pressed = true; h.tick(); h.gp.buttons[3].pressed = false; h.tick();
    expect(h.calls).toContainEqual(["hints", false]);
    h.gp.buttons[9].pressed = true; h.tick();
    expect(h.calls).toContainEqual(["pause"]);
  });
  it("nothing aims or shoots while the balls roll", () => {
    const h = harness({ canAim: false, aimOn: true, level: 5 });
    h.gp.buttons[0].pressed = true; h.tick(3); h.gp.buttons[0].pressed = false; h.tick();
    h.gp.axes[0] = 1; h.tick();
    expect(h.calls.filter((c) => c[0] === "aim" || c[0] === "fire")).toHaveLength(0);
  });
  it("no controller, or a browser that blocks the Gamepad API, is fine", () => {
    expect(() => harness({ noPad: true }).tick(3)).not.toThrow();
    expect(() => harness({ throws: true }).tick(3)).not.toThrow();
  });
});

describe("pollPad in the menus", () => {
  it("A presses the focused button and the stick moves the focus with a repeat delay", () => {
    const h = harness({ screen: "title", menu: "title" });
    h.gp.buttons[0].pressed = true; h.tick(); h.gp.buttons[0].pressed = false; h.tick();
    expect(h.calls).toContainEqual(["click", "focused"]);
    h.gp.axes[1] = 1; h.tick(6);
    expect(h.calls.filter((c) => c[0] === "move")).toEqual([["move", 0, 1]]);
    h.tick(10);
    expect(h.calls.filter((c) => c[0] === "move").length).toBe(2);
  });
  it("B and Start leave the pause menu; B closes the Play a friend dialog", () => {
    const p = harness({ menu: "pause" });
    p.gp.buttons[1].pressed = true; p.tick();
    expect(p.calls).toContainEqual(["resume"]);
    const s = harness({ menu: "pause" });
    s.gp.buttons[9].pressed = true; s.tick();
    expect(s.calls).toContainEqual(["resume"]);
    const r = harness({ screen: "title", menu: "room" });
    r.gp.buttons[1].pressed = true; r.tick();
    expect(r.calls).toContainEqual(["click", "room-close"]);
  });
});

describe("the page", () => {
  it("polls the controller from its own animation loop", () => {
    expect(page).toMatch(/function frame\(now\)\{[\s\S]{0,200}pollPad\(dt\);/);
  });
  it("shows the keyboard's focus ring when a controller moves the focus", () => {
    expect(page).toContain("body.pad-nav button:focus,body.pad-nav input:focus{outline:3px solid var(--ink) !important");
  });
  it("keeps its CRLF line endings throughout (no mixed endings)", () => {
    const lines = page.split("\n");
    expect(lines.slice(0, -1).every((l) => l.endsWith("\r"))).toBe(true);
  });
});
