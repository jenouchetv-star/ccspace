// Bolt's Obstacle Course: the logic (owner spec 2026-11-28, section 6.7: these must pass before UI work).
// assets/lib/boltCourse.js is a classic script; it is run here against a stub window.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/lib/boltCourse.js", import.meta.url), "utf8");
const root = {};
new Function("window", "globalThis", src)(root, root);
const B = root.BoltCourse;
const LEVELS = JSON.parse(readFileSync(new URL("../assets/games/bolt-course/levels.json", import.meta.url), "utf8")).levels;
const level = (id) => LEVELS.find((l) => l.id === id);
let n = 0;
const blk = (type, extra) => Object.assign({ id: "b" + (++n), type }, extra || {});
const walk = (dir = "right") => blk("walk", { dir });
const prog = (main, myBlocks = {}) => ({ main, myBlocks });
const flat = { grid: { width: 14, height: 8 }, start: { x: 1, y: 6, facing: "right", mode: "legs" }, goal: { x: 6, y: 6 }, obstacles: [], pickups: [] };

describe("the interpreter", () => {
  it("a repeat block with 3 iterations runs its body 3 times", () => {
    const r = B.runAll(flat, prog([blk("repeat", { times: 3, body: [walk()] })]));
    expect(r.actions).toHaveLength(3);
    expect(r.world.x).toBe(4);
  });
  it("repeat until stops when the condition comes true", () => {
    const r = B.runAll(flat, prog([blk("repeat_until", { cond: "at_goal", body: [walk()] })]));
    expect(r.state).toBe("won");
    expect(r.actions).toHaveLength(5);
  });
  it("repeat until that never comes true stops at the cap with loop_never_ends", () => {
    const loop = blk("repeat_until", { cond: "at_goal", body: [blk("wait", { ticks: 1 })] });
    const r = B.runAll(flat, prog([loop]));
    expect(r.state).toBe("failed");
    expect(r.error.reason).toBe("loop_never_ends");
    expect(r.error.blockId).toBe(loop.id);
    expect(r.error.message).toBe("This loop never stopped. What should Bolt look for to stop?");
  });
  it("if / else takes the right branch", () => {
    const lv = level("w1-l2");                                // a crate two tiles ahead of x 3
    const ifBlock = blk("if", { cond: "crate_ahead", then: [blk("jump", { dir: "right" })], else: [walk()] });
    const r1 = B.runAll(lv, prog([walk(), walk(), ifBlock]));   // at x 3, the crate is ahead: jump
    expect(r1.actions[2].at.x).toBe(4);
    expect(r1.world.y).toBe(4);                               // on top of the 2 ft crate
    const r2 = B.runAll(flat, prog([blk("if", { cond: "crate_ahead", then: [blk("jump", { dir: "right" })], else: [walk()] })]));
    expect(r2.actions[0].at).toMatchObject({ x: 2, y: 6 });    // no crate: walk
  });
  it("a My block calling itself more than 8 deep stops with too_deep", () => {
    const r = B.runAll(flat, prog([blk("call", { name: "hop" })], { hop: [blk("call", { name: "hop" })] }));
    expect(r.error.reason).toBe("too_deep");
    expect(r.error.message).toBe("My block is calling itself too much!");
  });
  it("a missing My block says so", () => {
    expect(B.runAll(flat, prog([blk("call", { name: "nope" })])).error.reason).toBe("missing_block");
  });
  it("too many steps stops with a kind message", () => {
    const r = B.runAll(flat, prog([blk("repeat", { times: 600, body: [blk("wait", { ticks: 1 })] })]));
    expect(r.error.reason).toBe("too_many_steps");
    expect(r.error.message).toBe("Bolt got tired! Try a shorter program or use a loop.");
  });
  it("runs the same way twice with the same level and program", () => {
    const lv = level("w1-l3");
    const a = B.runAll(lv, lv.sampleProgram), b = B.runAll(lv, lv.sampleProgram);
    expect(a.actions).toEqual(b.actions);
    expect(a.state).toBe(b.state);
  });
  it("hands out one step at a time (pausable), so the game can animate and highlight each block", () => {
    const w = new B.World(flat);
    const loop = blk("repeat", { times: 2, body: [walk()] });
    const gen = B.run([loop], prog([loop]), w);
    const first = gen.next();
    expect(first.value).toEqual({ kind: "highlight", blockId: loop.id });
    const second = gen.next();
    expect(second.value.kind).toBe("action");
    expect(w.x).toBe(1);                                      // nothing moved until the game performs it
  });
});

describe("Bolt's moves", () => {
  it("a jump into a 3 ft wall fails with jump_too_short", () => {
    const lv = { ...flat, obstacles: [{ type: "wall", x: 2, y: 6, heightFt: 3 }] };
    const r = B.runAll(lv, prog([blk("jump", { dir: "right" })]));
    expect(r.error.reason).toBe("jump_too_short");
    expect(r.error.message).toBe("My jump only goes 2 feet. What else can I try?");
  });
  it("wheels on stairs fails with wheels_on_stairs", () => {
    const lv = level("w1-l6");
    const r = B.runAll(lv, prog([blk("mode", { mode: "wheels" }), walk(), walk(), blk("stairs")]));
    expect(r.error.reason).toBe("wheels_on_stairs");
    expect(r.error.message).toBe("Wheels can't climb stairs. Switch to legs!");
  });
  it("the battery never goes below 0", () => {
    const lv = { ...flat, start: { ...flat.start, battery: 2 } };
    const r = B.runAll(lv, prog([blk("fly", { feet: 5 })]));
    expect(r.error.reason).toBe("low_battery");
    expect(r.world.battery).toBe(2);
    const r2 = B.runAll(lv, prog([blk("rocket"), blk("rocket"), blk("rocket")]));
    expect(r2.error.reason).toBe("low_battery");
    expect(r2.world.battery).toBe(0);
  });
  it("walking into a gap is a friendly fall, never a game over", () => {
    const r = B.runAll(level("w1-l4"), prog([walk(), walk(), walk(), walk()]));
    expect(r.state).toBe("failed");
    expect(r.error.reason).toBe("fell");
  });
  it("a battery pickup restores 3, up to full", () => {
    const lv = { ...flat, start: { ...flat.start, battery: 4 }, pickups: [{ type: "battery", x: 3, y: 6 }] };
    const r = B.runAll(lv, prog([walk(), walk()]));
    expect(r.world.battery).toBe(7);
  });
  it("legs are slow on a ramp (two walks a tile); wheels roll up", () => {
    const lv = level("w1-l5");
    const legs = B.runAll(lv, prog([walk(), walk(), walk(), walk()]));
    expect(legs.world.x).toBe(4);
    expect(legs.world.y).toBe(5);
    const wheels = B.runAll(lv, prog([blk("mode", { mode: "wheels" }), walk(), walk(), walk(), walk()]));
    expect(wheels.world.x).toBe(5);
    expect(wheels.world.y).toBe(4);
  });
});

describe("Phase 1 levels", () => {
  it("are the seven from the spec, one new ability each", () => {
    expect(LEVELS.map((l) => l.newAbility)).toEqual(["walk", "jump", "propeller", "rocket", "wheels", "stairs", "ladder"]);
  });
  for (const lv of LEVELS) {
    it(lv.id + " \"" + lv.title + "\" can be finished with its sample program, within its slots", () => {
      const r = B.runAll(lv, lv.sampleProgram);
      expect(r.error && r.error.message).toBeFalsy();
      expect(r.state).toBe("won");
      expect(B.countBlocks(lv.sampleProgram.main)).toBeLessThanOrEqual(lv.maxSlots);
      for (const b of lv.sampleProgram.main) expect(lv.allowedBlocks).toContain(b.type);
    });
  }
});

describe("the Python preview (Inventors)", () => {
  it("writes loops, ifs and My blocks as simple Python, one line per block", () => {
    const p = prog([blk("repeat", { times: 5, body: [blk("jump", { dir: "right" })] }), blk("if", { cond: "wall_ahead", then: [blk("fly", { feet: 4 })], else: [walk()] }), blk("call", { name: "hop_crate" })],
      { hop_crate: [blk("jump", { dir: "right" }), walk()] });
    const text = B.toPython(p).map((l) => l.text).join("\n");
    expect(text).toBe([
      "def hop_crate():", "    jump(\"right\")", "    walk_right()", "",
      "for i in range(5):", "    jump(\"right\")",
      "if wall_ahead():", "    fly_up(4)", "else:", "    walk_right()",
      "hop_crate()"
    ].join("\n"));
  });
});
