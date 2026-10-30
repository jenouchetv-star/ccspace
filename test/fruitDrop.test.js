// Fruit Drop (games/drop-blox.html, the page DropBlox used to be) is one self-contained page. All of its rules - the
// well, the pieces and how they turn, matches, full rows, fruit falling one by one, chains, the special fruit, scoring,
// goals and stars - live between the LOGIC-START / LOGIC-END markers with no drawing in them, so they are run here alone.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/drop-blox.html", import.meta.url), "utf8");
const block = page.slice(page.indexOf("/* LOGIC-START */"), page.indexOf("/* LOGIC-END */"));
const G = new Function(block + `; return { COLS, ROWS, STAR, FRUITS, SHAPES, LEVELS, CHAIN_WORDS, makeRng, emptyBoard, cloneBoard,
  boardFromRows, fillBoard, makePiece, pieceCells, fits, tryMove, rotate, dropped, gravity, land, findRuns, findMatches, fullRows,
  mostCommon, blastCells, clearRound, resolve, newStats, addRound, goalProgress, goalsDone, goalText, starsFor, unlocked,
  newGame, lock, placements, endlessLevel };`)();

/* a well from rows of letters (S O L A G B, * for a golden star), bottom-aligned */
const well = (rows) => G.boardFromRows(rows, { n: 0 });
const ids = { n: 5000 };
const one = (f, x) => ({ shape: "one", x, y: 0, px: 0, py: 0, cells: [{ dx: 0, dy: 0, f, id: ++ids.n }] });
const piece = (x, cells) => ({ shape: "test", x, y: 0, px: 0, py: 0, cells: cells.map(([dx, dy, f]) => ({ dx, dy, f, id: ++ids.n })) });
const S = 0, O = 1, L = 2, A = 3;
const at = (b, x, y) => b[y][x];
const bottom = G.ROWS - 1;
/* drop a piece straight down and let everything pop and fall */
function play(b, p) {
  const l = G.land(b, G.dropped(b, p));
  return G.resolve(l.board, l.fresh, { n: 90000 });
}
const count = (b) => b.flat().filter(Boolean).length;

describe("the well and the pieces", () => {
  it("is 8 across and 14 deep, with six fruit that differ in name and colour", () => {
    expect([G.COLS, G.ROWS]).toEqual([8, 14]);
    expect(G.FRUITS.map((f) => f.key)).toEqual(["strawberry", "orange", "lemon", "apple", "grapes", "blueberry"]);
    expect(new Set(G.FRUITS.map((f) => f.color)).size).toBe(6);
  });
  it("makes pieces of 2, 3 or 4 fruit, one fruit to a cell, starting at the top in the middle", () => {
    for (const s of Object.values(G.SHAPES)) {
      expect(s.cells.length).toBeGreaterThanOrEqual(2);
      expect(s.cells.length).toBeLessThanOrEqual(4);
      expect(new Set(s.cells.map((c) => c.join())).size).toBe(s.cells.length);
    }
    const rng = G.makeRng(3), idc = { n: 0 };
    for (let i = 0; i < 200; i++) {
      const p = G.makePiece(G.LEVELS[11], rng, idc);
      expect(p.y).toBe(0);
      expect(G.fits(G.emptyBoard(), p)).toBe(true);
      for (const c of p.cells) expect(c.f).toBeLessThan(6);
    }
  });
  it("uses only 4 kinds of fruit and the domino on level 1", () => {
    const rng = G.makeRng(9), idc = { n: 0 }, seen = new Set(), shapes = new Set();
    for (let i = 0; i < 300; i++) { const p = G.makePiece(G.LEVELS[0], rng, idc); shapes.add(p.shape); p.cells.forEach((c) => seen.add(c.f)); }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect([...shapes]).toEqual(["duo"]);
  });
  it("moves, but never through a wall or another fruit", () => {
    const b = well(["S......."]);
    const p = piece(0, [[0, 0, O], [1, 0, L]]);
    expect(G.tryMove(b, p, -1, 0)).toBe(null);
    expect(G.tryMove(b, piece(6, [[0, 0, O], [1, 0, L]]), 1, 0)).toBe(null);
    const low = { ...p, y: bottom - 1 };
    expect(G.tryMove(b, low, 0, 1)).toBe(null);                 /* the strawberry is under it */
    expect(G.dropped(G.emptyBoard(), p).y).toBe(bottom);
  });
  it("turns a quarter at a time, and four turns bring it back", () => {
    const b = G.emptyBoard();
    let p = { ...G.makePiece({ shapes: ["hook"], fruits: 4, pair: 0 }, G.makeRng(1), { n: 0 }), y: 5 };
    const start = JSON.stringify(G.pieceCells(p).map((c) => [c.x, c.y, c.f]).sort());
    const turned = G.rotate(b, p, 1);
    expect(JSON.stringify(G.pieceCells(turned).map((c) => [c.x, c.y, c.f]).sort())).not.toBe(start);
    for (let i = 0; i < 4; i++) p = G.rotate(b, p, 1);
    expect(JSON.stringify(G.pieceCells(p).map((c) => [c.x, c.y, c.f]).sort())).toBe(start);
    expect(JSON.stringify(G.pieceCells(G.rotate(b, G.rotate(b, turned, -1), 1)).map((c) => [c.x, c.y]).sort()))
      .toBe(JSON.stringify(G.pieceCells(turned).map((c) => [c.x, c.y]).sort()));
  });
  it("kicks a turning piece off the wall instead of refusing to turn", () => {
    const b = G.emptyBoard();
    /* a standing three against the right wall: turning it would poke out, so it slides back in */
    const p = { shape: "trio", x: 7, y: 4, px: 0, py: 1, cells: [[0, 0, S], [0, 1, O], [0, 2, L]].map(([dx, dy, f], i) => ({ dx, dy, f, id: i + 1 })) };
    const q = G.rotate(b, p, 1);
    expect(q).not.toBe(null);
    for (const c of G.pieceCells(q)) { expect(c.x).toBeLessThan(G.COLS); expect(c.x).toBeGreaterThanOrEqual(0); }
    expect(new Set(G.pieceCells(q).map((c) => c.y)).size).toBe(1);   /* now lying flat */
    /* boxed in on every side, it cannot turn at all */
    const walls = G.emptyBoard();
    for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (x !== 7 || y < 4 || y > 6) walls[y][x] = { f: 5, sp: null, id: 900 + y * 8 + x };
    expect(G.rotate(walls, p, 1)).toBe(null);
  });
});

describe("falling", () => {
  it("lets every fruit fall on its own until it rests on something (not whole rows)", () => {
    const b = G.emptyBoard();
    b[3][0] = { f: S, sp: null, id: 1 }; b[8][0] = { f: O, sp: null, id: 2 }; b[5][4] = { f: L, sp: null, id: 3 };
    b[bottom][4] = { f: A, sp: null, id: 4 };
    const g = G.gravity(b);
    expect(at(g.board, 0, bottom).id).toBe(2);
    expect(at(g.board, 0, bottom - 1).id).toBe(1);
    expect(at(g.board, 4, bottom - 1).id).toBe(3);
    expect(at(g.board, 4, bottom).id).toBe(4);
    expect(g.moves.find((m) => m.id === 1)).toEqual({ x: 0, from: 3, to: bottom - 1, id: 1 });
    expect(count(g.board)).toBe(4);
  });
  it("splits a piece that lands over a gap: each half falls as far as it can", () => {
    const b = well(["S......."]);
    const l = G.land(b, G.dropped(b, piece(0, [[0, 0, O], [1, 0, L]])));
    expect(at(l.board, 0, bottom - 1).f).toBe(O);
    expect(at(l.board, 1, bottom).f).toBe(L);
    expect(l.fresh.map((c) => c.join()).sort()).toEqual(["0,12", "1,13"]);
  });
});

describe("matches and the special fruit they make", () => {
  it("pops 3 in a row across, with nothing special left behind", () => {
    const r = play(well(["SS......"]), one(S, 2));
    expect(r.rounds.length).toBe(1);
    expect(r.rounds[0].cleared.length).toBe(3);
    expect(r.rounds[0].created).toEqual([]);
    expect(count(r.board)).toBe(0);
  });
  it("pops 3 up and down", () => {
    const r = play(well(["O.......", "O......."]), one(O, 0));
    expect(r.rounds[0].cleared.length).toBe(3);
    expect(count(r.board)).toBe(0);
  });
  it("never pops 2, or 3 that are not in a straight line", () => {
    expect(play(well(["S......."]), one(S, 1)).rounds.length).toBe(0);
    expect(play(well([".S......", "S......."]), one(S, 0)).rounds.length).toBe(0);  /* a bend, not a line */
  });
  it("turns exactly 4 across into a striped fruit that clears its row", () => {
    const r = play(well(["SSS.O..."]), one(S, 3));
    const made = r.rounds[0].created;
    expect(made.length).toBe(1);
    expect(made[0]).toMatchObject({ x: 3, y: bottom, sp: "row", f: S });     /* where the last fruit landed */
    expect(at(r.board, 3, bottom)).toMatchObject({ f: S, sp: "row" });
    expect(count(r.board)).toBe(2);
  });
  it("turns exactly 4 up and down into a striped fruit that clears its column", () => {
    const r = play(well(["L.......", "L.......", "L......."]), one(L, 0));
    expect(r.rounds[0].created[0]).toMatchObject({ sp: "col", f: L });
    expect(count(r.board)).toBe(1);
    expect(at(r.board, 0, bottom)).toMatchObject({ f: L, sp: "col" });
  });
  it("turns an L of 5 into a wrapped fruit at the corner", () => {
    const b = well(["AA......", "OLA.....", "LOA....."]);          /* level 7's start */
    const r = play(b, one(A, 2));
    const made = r.rounds[0].created;
    expect(made.length).toBe(1);
    expect(made[0]).toMatchObject({ x: 2, y: bottom - 2, sp: "wrap", f: A });
    expect(r.rounds[0].cleared.length).toBe(4);
    expect(r.board.flat().filter((c) => c && c.sp === "wrap").length).toBe(1);
  });
  it("turns a T of 5 into a wrapped fruit too", () => {
    /* three across on top, two more below the middle */
    const t = well(["OOO.....", "SOS.....", "AOA....."]);
    const m = G.findMatches(t);
    expect(m.length).toBe(1);
    expect(m[0].kind).toBe("wrap");
    expect(m[0].cells.length).toBe(5);
  });
  it("turns 5 in a straight line into a golden star (and 6 in a line too)", () => {
    const r = play(well(["SS.SSOAL"]), one(S, 2));                      /* level 10's start */
    expect(r.rounds[0].created[0]).toMatchObject({ x: 2, sp: "star", f: G.STAR });
    expect(G.findMatches(well(["LLLLLL.."]))[0].kind).toBe("star");
    expect(G.findMatches(well(["L.......", "L.......", "L.......", "L.......", "L......."]))[0].kind).toBe("star");
  });
  it("never counts the golden star as a fruit in a match", () => {
    expect(G.findMatches(well(["SS*SS..."])).length).toBe(0);
  });
});

describe("full rows", () => {
  it("clear a row full of any fruit at all, and the fruit above falls in", () => {
    const b = well(["S.......", "SOLAOLA."]);
    expect(G.findMatches(b).length).toBe(0);
    const r = play(b, one(O, 7));
    expect(r.rounds.length).toBe(1);
    expect(r.rounds[0].rows).toEqual([bottom]);
    expect(r.rounds[0].cleared.length).toBe(8);
    expect(count(r.board)).toBe(1);
    expect(at(r.board, 0, bottom).f).toBe(S);
  });
  it("score 40 more than the same fruit popped by a match", () => {
    const r = play(well(["SOLAOLA."]), one(O, 7));
    expect(r.rounds[0].points).toBe(8 * 10 + 40);
  });
});

describe("chains", () => {
  it("chain 2: popping lemons drops strawberries into a new match by themselves", () => {
    const b = well(["SO..O...", "SOO.S...", "OLL.O..."]);
    expect(G.findMatches(b).length).toBe(0);
    const r = play(b, one(L, 3));
    expect(r.rounds.map((x) => x.chain)).toEqual([1, 2]);
    expect(r.rounds[1].points).toBe(r.rounds[1].cleared.length * 10 * 2);    /* round 2 scores double */
  });
  it("chain 3: one strawberry sets off three rounds of pops", () => {
    const b = well([".LLOOA..", ".SSLOO..", "SSASAA..", "LLASAS.."]);
    expect(G.findMatches(b).length).toBe(0);
    expect(G.fullRows(b).length).toBe(0);
    const r = play(b, one(S, 0));
    expect(r.rounds.map((x) => x.chain)).toEqual([1, 2, 3]);
    for (const x of r.rounds) expect(x.points % x.chain).toBe(0);
    const st = G.newStats();
    r.rounds.forEach((x) => G.addRound(st, x));
    expect(st.chains).toBe(2);              /* every round after the first is a chain */
    expect(st.bestChain).toBe(3);
  });
  it("level 5's start makes a chain with one lemon in either gap, and the cheer words climb", () => {
    const b = well(G.LEVELS[4].start);
    expect(play(b, one(L, 3)).rounds.map((x) => x.chain)).toEqual([1, 2]);
    expect(play(b, one(L, 4)).rounds.map((x) => x.chain)).toEqual([1, 2]);
    expect(G.CHAIN_WORDS.slice(2, 5)).toEqual(["Sweet!", "Juicy!", "Fruit-tastic!"]);
  });
  it("always settles: after it all, no match, no full row and no fruit in mid-air", () => {
    const rng = G.makeRng(42);
    for (let t = 0; t < 40; t++) {
      const g = G.newGame(1 + (t % 12), 100 + t);
      for (let d = 0; d < 25 && !g.over && !g.won; d++) {
        const opts = G.placements(g.board, g.piece);
        g.piece = opts[Math.floor(rng() * opts.length)].piece;
        G.lock(g);
        expect(G.findMatches(g.board).length).toBe(0);
        expect(G.fullRows(g.board).length).toBe(0);
        for (let y = 0; y < G.ROWS - 1; y++) for (let x = 0; x < G.COLS; x++) if (g.board[y][x]) expect(g.board[y + 1][x]).not.toBe(null);
      }
    }
  });
});

describe("special fruit when they fire", () => {
  /* each test well is checked first: nothing in mid-air, no match and no full row before the drop */
  const ready = (b) => {
    for (let y = 0; y < G.ROWS - 1; y++) for (let x = 0; x < G.COLS; x++) if (b[y][x]) expect(b[y + 1][x], `fruit in mid-air at ${x},${y}`).not.toBe(null);
    expect(G.findMatches(b).length).toBe(0);
    expect(G.fullRows(b).length).toBe(0);
    return b;
  };
  const gone = (r) => new Set(r.cleared.map((e) => e.x + "," + e.y));

  it("a striped fruit (across) clears its whole row, and nothing above it", () => {
    const b = well(["GB......", "SS.OBGB."]);
    b[bottom][1].sp = "row";
    ready(b);
    expect(G.blastCells(b, 1, bottom, "row").length).toBe(8);
    const r = play(b, one(S, 2)).rounds[0];
    expect(r.fired.map((f) => f.sp)).toEqual(["row"]);
    expect(r.cleared.filter((e) => e.y === bottom).length).toBe(7);    /* every fruit in the bottom row */
    expect(r.cleared.filter((e) => e.y !== bottom).length).toBe(0);
  });
  it("a striped fruit (up and down) clears its whole column", () => {
    const b = ready(well(["G.......", "B.......", "G.......", "SS......"]));
    b[bottom][0].sp = "col";
    const r = play(b, one(S, 2)).rounds[0];
    expect(r.fired[0].sp).toBe("col");
    expect(r.cleared.filter((e) => e.x === 0).length).toBe(4);
  });
  it("a wrapped fruit blasts the 3 by 3 around it", () => {
    const b = well(["BG......", "GB.B....", "OO.G...."]);
    b[bottom][1].sp = "wrap";
    ready(b);
    expect(G.blastCells(b, 1, bottom, "wrap").length).toBe(6);         /* the floor cuts it to 3 by 2 */
    const r = play(b, one(O, 2)).rounds[0];
    expect(r.fired[0]).toMatchObject({ sp: "wrap", x: 1, y: bottom });
    expect([...gone(r)].sort()).toEqual(["0,12", "0,13", "1,12", "1,13", "2,13"]);
    const g2 = G.blastCells(G.emptyBoard(), 4, 6, "wrap");
    expect(g2.length).toBe(9);                                          /* away from the walls: the full 3 by 3 */
  });
  it("a golden star pops every fruit of the kind dropped on it", () => {
    const b = ready(well([".L..L...", "*SLSGL.."]));
    const r = play(b, one(S, 0));                                       /* a strawberry lands on the star */
    expect(r.rounds[0].fired[0]).toMatchObject({ sp: "star", target: S });
    expect(r.rounds[0].cleared.filter((e) => e.f === S).length).toBe(3);   /* the two in the well and the one dropped */
    expect(r.board.flat().filter((c) => c && (c.f === S || c.f === G.STAR)).length).toBe(0);
  });
  it("a golden star caught in a full row takes the fruit there is most of", () => {
    const b = ready(well(["LA......", "OLS*LSL."]));
    expect(G.mostCommon(b)).toBe(L);
    const r = play(b, one(A, 7)).rounds[0];                             /* fills the bottom row */
    expect(r.rows).toEqual([bottom]);
    expect(r.fired.find((f) => f.sp === "star").target).toBe(L);
    expect(gone(r).has("0,12")).toBe(true);                             /* the lemon up above went too */
  });
  it("special into special: a striped fruit's row catches a wrapped fruit, which blasts around itself", () => {
    const b = well([".....GG.", "....BOB.", "AA..OGBG"]);
    b[bottom][0].sp = "row"; b[bottom][5].sp = "wrap";
    ready(b);
    const r = play(b, one(A, 2)).rounds[0];
    expect(r.fired.map((f) => f.sp)).toEqual(["row", "wrap"]);
    const g = gone(r);
    for (const k of ["4,12", "5,12", "6,12"]) expect(g.has(k), k).toBe(true);   /* only the wrapped fruit reaches row 12 */
    expect(g.has("5,11")).toBe(false);
  });
  it("special into special: a golden star's fruit includes a striped one, which fires its row", () => {
    const b = well(["*OLOAOS."]);
    b[bottom][6].sp = "row";
    ready(b);
    const r = play(b, one(S, 0)).rounds[0];                             /* lands on top of the star */
    expect(r.fired.map((f) => f.sp)).toEqual(["star", "row"]);
    expect(r.cleared.filter((e) => e.y === bottom).length).toBe(7);
  });
  it("fires each special only once, even when two blasts cross it", () => {
    const b = well(["SS..OGB."]);
    b[bottom][0].sp = "row"; b[bottom][4].sp = "col"; b[bottom][5].sp = "wrap";
    ready(b);
    const r = play(b, one(S, 2)).rounds[0];
    expect(r.fired.map((f) => f.sp).sort()).toEqual(["col", "row", "wrap"]);
  });
});

describe("goals, stars and levels", () => {
  it("has 12 levels that ramp: slower and with fewer fruit at the start", () => {
    expect(G.LEVELS.length).toBe(12);
    for (let i = 1; i < 12; i++) {
      expect(G.LEVELS[i].speed).toBeLessThanOrEqual(G.LEVELS[i - 1].speed);
      expect(G.LEVELS[i].fruits).toBeGreaterThanOrEqual(G.LEVELS[i - 1].fruits);
    }
    expect(G.LEVELS[0].fruits).toBe(4);
    expect(G.LEVELS[0].speed).toBeGreaterThanOrEqual(1000);
    expect(G.LEVELS[11].fruits).toBe(6);
    for (const L of G.LEVELS) { expect(L.goals.length).toBeGreaterThan(0); expect(L.stars[0]).toBeLessThan(L.stars[1]); expect(L.tip.length).toBeGreaterThan(10); }
  });
  it("starts every level with a settled well: no match, no full row, nothing in mid-air", () => {
    G.LEVELS.forEach((L, i) => {
      for (let seed = 1; seed < 20; seed++) {
        const g = G.newGame(i + 1, seed);
        expect(G.findMatches(g.board).length, L.name).toBe(0);
        expect(G.fullRows(g.board).length, L.name).toBe(0);
        for (let y = 0; y < G.ROWS - 1; y++) for (let x = 0; x < G.COLS; x++) if (g.board[y][x]) expect(g.board[y + 1][x]).not.toBe(null);
        expect(g.over).toBe(false);
      }
    });
  });
  it("says each goal in plain words", () => {
    expect(G.goalText({ type: "pop", fruit: 0, n: 15 })).toBe("Pop 15 strawberries");
    expect(G.goalText({ type: "pop", n: 12 })).toBe("Pop 12 fruit");
    expect(G.goalText({ type: "chains", n: 3 })).toBe("Make 3 chains");
    expect(G.goalText({ type: "rows", n: 4 })).toBe("Clear 4 rows");
    expect(G.goalText({ type: "make", kind: "striped", n: 1 })).toBe("Make a striped fruit");
    expect(G.goalText({ type: "make", kind: "wrap", n: 1 })).toBe("Make a wrapped fruit");
    expect(G.goalText({ type: "make", kind: "star", n: 1 })).toBe("Make a golden star");
  });
  it("tracks each goal as fruit pops, and finishes the level when every goal is met", () => {
    const cfg = { goals: [{ type: "pop", fruit: S, n: 15 }, { type: "rows", n: 2 }], stars: [100, 200] };
    const st = G.newStats();
    expect(G.goalProgress(cfg.goals[0], st)).toEqual({ have: 0, need: 15, done: false });
    st.popped[S] = 7;
    expect(G.goalProgress(cfg.goals[0], st)).toEqual({ have: 7, need: 15, done: false });
    st.popped[S] = 19;
    expect(G.goalProgress(cfg.goals[0], st)).toEqual({ have: 15, need: 15, done: true });
    expect(G.goalsDone(cfg, st)).toBe(false);
    st.rows = 2;
    expect(G.goalsDone(cfg, st)).toBe(true);
    /* striped counts either way */
    const s2 = G.newStats(); s2.made.col = 1;
    expect(G.goalProgress({ type: "make", kind: "striped", n: 1 }, s2).done).toBe(true);
  });
  it("counts real pops toward the goals through a whole game", () => {
    const g = G.newGame(4, 5);                                         /* Make a striped fruit */
    g.board = well(["SSS.O..."]);
    g.piece = one(S, 3);
    G.lock(g);
    expect(g.stats.made.row).toBe(1);
    expect(g.won).toBe(true);
  });
  it("gives 1 star for finishing, and 2 or 3 for a high score", () => {
    const cfg = G.LEVELS[0];
    expect(G.starsFor(cfg, 0)).toBe(1);
    expect(G.starsFor(cfg, cfg.stars[0])).toBe(2);
    expect(G.starsFor(cfg, cfg.stars[1])).toBe(3);
  });
  it("opens each level after the one before it gets a star", () => {
    expect(G.unlocked(1, {})).toBe(true);
    expect(G.unlocked(2, {})).toBe(false);
    expect(G.unlocked(2, { 1: 1 })).toBe(true);
    expect(G.unlocked(5, { 1: 3, 2: 2, 3: 1 })).toBe(false);
    expect(G.unlocked(5, { 4: 1 })).toBe(true);
  });
  it("ends the game kindly when the fruit reaches the top", () => {
    const g = G.newGame(1, 1);
    const b = G.emptyBoard();
    for (let y = 1; y < G.ROWS; y++) for (let x = 0; x < 7; x++) b[y][x] = { f: (x + 2 * (y % 2)) % 4, sp: null, id: 7000 + y * 8 + x };
    g.board = b;
    g.piece = piece(3, [[0, 0, S], [1, 0, A]]);
    G.lock(g);
    expect(g.over).toBe(true);
    expect(g.won).toBe(false);
  });
  it("Endless has no goal, speeds up with the score and adds fruit", () => {
    const e0 = G.endlessLevel(0), e6 = G.endlessLevel(6);
    expect(e0.goals).toEqual([]);
    expect(e6.speed).toBeLessThan(e0.speed);
    expect(e6.fruits).toBe(6);
    const g = G.newGame(0, 3);
    g.stats.score = 3100;
    g.board = well(["SS......"]); g.piece = one(S, 2);
    const res = G.lock(g);
    expect(res.stageUp).toBe(true);
    expect(g.cfg.stage).toBe(2);
    expect(g.won).toBe(false);
  });
});

describe("level 1 is easy", () => {
  /* a simple player: try every place and turn, take whatever pops the most, else keep the stack low */
  function helper(g) {
    let best = null, bs = -Infinity;
    for (const o of G.placements(g.board, g.piece)) {
      const l = G.land(g.board, o.piece), r = G.resolve(l.board, l.fresh, { n: 1e6 });
      const pts = r.rounds.reduce((a, x) => a + x.points, 0);
      let h = 0; for (let y = 0; y < G.ROWS; y++) if (r.board[y].some(Boolean)) { h = G.ROWS - y; break; }
      const s = pts - h * 12;
      if (s > bs) { bs = s; best = o; }
    }
    return best.piece;
  }
  /* a very young player: drops each piece wherever it happens to be, turned any old way */
  function anywhere(g, rng) {
    const opts = G.placements(g.board, g.piece);
    return opts[Math.floor(rng() * opts.length)].piece;
  }
  function run(choose, seed) {
    const g = G.newGame(1, seed), rng = G.makeRng(seed * 7);
    let drops = 0;
    while (!g.over && !g.won && drops < 400) { g.piece = choose(g, rng); G.lock(g); drops++; }
    return { won: g.won, drops };
  }
  it("is finished by a simple scripted player every time, in a handful of drops", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = run(helper, seed);
      expect(r.won, "seed " + seed).toBe(true);
      expect(r.drops).toBeLessThan(30);
    }
  });
  it("is nearly always finished even dropping pieces at random", () => {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) if (run(anywhere, seed).won) wins++;
    expect(wins).toBeGreaterThanOrEqual(27);
  });
});

describe("the page", () => {
  it("is called Fruit Drop, at the old DropBlox address, with the old Master Brick and six-in-a-row rule gone", () => {
    expect(page).toContain("<title>Fruit Drop</title>");
    expect(page).toContain('aria-label="Fruit Drop"');
    expect(page).not.toMatch(/Master Brick|CLEAR_LINE_REQ|DropBlox/);
  });
  it("uses the shared skin and sound kit, re-applies its arcade faces after the skin, and keeps the site's fit-check element", () => {
    expect(page).toContain('<link rel="stylesheet" href="game-skin.css">');
    expect(page).toContain('<script src="game-sound.js"></script>');
    expect(page.indexOf("font-family: 'Bungee'", page.indexOf('href="game-skin.css"'))).toBeGreaterThan(0);
    expect(page).toContain('class="game-area-wrapper"');
    expect(page).toContain("CCSSound.button(");
  });
  it("shows Chike's poses, all of which exist", () => {
    for (const pose of ["thumbs-up", "wave", "point", "arms-crossed", "point-up"]) {
      expect(page).toContain(pose);
      expect(existsSync(new URL(`../assets/characters/chike-pose-${pose}.png`, import.meta.url))).toBe(true);
    }
  });
  it("saves stars and the best score under fd- keys, wrapped in try/catch", () => {
    expect(page).toContain('"fd-stars"');
    expect(page).toContain('"fd-best"');
    expect(page).toMatch(/function load\(k, d\)\{ try \{/);
    expect(page).toMatch(/function save\(k, v\)\{ try \{/);
  });
  it("announces what happens, honours reduced motion, and has real buttons for touch", () => {
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("prefers-reduced-motion: reduce");
    for (const a of ["left", "right", "turn", "down", "drop"]) expect(page).toContain(`data-act="${a}"`);
  });
  it("draws the fruit itself: no emoji fruit and no image files for the fruit", () => {
    expect(page).not.toMatch(/[\u{1F347}-\u{1F353}\u{1FAD0}]/u);
    expect(page).not.toMatch(/assets\/[^"']*fruit/i);
  });
});
