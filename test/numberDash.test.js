import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Number Dash is a subscribers-only game: its source sits in supabase/private-games and its rules in a LOGIC block. */
const html = readFileSync(new URL("../supabase/private-games/number-dash.html", import.meta.url), "utf8");
const logic = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = new Function(logic + "; return { LEVELS, LANES, makeRng, makeQuestion, makeRow, hitTest, gateChoice, speedAt, pointsFor, MAX_SPEED, START_SPEED };")();

describe("the questions", () => {
  it("has four levels, youngest first", () => {
    expect(L.LEVELS.map(l => l.id)).toEqual(["add10", "addsub20", "times", "mixed"]);
  });

  it("always offers three different, never negative, whole-number answers, one of them right", () => {
    for (const lvl of L.LEVELS){
      const rand = L.makeRng(7);
      for (let i = 0; i < 300; i++){
        const q = L.makeQuestion(lvl.id, rand);
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices).toContain(q.answer);
        for (const c of q.choices){ expect(Number.isInteger(c)).toBe(true); expect(c).toBeGreaterThanOrEqual(0); }
        expect(typeof q.text).toBe("string");
      }
    }
  });

  it("keeps the youngest level to sums up to 10 and the next to numbers up to 20", () => {
    const r = L.makeRng(3);
    for (let i = 0; i < 300; i++){
      const a = L.makeQuestion("add10", r);
      expect(a.answer).toBeLessThanOrEqual(10);
      expect(a.text).toMatch(/^\d+ \+ \d+$/);
      const b = L.makeQuestion("addsub20", r);
      expect(b.answer).toBeLessThanOrEqual(20);
      expect(b.text).toMatch(/^\d+ [+−] \d+$/);
    }
  });

  it("works its sums out right", () => {
    const r = L.makeRng(11);
    const ops = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => a / b };
    for (const lvl of L.LEVELS) for (let i = 0; i < 200; i++){
      const q = L.makeQuestion(lvl.id, r);
      const [a, op, b] = q.text.split(" ");
      expect(ops[op](Number(a), Number(b))).toBe(q.answer);
    }
  });

  it("puts the right answer in different lanes, not always the same one", () => {
    const r = L.makeRng(5), seen = new Set();
    for (let i = 0; i < 60; i++){ const q = L.makeQuestion("times", r); seen.add(q.choices.indexOf(q.answer)); }
    expect(seen.size).toBe(3);
  });

  it("is the same run for the same seed", () => {
    const a = L.makeRng(42), b = L.makeRng(42);
    expect(L.makeQuestion("mixed", a)).toEqual(L.makeQuestion("mixed", b));
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

describe("the answer gates", () => {
  it("counts the gate in the runner's lane as the answer chosen", () => {
    const q = { answer: 12, choices: [10, 12, 14] };
    expect(L.gateChoice(q, 1)).toEqual({ picked: 12, correct: true });
    expect(L.gateChoice(q, 0)).toEqual({ picked: 10, correct: false });
  });
});

describe("speed and points", () => {
  it("starts calm, speeds up slowly, and tops out", () => {
    expect(L.speedAt(0)).toBe(L.START_SPEED);
    expect(L.speedAt(500)).toBeGreaterThan(L.START_SPEED);
    expect(L.speedAt(1e6)).toBe(L.MAX_SPEED);
  });
  it("gives points for coins and right answers, more for a streak", () => {
    expect(L.pointsFor("coin", 0)).toBe(1);
    expect(L.pointsFor("correct", 0)).toBe(10);
    expect(L.pointsFor("correct", 3)).toBe(16);
    expect(L.pointsFor("correct", 50)).toBe(20);
    expect(L.pointsFor("wrong", 4)).toBe(0);
  });
});
