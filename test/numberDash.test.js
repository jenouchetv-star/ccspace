import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Math Runner (file: number-dash) is a subscribers-only game: its source sits in supabase/private-games and its rules in a LOGIC block. */
const html = readFileSync(new URL("../supabase/private-games/number-dash.html", import.meta.url), "utf8");
const logic = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = new Function(logic + "; return { LEVELS, LANES, makeRng, makeDoors, doorLabel, applyDoor, addCoin, bestDoors, formatCoins, readBest, mergeBest, makeRow, hitTest, speedAt, MAX_SPEED, START_SPEED, SUPER, superStep, superCoin };")();

describe("the doors", () => {
  it("has a level for each grade, Kindergarten to 6th grade", () => {
    expect(L.LEVELS.map(l => l.id)).toEqual(["k", "g1", "g2", "g3", "g4", "g5", "g6"]);
    expect(L.LEVELS.map(l => l.title)).toEqual(["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade"]);
    expect(L.LEVELS.map(l => l.short)).toEqual(["K", "1st", "2nd", "3rd", "4th", "5th", "6th"]);
  });

  it("writes a door the way a kid reads it", () => {
    expect(L.doorLabel({ op: "+", n: 8 })).toBe("+8");
    expect(L.doorLabel({ op: "−", n: 10 })).toBe("−10");
    expect(L.doorLabel({ op: "×", n: 3 })).toBe("×3");
    expect(L.doorLabel({ op: "÷", n: 4 })).toBe("÷4");
  });

  it("changes the coins the runner carries, never below zero, always whole", () => {
    expect(L.applyDoor(12, { op: "+", n: 8 })).toBe(20);
    expect(L.applyDoor(12, { op: "−", n: 10 })).toBe(2);
    expect(L.applyDoor(5, { op: "−", n: 10 })).toBe(0);
    expect(L.applyDoor(12, { op: "×", n: 3 })).toBe(36);
    expect(L.applyDoor(12, { op: "÷", n: 4 })).toBe(3);
    expect(L.applyDoor(13, { op: "÷", n: 4 })).toBe(3);
  });

  it("has no cap on the coins, in any grade", () => {
    for (const lvl of L.LEVELS){
      expect(L.applyDoor(9999, { op: "+", n: 5 }, lvl.id)).toBe(10004);
      expect(L.applyDoor(9999n, { op: "×", n: 12 }, lvl.id)).toBe(119988n);
    }
    expect(L.addCoin(9999n)).toBe(10000n);
    expect(html).not.toContain("BAG_MAX");
    expect(html).not.toContain("bagMax");
  });

  it("keeps a huge pile of coins exact, past what an ordinary number can hold", () => {
    const pile = 10n ** 30n + 7n;
    expect(L.applyDoor(pile, { op: "×", n: 12 })).toBe(12n * 10n ** 30n + 84n);
    expect(L.applyDoor(pile, { op: "÷", n: 4 })).toBe((10n ** 30n + 7n) / 4n);
    expect(L.applyDoor(pile, { op: "+", n: 200 })).toBe(10n ** 30n + 207n);
    expect(L.applyDoor(5n, { op: "−", n: 10 })).toBe(0n);
    expect(L.bestDoors(pile, [{ op: "+", n: 200 }, { op: "×", n: 2 }, { op: "÷", n: 3 }])).toEqual([1]);
  });

  it("writes big coin counts with commas", () => {
    expect(L.formatCoins(0n)).toBe("0");
    expect(L.formatCoins(999n)).toBe("999");
    expect(L.formatCoins(9999n)).toBe("9,999");
    expect(L.formatCoins(1234567n)).toBe("1,234,567");
    expect(L.formatCoins(10n ** 21n)).toBe("1,000,000,000,000,000,000,000");
  });

  it("knows which door gives the most, and that depends on how many coins you have", () => {
    const doors = [{ op: "+", n: 8 }, { op: "×", n: 3 }, { op: "−", n: 2 }];
    expect(L.bestDoors(1, doors)).toEqual([0]);    /* 1 + 8 = 9 beats 1 × 3 = 3 */
    expect(L.bestDoors(20, doors)).toEqual([1]);   /* 20 × 3 = 60 beats 20 + 8 */
  });

  it("counts every door that ties for the most as a best door", () => {
    expect(L.bestDoors(4, [{ op: "+", n: 8 }, { op: "×", n: 3 }, { op: "−", n: 1 }])).toEqual([0, 1]);
  });

  /* what each grade's doors use: [the signs, the biggest number on a door] */
  const SCOPE = {
    k:  [["+", "−"], 5],
    g1: [["+", "−"], 10],
    g2: [["+", "−", "×"], 20],
    g3: [["+", "−", "×", "÷"], 30],
    g4: [["+", "−", "×", "÷"], 50],
    g5: [["+", "−", "×", "÷"], 100],
    g6: [["+", "−", "×", "÷"], 200]
  };
  it("keeps each grade's doors to the math that grade practices", () => {
    const r = L.makeRng(3);
    for (const [id, [ops, maxN]] of Object.entries(SCOPE)){
      const seen = new Set();
      for (let i = 0; i < 400; i++){
        const doors = L.makeDoors(id, r);
        expect(doors).toHaveLength(3);
        for (const d of doors){
          seen.add(d.op);
          expect(ops).toContain(d.op);
          expect(Number.isInteger(d.n)).toBe(true);
          expect(d.n).toBeGreaterThanOrEqual(1);
          expect(d.n).toBeLessThanOrEqual(maxN);
          if (d.op === "×" || d.op === "÷") expect(d.n).toBeGreaterThanOrEqual(2);
        }
      }
      expect([...seen].sort()).toEqual([...ops].sort());
    }
  });

  it("always gives a real choice: three different doors, at least one that adds and one that takes away", () => {
    const r = L.makeRng(9);
    for (const lvl of L.LEVELS) for (let i = 0; i < 300; i++){
      const doors = L.makeDoors(lvl.id, r);
      expect(new Set(doors.map(L.doorLabel)).size).toBe(3);
      expect(doors.some(d => d.op === "+" || d.op === "×")).toBe(true);
      expect(doors.some(d => d.op === "−" || d.op === "÷")).toBe(true);
    }
  });

  it("puts the doors in different orders, not the same lane every time", () => {
    const r = L.makeRng(5), seen = new Set();
    for (let i = 0; i < 60; i++){ const doors = L.makeDoors("g3", r); seen.add(doors.findIndex(d => d.op === "−" || d.op === "÷")); }
    expect(seen.size).toBe(3);
  });

  it("is the same run for the same seed", () => {
    expect(L.makeDoors("g6", L.makeRng(42))).toEqual(L.makeDoors("g6", L.makeRng(42)));
  });
});

describe("the obstacles", () => {
  it("never blocks all three lanes with walls, so there is always a way through", () => {
    const r = L.makeRng(9);
    for (let d = 0; d < 400; d++){
      const row = L.makeRow(r, d / 400);
      const walls = row.filter(o => o.type === "wall").map(o => o.lane);
      expect(new Set(walls).size).toBeLessThan(3);
      for (const o of row){ expect([0, 1, 2]).toContain(o.lane); expect(["coin", "hurdle", "bar", "wall"]).toContain(o.type); }
    }
  });

  it("starts gentle: early rows have no walls", () => {
    const r = L.makeRng(1);
    for (let i = 0; i < 50; i++) expect(L.makeRow(r, 0).some(o => o.type === "wall")).toBe(false);
  });
});

describe("running into things", () => {
  const runner = (o) => Object.assign({ lane: 1, y: 0, sliding: false }, o);
  it("collects a coin in its lane", () => {
    expect(L.hitTest({ type: "coin", lane: 1 }, runner())).toBe("collect");
    expect(L.hitTest({ type: "coin", lane: 0 }, runner())).toBe("pass");
  });
  it("jumps over a hurdle, or trips on it", () => {
    expect(L.hitTest({ type: "hurdle", lane: 1 }, runner({ y: 0.9 }))).toBe("pass");
    expect(L.hitTest({ type: "hurdle", lane: 1 }, runner({ y: 0.1 }))).toBe("hit");
  });
  it("slides under a bar, or bumps it", () => {
    expect(L.hitTest({ type: "bar", lane: 1 }, runner({ sliding: true }))).toBe("pass");
    expect(L.hitTest({ type: "bar", lane: 1 }, runner())).toBe("hit");
  });
  it("has to go around a wall", () => {
    expect(L.hitTest({ type: "wall", lane: 1 }, runner({ y: 0.9 }))).toBe("hit");
    expect(L.hitTest({ type: "wall", lane: 2 }, runner())).toBe("pass");
  });
});

describe("super speed", () => {
  it("starts a run with a full meter", () => {
    expect(L.SUPER.full).toBeGreaterThan(0);
  });
  it("runs faster while held, using up the meter", () => {
    const s = L.superStep(L.SUPER.full, true, 0.5);
    expect(s.on).toBe(true);
    expect(s.meter).toBeCloseTo(L.SUPER.full - 0.5);
    expect(L.SUPER.mult).toBeGreaterThan(1.4);
  });
  it("stops when the meter is empty, even if still held", () => {
    const s = L.superStep(0.1, true, 0.5);
    expect(s.meter).toBe(0);
    expect(L.superStep(0, true, 0.1).on).toBe(false);
  });
  it("fills back up slowly when let go, never past full", () => {
    const s = L.superStep(1, false, 1);
    expect(s.on).toBe(false);
    expect(s.meter).toBeCloseTo(1 + L.SUPER.refill);
    expect(L.superStep(L.SUPER.full, false, 10).meter).toBe(L.SUPER.full);
  });
  it("gets a top-up from each coin, never past full", () => {
    expect(L.superCoin(1)).toBeCloseTo(1 + L.SUPER.coin);
    expect(L.superCoin(L.SUPER.full)).toBe(L.SUPER.full);
  });
});

describe("the most coins, kept for each grade", () => {
  it("reads a saved record, and ignores anything that isn't a whole number or a grade", () => {
    expect(L.readBest({ k: "50", g6: "123456789012345678901234567890" })).toEqual({ k: 50n, g6: 123456789012345678901234567890n });
    expect(L.readBest({ g1: 120 })).toEqual({ g1: 120n });                 /* the old saves were plain numbers */
    expect(L.readBest({ g2: "-5", g3: "1e9", g4: "abc", zz: "9", g5: "" })).toEqual({});
    expect(L.readBest(null)).toEqual({});
    expect(L.readBest("nope")).toEqual({});
  });
  it("keeps the higher number for each grade when two records meet", () => {
    expect(L.mergeBest({ k: 50n, g1: 3n }, { k: 20n, g2: 9n })).toEqual({ k: 50n, g1: 3n, g2: 9n });
    expect(L.mergeBest({ g6: 10n ** 25n }, { g6: 10n ** 25n + 1n })).toEqual({ g6: 10n ** 25n + 1n });
  });
  it("saves through the site, since the sealed game can't keep anything itself", () => {
    expect(html).toContain('ccsSave: "get", game: SAVE_NAME');
    expect(html).toContain('ccsSave: "set", game: SAVE_NAME');
    expect(html).toContain('const SAVE_NAME = "math-runner"');
  });
  it("notes a new best as soon as the coins pass it, so leaving mid-run keeps it", () => {
    const update = html.split("function onGate(")[1].split("\n}\n")[0];
    expect(update).toContain("noteBest()");
    expect(html.split("function update(dt){")[1].split("\n}\n")[0]).toContain("noteBest()");
  });
});

describe("speed and points", () => {
  it("runs at a brisk pace from the start", () => {
    expect(L.START_SPEED).toBeGreaterThanOrEqual(18);
    expect(L.MAX_SPEED).toBeGreaterThanOrEqual(32);
  });
  it("starts calm, speeds up slowly, and tops out", () => {
    expect(L.speedAt(0)).toBe(L.START_SPEED);
    expect(L.speedAt(500)).toBeGreaterThan(L.START_SPEED);
    expect(L.speedAt(1e6)).toBe(L.MAX_SPEED);
  });
});
