// Echo Matrix is one self-contained page (games/echo-matrix.html): a memory game where pads light up and
// play notes in a pattern, and the player taps the pattern back. Its rules (grades, pads, how a pattern
// grows, what counts as a right tap, speed, scoring) live between BEGIN/END markers so they can be tested
// without a browser.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/echo-matrix.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { GRADES, GRADE_ORDER, MODES, PADS, LIVES, REPLAYS, MAX_COMBO, LEVEL_EVERY, TAP_POINTS, makeRng, nextPad, grow, answerOrder, isRightTap, tempoFor, roundPoints, nextCombo, levelFor, starsFor, noteFor };"
)();

const SEEDS = Array.from({ length: 40 }, (_, i) => 3 + i * 97);

describe("grades", () => {
  it("run K to 5th: a 2 by 2 board for K and 1st, 3 by 3 for 2nd and 3rd, 4 by 4 for 4th and 5th", () => {
    expect(R.GRADE_ORDER).toEqual(["K", "1", "2", "3", "4", "5"]);
    expect(R.GRADE_ORDER.map((g) => R.GRADES[g].label)).toEqual(["K", "1st", "2nd", "3rd", "4th", "5th"]);
    expect(R.GRADE_ORDER.map((g) => R.GRADES[g].size)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it("start with longer patterns and quicker flashes as kids get older", () => {
    const starts = R.GRADE_ORDER.map((g) => R.GRADES[g].start);
    const tempos = R.GRADE_ORDER.map((g) => R.GRADES[g].tempo);
    expect(starts[0]).toBe(1);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
      expect(tempos[i]).toBeLessThan(tempos[i - 1]);
    }
  });
});

describe("pads", () => {
  it("are 16 pads, each with its own color, its own shape and a name a child can hear", () => {
    expect(R.PADS.length).toBe(16);
    expect(new Set(R.PADS.map((p) => p.color.toLowerCase())).size).toBe(16);
    expect(new Set(R.PADS.map((p) => p.shape)).size).toBe(16);
    for (const p of R.PADS) expect(p.name).toMatch(/^[a-z]+ [a-z]+$/);
  });

  it("play notes that climb from the first pad to the last on every board size", () => {
    for (const count of [4, 9, 16]) {
      const notes = Array.from({ length: count }, (_, i) => R.noteFor(i, count));
      for (let i = 1; i < count; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
      expect(notes[0]).toBeGreaterThan(150);
      expect(notes[count - 1]).toBeLessThan(1700);
    }
  });
});

describe("patterns", () => {
  it("never light the same pad twice in a row, so every flash is easy to see", () => {
    for (const seed of SEEDS) {
      const rand = R.makeRng(seed);
      for (const count of [4, 9, 16]) {
        let prev = -1;
        for (let i = 0; i < 200; i++) {
          const p = R.nextPad(prev, count, rand);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(count);
          expect(p).not.toBe(prev);
          prev = p;
        }
      }
    }
  });

  it("grow by one pad at a time and keep what was there", () => {
    const rand = R.makeRng(42);
    let seq = [];
    for (let n = 1; n <= 12; n++) {
      const next = R.grow(seq, 9, rand);
      expect(next.length).toBe(n);
      expect(next.slice(0, n - 1)).toEqual(seq);
      seq = next;
    }
  });

  it("come out the same for the same seed", () => {
    const a = [], b = [];
    let sa = [], sb = [];
    const ra = R.makeRng(777), rb = R.makeRng(777);
    for (let i = 0; i < 10; i++) { sa = R.grow(sa, 16, ra); sb = R.grow(sb, 16, rb); }
    a.push(...sa); b.push(...sb);
    expect(a).toEqual(b);
  });
});

describe("tapping it back", () => {
  it("is in the same order for Echo and Rush, and last to first for Backwards", () => {
    const seq = [0, 3, 1, 2];
    expect(R.answerOrder(seq, "echo")).toEqual([0, 3, 1, 2]);
    expect(R.answerOrder(seq, "rush")).toEqual([0, 3, 1, 2]);
    expect(R.answerOrder(seq, "flip")).toEqual([2, 1, 3, 0]);
    expect(seq).toEqual([0, 3, 1, 2]);
  });

  it("checks one tap at a time", () => {
    const seq = [4, 7, 2];
    expect(R.isRightTap(seq, 0, 4, "echo")).toBe(true);
    expect(R.isRightTap(seq, 1, 7, "echo")).toBe(true);
    expect(R.isRightTap(seq, 1, 2, "echo")).toBe(false);
    expect(R.isRightTap(seq, 0, 2, "flip")).toBe(true);
    expect(R.isRightTap(seq, 0, 4, "flip")).toBe(false);
    expect(R.isRightTap(seq, 3, 4, "echo")).toBe(false);
  });
});

describe("speed", () => {
  it("gets a little quicker each round, Rush is quicker still, and never goes too fast to follow", () => {
    for (const g of R.GRADE_ORDER) {
      const t1 = R.tempoFor(g, "echo", 1), t8 = R.tempoFor(g, "echo", 8);
      expect(t1).toBe(R.GRADES[g].tempo);
      expect(t8).toBeLessThan(t1);
      expect(R.tempoFor(g, "rush", 1)).toBeLessThan(t1);
      expect(R.tempoFor(g, "flip", 1)).toBe(t1);
      for (const m of ["echo", "flip", "rush"]) expect(R.tempoFor(g, m, 200)).toBeGreaterThanOrEqual(260);
      expect(R.tempoFor(g, "echo", 200)).toBeGreaterThanOrEqual(Math.round(R.GRADES[g].tempo * 0.6));
    }
  });
});

describe("scoring", () => {
  it("pays more for longer patterns, a streak, and the harder modes", () => {
    expect(R.roundPoints(4, 1, "echo")).toBe(100);
    expect(R.roundPoints(4, 2, "echo")).toBe(200);
    expect(R.roundPoints(4, 1, "rush")).toBe(150);
    expect(R.roundPoints(4, 1, "flip")).toBe(150);
    expect(R.TAP_POINTS).toBe(10);
  });

  it("builds a streak on perfect rounds up to x5, and a slip starts it over", () => {
    expect(R.nextCombo(1, true)).toBe(2);
    expect(R.nextCombo(R.MAX_COMBO, true)).toBe(R.MAX_COMBO);
    expect(R.nextCombo(4, false)).toBe(1);
    expect(R.MAX_COMBO).toBe(5);
  });

  it("levels up every few rounds", () => {
    expect(R.LEVEL_EVERY).toBe(5);
    expect(R.levelFor(1)).toBe(1);
    expect(R.levelFor(5)).toBe(1);
    expect(R.levelFor(6)).toBe(2);
    expect(R.levelFor(11)).toBe(3);
  });

  it("gives stars for how far past the starting pattern a child got", () => {
    const k = R.GRADES.K.start;
    expect(R.starsFor(k, "K")).toBe(0);
    expect(R.starsFor(k + 2, "K")).toBe(1);
    expect(R.starsFor(k + 5, "K")).toBe(2);
    expect(R.starsFor(k + 9, "K")).toBe(3);
    expect(R.starsFor(k + 30, "K")).toBe(3);
  });

  it("starts with 3 hearts and 3 replays", () => {
    expect(R.LIVES).toBe(3);
    expect(R.REPLAYS).toBe(3);
  });
});

describe("its place on the Play page", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/echo-matrix.sql", import.meta.url), "utf8");
  const words = readFileSync(new URL("../supabase/game-words.sql", import.meta.url), "utf8");
  it("is listed as a New free online game with a real cover and its thumbnail", () => {
    expect(index).toContain('G({ id:"game-echo-matrix", title:"Echo Matrix", slug:"echo-matrix",');
    expect(index).toContain('kind:"embed", interactive:true, featured:true, badge:"New", order:0, path:"games/echo-matrix.html"');
    expect(index).toContain('cover:{ src:"assets/games/echo-matrix.jpg"');
    expect(existsSync(new URL("../assets/games/echo-matrix.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/echo-matrix-thumb.jpg", import.meta.url))).toBe(true);
  });
  it("has the SQL row for the live games table, matching the page's word to know", () => {
    const row = JSON.parse(sql.split("$j$")[1]);
    expect(row).toMatchObject({ id: "game-echo-matrix", kind: "embed", status: "published", badge: "New", path: "games/echo-matrix.html", interactive: true, vocabWord: "sequence" });
    expect(index).toContain('"game-echo-matrix":      { vocabWord:"sequence"');
    expect(words).toContain("('game-echo-matrix', ");
  });
  it("is in the window-fit check", () => {
    expect(index).toContain('["games/echo-matrix.html",         "#play"]');
  });
});

describe("the page", () => {
  it("uses the site's game skin and sounds, and no outside style kit", () => {
    expect(page).toContain('href="game-skin.css"');
    expect(page).toContain('src="game-sound.js"');
    expect(page).not.toContain("tailwindcss");
  });

  it("shows how to play along the bottom: watch, wait for your turn, tap it back", () => {
    expect(page).toContain('class="howto"');
    expect((page.match(/<li data-step="\d"/g) || []).length).toBe(3);
  });

  it("gives every pad a name for screen readers and keeps emojis out", () => {
    expect(page).toContain('setAttribute("aria-label"');
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
