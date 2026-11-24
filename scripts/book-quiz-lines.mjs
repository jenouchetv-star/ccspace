// Lists every line the books' questions can say (Let's find out what you learned!, owner 2026-11-23), keyed by the same
// hash the reader uses, so the reader can play a pre-recorded clip of each in Heart's voice (Kokoro, af_heart). The
// lines come from the reader's own quiz-pure block and scripts/book-quiz.mjs, so they are keyed exactly as it keys them.
//   node scripts/book-quiz-lines.mjs lines.json   (then: node scripts/record-lines.mjs lines.json assets/books/quiz)
import { readFileSync, writeFileSync } from "node:fs";
import { BOOK_QUIZ } from "./book-quiz.mjs";

const reader = readFileSync(new URL("../books/reader.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = reader.split("/* BEGIN quiz-pure */")[1].split("/* END quiz-pure */")[0];
const Q = new Function(pure + "\nreturn { qzLineKey, qzAllLines, qzQuestions, qzLevel, qzAnswer, QZ_LINES, qzScoreLine };")();

export const quizPure = Q;
export const lineKey = Q.qzLineKey;
export const LINES = [...new Set(Object.values(BOOK_QUIZ).flatMap((quiz) => Q.qzAllLines(quiz)))];
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/book-quiz-lines.mjs") && process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(LINES.map((text) => ({ key: lineKey(text), text })), null, 1));
