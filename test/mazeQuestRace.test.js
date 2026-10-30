// Maze Quest is one self-contained page (games/maze-quest.html). Its rules (the seeded maze and its
// lanterns, the room codes, who wins a race, and the lantern questions for each grade) live between
// BEGIN/END markers so they can be tested without a browser; the race wiring on the page is pinned too.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/maze-quest.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { seededRandom, buildMaze, shortestPath, MAX_LEVEL, RACE_LANTERNS, genCode, cleanCode, fmtCode, newRace, isNewerRace, decideForest, applyResult, finalTally, GRADE_LIST, DEFAULT_GRADE, gradeFromSaved, gradeQuestion, mathQuestion, spellQuestion, misspellings, SPELL_BY_GRADE, MATH_BY_GRADE, REAL_LOOKALIKES };"
)();

const wallsOf = (m) => m.grid.map(row => row.map(c => (c.walls.top ? 1 : 0) | (c.walls.right ? 2 : 0) | (c.walls.bottom ? 4 : 0) | (c.walls.left ? 8 : 0)).join(",")).join("|");

describe("the seeded maze", () => {
  it("builds the identical maze, lanterns and forest from the same level and seed", () => {
    for (let level = 1; level <= R.MAX_LEVEL; level++) {
      for (const seed of [1, 42, 123456789, 2147483646]) {
        const a = R.buildMaze(level, seed, R.RACE_LANTERNS), b = R.buildMaze(level, seed, R.RACE_LANTERNS);
        expect(wallsOf(a)).toBe(wallsOf(b));
        expect(a.lanterns).toEqual(b.lanterns);
        expect(a.forestSeed).toBe(b.forestSeed);
        expect([a.cols, a.rows, a.cellSize]).toEqual([b.cols, b.rows, b.cellSize]);
      }
    }
  });

  it("builds a different maze from a different seed", () => {
    for (let level = 1; level <= R.MAX_LEVEL; level++) {
      const a = R.buildMaze(level, 1001, 10), b = R.buildMaze(level, 1002, 10);
      expect(wallsOf(a)).not.toBe(wallsOf(b));
      expect(a.forestSeed).not.toBe(b.forestSeed);
    }
  });

  it("always opens the way in and out, has a path to the cabin, and puts every lantern on a cell", () => {
    for (let level = 1; level <= R.MAX_LEVEL; level++) for (let s = 1; s <= 15; s++) {
      const m = R.buildMaze(level, s * 7919, R.RACE_LANTERNS);
      expect(m.grid[0][0].walls.top).toBe(false);
      expect(m.grid[m.rows - 1][m.cols - 1].walls.bottom).toBe(false);
      expect(R.shortestPath(m.grid, m.grid[0][0], m.grid[m.rows - 1][m.cols - 1]).length).toBeGreaterThan(1);
      expect(m.lanterns.length).toBeGreaterThan(0);
      expect(m.lanterns.length).toBeLessThanOrEqual(R.RACE_LANTERNS);
      for (const l of m.lanterns) {
        expect(l.col).toBeGreaterThanOrEqual(0); expect(l.col).toBeLessThan(m.cols);
        expect(l.row).toBeGreaterThanOrEqual(0); expect(l.row).toBeLessThan(m.rows);
        expect(l.answered).toBe(false);
      }
    }
  });

  it("caps the lanterns (fewer on a phone in solo play)", () => {
    expect(R.buildMaze(1, 77, 8).lanterns.length).toBeLessThanOrEqual(8);
    expect(R.buildMaze(1, 77, 15).lanterns.length).toBeLessThanOrEqual(15);
  });

  it("gives the same numbers from the same seed", () => {
    const a = R.seededRandom(9), b = R.seededRandom(9);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
});

describe("room codes", () => {
  it("always make six letters and numbers, with at least one of each", () => {
    for (let i = 0; i < 4000; i++) {
      const c = R.genCode((i * 2654435761) >>> 0);
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);   // no I, O, 0 or 1: they look alike
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

describe("starting a forest at the same time", () => {
  it("lets the newer game win, and for the same game the lower player id, on both screens", () => {
    const mine = R.newRace(3, 4, 111, [1, 1]);
    expect(R.isNewerRace({ g: 4, i: "zzz", sd: 5 }, mine, "aaa")).toBe(true);    // a newer game always wins
    expect(R.isNewerRace({ g: 2, i: "aaa", sd: 5 }, mine, "zzz")).toBe(false);   // an older one never does
    expect(R.isNewerRace({ g: 3, i: "aaa", sd: 5 }, mine, "zzz")).toBe(true);    // same game: the lower id wins
    expect(R.isNewerRace({ g: 3, i: "zzz", sd: 5 }, mine, "aaa")).toBe(false);
    expect(R.isNewerRace({ g: 3, i: "aaa", sd: 111 }, mine, "zzz")).toBe(false); // already playing that forest
    expect(R.isNewerRace({ g: 1, i: "x", sd: 1 }, null, "y")).toBe(true);        // not racing yet: take it
  });

  it("ends with both screens on the same forest when both press Next forest at once", () => {
    const host = R.newRace(5, 2, 10), guest = R.newRace(5, 2, 10);
    const fromHost = { g: 6, lv: 3, sd: 777, i: "hhhh" }, fromGuest = { g: 6, lv: 3, sd: 888, i: "gggg" };
    // each starts its own, then hears the other's
    Object.assign(host, { g: 6, seed: 777 }); Object.assign(guest, { g: 6, seed: 888 });
    if (R.isNewerRace(fromGuest, host, "hhhh")) host.seed = fromGuest.sd;
    if (R.isNewerRace(fromHost, guest, "gggg")) guest.seed = fromHost.sd;
    expect(host.seed).toBe(guest.seed);
    expect(host.seed).toBe(888);   // "gggg" sorts before "hhhh"
  });
});

describe("who wins a forest", () => {
  it("the first to reach the cabin wins, and a finish arriving late changes nothing", () => {
    const race = R.newRace(2, 1, 99);
    expect(R.decideForest(race, 2, 1)).toBe(true);      // the guest got there first
    expect(R.decideForest(race, 2, 0)).toBe(false);     // the host's finish, a moment later
    expect(race.winner).toBe(1);
    expect(race.score).toEqual([0, 1]);
  });

  it("ignores a finish from an older forest, or from nobody", () => {
    const race = R.newRace(4, 3, 5, [2, 1]);
    expect(R.decideForest(race, 3, 1)).toBe(false);
    expect(R.decideForest(race, 4, 7)).toBe(false);
    expect(race.winner).toBe(null);
    expect(race.score).toEqual([2, 1]);
  });

  it("the friend's screen takes the referee's word once, and a repeat does not count twice", () => {
    const guest = R.newRace(4, 3, 5, [2, 1]);
    expect(R.applyResult(guest, { g: 4, w: 0, s: [3, 1] })).toBe(true);
    expect(R.applyResult(guest, { g: 4, w: 0, s: [3, 1] })).toBe(false);
    expect(R.applyResult(guest, { g: 3, w: 1, s: [0, 9] })).toBe(false);  // an old result
    expect(guest.winner).toBe(0);
    expect(guest.score).toEqual([3, 1]);
  });

  it("adds up all eight forests and says who won the most", () => {
    const race = R.newRace(0, 1, 1);
    const winners = [0, 1, 1, 0, 1, 1, 0, 1];               // forest by forest
    winners.forEach((w, i) => { race.g = i + 1; race.winner = null; expect(R.decideForest(race, i + 1, w)).toBe(true); });
    expect(race.score).toEqual([3, 5]);
    expect(R.finalTally(race.score, 0)).toEqual({ mine: 3, theirs: 5, result: "lose" });
    expect(R.finalTally(race.score, 1)).toEqual({ mine: 5, theirs: 3, result: "win" });
    expect(R.finalTally([4, 4], 0).result).toBe("tie");
    expect(R.MAX_LEVEL).toBe(8);
  });
});

describe("lantern questions by grade", () => {
  it("has the six grades, Kindergarten to 5th, and uses the saved one (2nd grade if none)", () => {
    expect(R.GRADE_LIST.map(g => g.short)).toEqual(["K", "1st", "2nd", "3rd", "4th", "5th"]);
    expect(R.gradeFromSaved("k")).toBe(0);
    expect(R.gradeFromSaved("4")).toBe(4);
    expect(R.gradeFromSaved(5)).toBe(5);
    expect(R.gradeFromSaved(null)).toBe(R.DEFAULT_GRADE);
    expect(R.gradeFromSaved("9")).toBe(2);
    expect(R.DEFAULT_GRADE).toBe(2);
  });

  it("every grade asks valid math with the right answer among the choices", () => {
    const rand = R.seededRandom(2024);
    for (let g = 0; g < 6; g++) {
      for (let i = 0; i < 400; i++) {
        const q = R.mathQuestion(g, rand);
        expect(q.q.length).toBeGreaterThan(3);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options.length).toBeLessThanOrEqual(4);
        expect(new Set(q.options).size).toBe(q.options.length);         // no repeated choices
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        for (const o of q.options) expect(o).toMatch(/^\d{1,3}(,\d{3})*$/);  // whole numbers, never negative
      }
    }
  });

  it("checks the math answers are actually right", () => {
    const rand = R.seededRandom(7);
    const num = (s) => Number(String(s).replace(/,/g, ""));
    for (let g = 0; g < 6; g++) for (let i = 0; i < 300; i++) {
      const q = R.mathQuestion(g, rand), ans = num(q.options[q.answer]);
      let m;
      if ((m = q.q.match(/^What is ([\d,]+) \+ ([\d,]+)\?$/))) expect(ans).toBe(num(m[1]) + num(m[2]));
      else if ((m = q.q.match(/^What is ([\d,]+) − ([\d,]+)\?$/))) expect(ans).toBe(num(m[1]) - num(m[2]));
      else if ((m = q.q.match(/^What is ([\d,]+) × ([\d,]+)\?$/))) expect(ans).toBe(num(m[1]) * num(m[2]));
      else if ((m = q.q.match(/^What is ([\d,]+) ÷ ([\d,]+)\?$/))) expect(ans).toBe(num(m[1]) / num(m[2]));
      else if ((m = q.q.match(/^Which number is even\?$/))) { expect(ans % 2).toBe(0); q.options.forEach((o, k) => { if (k !== q.answer) expect(num(o) % 2).toBe(1); }); }
      else if ((m = q.q.match(/^Which number is a factor of (\d+)\?$/))) { expect(num(m[1]) % ans).toBe(0); q.options.forEach((o, k) => { if (k !== q.answer) expect(num(m[1]) % num(o)).not.toBe(0); }); }
      else if ((m = q.q.match(/^Which number is a multiple of (\d+)\?$/))) { expect(ans % num(m[1])).toBe(0); q.options.forEach((o, k) => { if (k !== q.answer) expect(num(o) % num(m[1])).not.toBe(0); }); }
      else if ((m = q.q.match(/^Which is bigger: (\d+) or (\d+)\?$/))) expect(ans).toBe(Math.max(num(m[1]), num(m[2])));
    }
  });

  it("every grade asks spelling from its own word list, with the right spelling and three wrong ones", () => {
    const rand = R.seededRandom(99);
    for (let g = 0; g < 6; g++) {
      const words = new Set(R.SPELL_BY_GRADE[g].map(w => w[0]));
      for (let i = 0; i < 200; i++) {
        const q = R.spellQuestion(g, rand);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        const right = q.options[q.answer];
        expect(words.has(right)).toBe(true);
        expect(q.q).toContain("Which spelling is right?");
        q.options.forEach((o, k) => { if (k !== q.answer) { expect(words.has(o)).toBe(false); expect(o).toMatch(/^[a-z]+$/); } });
      }
    }
  });

  it("can misspell every word on every grade's list three ways", () => {
    const all = new Set(R.SPELL_BY_GRADE.flat().map(w => w[0]).concat(R.REAL_LOOKALIKES));
    R.SPELL_BY_GRADE.forEach(list => list.forEach(([w]) => {
      for (let s = 0; s < 40; s++) {
        const m = R.misspellings(w, all, R.seededRandom(s + 1));
        expect(m).toHaveLength(3);
        m.forEach(x => { expect(x).not.toBe(w); expect(all.has(x)).toBe(false); });
      }
    }));
  });

  it("copies the spelling words and clues from Spelling Detective, grade by grade", () => {
    const sd = readFileSync(new URL("../games/spelling-detective.html", import.meta.url), "utf8");
    R.SPELL_BY_GRADE.forEach(list => list.forEach(([word, clue]) => {
      expect(sd).toContain(`word: '${word}'`);
      expect(sd).toContain(clue.replace(/'/g, "\\'"));
    }));
    expect(R.SPELL_BY_GRADE).toHaveLength(6);
    expect(R.MATH_BY_GRADE).toHaveLength(6);
  });

  it("mixes math and spelling for any grade", () => {
    const rand = R.seededRandom(3), kinds = new Set();
    for (let i = 0; i < 60; i++) kinds.add(R.gradeQuestion(0, rand).kind);
    expect([...kinds].sort()).toEqual(["math", "spell"]);
  });
});

describe("the page", () => {
  it("races over its own live room channel, with nothing saved", () => {
    expect(page).toContain("'mazequest-room-' + code");
    expect(page).toContain("../assets/vendor/supabase.js");
    expect(page).toContain("persistSession: false");
    expect(page).not.toMatch(/\.from\(['"]/);                // no database tables
    expect(page).not.toMatch(/<textarea/i);                 // no free text between players
  });
  it("offers Play on my own and Race a friend on the picker, and a labelled code box", () => {
    expect(page).toContain('id="charDone">Play on my own</button>');
    expect(page).toContain(">Race a friend</button>");
    expect(page).toContain('<label class="mq-join-label" for="joinCode">Room code</label>');
    expect(page).toContain('aria-live="assertive"');
  });
  it("keeps the grade on this device under mq-grade", () => {
    expect(page).toContain("const GRADE_KEY = 'mq-grade'");
    expect(page).toMatch(/try \{ gradeIndex = gradeFromSaved\(localStorage\.getItem\(GRADE_KEY\)\); \} catch/);
    expect(page).toMatch(/try \{ localStorage\.setItem\(GRADE_KEY, g\.id\); \} catch/);
  });
});
