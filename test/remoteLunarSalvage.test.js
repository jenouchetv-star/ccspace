// Remote Lunar Salvage is a subscribers-only 3D game (supabase/private-games/remote-lunar-salvage.html): kids drive a
// Moon rover, switch between Drive, Arm and Magnet, and fix an outpost. Its science and rules (which tool lifts
// which material, Moon gravity, the trench and bridge, the arm's reach, what fits where, the mission's steps) sit
// between BEGIN/END pure markers so they can be tested here without a browser. The phone remote
// (games/lunar-salvage-remote.html) has its own pure block for turning phone tilt into controls.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8");
const remote = readFileSync(new URL("../games/lunar-salvage-remote.html", import.meta.url), "utf8");
const pure = (src) => src.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const S = new Function(pure(game) + "; return { MOON_G, EARTH_G, LIFT_KG, SCRAP_TOTAL, ARM, ROVER, TRENCH, BRIDGE, WORLD, ROT_STEP, SNAP, MATERIALS, PART_TYPES, TARGET_ACCEPTS, NOTES, STEPS, QUIZ, angDiff, angDiffMod, earthFeelKg, fallTime, formatTime, magnetCheck, clawCheck, scanChips, bestTool, groundHeight, overTrench, onBridgeDeck, canDriveTo, driveStep, armLocal, toWorld, minPitchFor, fitCheck, currentStep, starsFor, makeCode, readCode };")();
const T = new Function(pure(remote) + "; return { wrapDeg, shapeAxis, learnLR, learnFB, tiltAxes, readCode };")();

describe("the science is real", () => {
  it("uses the real gravity of the Moon and Earth", () => {
    expect(S.MOON_G).toBe(1.62);
    expect(S.EARTH_G).toBe(9.81);
    expect(S.MOON_G / S.EARTH_G).toBeCloseTo(1 / 6, 1);
  });
  it("drops take longer on the Moon, and the note's numbers match", () => {
    expect(S.fallTime(1, S.MOON_G)).toBeCloseTo(1.11, 2);
    expect(S.fallTime(1, S.EARTH_G)).toBeLessThan(0.5);
    const note = S.NOTES.find((n) => n.id === "gravity").text;
    expect(note).toContain("1.62");
    expect(note).toContain("1.1 seconds");
  });
  it("tells how heavy a part feels compared to Earth", () => {
    expect(S.earthFeelKg(60)).toBeCloseTo(9.9, 1);
    expect(S.earthFeelKg(45)).toBeCloseTo(7.4, 1);
  });
  it("only steel is magnetic", () => {
    expect(S.MATERIALS.steel.magnetic).toBe(true);
    for (const m of ["aluminum", "glass", "plastic"]) expect(S.MATERIALS[m].magnetic).toBe(false);
  });
});

describe("tool choice is a puzzle", () => {
  it("the magnet lifts steel, never aluminum, glass or plastic", () => {
    expect(S.magnetCheck("scrap").ok).toBe(true);
    expect(S.magnetCheck("panel").ok).toBe(true);
    for (const t of ["block", "tube", "wedge", "glass", "cell"]) expect(S.magnetCheck(t)).toEqual({ ok: false, why: "nomag" });
  });
  it("the claw holds parts but not the wide panel or anything too heavy", () => {
    for (const t of ["scrap", "block", "tube", "wedge", "glass", "cell"]) expect(S.clawCheck(t).ok).toBe(true);
    expect(S.clawCheck("panel")).toEqual({ ok: false, why: "wide" });
    expect(S.clawCheck("drill")).toEqual({ ok: false, why: "heavy" });
  });
  it("each tool has a job only it can do, and some things neither can", () => {
    const best = Object.keys(S.PART_TYPES).filter((t) => t !== "lever").map((t) => S.bestTool(t));
    expect(best).toContain("magnet");
    expect(best).toContain("claw");
    expect(best).toContain("either");
    expect(S.bestTool("panel")).toBe("magnet");
    expect(S.bestTool("cell")).toBe("claw");
    expect(S.bestTool("drill")).toBe("none");
  });
  it("a scan shows the material and the clue that matters", () => {
    const text = (t) => S.scanChips(t).map((c) => c.text);
    expect(text("scrap")).toEqual(["Steel", "Magnetic"]);
    expect(text("block")).toEqual(["Aluminum", "Not magnetic"]);
    expect(text("panel")).toContain("Too wide for the claw");
    expect(text("drill")).toContain("Too heavy");
    expect(text("glass")).toContain("Brittle");
  });
});

describe("field notes and the quiz", () => {
  it("has eight notes, and every one can be found", () => {
    expect(S.NOTES).toHaveLength(8);
    const fromParts = new Set(Object.values(S.PART_TYPES).map((t) => t.note).filter(Boolean));
    for (const n of S.NOTES) expect(n.id === "gravity" || fromParts.has(n.id)).toBe(true);
    for (const n of S.NOTES) expect(n.hint.length).toBeGreaterThan(10);
  });
  it("says plainly that the sounds are pretend", () => {
    expect(S.NOTES.find((n) => n.id === "radio").text).toMatch(/sounds in this game are pretend/);
  });
  it("each quiz question has one right answer that the notes teach", () => {
    expect(S.QUIZ).toHaveLength(3);
    for (const q of S.QUIZ){ expect(q.opts).toHaveLength(3); expect(q.a).toBeGreaterThanOrEqual(0); expect(q.a).toBeLessThan(3); }
    expect(S.QUIZ[0].opts[S.QUIZ[0].a]).toMatch(/steel/i);
    expect(S.QUIZ[1].opts[S.QUIZ[1].a]).toMatch(/slower/);
    expect(S.QUIZ[2].opts[S.QUIZ[2].a]).toMatch(/triangle/);
  });
});

describe("the ground, the trench and the bridge", () => {
  it("is nearly flat where the rover starts and deep in the trench", () => {
    expect(Math.abs(S.groundHeight(0, 12))).toBeLessThan(0.3);
    expect(S.groundHeight(0, S.TRENCH.z)).toBeCloseTo(S.TRENCH.depth, 5);
    expect(S.overTrench(0, S.TRENCH.z)).toBe(true);
  });
  it("keeps the rover out of the trench until the bridge is level", () => {
    expect(S.canDriveTo(0, 12, "folded")).toBe(true);
    expect(S.canDriveTo(0, S.TRENCH.z, "folded")).toBe(false);
    expect(S.canDriveTo(0, S.TRENCH.z, "sag")).toBe(false);
    expect(S.canDriveTo(0, S.TRENCH.z, "level")).toBe(true);
    expect(S.canDriveTo(S.BRIDGE.half + 0.1, S.TRENCH.z, "level")).toBe(false);
    expect(S.canDriveTo(S.WORLD.x + 1, 0, "level")).toBe(false);
  });
  it("lets parts rest on the bridge deck only once it is level", () => {
    expect(S.onBridgeDeck(0, S.TRENCH.z, "level")).toBe(true);
    expect(S.onBridgeDeck(0, S.TRENCH.z, "sag")).toBe(false);
  });
});

describe("driving", () => {
  const run = (thr, steer, secs, s) => { s = s || { x: 0, z: 0, yaw: 0, v: 0 }; for (let i = 0; i < secs * 60; i++) s = S.driveStep(s, thr, steer, 1 / 60); return s; };
  it("forward goes toward -z at the top speed, smoothly", () => {
    const s = run(1, 0, 3);
    expect(s.v).toBeCloseTo(S.ROVER.maxF, 3);
    expect(s.z).toBeLessThan(-5);
    expect(Math.abs(s.x)).toBeLessThan(1e-9);
    expect(run(1, 0, 0.5).v).toBeLessThan(S.ROVER.maxF);
  });
  it("letting go brakes to a stop in under a second", () => {
    expect(run(0, 0, 0.7, run(1, 0, 3)).v).toBe(0);
  });
  it("steering right turns clockwise, even standing still", () => {
    expect(run(0, 1, 1).yaw).toBeLessThan(0);
    expect(run(0, -1, 1).yaw).toBeGreaterThan(0);
  });
  it("reverses more slowly than it drives forward", () => {
    expect(run(-1, 0, 4).v).toBeCloseTo(-S.ROVER.maxB, 3);
  });
});

describe("the arm", () => {
  it("points forward at yaw 0 and backward at half a turn", () => {
    const f = S.armLocal({ yaw: 0, pitch: 0, reach: 2 });
    expect(f.x).toBeCloseTo(0, 9); expect(f.z).toBeCloseTo(S.ARM.mountZ - 2, 9); expect(f.y).toBeCloseTo(S.ARM.mountY, 9);
    const b = S.armLocal({ yaw: Math.PI, pitch: 0, reach: 2 });
    expect(b.z).toBeCloseTo(S.ARM.mountZ + 2, 9);
  });
  it("can swing over its own cargo bed", () => {
    const t = S.armLocal({ yaw: Math.PI, pitch: 0.2, reach: S.ARM.reachMin + 0.05 });
    expect(Math.hypot(t.x - S.ROVER.bed.x, t.z - S.ROVER.bed.z)).toBeLessThan(0.5);
  });
  it("turns with the rover in the world", () => {
    const w = S.toWorld({ x: 5, z: 5, yaw: Math.PI / 2, y: 0 }, { x: 0, y: 0, z: -1 });
    expect(w.x).toBeCloseTo(4, 9); expect(w.z).toBeCloseTo(5, 9);
  });
  it("never lets the claw dip below the floor", () => {
    const reach = 3, mountY = S.ARM.mountY, floor = 0.4;
    const p = S.minPitchFor(reach, mountY, floor);
    const clawY = mountY + reach * Math.sin(p) - S.ARM.hang;
    expect(clawY).toBeGreaterThanOrEqual(floor + 0.05 - 1e-9);
  });
});

describe("what fits where", () => {
  const tri = (Math.PI * 2) / 3;
  it("the triangle brace fits the outline when turned to match, in any of its three ways", () => {
    expect(S.fitCheck("slot", "wedge", 0, tri)).toBe("ok");
    expect(S.fitCheck("slot", "wedge", tri, tri)).toBe("ok");
    expect(S.fitCheck("slot", "wedge", Math.PI / 3, tri)).toBe("turn");
    expect(S.fitCheck("slot", "block", 0, tri)).toBe("shape");
    expect(S.fitCheck("slot", "tube", 0, tri)).toBe("shape");
  });
  it("one Rotate step is small enough to line up within the tolerance", () => {
    expect(S.ROT_STEP / 2).toBeLessThanOrEqual(S.SNAP.yawTol);
  });
  it("only the power cell goes in the socket; the cargo bed takes cargo, not the panel", () => {
    expect(S.fitCheck("socket", "cell", 0, 0)).toBe("ok");
    expect(S.fitCheck("socket", "glass", 0, 0)).toBe("shape");
    expect(S.fitCheck("bed", "cell", 1, 0)).toBe("ok");
    expect(S.fitCheck("bed", "panel", 0, 0)).toBe("shape");
    expect(S.fitCheck("bay", "panel", 0, 0)).toBe("ok");
  });
});

describe("the mission", () => {
  const all = { approach: 1, panel: 1, lever: 1, support: 1, crossed: 1, cellLoaded: 1, atGreenhouse: 1 };
  it("walks through all nine steps in order", () => {
    expect(S.STEPS).toHaveLength(9);
    const keys = ["approach", "panel", "lever", "support", "crossed", "cellLoaded", "atGreenhouse"];
    const f = {};
    expect(S.currentStep(f)).toBe(0);
    keys.forEach((k, i) => { f[k] = true; expect(S.currentStep(f)).toBe(i + 1); });
    f.installed = true; expect(S.currentStep(f)).toBe(8);
    f.tested = true; expect(S.currentStep(f)).toBe(9);
  });
  it("goes back a step if the power cell falls out before it is home", () => {
    expect(S.currentStep(Object.assign({}, all, { cellLoaded: false }))).toBe(5);
  });
  it("gives a star for finishing, for every note and for all the scrap", () => {
    expect(S.starsFor({ done: true, notes: 2, scrap: 0 })).toBe(1);
    expect(S.starsFor({ done: true, notes: 8, scrap: S.SCRAP_TOTAL })).toBe(3);
  });
  it("shows the clock as minutes and seconds", () => {
    expect(S.formatTime(73)).toBe("1:13");
    expect(S.formatTime(5)).toBe("0:05");
  });
});

describe("the phone remote", () => {
  it("room codes are six digits with no leading zero, read the same on both sides", () => {
    for (const n of [0, 1, 899999, 123456789]) expect(S.makeCode(n)).toMatch(/^[1-9]\d{5}$/);
    expect(S.readCode("58 83 44")).toBe("588344");
    expect(S.readCode("012345")).toBe(null);
    expect(T.readCode("588344")).toBe("588344");
  });
  it("both pages use the same room channel", () => {
    expect(game).toContain('"lunarsalvage-remote-" + code');
    expect(remote).toContain('"lunarsalvage-remote-" + code');
  });
  it("the game links to the remote page, and that page exists", () => {
    expect(game).toContain("/games/lunar-salvage-remote.html?c=");
    expect(existsSync(new URL("../games/lunar-salvage-remote.html", import.meta.url))).toBe(true);
  });
  it("learns which way this phone tilts", () => {
    const cal = { b0: 0, g0: 0 };
    expect(T.learnLR(cal, 2, 20)).toEqual({ lr: "g", lrS: 1 });
    expect(T.learnLR(cal, -25, 3)).toEqual({ lr: "b", lrS: -1 });
    expect(T.learnLR(cal, 5, 6)).toBe(null);
    expect(T.learnFB({ b0: 0, g0: 0, lr: "g" }, 18, 0)).toBe(1);
    expect(T.learnFB({ b0: 0, g0: 0, lr: "b" }, 0, -18)).toBe(-1);
  });
  it("turns tilt into controls with a still middle", () => {
    const cal = { b0: 10, g0: -5, lr: "g", lrS: 1, fbS: -1 };
    expect(T.tiltAxes(cal, 10, -5)).toEqual({ lr: 0, fb: 0 });
    expect(T.tiltAxes(cal, 10, -3).lr).toBe(0);
    expect(T.tiltAxes(cal, 10, 23).lr).toBeCloseTo(1, 5);
    expect(T.tiltAxes(cal, 38, -5).fb).toBeCloseTo(-1, 5);
  });
  it("handles the sensor wrapping around at 180 degrees", () => {
    expect(T.wrapDeg(179 - -179)).toBe(-2);
    const cal = { b0: 179, g0: 0, lr: "b", lrS: 1, fbS: 1 };
    expect(T.tiltAxes(cal, -179, 0).lr).toBe(0);
  });
});

describe("the pages", () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  it("have no emojis", () => {
    expect(game).not.toMatch(emoji);
    expect(remote).not.toMatch(emoji);
  });
  it("load three.js r128 and the site's sound and Supabase files, with a CDN fallback for Supabase", () => {
    expect(game).toContain("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
    expect(game).toContain('<script src="/games/game-sound.js"></script>');
    for (const page of [game, remote]){
      expect(page).toContain("/assets/vendor/supabase.js");
      expect(page).toContain("https://unpkg.com/@supabase/supabase-js@2.112.4/dist/umd/supabase.js");
    }
  });
  it("uses textures the site already has", () => {
    for (const t of ["milky-way.jpg", "earth.jpg"]){
      expect(game).toContain("/assets/games/solar-system/" + t);
      expect(existsSync(new URL("../assets/games/solar-system/" + t, import.meta.url))).toBe(true);
    }
  });
  it("works with keys, touch, a game controller and a phone", () => {
    expect(game).toContain("navigator.getGamepads");
    expect(game).toContain('addEventListener("keydown"');
    expect(game).toContain('id="stick"');
    expect(remote).toContain("DeviceOrientationEvent.requestPermission");
  });
});

describe("the camera", () => {
  it("drives with the camera beside the rover, a little ahead, so its front shows", () => {
    const m = game.match(/const CAM_SIDE = Math\.PI \/ 2 \+ ([\d.]+);/);
    expect(m).toBeTruthy();
    const off = Math.PI / 2 + Number(m[1]);
    expect(off).toBeGreaterThan(Math.PI / 2);          /* past straight-beside, toward the front */
    expect(off).toBeLessThan(Math.PI * 0.75);          /* but still from the side, not head-on */
    expect(game).toContain("const yaw = rover.yaw + CAM_SIDE + camCtl.yaw;");
  });
});
