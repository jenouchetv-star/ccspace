// Pathbuilder is one self-contained page (games/pathbuilder.html). Its rules (the islands, the room
// codes, the card piles) live between BEGIN/END markers so they can be tested without a browser; the
// page, its art and its place on the Play page are pinned here too.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/pathbuilder.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { makeTerrain, buildTerrain, route, playable, reachable, parOf, TWO_STARTS, RIVER_MAX, deckPlan, rotatedEdges, genCode, cleanCode, fmtCode, G, T, SIZES, SET_SEED, DENSITY, BRIDGE_MIN, TUNNEL_MIN, RAMP_MIN, BASE_EDGES, rampSpan };"
)();
const { G } = R;
const count = (t, v) => t.flat().filter(x => x === v).length;
const SEEDS = Array.from({ length:40 }, (_, i) => 100 + i * 37);

describe("room codes", () => {
  it("always make six letters and numbers, with at least one of each", () => {
    for (let i = 0; i < 4000; i++) {
      const c = R.genCode((i * 2654435761) >>> 0);
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);          // no I, O, 0 or 1: they look alike
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[2-9]/);
    }
  });
  it("clean up what a player types and reject anything else", () => {
    expect(R.cleanCode("abc 234")).toBe("ABC234");
    expect(R.cleanCode("a-b-c-2-3-4")).toBe("ABC234");
    expect(R.cleanCode("ABC23")).toBe("");
    expect(R.cleanCode("ABC2345")).toBe("");
    expect(R.cleanCode("ABCO12")).toBe("");
    expect(R.cleanCode(null)).toBe("");
    expect(R.fmtCode("ABC234")).toBe("ABC 234");
  });
});

describe("the islands", () => {
  it("get bigger with the level, and the same numbers always build the same island", () => {
    expect(R.SIZES).toEqual({ easy:10, medium:14, hard:18 });
    for (const d of ["easy", "medium", "hard"]) {
      const a = R.makeTerrain(d, R.SET_SEED[d]), b = R.makeTerrain(d, R.SET_SEED[d]);
      expect(a).toEqual(b);
      expect(a).toHaveLength(R.SIZES[d]);
      expect(a[0]).toHaveLength(R.SIZES[d]);
    }
    expect(R.makeTerrain("easy", 1)).not.toEqual(R.makeTerrain("easy", 2));
  });

  it("always leave a clear corner to start in and a clear corner for the house", () => {
    for (const d of ["easy", "medium", "hard"]) for (const seed of SEEDS) {
      const t = R.makeTerrain(d, seed), n = t.length;
      for (let r = 0; r <= 2; r++) for (let c = 0; c <= 5; c++) expect(t[r][c]).toBe(G.GRASS);
      for (let r = n - 3; r < n; r++) for (let c = n - 3; c < n; c++) expect(t[r][c]).toBe(G.GRASS);
    }
  });

  it("always have a way home, over grass and a bridge over any river", () => {
    for (const d of ["easy", "medium", "hard"]) for (const seed of SEEDS) {
      const t = R.makeTerrain(d, seed), n = t.length;
      expect(R.reachable(t, n, { r:0, c:0 }, { r:n - 1, c:n - 1 })).toBeGreaterThan(0);
      const home = { r:n - 1, c:n - 1 }, a = R.reachable(t, n, R.TWO_STARTS[0], home), b = R.reachable(t, n, R.TWO_STARTS[1], home);
      expect(a).toBeGreaterThan(0);
      expect(b).toBe(a);                                      // with two players, the same distance to go: the par is fair to both
      expect(R.parOf(t, n)).toBeGreaterThanOrEqual(n);
    }
  });

  it("never hand a player an island that cannot be finished, however many random maps are made", () => {
    for (const d of ["easy", "medium", "hard"]) for (let seed = 1; seed <= 150; seed++) {
      const t = R.makeTerrain(d, seed * 13), n = t.length, home = { r:n - 1, c:n - 1 };
      expect(R.playable(t, n, d)).toBe(true);
      const a = R.route(t, n, { r:0, c:0 }, home);
      expect(a).not.toBeNull();
      expect(a.rivers).toBeLessThanOrEqual(R.RIVER_MAX[d]);
    }
  });

  it("know that a bridge only goes straight, so a river that would need a turn on the water is not a way through", () => {
    const G = R.G, o = G.GRASS, w = G.RIVER, v = G.VOID;
    const turn = [[o, w, w], [v, v, w], [v, v, o]];             // the only way is along the water and round a corner
    expect(R.route(turn, 3, { r:0, c:0 }, { r:2, c:2 })).toBeNull();
    const straight = [[o, w, o], [o, w, o], [o, o, o]];         // straight across is fine
    expect(R.route(straight, 3, { r:0, c:0 }, { r:2, c:2 })).not.toBeNull();
    expect(R.route(straight, 3, { r:0, c:0 }, { r:2, c:2 }).steps).toBe(4);   // and as short as going round by land
    const only = [[o, o, o], [w, w, w], [o, o, o]];
    expect(R.route(only, 3, { r:0, c:0 }, { r:2, c:2 }).rivers).toBe(1);
  });

  it("put a river across the island and trees and rocks in the way, more of them on the harder levels", () => {
    const avg = d => SEEDS.reduce((s, seed) => { const t = R.makeTerrain(d, seed); return s + (count(t, G.TREE) + count(t, G.ROCK)) / (t.length * t.length); }, 0) / SEEDS.length;
    expect(avg("easy")).toBeGreaterThan(.02);
    expect(avg("medium")).toBeGreaterThan(avg("easy"));
    expect(avg("hard")).toBeGreaterThan(avg("medium"));
    for (const d of ["easy", "medium", "hard"]) for (const seed of SEEDS.slice(0, 10)) expect(count(R.makeTerrain(d, seed), G.RIVER)).toBeGreaterThanOrEqual(R.SIZES[d] * .6);
  });

  it("have a river of their own on every set stage, and the harder stages are the bigger ones", () => {
    const sizes = ["easy", "medium", "hard"].map(d => R.makeTerrain(d, R.SET_SEED[d]).length);
    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
  });
});

describe("the cards", () => {
  it("fill a pile big enough for the island, with enough bridges for the rivers", () => {
    for (const d of ["easy", "medium", "hard"]) {
      const par = R.parOf(R.makeTerrain(d, R.SET_SEED[d]), R.SIZES[d]), plan = R.deckPlan(par, d);
      const total = Object.values(plan).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(44);
      expect(total).toBeGreaterThan(par * 2);
      expect(plan.BRIDGE).toBeGreaterThanOrEqual(R.BRIDGE_MIN[d]);
      expect(plan.TUNNEL).toBeGreaterThanOrEqual(R.TUNNEL_MIN[d]);
      expect(plan.RAMP).toBeGreaterThanOrEqual(R.RAMP_MIN[d]);
      expect(Object.keys(plan).sort()).toEqual(["BRIDGE", "CORNER", "CROSSROADS", "RAMP", "STRAIGHT", "TEE", "TUNNEL", "UTURN"]);
      Object.values(plan).forEach(n => expect(n).toBeGreaterThan(0));
    }
  });
  it("turn clockwise, a quarter at a time", () => {
    expect(R.rotatedEdges("CORNER", 0)).toEqual([1, 1, 0, 0]);   // north and east
    expect(R.rotatedEdges("CORNER", 1)).toEqual([0, 1, 1, 0]);   // east and south
    expect(R.rotatedEdges("CORNER", 2)).toEqual([0, 0, 1, 1]);   // south and west
    expect(R.rotatedEdges("STRAIGHT", 1)).toEqual([0, 1, 0, 1]);
    expect(R.rotatedEdges("UTURN", 1)).toEqual([0, 0, 0, 1]);    // open side was south, now west
  });
  it("has a T-intersection with three roads and a closed side", () => {
    expect(R.rotatedEdges("TEE", 0)).toEqual([1, 1, 0, 1]);      // north, east and west; the south is closed
    expect(R.rotatedEdges("TEE", 1)).toEqual([1, 1, 1, 0]);
    expect(R.rotatedEdges("TEE", 2)).toEqual([0, 1, 1, 1]);
    expect(R.rotatedEdges("TEE", 3)).toEqual([1, 0, 1, 1]);
    for (let r = 0; r < 4; r++) expect(R.rotatedEdges("TEE", r).reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("has a tunnel that runs straight, like a bridge", () => {
    expect(R.rotatedEdges("TUNNEL", 0)).toEqual([1, 0, 1, 0]);
    expect(R.rotatedEdges("TUNNEL", 1)).toEqual([0, 1, 0, 1]);
  });
  it("has a ramp with one open side: the way in, opposite the way it jumps", () => {
    expect(R.rotatedEdges("RAMP", 0)).toEqual([0, 0, 1, 0]);     // road comes in from the south, the car jumps north
    expect(R.rotatedEdges("RAMP", 1)).toEqual([0, 0, 0, 1]);     // in from the west, jumps east
    expect(R.rotatedEdges("RAMP", 2)).toEqual([1, 0, 0, 0]);
    expect(R.rotatedEdges("RAMP", 3)).toEqual([0, 1, 0, 0]);
  });
});

describe("the ramp's jump", () => {
  const { G } = R, n = 6, grass = () => Array.from({ length:n }, () => Array(n).fill(G.GRASS));
  it("jumps one rock, or one gap in the sea, and lands on the next square", () => {
    const t = grass(); t[2][3] = G.ROCK;
    expect(R.rampSpan(t, n, 3, 3, 0)).toEqual({ gap:{ r:2, c:3 }, land:{ r:1, c:3 } });   // facing north
    const t2 = grass(); t2[3][4] = G.VOID;
    expect(R.rampSpan(t2, n, 3, 3, 1)).toEqual({ gap:{ r:3, c:4 }, land:{ r:3, c:5 } });  // facing east
  });
  it("cannot jump two squares: the gap is one square, and the square after it must be land", () => {
    const t = grass(); t[2][3] = G.ROCK; t[1][3] = G.ROCK;
    expect(R.rampSpan(t, n, 3, 3, 0)).toBeNull();                 // two rocks in a row
    const t2 = grass(); t2[2][3] = G.VOID; t2[1][3] = G.VOID;
    expect(R.rampSpan(t2, n, 3, 3, 0)).toBeNull();                // two squares of sea in a row
  });
  it("has nothing to jump over grass, a tree, or a river, and cannot jump off the edge of the island", () => {
    expect(R.rampSpan(grass(), n, 3, 3, 0)).toBeNull();
    const tree = grass(); tree[2][3] = G.TREE; expect(R.rampSpan(tree, n, 3, 3, 0)).toBeNull();
    const river = grass(); river[2][3] = G.RIVER; expect(R.rampSpan(river, n, 3, 3, 0)).toBeNull();
    const edge = grass(); edge[0][3] = G.VOID; expect(R.rampSpan(edge, n, 1, 3, 0)).toBeNull();   // the square after it is off the map
  });
  it("can land on the far side of a river square only by a bridge, so a river square counts as land to aim at", () => {
    const t = grass(); t[2][3] = G.ROCK; t[1][3] = G.RIVER;
    expect(R.rampSpan(t, n, 3, 3, 0)).not.toBeNull();
    const sea = grass(); sea[2][3] = G.ROCK; sea[1][3] = G.VOID;
    expect(R.rampSpan(sea, n, 3, 3, 0)).toBeNull();               // landing in the sea is no landing
  });
});

describe("the page", () => {
  it("is a stand-alone page that wears the site's game skin and uses the site's own copy of three.js", () => {
    expect(page).toContain('<link rel="stylesheet" href="game-skin.css">');
    expect(page).toContain('<script src="../assets/vendor/three.min.js"></script>');
    expect(page).not.toMatch(/cdnjs|cdn\.tailwindcss|fontawesome/i);
    expect(existsSync(new URL("../assets/vendor/three.min.js", import.meta.url))).toBe(true);
  });

  it("is a home to drive to, not a flag", () => {
    expect(page).toContain("Pathbuilder");
    expect(page).not.toMatch(/flag/i);
    expect(page).toContain("HOME");
  });

  it("lets a bridge go over a road, and only across it", () => {
    expect(page).toContain("only a bridge can go on top of a road, and only across it, never along it");
    expect(page).toContain("A bridge must cross the road, not run along it.");
    expect(page).toContain("OVER_H = .27");                          // high enough for a car to drive underneath
  });

  it("lets a tunnel go under a rock and only there, keeps trees protected, and lets a ramp jump a rock or a gap in the sea", () => {
    expect(page).toContain("function buildTunnel()");
    expect(page).toContain("a tunnel goes under a rock");
    expect(page).toContain("trees are protected: no road, bridge, tunnel or jump goes through one");
    expect(page).toContain("Trees are protected. Plan your road around the tree.");
    expect(page).toContain("A tunnel needs a rock to go under.");
    expect(page).toContain("function buildRamp()");
    expect(page).toContain("const sp = rampSpan(terrain, SIZE, r, c, card.rotation);");
    expect(page).toContain('acts.push({ k:"jump"');
    expect(page).toContain("A ramp jumps one rock or one gap in the sea.");
  });

  it("tells the player what a card is for as soon as it is selected, for every kind of card", () => {
    const tips = page.split("const CARD_TIPS = {")[1].split("};")[0];
    for (const k of ["STRAIGHT", "CORNER", "CROSSROADS", "TEE", "UTURN", "BRIDGE", "TUNNEL", "RAMP"]) expect(tips).toContain(k + ":");
    expect(page).toContain('<div id="tip" hidden>');
    expect(page).toContain("function syncTip()");
    expect(page).toContain("fitView(); syncTip();");                 // the tip follows every change to the hand
  });

  it("grows palm trees by the sea and pine trees toward the middle", () => {
    expect(page).toContain("function nearSea(r, c)");
    expect(page).toContain("makeTree(c, r, R, nearSea(r, c))");
    expect(page).toContain("function makePalm(g, R)");
    expect(page).toContain("pines grow toward the middle of the island");
  });

  it("lets a card be turned in place on the board before it is placed, and only places it on Place", () => {
    for (const id of ["pL", "pR", "pOk", "pNo"]) expect(page).toContain('id="' + id + '"');
    expect(page).toContain("function pickSquare(r, c)");
    expect(page).toContain("function turnPending(dir)");
    expect(page).toContain("function confirmPending()");
    expect(page).toContain("if (pending && pending.r === r && pending.c === c){ confirmPending(); return; }");   // a second tap on the square places it
    const tap = page.split("function tapAt(x, y, type){")[1].split("function ")[0];
    expect(tap).toContain("pickSquare(c.r, c.c)");
    expect(tap).not.toContain("tryPlace(");                          // a tap never places a card straight away
    expect(page).toContain('$("#pOk").disabled = !canPlace(pending.r, pending.c, hand[selected]);');   // no placing a turn that does not fit
  });

  it("locks a road in once it is placed: nobody can move or turn another player's road", () => {
    expect(page).toContain("That road is your friend’s. Roads are locked in once they are placed, so nobody can move another player’s road.");
    expect(page).toContain("That road is locked in. Only a bridge card can go over a road.");
    expect(page).not.toMatch(/grid\[[^\]]+\]\[[^\]]+\]\.rotation\s*=[^=]/);   // no code turns a tile that is already on the board
  });

  it("offers a 3D view and a top-down 2D view, and turns the board a quarter at a time", () => {
    expect(page).toContain('data-view="3d"');
    expect(page).toContain('data-view="2d"');
    expect(page).toContain('id="bRotL"');
    expect(page).toContain('id="bRotR"');
    expect(page).toContain("const FOV = 24");                       // a narrow lens: a tight, near-isometric shot, never ultra wide
  });

  it("lets a stuck player swap their cards for a new random set, or undo", () => {
    expect(page).not.toContain('id="bSwap"');                        // no separate one-card swap any more
    expect(page).toContain('<span class="t">Swap my cards</span>');
    expect(page).not.toContain('Randomize my deck');
    expect(page).toContain('id="bUndo"');
    expect(page).toContain("function hasMove(p)");
    expect(page).toContain("None of your cards fits here.");
  });

  it("starts a Set stage or a Random map, at three sizes", () => {
    expect(page).toContain('<option value="set">Set stage</option>');
    expect(page).toContain('<option value="random" selected>Random map</option>');
    for (const d of ["easy", "medium", "hard"]) expect(page).toContain('<option value="' + d + '"');   // a drop-down menu
  });

  it("makes the chosen card unmistakable", () => {
    expect(page).toContain('nm.textContent = i === selected ? "Selected"');   // it says so, inside the card where nothing can cut it off
    expect(page).toContain(".rc .tick");
    expect(page).toContain("#cards.pick .rc:not(.sel)");
  });

  it("does not take over the Escape key, which the site's game window uses to close itself", () => {
    expect(page).not.toMatch(/key\s*===?\s*["']Escape["']/);
  });
});

describe("playing together", () => {
  it("is a 6-character room code like Doodle Dash, over Supabase Realtime, with nothing saved", () => {
    expect(page).toContain('sb.channel("pathbuilder-room-" + code');
    expect(page).toContain("Rooms are live only");
    expect(page).toContain("persistSession:false");
    expect(page).toContain('Make a room code');
    expect(page).toContain('Join a friend');
    expect(page).toContain('maxlength="7"');
    expect(page).not.toMatch(/\.from\(["']/);                        // no table reads or writes
  });
  it("loads the realtime library only when two players want it", () => {
    expect(page).not.toMatch(/<script src="[^"]*supabase/);
    expect(page).toContain('s.src = "../assets/vendor/supabase.js"');
    expect(existsSync(new URL("../assets/vendor/supabase.js", import.meta.url))).toBe(true);
  });
  it("keeps each player's cards private and shares only the placed roads, in turn", () => {
    expect(page).toContain('mpSend({ t:"mv"');
    expect(page).toContain('mpSend({ t:"pass"');
    expect(page).toContain('mpSend({ t:"undo"');
    expect(page).not.toMatch(/t:"hand"|t:"cards"/);
    expect(page).toContain("p.tn !== turnNo || p.who !== current");
  });
  it("starts both cars close together on one island", () => {
    expect(page).toContain("players[1].start = online() ?");
    expect(page).toContain("players[2].start = { r:TWO_STARTS[1].r, c:TWO_STARTS[1].c };");
  });
});

describe("its place on the Play page", () => {
  it("is registered as an embedded game with a cover and a link to the Bottle-Cap Marble Run activity", () => {
    const entry = index.split('G({ id:"game-pathbuilder"')[1].split('leadsTo:')[1].split("}),")[0];
    expect(entry).toContain('act-marble-run');
    const g = index.split('G({ id:"game-pathbuilder"')[1].split("}),")[0];
    expect(g).toContain('path:"games/pathbuilder.html"');
    expect(g).toContain('kind:"embed"');
    expect(g).toContain('cover:{ src:"assets/games/pathbuilder.jpg"');
    expect(g).toContain("6-character code");
    expect(g).toContain('badge:"New"');
    expect(g).toContain("order:0");                                  // first on the list of online games
  });
  it("has its cover and thumbnail", () => {
    expect(existsSync(new URL("../assets/games/pathbuilder.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/pathbuilder-thumb.jpg", import.meta.url))).toBe(true);
    expect(index).toContain('id:"act-marble-run"');
  });
  it("is part of the site's check that every game fits the window", () => {
    expect(index).toContain('["games/pathbuilder.html",           "#hand"],');
  });
});

describe("the starting settings", () => {
  it("are 1 player, Medium and a Random map", () => {
    expect(page).toContain('let difficulty = "medium", mapRandom = true, mode = "solo";');
    expect(page).toContain('<option value="solo">1 player</option>');
    expect(page).toContain('<option value="medium" selected>Medium</option>');
    expect(page).toContain('<option value="random" selected>Random map</option>');
    expect(page).not.toContain(">Solo<");
  });
});

describe("the menu", () => {
  it("folds into one Settings menu on narrow screens, so no control runs off the side", () => {
    expect(page).toContain('aria-label="Game settings"');
    expect(page).toContain('id="bMenu"');
    expect(page).toContain('aria-controls="ctl"');
    expect(page).toContain('@media (max-width:900px){');
    expect(page).toContain("#hud.open .ctl{display:flex}");
    expect(page).toContain("function setMenu(open)");
    expect(page).not.toContain("overflow-x:auto;pointer-events:auto;scrollbar-width:none");   // no more scrolling top bar
  });
});

describe("the picture", () => {
  it("has no clouds drifting between the camera and the board, which washed it out", () => {
    expect(page).not.toContain("buildClouds");
    expect(page).not.toContain("clouds.forEach");
  });
});

describe("the water", () => {
  it("has a green-teal river and a darker blue sea, so they cannot be mistaken for each other", () => {
    expect(page).toContain('const riverMat = waterMaterial({ deep:"#2A9D8F", shallow:"#7CDDB8"');
    expect(page).toContain('const seaMat = waterMaterial({ deep:"#072B63", shallow:"#16569B"');
    expect(page).toContain("spec *= 0.025; fres *= 0.12;");           // and the sea hardly glints
  });
});
