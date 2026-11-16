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
const S = new Function(pure(game) + "; return { MOON_G, EARTH_G, LIFT_KG, SCRAP_TOTAL, ARM, ROVER, TRENCH, BRIDGE, WORLD, ROT_STEP, SNAP, MATERIALS, PART_TYPES, TARGET_ACCEPTS, NOTES, STEPS, QUIZ, angDiff, angDiffMod, earthFeelKg, fallTime, formatTime, magnetCheck, clawCheck, scanChips, bestTool, groundHeight, overTrench, onBridgeDeck, canDriveTo, driveStep, armLocal, toWorld, minPitchFor, fitCheck, currentStep, starsFor, makeCode, readCode, aimArm, boxTopAt, circleTopAt, footprintPts, ROVER_SOLIDS, LASER, raySphere, CONTEST, contestPoints, contestWinner, inBase, pickBonus, WORLDS, worldById, stepIndex, SAVE_NAME, defaultSave, mergeSave, combineSaves, gradeBand, NOTE_DOODLES, SCAN, scanRange, SCANNABLE, DRILL, drillStep, drillFind, toolsFor, MISSIONS, SAT_STEPS, BOARD_STEPS, FLIGHT, flightPhase, BRIEFS };")();
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
  it("has twelve notes on Pumice Moon, and every one can be found", () => {
    expect(S.NOTES.filter((n) => n.world === "pumice")).toHaveLength(12);
    const fromParts = new Set(Object.values(S.PART_TYPES).map((t) => t.note).filter(Boolean));
    for (const n of S.NOTES) expect(n.id === "gravity" || n.id === "laser" || n.id === "rocket" || fromParts.has(n.id)).toBe(true);
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
  const all = { approach: 1, panel: 1, lever: 1, support: 1, crossed: 1, freed: 1, cellLoaded: 1, atGreenhouse: 1 };
  it("walks through all ten steps in order", () => {
    expect(S.STEPS).toHaveLength(10);
    const keys = ["approach", "panel", "lever", "support", "crossed", "freed", "cellLoaded", "atGreenhouse"];
    const f = {};
    expect(S.currentStep(f)).toBe(0);
    keys.forEach((k, i) => { f[k] = true; expect(S.currentStep(f)).toBe(i + 1); });
    f.installed = true; expect(S.currentStep(f)).toBe(9);
    f.tested = true; expect(S.currentStep(f)).toBe(10);
  });
  it("goes back a step if the power cell falls out before it is home", () => {
    expect(S.currentStep(Object.assign({}, all, { cellLoaded: false }))).toBe(6);
  });
  it("gives a star for finishing, for every note and for all the scrap", () => {
    expect(S.starsFor({ done: true, notes: 2, scrap: 0 })).toBe(1);
    expect(S.starsFor({ done: true, notes: S.NOTES.length, scrap: S.SCRAP_TOTAL })).toBe(3);
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
    expect(game).toContain('data-c="wheel"');   /* the dashboard: a steering wheel and pedals to drive */
    expect(game).toContain('data-c="go"');
    expect(game).toContain('data-c="joy"');     /* a joystick, a reach lever and a big button for the tools */
    expect(game).toContain('data-c="reach"');
    expect(game).toContain('data-mode="laser"');
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

describe("aiming the arm and keeping things from passing through each other", () => {
  it("aims the claw exactly at a spot in reach, in front, beside or behind the rover", () => {
    for (const spot of [{ x: 0, y: 0.3, z: -3 }, { x: 2.2, y: 0.2, z: -1 }, { x: -1.5, y: 0.6, z: 1.2 }, { x: 0, y: 1.2, z: 0.95 }]){
      const a = S.aimArm(spot);
      expect(a.ok).toBe(true);
      const tip = S.armLocal(a);
      expect(tip.x).toBeCloseTo(spot.x, 5);
      expect(tip.z).toBeCloseTo(spot.z, 5);
      expect(tip.y - S.ARM.hang).toBeCloseTo(spot.y, 5);
    }
  });
  it("says when a spot is too far for the arm", () => {
    const a = S.aimArm({ x: 0, y: 0.2, z: -9 });
    expect(a.ok).toBe(false);
    expect(a.far).toBe(true);
    expect(a.reach).toBe(S.ARM.reachMax);
  });
  it("can reach the cargo bed on its own back", () => {
    const a = S.aimArm({ x: S.ROVER.bed.x, y: S.ROVER.bed.y + 0.9, z: S.ROVER.bed.z });
    expect(a.ok).toBe(true);
  });
  it("finds the top of turned boxes and circles, and nothing outside them", () => {
    const b = { x: 1, z: 2, hw: 1, hd: 0.25, yaw: Math.PI / 2, top: 0.7 };
    expect(S.boxTopAt(b, 1, 2.9)).toBe(0.7);           /* turned a quarter: long along z now */
    expect(S.boxTopAt(b, 1.9, 2)).toBe(-Infinity);
    expect(S.circleTopAt({ x: 0, z: 0, r: 1, top: 2 }, 0.5, 0.5)).toBe(2);
    expect(S.circleTopAt({ x: 0, z: 0, r: 1, top: 2 }, 1, 1)).toBe(-Infinity);
  });
  it("tests the corners of a wide panel and a ring around round parts", () => {
    const flat = S.footprintPts({ w: 1.2, d: 0.75 }, 0, 0, 0);
    expect(flat.length).toBe(9);
    expect(flat).toContainEqual([1.2, 0.75]);
    const turned = S.footprintPts({ w: 1.2, d: 0.75 }, 0, 0, Math.PI / 2);
    expect(Math.max(...turned.map(p => Math.abs(p[1])))).toBeCloseTo(1.2, 5);
    expect(S.footprintPts({ r: 0.3 }, 5, 5, 0).length).toBe(7);
  });
  it("keeps the claw on top of the rover's own body, wheels and cargo bed", () => {
    const top = (x, z) => Math.max(...S.ROVER_SOLIDS.map(b => S.boxTopAt(b, x, z)));
    expect(top(1.05, -0.95)).toBeGreaterThanOrEqual(0.78);   /* a front wheel */
    expect(top(0, -0.9)).toBeGreaterThan(1.3);               /* the cab */
    expect(top(0, 0.95)).toBe(1.0);                          /* inside the cargo bed: its floor */
    expect(top(0.6, 0.95)).toBeGreaterThan(1.2);             /* the cargo bed wall */
    expect(top(2, 0)).toBe(-Infinity);                       /* beside the rover */
  });
});

describe("the laser", () => {
  it("has a step of its own: free the power cell from the boulder before loading it", () => {
    const f = { approach: 1, panel: 1, lever: 1, support: 1, crossed: 1 };
    expect(S.STEPS[S.currentStep(f)].id).toBe("free");
    expect(S.STEPS[S.currentStep(Object.assign(f, { freed: 1 }))].id).toBe("load");
  });
  it("finds where a beam meets a boulder, and misses one beside it", () => {
    const o = { x: 0, y: 1, z: 0 }, d = { x: 0, y: 0, z: -1 };
    expect(S.raySphere(o, d, { x: 0, y: 1, z: -10 }, 1)).toBeCloseTo(9, 5);
    expect(S.raySphere(o, d, { x: 3, y: 1, z: -10 }, 1)).toBe(-1);
    expect(S.raySphere(o, d, { x: 0, y: 1, z: 10 }, 1)).toBe(-1);   /* behind the rover */
  });
  it("is honest about what real rover lasers do", () => {
    const n = S.NOTES.find((n) => n.id === "laser").text;
    expect(n).toContain("ChemCam");
    expect(n).toMatch(/real rover lasers don't do/);
    expect(S.LASER.range).toBeGreaterThan(10);
  });
});

describe("the dashboard and Chike's requests", () => {
  it("gives every step a picture, and the picture is of the part Chike asks for", () => {
    const list = S.MISSIONS.repair.pic;
    expect(list).toHaveLength(S.STEPS.length);
    const want = { panel: "panel", lever: "lever", support: "wedge", free: "boulder", load: "cell", install: "cell" };
    S.STEPS.forEach((st, i) => { if (want[st.id]) expect(list[i]).toBe(want[st.id]); });
  });
  it("draws the part pictures from the real 3D parts", () => {
    expect(game).toContain('for (const t of ["panel", "wedge", "cell", "scrap", "glass", "block", "tube"]) shot(t, partMesh(t).g');
    expect(game).toContain("/assets/characters/chike-pose-point.png");
  });
});

describe("easy enough for a 6-year-old", () => {
  it("lights up the tool each step needs, and the step's hint names the same tool", () => {
    const name = { magnet: "Magnet", arm: "Arm", laser: "Laser", drill: "Drill" };
    for (const m of Object.values(S.MISSIONS)) {
      expect(m.tool).toHaveLength(m.steps.length);
      m.steps.forEach((st, i) => { if (name[m.tool[i]]) expect(st.hint).toContain(name[m.tool[i]]); });
    }
  });
  it("turns the right piece to fit by itself, so the puzzle is picking the piece, not the angle", () => {
    expect(game).toContain('if (fit && fit.res === "turn"){ radio("Right piece! It turns itself to fit the outline."); return snapTo(p, fit.t); }');
  });
  it("pulls the bridge lever with one press of Grab", () => {
    expect(game).toContain("G.autoPull = true");
  });
});

describe("held buttons stay held", () => {
  it("the phone never rebuilds its buttons while the magnet picks something up", () => {
    expect(remote).not.toContain("paintPad(modeChanged || heldChanged)");
    expect(remote).toContain("paintPad(modeChanged);");
  });
  it("a long press never opens the phone's menu on either page", () => {
    expect(remote).toContain('addEventListener("contextmenu"');
    expect(game).toContain('d.addEventListener("contextmenu", (e) => e.preventDefault());');
  });
});

describe("the Rover Contest", () => {
  it("scores the right tool's parts higher, and doubles Chike's bonus part", () => {
    expect(S.contestPoints("scrap", null)).toBe(1);
    expect(S.contestPoints("block", null)).toBe(2);
    expect(S.contestPoints("glass", null)).toBe(3);
    expect(S.contestPoints("meteor", null)).toBe(5);
    expect(S.contestPoints("glass", "glass")).toBe(6);
    expect(S.contestPoints("scrap", "glass")).toBe(1);
  });
  it("tells a real fact: meteorites are magnetic, they are mostly iron and nickel", () => {
    expect(S.magnetCheck("meteor").ok).toBe(true);
    expect(S.clawCheck("meteor").ok).toBe(true);
    expect(S.MATERIALS.meteor.name).toMatch(/iron/i);
  });
  it("picks the winner, or a tie", () => {
    expect(S.contestWinner({ blue: 9, gold: 4 })).toBe("blue");
    expect(S.contestWinner({ blue: 2, gold: 7 })).toBe("gold");
    expect(S.contestWinner({ blue: 5, gold: 5 })).toBe("tie");
  });
  it("knows each team's base, and the two bases are far apart", () => {
    expect(S.inBase(-17, 1, "blue")).toBe(true);
    expect(S.inBase(-17, 1, "gold")).toBe(false);
    expect(S.inBase(0, 0, "blue")).toBe(false);
    expect(Math.abs(S.CONTEST.bases.blue.x - S.CONTEST.bases.gold.x)).toBeGreaterThan(20);
  });
  it("asks for a part that is on the field, and not the same one twice in a row", () => {
    expect(S.pickBonus(["scrap", "glass"], null)).toBe("glass");
    expect(S.pickBonus(["scrap", "glass"], "glass")).toBe("scrap");
    expect(S.pickBonus(["glass"], "glass")).toBe("glass");
    expect(S.pickBonus([], null)).toBe(null);
  });
  it("lasts three minutes", () => { expect(S.CONTEST.secs).toBe(180); });
});

describe("the Rover Contest on the page and the phones", () => {
  it("has a Contest button, a lobby with one code for both phones, and a scoreboard", () => {
    expect(game).toContain('id="bContest"');
    expect(game).toContain('id="ovLobby"');
    expect(game).toContain('id="ctBlue"');
    expect(game).toContain('id="ctGold"');
  });
  it("gives the first phone Blue and the next Gold, and turns a third away", () => {
    expect(game).toContain('return stale(CT.teams.blue) ? "blue" : stale(CT.teams.gold) ? "gold" : null;');
    expect(game).toContain('if (!team){ rmSend({ t: "full", to: p.i }); return; }');
  });
  it("sends each phone only its own rover's state, and the phone ignores the other's", () => {
    expect(game).toContain('rmSend({ t: "st", to: T.id, team,');
    expect(remote).toContain("if (p.to && p.to !== C.id) return;");
    expect(remote).toContain('id="teamTag"');
  });
  it("lets both players use one keyboard when there are no phones", () => {
    expect(game).toContain('blue: { l: "KeyA", r: "KeyD"');
    expect(game).toContain('gold: { l: "ArrowLeft", r: "ArrowRight"');
  });
});

describe("worlds are data", () => {
  it("lists four made-up worlds in campaign order with real-place gravity", () => {
    expect(S.WORLDS.map(w => w.id)).toEqual(["pumice", "glacia", "ember", "gusto"]);
    expect(S.worldById("pumice").g).toBe(S.MOON_G);
    expect(S.worldById("glacia").g).toBeCloseTo(3.71, 2);
    expect(S.worldById("ember").air).toBe(true);
    expect(S.worldById("pumice").air).toBe(false);
  });
  it("Pumice Moon has the drill, and only worlds with air have the hose", () => {
    expect(S.worldById("pumice").tools).toContain("drill");
    for (const w of S.WORLDS) if (w.tools.includes("hose")) expect(w.air).toBe(true);
  });
  it("finds the step from the first flag not done", () => {
    expect(S.stepIndex([{ flag: "a" }, { flag: "b" }], { a: true })).toBe(1);
    expect(S.stepIndex([{ flag: "a" }], { a: true })).toBe(1);
    expect(S.currentStep({ approach: true, panel: true })).toBe(2);
    expect(S.currentStep({ tested: true, installed: true, approach: true, panel: true, lever: true, support: true, crossed: true, freed: true, cellLoaded: true, atGreenhouse: true })).toBe(10);
  });
  it("weight feels lighter on Pumice Moon than on Glacia", () => {
    expect(S.earthFeelKg(60)).toBeCloseTo(9.9, 1);
    expect(S.earthFeelKg(60, 3.71)).toBeGreaterThan(S.earthFeelKg(60));
  });
  it("calls world 1 Pumice Moon, and says it pulls like Earth's Moon", () => {
    const g = S.NOTES.find(n => n.id === "gravity").text;
    expect(g).toContain("Pumice Moon");
    expect(g).toContain("Earth's Moon");
    expect(g).toContain("1.62");
    expect(S.NOTES.every(n => n.world)).toBe(true);
  });
});

describe("saving", () => {
  it("starts fresh from junk", () => {
    for (const junk of [null, "x", 5, { grade: "7", reached: ["mars"], notes: ["nope"] }]) {
      expect(S.mergeSave(junk)).toEqual(S.defaultSave());
    }
  });
  it("keeps the good parts of a save", () => {
    const s = S.mergeSave({ grade: 3, reached: ["glacia", "pumice", "pumice"], notes: ["steel", "steel", "gravity"], stars: { pumice: { mission: true, notes: false, quiz: true } } });
    expect(s.grade).toBe(3);
    expect(s.reached).toEqual(["pumice", "glacia"]);
    expect(s.notes.sort()).toEqual(["gravity", "steel"]);
    expect(s.stars.pumice).toEqual({ mission: true, notes: false, quiz: true });
  });
  it("puts grades in three bands", () => {
    expect([1, 2, 3, 4, 5, null].map(S.gradeBand)).toEqual(["g1", "g23", "g23", "g45", "g45", "g23"]);
  });
  it("combines this device's save with the site's, keeping everything earned", () => {
    const c = S.combineSaves({ grade: null, reached: ["pumice"], notes: ["steel"], stars: { pumice: { mission: true, notes: false, quiz: false } } },
                             { grade: 4, reached: ["pumice", "glacia"], notes: ["gravity"], stars: { pumice: { mission: false, notes: false, quiz: true } } });
    expect(c.grade).toBe(4);
    expect(c.reached).toEqual(["pumice", "glacia"]);
    expect(c.notes.sort()).toEqual(["gravity", "steel"]);
    expect(c.stars.pumice).toEqual({ mission: true, notes: false, quiz: true });
  });
  it("uses a save name the site accepts, and asks the site for it", () => {
    expect(S.SAVE_NAME).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
    expect(game).toContain('ccsSave: "get"');
    expect(game).toContain('ccsSave: "set"');
  });
});

describe("the notepad", () => {
  it("has a pen doodle for every note", () => {
    for (const n of S.NOTES) expect(S.NOTE_DOODLES[n.id]).toMatch(/^<svg/);
  });
  it("uses handwriting fonts and no emojis in the notepad", () => {
    expect(game).toContain("family=Kalam:wght@700&family=Patrick+Hand");
    expect(game).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
  it("the Field Notes button is a notepad, not a small bar button", () => {
    expect(game).toMatch(/<button[^>]*id="bNotes"[^>]*class="padbtn"|<button[^>]*class="padbtn"[^>]*id="bNotes"/);
    expect(game).toMatch(/\.padbtn\.fresh:after\{[^}]*animation:[^}]*3\}/);
  });
});

describe("scan fills the notepad", () => {
  it("scan reaches farther from the nose than from the claw", () => {
    expect(S.scanRange("drive")).toBe(7);
    expect(S.scanRange("arm")).toBe(4.5);
  });
  it("every scannable prop writes a real note", () => {
    for (const id of Object.values(S.SCANNABLE)) expect(S.NOTES.some(n => n.id === id)).toBe(true);
  });
  it("the drill rig and the radio tower can be scanned", () => {
    expect(S.SCANNABLE.drill).toBe("weight");
    expect(S.SCANNABLE.tower).toBe("radio");
  });
});

describe("the drill", () => {
  it("goes down while held and creeps back when let go", () => {
    let d = 0;
    for (let i = 0; i < 16; i++) d = S.drillStep(d, true, 0.1);
    expect(d).toBeCloseTo(0.5, 1);
    expect(S.drillStep(0.5, false, 0.5)).toBeCloseTo(0.2, 1);
    expect(S.drillStep(0.99, true, 1)).toBe(1);
  });
  it("finds what the spot hides, and only rock off a spot", () => {
    expect(S.drillFind({ gives: "energy" })).toBe("energy");
    expect(S.drillFind(null)).toBe("rock");
  });
  it("energy rocks need the claw", () => {
    expect(S.magnetCheck("energy").ok).toBe(false);
    expect(S.clawCheck("energy").ok).toBe(true);
  });
  it("the drill unlocks on Pumice Moon after the greenhouse works", () => {
    const w = S.worldById("pumice");
    expect(S.toolsFor(w, {})).not.toContain("drill");
    expect(S.toolsFor(w, { tested: true })).toContain("drill");
    expect(S.toolsFor(w, {})[0]).toBe("drive");
  });
  it("the phone shows only the tools the game sends, and has Notes and Launch", () => {
    expect(remote).toContain('data-m="drill"');
    expect(remote).toMatch(/st\.tools|p\.tools/);
    expect(remote).toContain('t: "notes"');
    expect(remote).toContain('t: "launch"');
  });
  it("the game ignores a tool this world doesn't have yet", () => {
    expect(game).toMatch(/function setMode\(m, quiet\)\{[\s\S]{0,200}modesNow\(\)\.includes\(m\)/);
  });
});

describe("the satellite mission", () => {
  it("runs drill, rack, fill, test in order", () => {
    const st = S.MISSIONS.satellite.steps;
    expect(st.map(s => s.flag)).toEqual(["drill1", "rack1", "rack3", "satTest"]);
    expect(S.MISSIONS.satellite.tool).toEqual(["drill", "arm", "drill", "drive"]);
    expect(S.stepIndex(st, { drill1: true, rack1: true })).toBe(2);
  });
  it("the rack only takes energy rocks", () => {
    expect(S.TARGET_ACCEPTS.rack).toEqual(["energy"]);
    expect(S.fitCheck("rack", "energy", 0, 0)).toBe("ok");
    expect(S.fitCheck("rack", "scrap", 0, 0)).toBe("shape");
  });
  it("every mission's tool and picture lists match its steps", () => {
    for (const m of Object.values(S.MISSIONS)) {
      expect(m.tool.length).toBe(m.steps.length);
      expect(m.pic.length).toBe(m.steps.length);
    }
  });
  it("the repair mission keeps today's tools and pictures", () => {
    expect(S.MISSIONS.repair.steps).toBe(S.STEPS);
    expect(S.MISSIONS.repair.tool).toEqual(["drive", "magnet", "arm", "arm", "drive", "laser", "arm", "drive", "arm", "drive"]);
  });
  it("teaches layers and satellites", () => {
    expect(S.NOTES.find(n => n.id === "layers").world).toBe("pumice");
    expect(S.NOTES.find(n => n.id === "satellite").world).toBe("pumice");
    expect(S.SCANNABLE.energy).toBe("layers");
    expect(S.SCANNABLE.dish).toBe("satellite");
    expect(S.NOTE_DOODLES.layers).toMatch(/^<svg/);
    expect(S.NOTE_DOODLES.satellite).toMatch(/^<svg/);
  });
});

describe("the rocket", () => {
  it("counts down, lifts off, flies, waits for the briefing, lands", () => {
    expect(S.flightPhase(0).phase).toBe("count");
    expect(S.flightPhase(3.5).phase).toBe("lift");
    expect(S.flightPhase(7.5).phase).toBe("space");
    expect(S.flightPhase(9.5).phase).toBe("brief");
    expect(S.flightPhase(30).phase).toBe("brief");
    expect(S.flightPhase(10, true).phase).toBe("land");
    expect(S.flightPhase(9 + S.FLIGHT.land + 0.1, true).phase).toBe("done");
  });
  it("boards after the quiz", () => {
    expect(S.MISSIONS.board.steps.map(s => s.flag)).toEqual(["quiz", "inRocket", "launched"]);
  });
  it("Zech's briefing names Glacia and Yuna, and the kid's picture exists", () => {
    const b = S.BRIEFS.glacia;
    expect(b.lines.join(" ")).toContain("Glacia");
    expect(b.lines.join(" ")).toContain("Yuna");
    expect(b.lines[b.lines.length - 1]).toMatch(/^Landing on Glacia/);
    expect(existsSync(new URL("../assets/characters/" + b.kid + ".jpg", import.meta.url))).toBe(true);
  });
  it("teaches how rockets go up", () => {
    const n = S.NOTES.find(n => n.id === "rocket");
    expect(n.world).toBe("pumice");
    expect(n.text).toMatch(/push/i);
    expect(S.NOTE_DOODLES.rocket).toMatch(/^<svg/);
  });
  it("launch can only start once", () => {
    expect(game).toMatch(/function launchRocket\(\)\{\s*if \(G\.launching\) return;/);
  });
});
