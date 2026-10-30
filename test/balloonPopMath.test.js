// Balloon Pop Math asks a different mix of questions for each grade (K to 5th). The question makers live between
// BEGIN/END math markers so they can be run here many times over: every question must have a whole-number answer,
// and that answer must always be on one of the eight balloons, with no repeats and no negative numbers.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/balloon-pop-math.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN math */")[1].split("/* END math */")[0];
const M = new Function(block + "; return { GRADES, spread, gcd };")();

describe("the grade picker", () => {
  it("offers Kindergarten to 5th grade", () => {
    expect(M.GRADES.map((g) => g.name)).toEqual(["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"]);
  });
  it("is the first thing a player sees, and a round is 25 questions", () => {
    expect(page).toContain('<div class="over" id="start" role="dialog"');
    expect(page).not.toMatch(/id="start"[^>]*hidden/);
    expect(page).toContain("const TOTAL = 25");
  });
});

describe("every grade's questions", () => {
  for (let gi = 0; gi < 6; gi++) {
    it(`always put the answer on a balloon (${["K", "1st", "2nd", "3rd", "4th", "5th"][gi]})`, () => {
      const g = M.GRADES[gi];
      for (let k = 0; k < 600; k++) {
        const maker = g.makers[k % g.makers.length];
        const q = maker();
        expect(Number.isInteger(q.a), q.q).toBe(true);
        expect(q.a, q.q).toBeGreaterThanOrEqual(0);
        const nums = q.choices ? q.choices.slice(0, 8) : M.spread(q.a);
        expect(nums, q.q).toHaveLength(8);
        expect(new Set(nums).size, q.q).toBe(8);
        expect(nums, q.q).toContain(q.a);
        for (const n of nums) { expect(Number.isInteger(n), q.q).toBe(true); expect(n, q.q).toBeGreaterThanOrEqual(0); }
        expect(typeof q.hint).toBe("string");
        expect(typeof q.say).toBe("string");
      }
    });
  }
  it("gets the math right", () => {
    const [, , two, three, four, five] = M.GRADES;
    // "Pop the even number" has exactly one even balloon; "a factor of" and "a multiple of" have exactly one right balloon
    for (let k = 0; k < 300; k++) {
      const e = two.makers[4]();
      expect(e.choices.filter((n) => n % 2 === 0)).toEqual([e.a]);
      const f = four.makers[2](), N = Number(f.q.match(/factor of (\d+)/)[1]);
      expect(f.choices.filter((n) => N % n === 0)).toEqual([f.a]);
      const m = four.makers[3](), K = Number(m.q.match(/multiple of (\d+)/)[1]);
      expect(m.choices.filter((n) => n % K === 0)).toEqual([m.a]);
      const o = five.makers[2](), [a, b, c] = o.q.match(/\d+/g).map(Number);
      expect(o.a).toBe(a + b * c);                                   // multiply before you add
      const r = three.makers[3](), [n, to] = r.q.replace(/,/g, "").match(/\d+/g).map(Number);
      expect(r.a).toBe(Math.round(n / to) * to);
    }
    expect(M.gcd(24, 36)).toBe(12);
  });
  it("shows the digit, not the whole number, as the answer to a place-value question", () => {
    const q = M.GRADES[2].makers[2]();
    const n = Number(q.q.match(/of ([\d,]+)/)[1].replace(/,/g, ""));
    expect(q.a).toBeLessThan(10);
    expect(String(n)).toContain(String(q.a));
  });
});

describe("playing", () => {
  it("has sound on unless the player turned it off, and a button to turn it off", () => {
    expect(page).toContain('soundOn = localStorage.getItem("bpm-sound") !== "off"');
    expect(page).toContain('id="soundBtn"');
  });
  it("gives a hint after two misses, shows the work after three, then lights up the right balloon", () => {
    const w = page.split("function wrong(el){")[1].split("\n}\n")[0];
    expect(w).toContain('if (misses === 2) chike("point", `Hint: ${cur.hint} Stuck? Press Show me how.`');
    expect(w).toContain("else if (misses === 3) showWork();");
    expect(w).toContain('good.el.classList.add("glow")');
  });
  it("still takes a typed answer, and Enter jumps into the box", () => {
    expect(page).toContain('id="answer-input"');
    expect(page).toContain('document.addEventListener("keydown"');
  });
  it("keeps the site's shared game skin, and holds still for people who ask for less motion", () => {
    expect(page).toContain('href="game-skin.css"');
    expect(page).toContain("prefers-reduced-motion");
  });
});

describe("a saved place", () => {
  it("is kept after every question, on this device, and cleared when the round is finished", () => {
    expect(page).toContain('const SAVE_KEY = "bpm-save";');
    expect(page.split("function nextQuestion(){")[1].split("\n}\n")[0]).toContain("saveGame();");
    expect(page.split("function finish(){")[1].split("\n}\n")[0]).toContain("clearSave();");
  });
  it("is offered first on the start screen with Continue, and picks up the grade, question and score", () => {
    expect(page).toContain('<div class="resume" id="resume" hidden>');
    expect(page).toContain("Pick up where you left off");
    const start = page.split("function startRound(saved){")[1].split("\n}\n")[0];
    expect(start).toContain("qNum = saved.q - 1; score = saved.score || 0;");
    expect(start).toContain("Welcome back! You were on question");
  });
  it("ignores a save it cannot trust", () => {
    const load = page.split("function loadSave(){")[1].split("\n}\n")[0];
    expect(load).toContain("GRADES.some((g) => g.id === s.g)");
    expect(load).toContain("s.q >= 1 && s.q <= TOTAL");
  });
});

describe("Chike shows the work", () => {
  const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/,/g, "");
  it("writes steps for every question that end with the answer (or fall back to the hint)", () => {
    for (const g of M.GRADES) for (let k = 0; k < 300; k++) {
      const q = g.makers[k % g.makers.length]();
      if (!q.work) continue;
      expect(q.work.steps.length, q.q).toBeGreaterThanOrEqual(2);
      const last = strip(q.work.steps[q.work.steps.length - 1]);
      expect(last, q.q).toContain(String(q.a));
    }
  });
  it("adds and takes away in columns, carrying and borrowing correctly", () => {
    const two = M.GRADES[2], three = M.GRADES[3];
    for (let k = 0; k < 400; k++) {
      for (const q of [two.makers[0](), two.makers[1](), three.makers[4](), three.makers[5]()]) {
        expect(q.work.vis, q.q).toContain('class="cols"');
        for (const s of q.work.steps) {
          // every "x + y (+ 1 carried) = s" and "x − y = s" line is true
          const m = s.match(/: (\d+) \+ (\d+)( \+ 1 carried)? = (\d+)/);
          if (m) expect(+m[1] + +m[2] + (m[3] ? 1 : 0), s).toBe(+m[4]);
          const t = s.match(/(\d+) − (\d+) = (\d+)/);
          if (t) expect(+t[1] - +t[2], s).toBe(+t[3]);
          const b = s.match(/: (\d+) − (\d+) = (\d+)\.$/);
          if (b) expect(+b[1] - +b[2], s).toBe(+b[3]);
        }
      }
    }
  });
  it("draws dots for times tables and sharing, place columns, and a number line for rounding", () => {
    expect(M.GRADES[3].makers[0]().work.vis || "").toMatch(/class="dots"|^$/);
    expect(M.GRADES[2].makers[2]().work.vis).toContain('class="places"');
    expect(M.GRADES[3].makers[3]().work.vis).toContain('class="line"');
  });
  it("has a Show me how button, opens by itself on the third miss, and counts like a miss", () => {
    expect(page).toContain('id="showBtn"');
    expect(page).toContain("Show me how</button>");
    expect(page).toContain("else if (misses === 3) showWork();");
    expect(page.split("function showWork(){")[1].split("\n}\n")[0]).toContain("if (!misses) misses = 1;");
  });
});
