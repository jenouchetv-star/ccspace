// Chike's quick questions after an episode or a "We made it!" activity (owner, 2026-11-24; the drafts
// docs/mockups/tracker-quick-questions-*.png). Each item keeps 4 questions per grade band in its record (quiz), like a
// book's learn.quiz: the first time 2, the second time the other 2, then just for fun (not counted).
import { describe, it, expect } from "vitest";
import { quizLevelFor, itemQuizGame, itemQuizSubject, itemQuizPick, ITEM_QUIZ_PER_TIME } from "../assets/lib/progress.js";

const Q = (n, k = 3) => ({ q: "Question " + n + "?", choices: Array.from({ length: k }, (_, i) => (i === 0 ? "Right " : "Wrong " + i + " ") + n), why: "Because " + n + "." });
const quiz = { subject: "science", k1: [Q(1, 2), Q(2, 2), Q(3, 2), Q(4, 2)], g23: [Q(1), Q(2), Q(3), Q(4)], g45: [Q(1, 4), Q(2, 4), Q(3, 4), Q(4, 4)] };
const fixed = () => 0.5;

describe("Chike's quick questions: the rules", () => {
  it("asks at the child's grade: K-1, 2-3, 4-6", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(quizLevelFor)).toEqual(["k1", "k1", "g23", "g23", "g45", "g45", "g45"]);
    expect(quizLevelFor(null)).toBe(null);
    expect(quizLevelFor(9)).toBe(null);
  });
  it("names each item's answers as its own game, so the report can find it and count it as its own source", () => {
    expect(itemQuizGame("episode", "vid-ep2")).toBe("episode-vid-ep2");
    expect(itemQuizGame("activity", "act-cardboard-city")).toBe("activity-act-cardboard-city");
    expect(itemQuizGame("book", "x")).toBe("");
    expect(itemQuizGame("episode", "Bad Id!")).toBe("");
    expect(itemQuizGame("activity", "a".repeat(40))).toBe("");
  });
  it("counts toward the item's one subject (a STEAMM subject, or Reading and Writing)", () => {
    expect(itemQuizSubject(quiz)).toBe("science");
    expect(itemQuizSubject({ subject: "reading" })).toBe("reading");
    expect(itemQuizSubject({ subject: "history" })).toBe("");
    expect(itemQuizSubject(null)).toBe("");
  });
  it("the first time: questions 1 and 2, counted", () => {
    const p = itemQuizPick(quiz, "g23", [], fixed);
    expect(p.practice).toBe(false);
    expect(p.questions.map(q => q.qid)).toEqual(["g23-1", "g23-2"]);
    expect(ITEM_QUIZ_PER_TIME).toBe(2);
  });
  it("the second time: questions 3 and 4, fresh and counted", () => {
    const p = itemQuizPick(quiz, "g23", ["g23-1", "g23-2"], fixed);
    expect(p.practice).toBe(false);
    expect(p.questions.map(q => q.qid)).toEqual(["g23-3", "g23-4"]);
  });
  it("a set left half done: the one not answered, then the next", () => {
    expect(itemQuizPick(quiz, "g23", ["g23-1"], fixed).questions.map(q => q.qid)).toEqual(["g23-2", "g23-3"]);
  });
  it("after all four: two of them again, just for fun, not counted", () => {
    const p = itemQuizPick(quiz, "k1", ["k1-1", "k1-2", "k1-3", "k1-4"], fixed);
    expect(p.practice).toBe(true);
    expect(p.questions).toHaveLength(2);
    expect(new Set(p.questions.map(q => q.qid)).size).toBe(2);
  });
  it("answers at another grade don't count as answered at this one", () => {
    expect(itemQuizPick(quiz, "g45", ["g23-1", "g23-2"], fixed).questions.map(q => q.qid)).toEqual(["g45-1", "g45-2"]);
  });
  it("mixes the choices but keeps track of the right one, and its words", () => {
    for (let k = 0; k < 50; k++) {
      const p = itemQuizPick(quiz, "g45", [], Math.random);
      for (const q of p.questions) {
        expect(q.choices).toHaveLength(4);
        expect(q.choices[q.answer]).toMatch(/^Right /);
        expect(q.right).toBe(q.choices[q.answer]);
        expect(q.subject).toBe("science");
        expect(q.why).toMatch(/^Because /);
      }
    }
  });
  it("nothing to ask: no quiz, no questions at this grade, or broken questions are skipped", () => {
    expect(itemQuizPick(null, "k1", [], fixed).questions).toEqual([]);
    expect(itemQuizPick({ subject: "art" }, "k1", [], fixed).questions).toEqual([]);
    const broken = { subject: "art", k1: [{ q: "", choices: ["a", "b"] }, { q: "Only one?", choices: ["a"] }, Q(3, 2)] };
    expect(itemQuizPick(broken, "k1", [], fixed).questions.map(q => q.qid)).toEqual(["k1-3"]);
    expect(itemQuizPick({ subject: "nope", k1: [Q(1, 2)] }, "k1", [], fixed).questions).toEqual([]);
  });
});

import { ITEM_QUIZ } from "../scripts/item-quiz.mjs";
import { itemQuizSql } from "../scripts/sync-item-quiz.mjs";

describe("the questions themselves (scripts/item-quiz.mjs)", () => {
  const entries = Object.entries(ITEM_QUIZ);
  it("cover the episodes and activities, each with one subject and 4 questions at every grade band", () => {
    expect(entries.length).toBeGreaterThanOrEqual(40);
    for (const [key, it] of entries) {
      expect(key).toMatch(/^(episode|activity):[a-z0-9-]+$/);
      expect(itemQuizSubject(it), key).not.toBe("");
      for (const [level, n] of [["k1", 2], ["g23", 3], ["g45", 3]]) {
        expect(it[level], key + " " + level).toHaveLength(4);
        for (const q of it[level]) {
          expect(q.choices.length, key + " " + q.q).toBeGreaterThanOrEqual(n);
          expect(q.choices.length).toBeLessThanOrEqual(level === "k1" ? 2 : level === "g23" ? 3 : 4);
          expect(q.why.trim().length).toBeGreaterThan(0);
        }
        expect(itemQuizPick(it, level, [], () => 0).questions).toHaveLength(2);
        expect(new Set(it[level].map(q => q.q)).size).toBe(4);
      }
      expect(itemQuizGame(key.split(":")[0], key.split(":")[1]), key).not.toBe("");
    }
  });
  it("no em dashes, no emojis, never he or she for a child", () => {
    const words = JSON.stringify(ITEM_QUIZ);
    expect(words).not.toContain("—");
    expect(words).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(words).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
  });
  it("are copied into each record's quiz and nothing else (merged in, the rest of the record kept)", () => {
    const sql = itemQuizSql(ITEM_QUIZ).split("\n");
    expect(sql).toHaveLength(entries.length);
    expect(sql[0]).toMatch(/^update public\.(videos|activities) set data = data \|\| jsonb_build_object\('quiz', \$q\$\{"subject":/);
    expect(sql.every(l => /where id = '[a-z0-9-]+';$/.test(l))).toBe(true);
  });
});
