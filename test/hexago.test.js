// HexaGone! (subscribers-only game; file and ids still "hexago"): the rules in the game's LOGIC block, tested on their own.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// read with plain line endings, however git checked the file out (Windows checkouts get \r\n)
const html = readFileSync(new URL("../supabase/private-games/hexago.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const logic = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const G = new Function(logic + `; return { CONFIG, DIRS, D, DIR_VECS, DUR_COLORS, LEVELS, LEVEL_ENV, THEME_OF, hexToWorld, worldToHex, hexKey, pickDir,
  screenToWorld, buildLevel, validateLevel, createSim, simStep, retryCheckpoint, restore, capture, getTile, tileSupports, blocked,
  bumperUp, ballPos, replayMoves, planWitness, solvableFrom, sanitizeSave, awardsFor, mergeAwards, formatTime, towardVec, advance };`)();
const { CONFIG, D } = G;
const STEP = CONFIG.STEP;
const NONE = { x: 0, z: 0 };

/* a small test level from a build script */
let n = 0;
function lvl(make){ return G.buildLevel({ id: 900 + (n++), title: "Test", theme: "city", seed: 7, make }); }
function run(S, vec, until, maxSec){
  const steps = Math.round((maxSec || 10) / STEP);
  for (let i = 0; i < steps; i++){
    if (until && until(S)) return true;
    G.simStep(S, STEP, typeof vec === "function" ? vec(S) : vec);
  }
  return until ? until(S) : true;
}
const dirVec = i => G.DIR_VECS[i];
/* hold a direction for one hop, from a moment the ball is about to hop (or waiting at the start) */
function hop(S, dir){ return G.advance(S, dir === undefined ? 6 : dir, STEP); }
function landings(S){ return S.events.filter(e => e.type === "landed").length; }

describe("the hex grid and steering", () => {
  it("places pointy-top hexes and finds the hex under any point", () => {
    expect(G.hexToWorld(1, 0)).toEqual({ x: Math.sqrt(3) * CONFIG.R, z: 0 });
    for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++){
      const w = G.hexToWorld(q, r);
      expect(G.worldToHex(w.x + 0.3, w.z - 0.3)).toEqual({ q, r });
    }
  });
  it("turns a held direction into the nearest neighbour, the same however the camera is turned", () => {
    for (const yaw of [0, 0.3, -0.4]){
      const v = G.screenToWorld(1, 0, yaw), d = G.pickDir(v, -1), dv = G.DIR_VECS[d];
      expect(dv.x * v.x + dv.z * v.z).toBeGreaterThan(0.85);
    }
    expect(G.pickDir({ x: 0.05, z: 0.1 }, -1)).toBe(-1);
  });
  it("a quick tap moves one tile: letting go mid-hop keeps the hop you aimed", () => {
    const L = lvl(b => b.start().up(3, "8").side(D.R, "8").up(1, "P"));
    const S = G.createSim(L);
    run(S, NONE, s => s.mode === "bounce" && s.phase === "air" && s.t > 0.05, 3);
    const from = { ...S.from };
    for (let i = 0; i < 6; i++) G.simStep(S, STEP, dirVec(D.UL));
    run(S, NONE, s => s.phase === "dwell", 2);
    expect(S.to).toEqual({ q: from.q, r: from.r - 1 });
  });
  it("holding straight up zigzags up the screen, never drifting off sideways", () => {
    const L = lvl(b => b.start().up(8, "8").up(1, "P"));
    const S = G.createSim(L), up = G.screenToWorld(0, 1, 0);
    run(S, up, s => s.mode === "complete" || s.mode === "falling", 12);
    expect(S.mode).toBe("complete");
  });
});

describe("tile countdown", () => {
  it("a tile starting at 8 becomes 7 after one landing, and the colours run in order", () => {
    expect(G.DUR_COLORS.slice(1)).toEqual(["#FF4258", "#FF943D", "#FFE45C", "#B8ED38", "#19D5C5", "#3685FF", "#9955FF", "#EE39FF"]);
    const L = lvl(b => b.start().up(1, "8").up(1, "P"));
    const S = G.createSim(L);
    hop(S, D.UL);
    expect(S.tiles.get(G.hexKey(0, -1)).dur).toBe(7);
  });
  it("a red tile holds one landing and falls away once the ball leaves; coming back finds nothing", () => {
    const L = lvl(b => b.start().up(1, "1").up(1, "P"));
    const S = G.createSim(L);
    hop(S, D.UL);
    const t = S.tiles.get(G.hexKey(0, -1));
    expect(t.life).toBe("spent");
    hop(S);                                   // bounce in place on it
    expect(S.mode === "falling" || S.mode === "failed").toBe(true);
    expect(S.cause).toBe("Tile exhausted");
  });
  it("bouncing in place uses one landing per bounce, never one per frame; grey never runs out", () => {
    const L = lvl(b => b.start().up(1, "8").up(1, "P"));
    const S = G.createSim(L);
    hop(S, D.UL); hop(S); hop(S); hop(S);
    expect(S.tiles.get(G.hexKey(0, -1)).dur).toBe(4);
    const S2 = G.createSim(L);
    for (let i = 0; i < 6; i++) hop(S2);
    expect(S2.mode).toBe("bounce");
  });
});

describe("hills, ramps and trampolines", () => {
  it("hops up one step, down any number; a ledge two steps up is a wall the ball bonks off, landing back with no fall", () => {
    const L = lvl(b => b.start().go(D.UL, "8", 1).go(D.UL, "8", 2).mark("top").back("top").go(D.UR, "8", -3).up(1, "P", 0));
    const S = G.createSim(L);
    hop(S, D.UL);
    expect(S.to).toEqual({ q: 0, r: -1 });                        // up one step: fine
    S.events.length = 0;
    const before = { ...S.to };
    let bonked = false;
    run(S, s => (s.events.some(e => e.type === "bonk") && (bonked = true), dirVec(D.UL)), s => bonked && s.phase === "dwell", 3);
    expect(bonked).toBe(true);                                     // two steps up: bonk
    expect(S.to).toEqual(before);
    expect(S.mode).toBe("bounce");
  });
  it("a ramp rolls the ball on downhill by itself, whatever is held", () => {
    const L = lvl(b => b.start().go(D.UL, "8").slide(D.R, 2).go(D.R, "8", -1).up(1, "P"));
    const S = G.createSim(L);
    hop(S, D.UL); hop(S, D.R);                                     // onto the first ramp
    expect(G.getTile(S, S.to).kind).toBe("ramp");
    hop(S, D.L); hop(S, D.L);                                      // pushing the other way changes nothing
    expect(G.getTile(S, S.to).kind).toBe("standard");
    expect(S.to.q).toBeGreaterThan(1);
  });
  it("a trampoline jumps two tiles the way you steer, over a gap and up to three steps", () => {
    const L = lvl(b => b.start().go(D.UL, "T").leap(D.UL, "8", 3).up(1, "P"));
    const S = G.createSim(L);
    hop(S, D.UL);
    expect(G.getTile(S, S.to).kind).toBe("tramp");
    hop(S, D.UL);
    expect(S.to).toEqual({ q: 0, r: -3 });
    expect(G.getTile(S, S.to).h).toBe(3);
    expect(S.mode).toBe("bounce");
  });
});

describe("moving platforms, bumpers, switches", () => {
  it("a moving platform carries a ball that bounces in place across a gap", () => {
    const L = lvl(b => b.start().go(D.UL, "G").ferry(D.UL, 2, "G").up(1, "P"));
    expect(G.validateLevel(L)).toEqual([]);
    expect(G.planWitness(L, 7).ok).toBe(true);
    const S = G.createSim(L);
    hop(S, D.UL);                                                  // to the shore (the platform slides off to the far end)
    hop(S, D.UL);                                                  // it has come back: hop on
    expect(G.getTile(S, S.to).kind).toBe("mover");
    const on = { ...S.to };
    hop(S);                                                        // bounce in place: it carries the ball along
    expect(G.getTile(S, S.to).kind).toBe("mover");
    expect(S.to).not.toEqual(on);
    hop(S, D.UL);                                                  // and off onto the far shore
    expect(S.to).toEqual({ q: 0, r: -4 });
  });
  it("a bumper's bar blocks its tile on alternate hops; waiting a bounce gets you through", () => {
    const L = lvl(b => b.start().go(D.UL, "G").go(D.UR, "B0").go(D.UL, "G").up(1, "P"));
    const S = G.createSim(L);
    const t = [...S.tiles.values()].find(x => x.kind === "bumper");
    S.tick = 0; expect(G.bumperUp(S, t)).toBe(true);
    S.tick = 1; expect(G.bumperUp(S, t)).toBe(false);
    expect(G.planWitness(L, 7).ok).toBe(true);
  });
  it("a switch makes its bridge appear and opens its gate, and stays pressed", () => {
    const L = lvl(b => b.start().mark("s").go(D.L, "Oa").back("s").go(D.UL, "=a").go(D.UR, "#a").up(1, "P"));
    expect(G.validateLevel(L)).toEqual([]);
    const S = G.createSim(L);
    const bridge = [...S.tiles.values()].find(x => x.kind === "bridge"), gate = [...S.tiles.values()].find(x => x.kind === "gate");
    expect(G.tileSupports(bridge, S)).toBe(false);
    expect(G.blocked(S, gate, 0, false)).toBe(true);
    hop(S, D.L);
    expect(S.switches.has("a")).toBe(true);
    expect(G.tileSupports(bridge, S)).toBe(true);
    expect(G.blocked(S, gate, 0, false)).toBe(false);
    expect(G.planWitness(L, 7).ok).toBe(true);
  });
});

describe("rescue points", () => {
  it("a big diamond adds 3, the meter holds 3 rescues (30), and one rescue costs 10", () => {
    expect(CONFIG.ENERGY_CAP).toBe(30); expect(CONFIG.RESCUE_COST).toBe(10);
    const L = lvl(b => b.start().go(D.UL, "8D").up(1, "P"));
    const S = G.createSim(L, 7, 29);
    hop(S, D.UL);
    expect(S.energy).toBe(30);
  });
  it("carry over: a level starts with the rescue points brought in, and a miss with 10 or more hovers and spends 10", () => {
    const L = lvl(b => b.start().up(1, "P"));
    const S = G.createSim(L, 7, 23);
    expect(S.energy).toBe(23);
    hop(S, D.R);                                                   // nothing to the right: a miss
    expect(S.mode).toBe("hover");
    expect(S.energy).toBe(13);
    const S2 = G.createSim(L, 7, 9);
    hop(S2, D.R);
    expect(S2.mode).toBe("falling");
  });
  it("is saved with the progress, and the game hands it to each new level and keeps it at the end", () => {
    expect(G.sanitizeSave({ v: 2, energy: 17 }).energy).toBe(17);
    expect(G.sanitizeSave({ v: 2, energy: 99 }).energy).toBe(30);
    const game = html.slice(html.indexOf("/*GAME*/"));
    expect(game).toContain("createSim(L, undefined, app.save.energy)");
    expect(game).toContain("s.energy = S.energy;");
  });
});

describe("checkpoints, saving, the loop", () => {
  it("a checkpoint retry restores tiles, switches, the platform clock, diamonds, energy and dice, but not time or falls", () => {
    const L = G.LEVELS.find(l => l.id === 24);
    const r = G.replayMoves(L, L.solutionWitness, L.seed);
    expect(r.ok).toBe(true);
    const snap = Object.values(r.cps)[1];
    const S = G.createSim(L);
    G.restore(S, snap);
    S.time = 50; S.deaths = 2; S.switches.add("z"); S.tick = 99; S.energy = 3;
    G.retryCheckpoint(S);                                          // no snap of its own yet: back to the start
    expect(S.tick).toBe(0);
    S.snap = snap; G.retryCheckpoint(S);
    expect([...S.switches].sort()).toEqual([...snap.switches].sort());
    expect(S.tick).toBe(snap.tick);
    expect(S.energy).toBe(snap.energy);
    expect(S.time).toBe(50); expect(S.deaths).toBe(2);
  });
  it("an old save from the 20-level version keeps its settings but starts the new campaign fresh; junk can't break it", () => {
    const old = G.sanitizeSave({ v: 1, unlocked: 14, settings: { master: 30 } });
    expect(old.unlocked).toBe(1); expect(old.settings.master).toBe(30);
    for (const raw of [null, "x", 5, [], { v: 2, unlocked: "lots", settings: "no" }]) expect(G.sanitizeSave(raw).unlocked).toBeGreaterThanOrEqual(1);
    expect(G.sanitizeSave({ v: 2, unlocked: 99 }).unlocked).toBe(25);
  });
  it("gameplay only moves when stepped, with capped catch-up; no clock on screen; level 25 ends the campaign", () => {
    const game = html.slice(html.indexOf("/*GAME*/"));
    expect(game).toContain("Math.min(dt, CONFIG.MAX_CATCHUP)");
    expect(game).toContain('document.addEventListener("visibilitychange"');
    expect(game).toMatch(/if \(app\.state !== "PLAYING"\)[^\n]*return/);
    expect(game).not.toContain('$("h-time").textContent');
    expect(game).toContain('"CAMPAIGN_COMPLETE"');
    expect(game).toMatch(/level\.id === CONFIG\.LEVEL_COUNT/);
    expect(html).toContain("<title>HexaGone!</title>");
    expect(html).not.toContain("Hexa'GO");
  });
  it("badges for every diamond, no falls and the target time, separately", () => {
    const L = G.LEVELS[0];
    expect(G.awardsFor(L, { diamonds: 2, diamondTotal: 2, deaths: 0, time: 1 })).toBe("dzt");
    expect(G.mergeAwards("dz", "tz")).toBe("dtz");
    expect(G.formatTime(75.25)).toBe("1:15.3");
  });
});

describe("the 25 levels", () => {
  it("are all there: five worlds of five, each with its own sky", () => {
    expect(G.LEVELS.map(l => l.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    const worlds = ["city", "canyon", "reactor", "sky", "cosmic"];
    G.LEVELS.forEach((l, i) => expect(l.theme).toBe(worlds[Math.floor(i / 5)]));
    const looks = new Set(G.LEVELS.map(l => { const e = G.LEVEL_ENV[l.id]; return e.sky.join() + e.weather + e.feature; }));
    expect(looks.size).toBe(25);
    expect(new Set(Object.values(G.LEVEL_ENV).map(e => e.name)).size).toBe(25);
  });
  it("bring in the new pieces world by world", () => {
    const kinds = id => new Set(G.LEVELS[id - 1].tiles.map(t => t.kind).concat(G.LEVELS[id - 1].movers.length ? ["mover"] : []));
    expect([6, 7, 8, 9, 10].some(id => G.LEVELS[id - 1].tiles.some(t => t.h > 0))).toBe(true);
    expect(kinds(8).has("ramp")).toBe(true);
    expect(kinds(11).has("bridge")).toBe(true);
    expect(kinds(12).has("gate")).toBe(true);
    expect(kinds(13).has("mover")).toBe(true);
    expect(kinds(14).has("bumper")).toBe(true);
    expect(kinds(16).has("tramp")).toBe(true);
    expect(kinds(18).has("white")).toBe(true);
    const all = kinds(25);
    for (const k of ["ramp", "bridge", "gate", "mover", "bumper", "tramp", "white"]) expect(all.has(k), k).toBe(true);
  });
  it("are longer than the old ones", () => {
    for (const L of G.LEVELS) expect(L.tiles.length + L.movers.length, `level ${L.id}`).toBeGreaterThanOrEqual(28);
  });
  for (const L of G.LEVELS){
    it(`level ${L.id} "${L.title}" is valid and its winning moves work with the real rules, no hover`, () => {
      expect(G.validateLevel(L)).toEqual([]);
      const r = G.replayMoves(L, L.solutionWitness, L.seed);
      expect(r.ok).toBe(true);
      for (const id in L.checkpointWitnesses){
        expect(r.cps[id]).toBeTruthy();
        expect(G.replayMoves(L, L.checkpointWitnesses[id], L.seed, r.cps[id]).ok).toBe(true);
      }
    });
  }
  it("every launcher throw leads somewhere you can still finish from", () => {
    for (const L of G.LEVELS.filter(l => l.tiles.some(t => t.kind === "white"))){
      for (let seed = 1; seed <= 6; seed++) expect(G.planWitness(L, seed).ok, `level ${L.id} seed ${seed}`).toBe(true);
    }
  });
});
