// Chike's Gravity 4 plays with a game controller (standard mapping): left / right on the stick or d-pad picks the
// column (with a repeat while held), A or d-pad down drops, Y resets the view, Back goes to the menu; in the menus
// the stick or d-pad moves the focus, A presses, B goes back. The controller block is lifted out of the page and
// run against small stand-ins for the game around it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../supabase/private-games/chikes-gravity-four.html", import.meta.url), "utf8");
const padSrc = "const PAD =" + html.split("const PAD =")[1].split('\nwindow.addEventListener("pointerdown"')[0];

/* a button the fake page can lay out and click */
function el(id, x, y, w = 100, h = 40, calls) {
  return { id, tagName: "BUTTON", getClientRects: () => [1], getBoundingClientRect: () => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }),
    focus() { doc.activeElement = this; }, scrollIntoView() {}, click() { calls.push(["click", id]); } };
}
let doc;

function harness(o = {}) {
  const calls = [];
  const gp = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  /* the main menu: Easy and Smart side by side, the three mode buttons below */
  const menuBtns = [el("lvEasy", 0, 0, 100, 40, calls), el("lvSmart", 110, 0, 100, 40, calls), el("mAi", 0, 60, 210, 50, calls), el("mLocal", 0, 120, 210, 50, calls)];
  const nodes = {};
  ["mMenu", "mOnlineMenu", "mWait", "mWin", "hudBot", "nogl", "bCam", "bMenu", "oBack", "bCancel"].forEach((id) => {
    nodes[id] = { id, hidden: true, click: () => calls.push(["click", id]), querySelectorAll: () => menuBtns };
  });
  nodes.nogl.hidden = true;
  if (o.modal) nodes[o.modal].hidden = false; else nodes.hudBot.hidden = false;
  doc = { activeElement: o.focus === undefined ? menuBtns[2] : o.focus === null ? { id: "body" } : menuBtns[o.focus], body: { classList: { add() {}, remove() {} } } };
  const G = { sel: 3 };
  const env = {
    navigator: { getGamepads: o.throws ? () => { throw new Error("blocked"); } : () => [o.noPad ? null : gp] },
    document: doc,
    $: (id) => nodes[id],
    MODALS: ["mMenu", "mOnlineMenu", "mWait", "mWin"],
    G,
    moveSel: (c) => { G.sel = Math.max(0, Math.min(6, c)); calls.push(["sel", G.sel]); },
    tryDrop: () => calls.push(["drop", G.sel])
  };
  const names = Object.keys(env);
  const P = new Function(...names, padSrc + "\nreturn { pollPad, padMove, PAD };")(...names.map((k) => env[k]));
  const tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) P.pollPad(dt); };
  const press = (i) => { gp.buttons[i].pressed = true; tick(); gp.buttons[i].pressed = false; tick(); };
  return { gp, calls, tick, press, P, G, menuBtns, of: (k) => calls.filter((c) => c[0] === k) };
}

describe("on the board", () => {
  it("d-pad left and right pick the column, one step a press", () => {
    const h = harness();
    h.press(15); h.press(15); h.press(14);
    expect(h.of("sel")).toEqual([["sel", 4], ["sel", 5], ["sel", 4]]);
  });
  it("a held stick steps once, waits, then repeats; a light touch does nothing", () => {
    const h = harness();
    h.gp.axes[0] = 0.4; h.tick(30);
    expect(h.of("sel")).toHaveLength(0);
    h.gp.axes[0] = 1; h.tick(1);
    expect(h.of("sel")).toHaveLength(1);
    h.tick(Math.floor(h.P.PAD.FIRST * 60) - 2);
    expect(h.of("sel")).toHaveLength(1);
    h.tick(4 + Math.ceil(h.P.PAD.REPEAT * 60));
    expect(h.of("sel").length).toBeGreaterThanOrEqual(3);
    h.gp.axes[0] = 0; h.tick();
    const n = h.of("sel").length;
    h.gp.axes[0] = -1; h.tick();
    expect(h.of("sel").length).toBe(n + 1);
  });
  it("A or d-pad down drops; holding A drops only once", () => {
    const h = harness();
    h.gp.buttons[0].pressed = true; h.tick(20); h.gp.buttons[0].pressed = false; h.tick();
    expect(h.of("drop")).toHaveLength(1);
    h.press(13);
    expect(h.of("drop")).toHaveLength(2);
  });
  it("Y resets the view and Back goes to the menu", () => {
    const h = harness();
    h.press(3); h.press(8);
    expect(h.calls).toContainEqual(["click", "bCam"]);
    expect(h.calls).toContainEqual(["click", "bMenu"]);
  });
  it("no controller, or a browser that blocks the Gamepad API, is fine", () => {
    expect(() => harness({ noPad: true }).tick(3)).not.toThrow();
    expect(() => harness({ throws: true }).tick(3)).not.toThrow();
  });
});

describe("in the menus", () => {
  it("A presses the focused button and never drops a chip", () => {
    const h = harness({ modal: "mMenu" });
    h.press(0);
    expect(h.calls).toContainEqual(["click", "mAi"]);
    expect(h.of("drop")).toHaveLength(0);
  });
  it("with nothing focused, A only puts the focus on the first button", () => {
    const h = harness({ modal: "mMenu", focus: null });
    h.press(0);
    expect(h.of("click")).toHaveLength(0);
    expect(doc.activeElement.id).toBe("lvEasy");
  });
  it("the stick and d-pad move the focus to the nearest button that way", () => {
    const h = harness({ modal: "mMenu", focus: 0 });
    h.press(15); expect(doc.activeElement.id).toBe("lvSmart");
    h.press(13); expect(doc.activeElement.id).toBe("mAi");
    h.press(13); expect(doc.activeElement.id).toBe("mLocal");
    h.press(12); h.press(12); expect(doc.activeElement.id).toBe("lvEasy");
    h.press(14); expect(doc.activeElement.id).toBe("lvEasy");
  });
  it("B goes back from the online menu and cancels the wait for a friend", () => {
    const a = harness({ modal: "mOnlineMenu" }); a.press(1);
    expect(a.calls).toContainEqual(["click", "oBack"]);
    const b = harness({ modal: "mWait" }); b.press(1);
    expect(b.calls).toContainEqual(["click", "bCancel"]);
  });
});

describe("the page", () => {
  it("polls the controller from its own animation loop", () => {
    expect(html).toMatch(/function frame\(\)\{[\s\S]{0,200}pollPad\(dt\);/);
  });
  it("shows the keyboard's focus ring when a controller moves the focus", () => {
    expect(html).toContain("body.pad-nav button:focus,body.pad-nav input:focus{outline:3px solid var(--ink)!important");
  });
  it("keeps LF line endings", () => {
    expect(html.includes("\r\n")).toBe(false);
  });
});
