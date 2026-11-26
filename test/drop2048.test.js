// Drop 2048 (owner, 2026-11-22): a free arcade game. Drop a numbered gem into a column; gems with the same number that
// touch by their sides smash into one where the dropped gem landed (two make double, each extra one doubles again),
// gems above fall, and new matches chain. The rules live in the game's pure block, so they are tested here directly.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { LINES, PHONEMES, lineKey as scriptKey } from "../scripts/drop2048-lines.mjs";

const game = readFileSync(new URL("../games/drop-2048.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const D = new Function(pure + "; return { COLORS, SIZES, DROPS, DROPS_6, DROPS_7, dropsFor, pickDrop, scanBoard, mergeValue, emptyGrid, landRow, isFull, groupAt, gravity, settle, smashAt, HAMMER_EVERY, chargeAfterDrop, hammerReady, lineKey, SAY, allLines, comboLine };")();

let uid = 0;
/** A grid from rows of numbers (0 = empty), top row first. */
const gridOf = (rows) => rows.map(r => r.map(v => (v ? { id: ++uid, v } : null)));
const values = (g) => g.map(r => r.map(t => (t ? t.v : 0)));
/** Drop v into column c the way the game does, and settle it. */
function dropInto(g, c, v){ const r = D.landRow(g, c); g[r][c] = { id: ++uid, v }; return D.settle(g, r, c); }

describe("the rules", () => {
  it("drops 2 to 16 on 5 x 5, up to 64 on 6 x 6, and up to 128 on 7 x 7 (owner, 2026-11-22 and -23)", () => {
    expect(D.SIZES).toEqual([5, 6, 7]);
    const seen = (n) => { const s = new Set(); for (let i = 0; i < 1000; i++) s.add(D.pickDrop(() => i / 1000, n)); return [...s].sort((a, b) => a - b); };
    expect(seen(5)).toEqual([2, 4, 8, 16]);
    expect(seen(6)).toEqual([2, 4, 8, 16, 32, 64]);
    expect(seen(7)).toEqual([2, 4, 8, 16, 32, 64, 128]);
    expect(D.dropsFor(5)).toBe(D.DROPS);
    /* the big ones are rare */
    expect(D.DROPS_7.find(d => d[0] === 128)[1]).toBeLessThan(D.DROPS_7.find(d => d[0] === 64)[1]);
  });
  it("never leaves two touching gems with the same number (owner, 2026-11-23: some were not merging)", () => {
    /* one fall makes two matches at once: both must merge, not just the first */
    const g = gridOf([[0, 0, 0, 0], [0, 4, 0, 0], [2, 8, 4, 0], [2, 8, 4, 0]].map(r => r.map(v => v)));
    D.settle(g, 3, 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++){ if (!g[r][c]) continue; expect(D.groupAt(g, r, c).length, r + "," + c).toBe(1); }
    /* and 300 random games on every board, checked after every drop */
    let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let game = 0; game < 300; game++){
      const n = D.SIZES[game % 3], b = D.emptyGrid(n);
      for (let k = 0; k < 120; k++){
        const c = Math.floor(rand() * n), r = D.landRow(b, c);
        if (r < 0){ if (D.isFull(b)) break; continue; }
        b[r][c] = { id: ++uid, v: D.pickDrop(rand, n) };
        D.settle(b, r, c);
        expect(D.scanBoard(b), "game " + game + " drop " + k).toBeNull();
        for (let x = 0; x < n; x++) for (let y = 0; y < n - 1; y++) if (b[y][x]) expect(b[y + 1][x], "floating gem").not.toBeNull();
      }
    }
  });
  it("two the same make double, and each extra one doubles again", () => {
    expect(D.mergeValue(4, 2)).toBe(8);
    expect(D.mergeValue(4, 3)).toBe(16);
    expect(D.mergeValue(4, 4)).toBe(32);
    expect(D.mergeValue(1024, 2)).toBe(2048);
  });
  it("three 4s in a row make 16 where the dropped gem landed", () => {
    const g = gridOf([[0, 0, 0], [0, 0, 0], [4, 0, 4]]);
    const steps = dropInto(g, 1, 4);
    expect(values(g)).toEqual([[0, 0, 0], [0, 0, 0], [0, 16, 0]]);
    expect(steps[0]).toMatchObject({ type: "merge", r: 2, c: 1, value: 16, chain: 1 });
    expect(steps[0].from).toHaveLength(2);
  });
  it("corners never count: only up, down, left and right", () => {
    const g = gridOf([[0, 0, 0], [0, 0, 0], [8, 0, 0]]);
    dropInto(g, 1, 4); dropInto(g, 1, 8);
    expect(values(g)).toEqual([[0, 0, 0], [0, 8, 0], [8, 4, 0]]);
  });
  it("a merge on top falls into the gap and chains into a combo", () => {
    /* 8 | 4 | 16: two 4s make 8, which falls, meets the 8 (16), then the 16 (32) */
    const g = gridOf([[0, 0, 0], [0, 0, 0], [8, 4, 16]]);
    const steps = dropInto(g, 1, 4);
    expect(values(g)).toEqual([[0, 0, 0], [0, 0, 0], [0, 32, 0]]);
    const merges = steps.filter(s => s.type === "merge");
    expect(merges.map(m => [m.value, m.chain])).toEqual([[8, 1], [16, 2], [32, 3]]);
    expect(steps.some(s => s.type === "fall")).toBe(true);
  });
  it("gems fall into gaps, and a full top row ends the game", () => {
    const g = gridOf([[2, 0], [0, 0]]);
    expect(D.gravity(g)).toEqual([expect.objectContaining({ fromR: 0, r: 1, c: 0 })]);
    expect(values(g)).toEqual([[0, 0], [2, 0]]);
    expect(D.landRow(gridOf([[2], [4]]), 0)).toBe(-1);
    expect(D.isFull(gridOf([[2, 4], [4, 2]]))).toBe(true);
    expect(D.isFull(gridOf([[0, 4], [4, 2]]))).toBe(false);
  });
  it("every number on the way to 2048 has its own color", () => {
    for (let v = 2; v <= 2048; v *= 2) expect(D.COLORS[v], String(v)).toMatch(/^#[0-9A-F]{6}$/i);
    expect(new Set(Object.values(D.COLORS)).size).toBe(Object.keys(D.COLORS).length);
  });
});

describe("the hammer (owner, 2026-11-22: for a younger child, after every 5 gems)", () => {
  it("charges one light per gem dropped, is ready at 5, and never stacks", () => {
    expect(D.HAMMER_EVERY).toBe(5);
    let c = 0;
    for (let i = 0; i < 4; i++) c = D.chargeAfterDrop(c);
    expect(D.hammerReady(c)).toBe(false);
    c = D.chargeAfterDrop(c);
    expect(D.hammerReady(c)).toBe(true);
    expect(D.chargeAfterDrop(c)).toBe(5);
  });
  it("smashes one gem: the gems above fall, and new matches smash too", () => {
    /* smash the 4 under a 2: the 2 falls next to the other 2, and they make 4 */
    const g = gridOf([[0, 0, 0], [0, 2, 0], [2, 4, 8]]);
    const res = D.smashAt(g, 2, 1);
    expect(res.moves).toEqual([expect.objectContaining({ fromR: 1, r: 2, c: 1 })]);
    expect(res.steps.find(s => s.type === "merge")).toMatchObject({ value: 4 });
    expect(values(g)).toEqual([[0, 0, 0], [0, 0, 0], [0, 4, 8]]);
    expect(D.smashAt(gridOf([[0]]), 0, 0)).toBeNull();
  });
  it("shows the charge, waits for a tap on a gem, and rescues a full board instead of ending the game", () => {
    expect(game).toContain('id="bHammer"');
    expect(game).toContain('<span class="pips" id="pips"><i></i><i></i><i></i><i></i><i></i></span>');
    expect(game).toContain("if (busy || over || hammerOn || !$(\"sStart\").hidden) return;");
    expect(game).toContain("if (hammerReady(charge)){ say(SAY.stuck);");
    expect(game).toContain("busy = true; hammerOn = false; charge = 0;");
  });
});

describe("the next gem", () => {
  it("sits at the top of the board, smaller and lighter than the gem being dropped (owner, 2026-11-22)", () => {
    expect(game).toMatch(/<div class="topbar">\s*<div class="nextwrap"/);
    expect(game).toContain('$("nextGem").style.setProperty("--cell", Math.max(30, Math.round(cell * .5)) + "px");');
    expect(game).toMatch(/\.nextgem\{[^}]*opacity:\.55;/);
  });
});

describe("the look, the feel and the voice", () => {
  it("never stops for a quiz (owner, 2026-11-22) and sends no answers", () => {
    expect(game).not.toMatch(/quizFor|askQuiz|id="sQuiz"|ccsAnswer|Quick question/);
  });
  it("is an arcade with glossy gems: a neon board, Lilita One lettering, faceted gems with a glint", () => {
    expect(game).toContain("family=Lilita+One");
    expect(game).not.toContain("Bungee");     /* its 4 read like a different letter */
    expect(game).toContain("background:conic-gradient(from -45deg, var(--hi) 0 25%, var(--c) 0 50%, var(--lo) 0 75%, var(--mid) 0 100%);");
    expect(game).toContain("border:3px solid var(--cyan);");
  });
  it("drops with a dramatic ease-in and lands with one small bounce; merges pull back, slam, spark and pop", () => {
    expect(game).toContain('const EASE_IN = "cubic-bezier(.62,0,.86,.28)";');
    expect(game).toContain("const ms = 130 + 30 * (r + 1);");
    expect(game).toMatch(/function impact\(t, r, c, heavy\)\{[\s\S]*translateY\(-13%\)/);
    expect(game).toContain("place(x, f.r + dr * back, f.c + dc * back, 150, 0, EASE_OUT)");
    expect(game).toContain("others.forEach(x => place(x, s.r, s.c, 150, .7, EASE_SLAM));");
    expect(game).toContain("chips(s.r + .5, s.c + .5, color,");
    expect(game).toMatch(/\{ transform: "scale\(1\.28\)"/);
  });
  it("holds still for anyone who asks for less motion", () => {
    expect(game).toMatch(/const REDUCED = \(\(\) => \{ try \{ return matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches;/);
    expect(game).toMatch(/function burst\([^)]*\)\{\n  if \(REDUCED\) return;/);
    expect(game).toMatch(/function chips\([^)]*\)\{\n  if \(REDUCED\) return;/);
    expect(game).toContain("@media (prefers-reduced-motion: reduce)");
  });
  it("uses the site's sound kit and keeps the best score for each board on the device", () => {
    expect(game).toContain('<script src="/games/game-sound.js"></script>');
    expect(game).toContain('CCSSound.button({ compact: true');
    expect(game).toContain('store.set("drop2048-best-" + N, String(best))');
  });
  it("cheers a chain of 2 as a combo, 3 super, 4 super duper, and 5 or more mega (owner, 2026-11-24)", () => {
    expect(D.comboLine(0)).toBe(null);
    expect(D.comboLine(1)).toBe(null);
    expect(D.comboLine(2)).toBe("Combo!");
    expect(D.comboLine(3)).toBe("Super combo!");
    expect(D.comboLine(4)).toBe("Super duper combo!");
    expect(D.comboLine(5)).toBe("Mega combo!");
    expect(D.comboLine(8)).toBe("Mega combo!");
    expect(game.match(/const line = comboLine\(chain\); if \(line\) say\(line\);/g)).toHaveLength(2);   /* after a drop and after the hammer */
    expect(game).not.toContain("say(SAY.superCombo)");
  });
  it("has a recorded clip in Heart's voice for every line, keyed the same way as the game", () => {
    expect(LINES).toEqual(D.allLines());
    expect(LINES).toHaveLength(11);
    for (const t of LINES){
      expect(scriptKey(t)).toBe(D.lineKey(t));
      expect(existsSync(new URL("../assets/games/drop-2048/voice/" + D.lineKey(t) + ".mp3", import.meta.url)), t).toBe(true);
    }
    expect(Object.keys(PHONEMES)).toEqual(["You made 2048! Amazing!"]);   /* said "two thousand forty-eight" */
  });
  it("has its Play page cover, and no em dashes or emojis", () => {
    for (const f of ["assets/games/drop-2048.jpg", "assets/games/drop-2048-thumb.jpg"]) expect(existsSync(new URL("../" + f, import.meta.url)), f).toBe(true);
    expect(game).not.toContain("—");
    expect(game).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe("Drop 2048: the board button never costs a game (owner, 2026-11-25)", () => {
  it("a game under way gets Back to my game; picking a size only counts when Play starts a new game", () => {
    expect(game).toContain('<button class="btn btn--paper" id="bBack" type="button" hidden>Back to my game</button>');
    expect(game).toContain("const gameUnderWay = () => !over && grid.some(row => row.some(Boolean));");
    expect(game).toContain('$("bBack").hidden = !gameUnderWay();');
    expect(game).toContain("pickN = Number(b.dataset.n);");
    expect(game).not.toMatch(/[^k]N = Number(b.dataset.n)/);   // only pickN changes as a size is tapped
    expect(game).toContain('$("bPlay").onclick = () => { sfx("start", { volume: 0.5 }); N = pickN; $("sStart").hidden = true; newGame();');
  });
  it("Back to my game, Escape or a tap outside the card close it and carry on", () => {
    expect(game).toContain('$("bBack").onclick = () => { sfx("click", { volume: 0.5 }); backToGame(); };');
    expect(game).toContain('if (e.target === $("sStart") && !$("bBack").hidden) backToGame();');
    expect(game).toContain('if (e.key === "Escape" && !$("sStart").hidden && !$("bBack").hidden)');
    const back = game.split("function backToGame(){")[1].split("}")[0];
    expect(back).not.toContain("newGame");
  });
});
