// Chike reads the K-1 quiz cards aloud in Heart's voice (owner, 2026-11-25): the weekly quiz and the quick questions
// play recorded pieces (assets/voice/quiz, scripts/quiz-voice-lines.mjs + scripts/record-lines.mjs), and only fall back
// to the device's voice for a piece with no recording.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  quizLineKey, quizQuestionParts, quizReplyParts, quizPopEndLine, quizItemEndLine, quizVoiceLines, QUIZ_VOICE_DIR,
  QUIZ_POP_SIZE, ITEM_QUIZ_PER_TIME,
} from "../assets/lib/progress.js";
import { ITEM_QUIZ } from "../scripts/item-quiz.mjs";
import { quizLineList, spokenText } from "../scripts/quiz-voice-lines.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
const fn = (name, ...deps) => (...vals) => new Function(...deps, "return function " + name + "(" + body(name))(...vals);
const E = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");

describe("the pieces Chike says", () => {
  it("are named by the same hash the games use", () => {
    const game = readFileSync(new URL("../games/drop-2048.html", import.meta.url), "utf8");
    const lineKey = new Function("text", game.split("function lineKey(text){")[1].split("\n}")[0]);
    for (const t of ["Combo!", "Mega combo!", "You got it!", "It’s Neptune, far away."]) expect(quizLineKey(t)).toBe(lineKey(t));
    expect(QUIZ_VOICE_DIR).toBe("assets/voice/quiz/");
  });
  it("a question: the question, then each choice with \"or\" between", () => {
    expect(quizQuestionParts("What is lava?", ["Melted rock", "Hot water"])).toEqual(["What is lava?", "Melted rock", "or", "Hot water"]);
    expect(quizQuestionParts("Pick one", ["A", "B", "C"])).toEqual(["Pick one", "A", "or", "B", "or", "C"]);
  });
  it("say exactly the words on the card after an answer", () => {
    const reply = fn("progressQuizReplyHTML", "E")(E);
    const choices = ["Hot water", "Melted rock."];
    for (const st of [
      { result: { correct: true, answer: 1, why: "Lava is melted rock." } },
      { result: { correct: false, answer: 1, why: "Lava is melted rock." } },
      { result: { correct: false, answer: 1, why: "" } },
      { result: { skipped: true } },
      { error: true, result: null },
    ]) expect(quizReplyParts(st, choices).join(" ")).toBe(text(reply({ choices }, st)));
    expect(quizReplyParts({ result: null }, choices)).toEqual([]);
  });
  it("and the end lines are the card's own", () => {
    const pop = fn("progressQuizEndHTML", "E", "quizPopEndLine")(E, quizPopEndLine);
    const item = fn("progressItemQuizEndHTML", "E", "quizItemEndLine")(E, quizItemEndLine);
    expect(text(pop(2, 3))).toContain("You got 2 of 3 right. See you next week!");
    expect(text(pop(0, 0))).toContain("See you next week!");
    expect(text(item(1, 2, false))).toContain("You got 1 of 2 right. Great job!");
    expect(text(item(2, 2, true))).toContain("You got 2 of 2 right. Great practice!");
  });
});

describe("the recordings", () => {
  const lines = quizVoiceLines(Object.values(ITEM_QUIZ));
  const all = new Set(lines);
  it("cover every piece of every K-1 quick question, whichever way its choices are mixed", () => {
    let n = 0;
    for (const it of Object.values(ITEM_QUIZ)) for (const x of it.k1) {
      n++;
      const shown = [...x.choices].reverse();
      for (const p of quizQuestionParts(x.q, shown)) expect(all.has(p), p).toBe(true);
      for (let a = 0; a < shown.length; a++) {
        const right = shown.indexOf(x.choices[0]);
        for (const correct of [true, false]) for (const p of quizReplyParts({ result: { correct, answer: right, why: x.why } }, shown)) expect(all.has(p), p).toBe(true);
      }
    }
    expect(n).toBe(160);
  });
  it("and every line that ends a quiz", () => {
    for (let a = 0; a <= QUIZ_POP_SIZE; a++) for (let r = 0; r <= a; r++) expect(all.has(quizPopEndLine(r, a))).toBe(true);
    for (let k = 1; k <= ITEM_QUIZ_PER_TIME; k++) for (let r = 0; r <= k; r++) for (const p of [true, false]) expect(all.has(quizItemEndLine(r, k, p))).toBe(true);
    for (const l of ["That didn’t go through. Tap your answer again.", "Let’s skip that one. On to the next!"]) expect(all.has(l)).toBe(true);
  });
  it("are each on disk, one file per line, and nothing else", () => {
    const list = quizLineList(ITEM_QUIZ);
    expect(new Set(list.map((l) => l.key)).size).toBe(list.length);
    const dir = new URL("../" + QUIZ_VOICE_DIR, import.meta.url);
    for (const l of list) expect(existsSync(new URL(l.key + ".mp3", dir)), l.text).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith(".mp3")).length).toBe(list.length);
  });
  it("are spoken with plain apostrophes, keyed by the words shown", () => {
    expect(spokenText("Let’s skip that one.")).toBe("Let's skip that one.");
    const l = quizLineList(ITEM_QUIZ).find((x) => x.text === "Let's skip that one. On to the next!");
    expect(l.key).toBe(quizLineKey("Let’s skip that one. On to the next!"));
  });
});

describe("both quiz cards", () => {
  it("play the pieces at 80%, all loading at once, and use the device's voice only from a missing piece on", () => {
    const play = body("quizVoicePlay");
    expect(play).toContain('new Audio("/" + QUIZ_VOICE_DIR + quizLineKey(t) + ".mp3")');
    expect(play).toContain("a.volume = 0.8");
    expect(play).toContain('a.preload = "auto"');
    expect(play).toContain("quizVoiceHere(list.slice(i).join(\" \"))");
    expect(body("quizVoiceHere")).toContain("u.volume = 0.8");
    expect(body("closePopQuiz")).toContain("quizVoiceStop();");
  });
  it("the weekly quiz and the quick questions both read K-1 aloud this way", () => {
    for (const f of ["openPopQuiz", "openItemQuiz"]) {
      const o = body(f);
      expect(o, f).toContain('const canSay = level === "k1";');
      expect(o, f).toContain("say(quizQuestionParts(q.question, q.choices))");
      expect(o, f).toContain("say(quizReplyParts(st, q.choices))");
      expect(o, f).not.toContain("SpeechSynthesisUtterance");
    }
    expect(body("openPopQuiz")).toContain("say([words])");
    expect(body("openItemQuiz")).toContain("say([words])");
  });
});
