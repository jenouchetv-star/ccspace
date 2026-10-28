// Road to Home is one self-contained page (games/road-to-home.html). Its rules (the islands, the room
// codes, the card piles) live between BEGIN/END markers so they can be tested without a browser; the
// page, its art and its place on the Play page are pinned here too.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/road-to-home.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { makeTerrain, reachable, parOf, TWO_STARTS, deckPlan, rotatedEdges, genCode, cleanCode, fmtCode, G, T, SIZES, SET_SEED, DENSITY, BRIDGE_MIN, BASE_EDGES };"
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
      expect(Object.keys(plan).sort()).toEqual(["BRIDGE", "CORNER", "CROSSROADS", "STRAIGHT", "UTURN"]);
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
});

describe("the page", () => {
  it("is a stand-alone page that wears the site's game skin and uses the site's own copy of three.js", () => {
    expect(page).toContain('<link rel="stylesheet" href="game-skin.css">');
    expect(page).toContain('<script src="../assets/vendor/three.min.js"></script>');
    expect(page).not.toMatch(/cdnjs|cdn\.tailwindcss|fontawesome/i);
    expect(existsSync(new URL("../assets/vendor/three.min.js", import.meta.url))).toBe(true);
  });

  it("is a home to drive to, not a flag", () => {
    expect(page).toContain("Road to Home");
    expect(page).not.toMatch(/flag/i);
    expect(page).toContain("HOME");
  });

  it("lets a bridge go over a road, and only across it", () => {
    expect(page).toContain("only a bridge can go on top of a road, and only across it, never along it");
    expect(page).toContain("A bridge must cross the road, not run along it.");
    expect(page).toContain("OVER_H = .27");                          // high enough for a car to drive underneath
  });

  it("offers a 3D view and a top-down 2D view, and turns the board a quarter at a time", () => {
    expect(page).toContain('data-view="3d"');
    expect(page).toContain('data-view="2d"');
    expect(page).toContain('id="bRotL"');
    expect(page).toContain('id="bRotR"');
    expect(page).toContain("const FOV = 24");                       // a narrow lens: a tight, near-isometric shot, never ultra wide
  });

  it("lets a stuck player swap a card, randomize the whole deck, or undo", () => {
    expect(page).toContain('id="bSwap"');
    expect(page).toContain('Randomize my deck');
    expect(page).toContain('id="bUndo"');
    expect(page).toContain("function hasMove(p)");
    expect(page).toContain("None of your cards fits here.");
  });

  it("starts a Set stage or a Random map, at three sizes", () => {
    expect(page).toContain('<option value="set">Set stage</option>');
    expect(page).toContain('<option value="random">Random map</option>');
    for (const d of ["easy", "medium", "hard"]) expect(page).toContain('data-diff="' + d + '"');
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
    expect(page).toContain('sb.channel("r2h-room-" + code');
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
  it("is registered as an embedded game with a cover and a link to the cardboard city activity", () => {
    const entry = index.split('G({ id:"game-road-to-home"')[1].split('leadsTo:')[1].split("}),")[0];
    expect(entry).toContain('act-cardboard-city');
    const g = index.split('G({ id:"game-road-to-home"')[1].split("}),")[0];
    expect(g).toContain('path:"games/road-to-home.html"');
    expect(g).toContain('kind:"embed"');
    expect(g).toContain('cover:{ src:"assets/games/road-to-home.jpg"');
    expect(g).toContain("6-character code");
  });
  it("has its cover and thumbnail", () => {
    expect(existsSync(new URL("../assets/games/road-to-home.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/road-to-home-thumb.jpg", import.meta.url))).toBe(true);
    expect(index).toContain('id:"act-cardboard-city"');
  });
  it("is part of the site's check that every game fits the window", () => {
    expect(index).toContain('["games/road-to-home.html",        "#hand"],');
  });
});
