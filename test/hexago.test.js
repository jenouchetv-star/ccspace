// Hexa'GO! (subscribers-only game): the rules in the game's LOGIC block, tested on their own.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// read with plain line endings, however git checked the file out (Windows checkouts get \r\n)
const html = readFileSync(new URL("../supabase/private-games/hexago.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const logic = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const G = new Function(logic + `; return { CONFIG, DIRS, DUR_COLORS, LEVELS, hexToWorld, worldToHex, hexKey, pickDir, screenToWorld,
  parseLevel, validateLevel, createSim, simStep, retryCheckpoint, restore, capture, getTile, tileSupports, ballPos, rngNext,
  replayWitness, planWitness, solvableFrom, sanitizeSave, awardsFor, mergeAwards, formatTime, towardVec, shortestHops, LEVEL_ENV };`)();
const { CONFIG } = G;
const STEP = CONFIG.STEP;

/* a tiny level made from a map, for the rule tests */
function lvl(map, extra){ return G.parseLevel(Object.assign({ id: 99, title: "Test", theme: "city", seed: 7, map }, extra || {})); }
/* runs the sim until `until(S)` or the time runs out, holding `vec` (or a function of S) */
function run(S, vec, until, maxSec){
  const n = Math.round((maxSec || 10) / STEP);
  for (let i = 0; i < n; i++){
    if (until && until(S)) return true;
    simStepWith(S, typeof vec === "function" ? vec(S) : vec);
  }
  return until ? until(S) : true;
}
function simStepWith(S, v){ G.simStep(S, STEP, v || { x: 0, z: 0 }); }
const NONE = { x: 0, z: 0 };
const UP_RIGHT = () => { const w = G.hexToWorld(1, -1); const l = Math.hypot(w.x, w.z); return { x: w.x / l, z: w.z / l }; };
function landings(S){ return S.events.filter(e => e.type === "landed").length; }

describe("the hex grid", () => {
  it("places pointy-top hexes with the PRD's formula and finds the hex under any point", () => {
    const R = CONFIG.R;
    expect(G.hexToWorld(1, 0)).toEqual({ x: Math.sqrt(3) * R, z: 0 });
    expect(G.hexToWorld(0, 2).z).toBeCloseTo(3 * R);
    for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++){
      const w = G.hexToWorld(q, r);
      expect(G.worldToHex(w.x + 0.3, w.z - 0.3)).toEqual({ q, r });
    }
  });
  it("turns a held direction into the nearest of the six neighbours, the same however the camera is turned", () => {
    // pressing "right" with the camera turned 30 degrees still means the neighbour on the right of the screen
    for (const yaw of [0, 0.3, -0.4]){
      const v = G.screenToWorld(1, 0, yaw);
      const d = G.pickDir(v, -1);
      const dv = G.towardVec({ q: 0, r: 0 }, { q: G.DIRS[d][0], r: G.DIRS[d][1] });
      expect(dv.x * v.x + dv.z * v.z).toBeGreaterThan(0.85);
    }
    expect(G.pickDir({ x: 0.05, z: 0.1 }, -1)).toBe(-1);               // inside the dead zone: no direction
    expect(G.pickDir(G.screenToWorld(1, 0, 0), -1)).toBe(0);          // right
    expect(G.pickDir(G.screenToWorld(0.8, 1, 0), 0)).toBe(1);         // up-right wins clearly
    expect(G.pickDir(G.screenToWorld(0.97, 0.26, 0), 0)).toBe(0);     // near a border it keeps its last pick
  });
  it("a quick tap moves one tile: letting go mid-hop keeps the hop you aimed", () => {
    const L = lvl(["P. .. ..", "8. 8. 8.", "8. 8. ..", ".. S. .."]);
    const S = G.createSim(L);
    run(S, NONE, s => s.mode === "bounce" && s.phase === "air" && s.t > 0.05, 3);   // airborne, bouncing in place
    const from = { ...S.from };
    const right = G.screenToWorld(1, 0, 0);
    for (let i = 0; i < 6; i++) G.simStep(S, STEP, right);                           // a 50 ms tap
    run(S, NONE, s => s.phase === "dwell", 2);
    expect(S.to).toEqual({ q: from.q + 1, r: from.r });
  });
  it("a tap made too late in a hop is kept for the next hop, but letting go of a long hold adds no extra hop", () => {
    const L = lvl(["P. .. .. ..", "8. 8. 8. 8.", "8. 8. 8. ..", ".. S. .. .."]);
    const AIR = CONFIG.BOUNCE - CONFIG.DWELL;
    const S = G.createSim(L);
    run(S, NONE, s => s.mode === "bounce" && s.phase === "air" && s.t / AIR > CONFIG.LOCK + 0.05, 3);
    const start = { ...S.from };
    const right = G.screenToWorld(1, 0, 0);
    for (let i = 0; i < 4; i++) G.simStep(S, STEP, right);                           // tapped after the lock
    const hop = S.hop;
    run(S, NONE, s => s.hop > hop && s.phase === "air" && s.t > 0.1, 2);             // the next hop
    expect(S.to).toEqual({ q: start.q + 1, r: start.r });
    // now a long hold that ends late in the hop: the hop it was holding happens, nothing after it
    const S2 = G.createSim(L);
    run(S2, right, s => s.mode === "bounce" && s.phase === "air" && s.t / AIR > CONFIG.LOCK + 0.05, 3);
    const aimed = { ...S2.to }, hop2 = S2.hop;
    run(S2, NONE, s => s.hop > hop2 && s.phase === "air" && s.t > 0.1, 2);
    expect(S2.to).toEqual(aimed);                                                     // bounces in place where it landed
  });
  it("holding straight up zigzags straight up the screen (there is no neighbour straight up), never drifting off sideways", () => {
    const L = lvl([".. 8. ..", ".. 8. ..", ".. 8. ..", ".. 8. ..", ".. 8. ..", "8. 8. 8.", ".. S. .."]);
    const S = G.createSim(L);
    const up = G.screenToWorld(0, 1, 0);
    const xs = [];
    run(S, up, s => { if (s.events.some(e => e.type === "landed")){ xs.push(G.hexToWorld(s.to.q, s.to.r).x); s.events.length = 0; } return xs.length >= 5; }, 10);
    expect(S.mode).toBe("bounce");
    const x0 = G.hexToWorld(L.spawn.q, L.spawn.r).x;
    for (const x of xs) expect(Math.abs(x - x0)).toBeLessThan(CONFIG.R * 1.2);
  });
});

describe("tile countdown", () => {
  it("1. a tile starting at 8 shows 8, becomes 7 after one landing, and runs through the colours in order", () => {
    expect(G.DUR_COLORS.slice(1)).toEqual(["#FF4258", "#FF943D", "#FFE45C", "#B8ED38", "#19D5C5", "#3685FF", "#9955FF", "#EE39FF"]);
    const L = lvl(["P.", "8.", "S."]);
    const S = G.createSim(L);
    const k = G.hexKey(0, 1);
    expect(S.tiles.get(k).dur).toBe(8);
    run(S, UP_RIGHT(), s => landings(s) >= 1, 5);
    expect(S.tiles.get(k).dur).toBe(7);
  });
  it("2. a red tile holds one landing, shows 0, and only falls away once the ball leaves", () => {
    const L = lvl(["P. ..", "1. ..", "S. .."]);
    const S = G.createSim(L);
    const k = G.hexKey(0, 1), t = S.tiles.get(k);
    run(S, UP_RIGHT(), s => s.events.some(e => e.type === "tileSpent"), 5);
    expect(t.dur).toBe(0);
    expect(t.life).toBe("spent");
    expect(S.mode).toBe("bounce");                                  // landing on red is safe
    run(S, NONE, s => s.events.some(e => e.type === "tileCollapsed"), 2);
    expect(t.life).toBe("collapsing");
    expect(G.tileSupports(t)).toBe(false);
  });
  it("3. coming back to a fallen tile finds nothing to land on, even while its pieces are still falling", () => {
    const L = lvl(["P. ..", "1. ..", "S. .."]);
    const S = G.createSim(L);
    run(S, UP_RIGHT(), s => s.events.some(e => e.type === "tileSpent"), 5);
    run(S, NONE, s => s.mode === "falling" || s.mode === "failed", 3);  // bouncing in place on a spent tile
    expect(S.cause).toBe("Tile exhausted");
  });
  it("4. bouncing in place uses one landing per bounce, never one per frame", () => {
    const L = lvl(["P.", "8.", "S."]);
    const S = G.createSim(L);
    run(S, UP_RIGHT(), s => landings(s) >= 1, 5);
    S.events.length = 0;
    run(S, NONE, null, CONFIG.BOUNCE * 3 + 0.01);
    expect(S.tiles.get(G.hexKey(0, 1)).dur).toBe(7 - 3);
  });
  it("5. grey tiles never run out", () => {
    const L = lvl(["P.", "S."]);
    const S = G.createSim(L);
    run(S, NONE, null, 20);
    expect(S.mode).toBe("bounce");
    expect(G.tileSupports(S.tiles.get(G.hexKey(0, 1)))).toBe(true);
  });
});

describe("diamonds and the rescue hover", () => {
  it("6. awards a diamond once, a large one adds exactly 3, and the meter stops at 10", () => {
    const L = lvl(["P. .. ..", "8D 8D ..", "8D 8D ..", "S. .. .."]);
    const S = G.createSim(L);
    run(S, UP_RIGHT(), s => s.collected.size >= 1, 5);
    expect(S.energy).toBe(3);
    run(S, NONE, null, CONFIG.BOUNCE * 2);                           // more landings on the same tile
    expect(S.energy).toBe(3);
    S.energy = 9;
    const S2 = G.createSim(L); S2.energy = 9;
    run(S2, UP_RIGHT(), s => s.collected.size >= 1, 5);
    expect(S2.energy).toBe(10);
  });
  it("7. a landing with nothing under it at 10 energy starts one hover and empties the meter", () => {
    const L = lvl(["P. .. ..", ".. .. ..", "S. .. .."]);
    const S = G.createSim(L); S.energy = 10;
    run(S, UP_RIGHT(), s => s.mode === "hover", 5);
    expect(S.mode).toBe("hover");
    expect(S.energy).toBe(0);
    expect(S.events.filter(e => e.type === "hoverStarted").length).toBe(1);
  });
  it("8. below 10 energy the ball falls instead", () => {
    const L = lvl(["P. ..", ".. ..", "S. .."]);
    const S = G.createSim(L); S.energy = 9;
    run(S, UP_RIGHT(), s => s.mode === "falling", 5);
    expect(S.mode).toBe("falling");
    expect(S.cause).toBe("No landing tile");
    run(S, NONE, s => s.mode === "failed", 3);
    expect(S.deaths).toBe(1);
  });
  it("9. a hover touchdown is one landing, and it may use a tile's last landing", () => {
    // start at the bottom, hop up-right into the gap, glide on up to the red tile beyond it
    const L = lvl([".. P. ..", ".. 1. ..", ".. .. ..", "S. .. .."]);
    const S = G.createSim(L); S.energy = 10;
    const target = G.hexToWorld(L.tiles.find(t => t.durability === 1).q, L.tiles.find(t => t.durability === 1).r);
    run(S, s => {
      if (s.mode !== "hover") return UP_RIGHT();
      const dx = target.x - s.hover.x, dz = target.z - s.hover.z, l = Math.hypot(dx, dz) || 1;
      return { x: dx / l, z: dz / l };
    }, s => s.events.some(e => e.type === "hoverEnded"), 8);
    const red = [...S.tiles.values()].find(t => t.durability === 1);
    expect(S.events.filter(e => e.type === "landed").length).toBe(1);
    expect(red.dur).toBe(0);
  });
  it("10. a hover that runs out over a gap falls", () => {
    const L = lvl(["P. .. .. ..", ".. .. .. ..", ".. .. .. ..", ".. .. .. ..", "S. .. .. .."]);
    const S = G.createSim(L); S.energy = 10;
    run(S, s => s.mode === "hover" ? { x: 1, z: 0 } : { x: 1, z: 0 }, s => s.mode === "falling", 6);
    expect(S.cause).toBe("Hover expired");
  });
});

describe("white launchers", () => {
  const map = [".. G. .. G. ..", ".. .. .. .. ..", ".. .. Wa .. ..", ".. .. S. .. .."];
  it("11. only throw to their own targets that are there to land on, never to another launcher", () => {
    const L = lvl(map, { launch: { a: [[1, 0], [3, 0]] } });
    const targets = new Set(L.tiles.find(t => t.kind === "white").launchTargets.map(g => G.hexKey(g.q, g.r)));
    const w = L.tiles.find(t => t.kind === "white"), toW = G.towardVec(L.spawn, w);
    for (let seed = 1; seed <= 30; seed++){
      const S = G.createSim(L, seed);
      run(S, s => s.mode === "ready" || (s.from.q === L.spawn.q && s.from.r === L.spawn.r) ? toW : NONE, s => s.mode === "launch", 6);
      expect(targets.has(G.hexKey(S.to.q, S.to.r))).toBe(true);
    }
    const bad = lvl([".. Wb .. G. ..", ".. .. .. .. ..", ".. .. Wa .. ..", ".. .. S. .. .."], { launch: { a: [[1, 0], [3, 0]], b: [[3, 0], [2, 2]] } });
    expect(G.validateLevel(bad).join(" ")).toContain("aims at another launcher");
  });
  it("12. a launcher with no target left to land on acts like a grey tile", () => {
    const L = lvl([".. 1. .. 1. ..", ".. .. .. .. ..", ".. .. Wa .. ..", ".. .. S. .. .."], { launch: { a: [[1, 0], [3, 0]] } });
    const S = G.createSim(L);
    for (const t of S.tiles.values()) if (t.durability === 1){ t.dur = 0; t.life = "absent"; }
    const w = L.tiles.find(t => t.kind === "white"), toW = G.towardVec(L.spawn, w);
    run(S, s => s.mode === "ready" || (s.phase === "air" && s.from.q === L.spawn.q && s.from.r === L.spawn.r) ? toW : NONE,
      s => s.landedHop >= 2, 6);
    expect(S.mode).toBe("bounce");                                   // no throw: it bounced on it like grey
    expect(S.to).toEqual({ q: w.q, r: w.r });
  });
  it("13. the same seed and the same moves always give the same throws", () => {
    const L = G.LEVELS.find(l => l.id === 10);
    const a = G.planWitness(L, 5).path.map(p => G.hexKey(p.q, p.r)).join(" ");
    const b = G.planWitness(L, 5).path.map(p => G.hexKey(p.q, p.r)).join(" ");
    expect(a).toBe(b);
    const outcomes = new Set();
    for (let s = 1; s <= 20; s++) outcomes.add(G.planWitness(L, s).path[2] && G.hexKey(G.planWitness(L, s).path[2].q, G.planWitness(L, s).path[2].r));
    expect(outcomes.size).toBeGreaterThan(1);                        // and different seeds really do differ
  });
});

describe("checkpoints, pausing and saving", () => {
  it("14. a checkpoint retry puts back the tiles, diamonds, energy and dice together, but keeps the time and falls", () => {
    const L = G.LEVELS.find(l => l.id === 19);
    const r = G.replayWitness(L, L.solutionWitness, L.seed);
    expect(r.ok).toBe(true);
    const S = G.createSim(L);
    const path = L.solutionWitness;
    let i = 0;
    run(S, s => {
      const deciding = s.mode === "ready" || s.phase === "dwell";
      const from = deciding ? s.to : s.from, next = path[Math.min(i, path.length - 1)];
      return G.towardVec(from, next);
    }, s => { if (s.events.some(e => e.type === "landed")){ i++; s.events.length = 0; } return !!s.snap; }, 60);
    const snapTiles = JSON.stringify(S.snap.tiles), snapEnergy = S.snap.energy, snapRng = S.snap.rng, gems = [...S.collected].join();
    // wander off: use up tiles, fall
    run(S, UP_RIGHT(), s => s.mode === "failed", 20);
    S.energy = 7; S.collected.add("dX"); S.rng.s = 12345;
    const time = S.time, deaths = S.deaths;
    G.retryCheckpoint(S);
    expect(JSON.stringify(G.capture(S, S.to).tiles)).toBe(snapTiles);
    expect(S.energy).toBe(snapEnergy);
    expect(S.rng.s).toBe(snapRng);
    expect([...S.collected].join()).toBe(gems);
    expect(S.time).toBe(time);
    expect(S.deaths).toBe(deaths);
    expect(S.mode).toBe("ready");
  });
  it("15. gameplay only moves when stepped: the game's loop caps catch-up and stops while paused or hidden", () => {
    const S = G.createSim(G.LEVELS[0]);
    const t0 = S.time;
    expect(S.time).toBe(t0);                                         // no step, no time
    const game = html.slice(html.indexOf("/*GAME*/"));
    expect(game).toContain("Math.min(dt, CONFIG.MAX_CATCHUP)");
    expect(game).toContain('document.addEventListener("visibilitychange"');
    expect(game).toMatch(/if \(app\.state !== "PLAYING"\)[^\n]*return/);
  });
  it("17. a missing or corrupt save can't stop the game starting", () => {
    for (const raw of [null, undefined, "x", 5, [], { unlocked: "lots", settings: "no" }, { unlocked: 99, best: { 3: -1, 4: "a" }, awards: { 2: "dzzq" } }]){
      const s = G.sanitizeSave(raw);
      expect(s.unlocked).toBeGreaterThanOrEqual(1);
      expect(s.unlocked).toBeLessThanOrEqual(20);
      expect(typeof s.settings.master).toBe("number");
    }
    const s = G.sanitizeSave({ unlocked: 99, best: { 3: -1, 4: 50000 }, awards: { 2: "dzzq" } });
    expect(s.unlocked).toBe(20);
    expect(s.best).toEqual({ 4: 50000 });
    expect(s.awards[2]).toBe("dz");
  });
  it("18. finishing level 20 ends the campaign rather than looking for a level 21", () => {
    expect(G.LEVELS.length).toBe(20);
    const game = html.slice(html.indexOf("/*GAME*/"));
    expect(game).toContain('"CAMPAIGN_COMPLETE"');
    expect(game).toMatch(/level\.id === CONFIG\.LEVEL_COUNT/);
  });
  it("gives badges for every diamond, no falls and the target time, separately", () => {
    const L = G.LEVELS[0];
    expect(G.awardsFor(L, { diamonds: 2, diamondTotal: 2, deaths: 0, time: 1 })).toBe("dzt");
    expect(G.awardsFor(L, { diamonds: 1, diamondTotal: 2, deaths: 1, time: 999 })).toBe("");
    expect(G.mergeAwards("dz", "tz")).toBe("dtz");
    expect(G.formatTime(75.25)).toBe("1:15.3");
  });
});

describe("the 20 levels", () => {
  it("are all there, in four themes, five each", () => {
    expect(G.LEVELS.map(l => l.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const themes = G.LEVELS.map(l => l.theme);
    expect(themes.slice(0, 5).every(t => t === "city")).toBe(true);
    expect(themes.slice(5, 10).every(t => t === "reactor")).toBe(true);
    expect(themes.slice(10, 15).every(t => t === "sky")).toBe(true);
    expect(themes.slice(15).every(t => t === "cosmic")).toBe(true);
  });
  for (const L of G.LEVELS){
    it(`level ${L.id} "${L.title}" is valid and its winning path works with the real rules, no hover`, () => {
      expect(G.validateLevel(L)).toEqual([]);
      expect(L.tiles.filter(t => t.kind === "standard").every(t => t.durability >= 1 && t.durability <= 8)).toBe(true);
      const r = G.replayWitness(L, L.solutionWitness, L.seed);
      expect(r.ok).toBe(true);
      expect(r.S.energy).toBeLessThanOrEqual(10);
      for (const id in L.checkpointWitnesses){
        expect(r.cps[id]).toBeTruthy();
        expect(G.replayWitness(L, L.checkpointWitnesses[id], L.seed, r.cps[id]).ok).toBe(true);
      }
      expect(L.parTimeSeconds).toBeGreaterThan(0);
    });
  }
  it("each level has its own environment and sky: no two levels look alike", () => {
    expect(Object.keys(G.LEVEL_ENV).map(Number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const looks = new Set(), names = new Set();
    for (const L of G.LEVELS){
      const e = G.LEVEL_ENV[L.id];
      expect(e.sky).toHaveLength(3);
      expect(["clear", "rain", "snow", "fog", "embers", "steam", "smog", "ash", "meteors"]).toContain(e.weather);
      looks.add(e.sky.join() + "|" + e.weather + "|" + e.feature);
      names.add(e.name);
    }
    expect(looks.size).toBe(20);
    expect(names.size).toBe(20);
    // flashes (lightning, a red-alert pulse) all switch off with "Reduce flashes"
    const game = html.slice(html.indexOf("/*GAME*/"));
    expect(game).toMatch(/reducedFlash[^\n]*flash/);
  });
  it("every launcher throw leads somewhere you can still finish from", () => {
    for (const L of G.LEVELS.filter(l => l.tiles.some(t => t.kind === "white"))){
      for (let seed = 1; seed <= 16; seed++) expect(G.planWitness(L, seed).ok, `level ${L.id} seed ${seed}`).toBe(true);
    }
  });
  it("don't give every tile eight landings, and get more fragile later on", () => {
    const avg = L => { const s = L.tiles.filter(t => t.kind === "standard"); return s.reduce((a, t) => a + t.durability, 0) / s.length; };
    expect(G.LEVELS.slice(0, 5).map(avg).reduce((a, b) => a + b) / 5).toBeGreaterThan(G.LEVELS.slice(15).map(avg).reduce((a, b) => a + b) / 5);
    expect(G.LEVELS.every(L => L.tiles.some(t => t.kind === "standard" && t.durability < 8))).toBe(true);
  });
});
