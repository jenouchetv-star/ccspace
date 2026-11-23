// Spelling Detective's cases count toward Reading and Writing on the progress report (owner, 2026-11-22): each case,
// solved or not, posts one answer in the shape the site takes (answerFromMessage in assets/lib/progress.js).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { answerFromMessage } from "../assets/lib/progress.js";

const page = readFileSync(new URL("../games/spelling-detective.html", import.meta.url), "utf8");
const src = "function spellingAnswer(" + page.split("function spellingAnswer(")[1].split("\n            }\n")[0] + "\n}";
const spellingAnswer = new Function(src + "; return spellingAnswer;")();
const words = [...page.matchAll(/\{ word: '([^']*)', definition: '((?:[^'\\]|\\.)*)' \}/g)].map((m) => m[1]);

describe("Spelling Detective's answers", () => {
  it("a solved case is a right answer for Reading and Writing, at the grade's level", () => {
    const a = spellingAnswer("k", { word: "cat", definition: "A furry pet that says meow." }, true);
    expect(a).toEqual({ ccsAnswer: { game: "spelling-detective", qid: "spell-cat", subject: "reading", level: "k1", correct: true,
      question: "Spell the word that means: A furry pet that says meow.", answer: "cat", why: "Cat is spelled C-A-T.", skill: "Short vowel words" } });
    expect(answerFromMessage(a)).toEqual(a.ccsAnswer);
  });

  it("a missed case is a wrong answer, so it shows under Questions to go over", () => {
    const a = spellingAnswer("4", { word: "volcano", definition: "A mountain that can erupt." }, false);
    expect(a.ccsAnswer).toMatchObject({ correct: false, level: "g45", answer: "volcano", why: "Volcano is spelled V-O-L-C-A-N-O." });
    expect(answerFromMessage(a)).not.toBe(null);
  });

  it("tells the parent report what was spelled, whether a clue was used, and the pattern practiced (owner, 2026-11-23)", () => {
    const a = spellingAnswer("2", { word: "beach", definition: "The sandy place by the sea." }, false, "bee_h", 1).ccsAnswer;
    expect(a).toMatchObject({ given: "bee_h", hints: 1, skill: "Spelling “ea” words" });
    expect(answerFromMessage({ ccsAnswer: a })).toMatchObject({ given: "bee_h", hints: 1, skill: "Spelling “ea” words" });
    const skill = (w) => spellingAnswer("2", { word: w, definition: "x" }, true).ccsAnswer.skill;
    expect(["night", "cake", "ship", "sun", "volcano"].map(skill)).toEqual([
      "Spelling “igh” words", "Spelling words with a silent e", "Spelling words with “sh”", "Short vowel words", "Spelling longer words"]);
    const solved = spellingAnswer("2", { word: "cat", definition: "x" }, true, "", 0).ccsAnswer;
    expect(solved).not.toHaveProperty("given"); expect(solved).not.toHaveProperty("hints");
    expect(page).toContain("isWin ? '' : guessedWord.map((l) => l || '_').join(''), clueUsed ? 1 : 0)");
  });

  it("maps every grade to a level", () => {
    const lv = (g) => spellingAnswer(g, { word: "sun", definition: "x" }, true).ccsAnswer.level;
    expect(["k", "1", "2", "3", "4", "5"].map(lv)).toEqual(["k1", "k1", "g23", "g23", "g45", "g45"]);
  });

  it("every word makes an answer the site accepts", () => {
    expect(words.length).toBeGreaterThan(150);
    for (const w of words) expect(answerFromMessage(spellingAnswer("2", { word: w, definition: "A clue." }, true)), w).not.toBe(null);
  });

  it("posts once per case, when it ends, and only inside the site", () => {
    const end = page.split("function endGame(isWin) {")[1].split("if (isWin)")[0];
    expect(end).toContain("sendAnswer(isWin);");
    expect(page.split("sendAnswer(").length - 1).toBe(2);                    // the one definition and the one call
    expect(page).toContain("window.parent !== window");
  });
});
