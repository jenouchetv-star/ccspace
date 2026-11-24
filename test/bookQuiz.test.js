// Let's find out what you learned! (owner, 2026-11-23; docs/mockups/book-quiz-draft.html): 3 questions at the child's
// grade after every book's green page, read aloud, each answer counting toward its own subject on the progress report.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { BOOK_QUIZ } from "../scripts/book-quiz.mjs";
import { LINES, lineKey, quizPure as Q } from "../scripts/book-quiz-lines.mjs";
import { answerFromMessage } from "../assets/lib/progress.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const reader = read("books/reader.html");
const index = read("index.html");
const SUBJECTS = ["science", "technology", "engineering", "art", "math", "music", "reading"];

describe("the questions", () => {
  it("are 3 per grade level for each of the 8 books with a green page", () => {
    expect(Object.keys(BOOK_QUIZ).sort()).toEqual(["book-space-adventure", "story-city-that-sank", "story-drawing-nobody-understood", "story-fold-that-would-not",
      "story-question-mark", "story-slowest-dancer", "story-song-in-the-rain", "story-train-with-no-signals"]);
    for (const [id, b] of Object.entries(BOOK_QUIZ)) {
      expect(index, id).toContain("books/reader.html?story=" + id);                 // a real book on the site
      for (const lv of ["k1", "g23", "g45"]) expect(b[lv], id + " " + lv).toHaveLength(3);
    }
  });
  it("give K and 1st two answers and the older grades three, all different, with a why and a subject", () => {
    for (const [id, b] of Object.entries(BOOK_QUIZ)) for (const lv of ["k1", "g23", "g45"]) for (const x of b[lv]) {
      expect(x.choices, id + " " + x.q).toHaveLength(lv === "k1" ? 2 : 3);
      expect(new Set(x.choices).size).toBe(x.choices.length);
      expect(x.why.length).toBeGreaterThan(10);
      expect(SUBJECTS).toContain(x.subject);
    }
  });
  it("count toward every STEAMM subject and Reading and Writing across the books", () => {
    const used = new Set(Object.values(BOOK_QUIZ).flatMap((b) => ["k1", "g23", "g45"].flatMap((lv) => b[lv].map((x) => x.subject))));
    expect([...used].sort()).toEqual([...SUBJECTS].sort());
  });
  it("use no em dashes", () => {
    expect(JSON.stringify(BOOK_QUIZ)).not.toContain("—");
  });
});

describe("the reader's question logic", () => {
  it("picks the questions by grade: K and 1st, 2nd and 3rd, 4th to 6th, and 2nd and 3rd with nobody picked", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(Q.qzLevel)).toEqual(["k1", "k1", "g23", "g23", "g45", "g45", "g45"]);
    for (const g of [null, undefined, "", "7", -1, "x"]) expect(Q.qzLevel(g)).toBe("g23");
    expect(Q.qzLevel("4")).toBe("g45");
  });
  it("sends an answer the site keeps, with what the child picked and the book as the skill", () => {
    for (const [id, b] of Object.entries(BOOK_QUIZ)) for (const lv of ["k1", "g23", "g45"]) b[lv].forEach((x, i) => {
      const right = Q.qzAnswer(id, b.title, lv, i, x, 0), wrong = Q.qzAnswer(id, b.title, lv, i, x, 1);
      expect(right.ccsAnswer).toMatchObject({ game: "book-" + id, qid: lv + "-" + (i + 1), subject: x.subject, level: lv, correct: true, answer: x.choices[0], given: x.choices[0], skill: b.title });
      expect(wrong.ccsAnswer).toMatchObject({ correct: false, given: x.choices[1] });
      expect(answerFromMessage(right), id + " " + lv + " " + i).not.toBe(null);
      expect(answerFromMessage(wrong)).toMatchObject({ given: x.choices[1], skill: b.title });
    });
    expect(Q.qzAnswer("x".repeat(40), "T", "g23", 0, BOOK_QUIZ["story-city-that-sank"].g23[0], 0)).toBe(null);   // a game id over 40 is never sent
  });
  it("skips a broken question rather than showing it", () => {
    expect(Q.qzQuestions({ g23: [{ q: "Ok?", choices: ["a", "b"] }, { q: "", choices: ["a", "b"] }, { q: "One?", choices: ["a"] }, null] }, "g23")).toHaveLength(1);
    expect(Q.qzQuestions(undefined, "g23")).toEqual([]);
  });
});

describe("the voice", () => {
  it("has a recording for every line the questions can say", () => {
    expect(LINES.length).toBeGreaterThan(300);
    for (const t of LINES) expect(existsSync(new URL("../assets/books/quiz/" + lineKey(t) + ".mp3", import.meta.url)), t).toBe(true);
  });
  it("plays at 80%, reads K and 1st aloud by itself, and the others when the speaker is tapped", () => {
    expect(reader).toContain("const a = new Audio('/assets/books/quiz/' + QR.qzLineKey(t) + '.mp3'); a.volume = 0.8; QZ.audio = a;");
    expect(reader).toContain("u.lang = 'en-US'; u.rate = 0.9; u.volume = 0.8;");
    expect(reader).toContain("if (QZ.level === 'k1') qzSay([item.q].concat(QZ.order.map(k => item.choices[k])));");
  });
});

describe("the page in the reader", () => {
  it("comes right after the green page, only when the book has questions", () => {
    expect(reader).toContain("if (learn.quiz && [\"k1\", \"g23\", \"g45\"].some(lv => qzQuestions(learn.quiz, lv).length)) out.push({ quizPage: true });");
    expect(reader).toContain("if (page && page.quizPage) return '<div class=\"page-content quizpage\"");
  });
  it("never turns the page when a question is tapped, by mouse or by touch", () => {
    expect(reader).toContain("if (!e.target.closest('.qz')) return;\n    e.stopPropagation();");
    expect(reader).toContain("if (e.target && e.target.closest && e.target.closest('.qz')) return;");
  });
  it("sends only the first answer to each question, and only from inside the site", () => {
    expect(reader).toContain("if (!QZ.sent.has(QZ.i)){");
    expect(reader).toContain("if (msg && window.parent && window.parent !== window){ try { window.parent.postMessage(msg, '*'); }");
  });
  it("shows every word escaped", () => {
    const draw = reader.split("function qzDraw(){")[1].split("function qzAsk(){")[0];
    expect(draw).not.toMatch(/\+ item\.(q|why) \+|\+ item\.choices\[k\] \+|\+ story\.title \+/);
  });
});

describe("the site", () => {
  it("tells a book the picked child's grade, like a game", () => {
    expect(index).toContain("else if (/^\\/?(games|books)\\/[^?#]+\\.html/.test(g.path)){");
  });
  it("links a book's answers on the progress report to the book", () => {
    expect(index).toContain('if (/^book-/.test(id)){ const b = rpItem("book", id.slice(5)); if (b) return b; }');
  });
});
