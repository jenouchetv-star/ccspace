// Word Quest is one self-contained page (games/word-quest.html). Its rules (grades, word banks, how a
// board is built, how a drag becomes a line, scoring) live between BEGIN/END markers so they can be
// tested without a browser.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/word-quest.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { GRADES, GRADE_ORDER, DIRS, BANKS, BLOCKED, makeRng, buildBoard, linePath, spell, occurrences, findMatch, wordPoints, secretPoints, nextCombo, COMBO_MS, MAX_COMBO, roundTime, timeBonus, clearBonus, stars, HINTS_PER_BOARD };"
)();

const SEEDS = Array.from({ length: 30 }, (_, i) => 7 + i * 101);
const key = (p) => p.map((x) => x.r + "," + x.c).sort().join("|");

describe("grades", () => {
  it("run K to 5th with bigger boards and more words as kids get older", () => {
    expect(R.GRADE_ORDER).toEqual(["K", "1", "2", "3", "4", "5"]);
    expect(R.GRADE_ORDER.map((g) => R.GRADES[g].label)).toEqual(["K", "1st", "2nd", "3rd", "4th", "5th"]);
    const sizes = R.GRADE_ORDER.map((g) => R.GRADES[g].size);
    const words = R.GRADE_ORDER.map((g) => R.GRADES[g].words);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      expect(words[i]).toBeGreaterThanOrEqual(words[i - 1]);
    }
  });

  it("only hide words left-to-right and top-to-bottom for K and 1st, add diagonals in 2nd, every way from 3rd", () => {
    expect(R.GRADES.K.dirs.sort()).toEqual(["D", "R"]);
    expect(R.GRADES["1"].dirs.sort()).toEqual(["D", "R"]);
    expect(R.GRADES["2"].dirs.sort()).toEqual(["D", "DR", "R", "UR"]);
    for (const g of ["3", "4", "5"]) expect(R.GRADES[g].dirs.length).toBe(8);
  });
});

describe("word banks", () => {
  it("hold plenty of grade-sized words with no repeats", () => {
    for (const g of R.GRADE_ORDER) {
      const bank = R.BANKS[g];
      expect(bank.length).toBeGreaterThanOrEqual(30);
      expect(new Set(bank).size).toBe(bank.length);
      for (const w of bank) {
        expect(w).toMatch(/^[A-Z]+$/);
        expect(w.length).toBeLessThanOrEqual(R.GRADES[g].size);
        expect(w.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("boards", () => {
  it("are the same for the same seed and different for another", () => {
    expect(R.buildBoard("3", 42)).toEqual(R.buildBoard("3", 42));
    expect(R.buildBoard("3", 42).grid).not.toEqual(R.buildBoard("3", 43).grid);
  });

  it("hide every word along its path, in a direction the grade allows, exactly once", () => {
    for (const g of R.GRADE_ORDER) for (const seed of SEEDS) {
      const b = R.buildBoard(g, seed), cfg = R.GRADES[g];
      expect(b.size).toBe(cfg.size);
      expect(b.grid).toHaveLength(cfg.size);
      for (const row of b.grid) {
        expect(row).toHaveLength(cfg.size);
        for (const ch of row) expect(ch).toMatch(/^[A-Z]$/);
      }
      const targets = b.words.filter((w) => w.kind === "target");
      const secrets = b.words.filter((w) => w.kind === "secret");
      expect(targets).toHaveLength(cfg.words);
      expect(secrets).toHaveLength(cfg.secrets);
      expect(new Set(b.words.map((w) => w.word)).size).toBe(b.words.length);
      for (const w of b.words) {
        expect(R.BANKS[g]).toContain(w.word);
        expect(cfg.dirs).toContain(w.dir);
        expect(R.spell(b.grid, w.path)).toBe(w.word);
        const occ = R.occurrences(b.grid, w.word);
        expect(occ).toHaveLength(1);
        expect(key(occ[0])).toBe(key(w.path));
      }
    }
  });

  it("never spell a rude word in the filler letters", () => {
    for (const g of R.GRADE_ORDER) for (const seed of SEEDS) {
      const b = R.buildBoard(g, seed);
      for (const bad of R.BLOCKED) for (const occ of R.occurrences(b.grid, bad)) {
        const cells = new Set(occ.map((x) => x.r + "," + x.c));
        const inside = b.words.some((w) => [...cells].every((c) => w.path.some((x) => x.r + "," + x.c === c)));
        expect(inside).toBe(true); // only allowed inside a real word, like the BUTT in BUTTER
      }
    }
  });
});

describe("dragging across the letters", () => {
  const S = 8;
  it("makes straight lines across, down and on a diagonal", () => {
    expect(R.linePath({ r: 2, c: 1 }, { r: 2, c: 4 }, S)).toEqual([{ r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }]);
    expect(R.linePath({ r: 3, c: 3 }, { r: 1, c: 3 }, S)).toEqual([{ r: 3, c: 3 }, { r: 2, c: 3 }, { r: 1, c: 3 }]);
    expect(R.linePath({ r: 0, c: 0 }, { r: 2, c: 2 }, S)).toEqual([{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }]);
    expect(R.linePath({ r: 5, c: 5 }, { r: 5, c: 5 }, S)).toEqual([{ r: 5, c: 5 }]);
  });

  it("snaps a wobbly drag to the nearest straight line", () => {
    expect(R.linePath({ r: 0, c: 0 }, { r: 1, c: 4 }, S)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }]);
    expect(R.linePath({ r: 0, c: 0 }, { r: 3, c: 2 }, S)).toEqual([{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }, { r: 3, c: 3 }]);
  });

  it("never leaves the board", () => {
    const p = R.linePath({ r: 6, c: 6 }, { r: 7, c: 7 }, S);
    for (const x of p) { expect(x.r).toBeLessThan(S); expect(x.c).toBeLessThan(S); }
    const q = R.linePath({ r: 6, c: 1 }, { r: 7, c: 4 }, S); // ~35 degrees: snaps to a diagonal that would run off the bottom
    for (const x of q) { expect(x.r).toBeLessThan(S); expect(x.c).toBeLessThan(S); }
  });
});

describe("finding words", () => {
  const b = R.buildBoard("3", 99);
  const w = b.words.find((x) => x.kind === "target");
  it("counts a word dragged from either end", () => {
    expect(R.findMatch(b, w.path, new Set())).toMatchObject({ word: w.word });
    expect(R.findMatch(b, w.path.slice().reverse(), new Set())).toMatchObject({ word: w.word });
  });
  it("gives nothing for a word already found, part of a word or random letters", () => {
    expect(R.findMatch(b, w.path, new Set([w.word]))).toBeNull();
    expect(R.findMatch(b, w.path.slice(0, -1), new Set())).toBeNull();
    expect(R.findMatch(b, [{ r: 0, c: 0 }], new Set())).toBeNull();
  });
  it("finds secret words too", () => {
    const s = b.words.find((x) => x.kind === "secret");
    expect(R.findMatch(b, s.path, new Set())).toMatchObject({ word: s.word, kind: "secret" });
  });
});

describe("its place on the Play page", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/word-quest.sql", import.meta.url), "utf8");
  it("is listed as a free online game with a real cover and its thumbnail", () => {
    expect(index).toContain('G({ id:"game-word-quest", title:"Word Quest", slug:"word-quest",');
    expect(index).toContain('path:"games/word-quest.html"');
    expect(index).toContain('cover:{ src:"assets/games/word-quest.jpg"');
    expect(existsSync(new URL("../assets/games/word-quest.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/word-quest-thumb.jpg", import.meta.url))).toBe(true);
  });
  it("has the SQL row for the live games table", () => {
    const row = JSON.parse(sql.split("$j$")[1]);
    expect(row).toMatchObject({ id: "game-word-quest", kind: "embed", status: "published", path: "games/word-quest.html", interactive: true });
  });
  it("uses the site's shared skin and sound kit and shows how to circle a word", () => {
    expect(page).toContain('<link rel="stylesheet" href="game-skin.css">');
    expect(page).toContain('<script src="game-sound.js"></script>');
    expect(page).toContain('class="howto"');
    expect(page).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); // no emojis
  });
});

describe("scoring", () => {
  it("pays more for longer words and multiplies by the combo", () => {
    expect(R.wordPoints("CAT", 1)).toBe(80);
    expect(R.wordPoints("CAT", 3)).toBe(240);
    expect(R.wordPoints("ASTRONAUT", 1)).toBeGreaterThan(R.wordPoints("CAT", 1));
    expect(R.secretPoints(2)).toBe(2 * R.secretPoints(1));
  });
  it("builds a combo when words come quickly, up to a cap, and drops it after a pause", () => {
    expect(R.nextCombo(1, 2000)).toBe(2);
    expect(R.nextCombo(R.MAX_COMBO, 1000)).toBe(R.MAX_COMBO);
    expect(R.nextCombo(4, R.COMBO_MS + 1)).toBe(1);
  });
  it("gives a little less time each round, never under 70%", () => {
    expect(R.roundTime("K", 2)).toBeLessThan(R.roundTime("K", 1));
    expect(R.roundTime("K", 50)).toBe(Math.round(R.GRADES.K.time * 0.7));
    expect(R.timeBonus(12.7)).toBe(120);
    expect(R.clearBonus(2)).toBeGreaterThan(R.clearBonus(1));
  });
  it("awards 1 to 3 stars", () => {
    expect(R.stars({ mode: "arcade", timeLeft: 60, timeTotal: 100, hints: 0 })).toBe(3);
    expect(R.stars({ mode: "arcade", timeLeft: 25, timeTotal: 100, hints: 0 })).toBe(2);
    expect(R.stars({ mode: "arcade", timeLeft: 5, timeTotal: 100, hints: 0 })).toBe(1);
    expect(R.stars({ mode: "chill", hints: 0 })).toBe(3);
    expect(R.stars({ mode: "chill", hints: 2 })).toBe(2);
    expect(R.stars({ mode: "chill", hints: 5 })).toBe(1);
  });
});
