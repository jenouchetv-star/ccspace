// Lists every piece Chike says aloud on the K-1 quiz cards (the quick questions in scripts/item-quiz.mjs, and the lines
// the weekly quiz and the quick questions share), keyed by the same short hash the site plays them by (quizLineKey in
// assets/lib/progress.js). Record them in Heart's voice with scripts/record-lines.mjs (owner, 2026-11-25):
//   node scripts/quiz-voice-lines.mjs > quiz-lines.json
//   node scripts/record-lines.mjs quiz-lines.json assets/voice/quiz
import { ITEM_QUIZ } from "./item-quiz.mjs";
import { quizVoiceLines, quizLineKey } from "../assets/lib/progress.js";

/* Kokoro reads a curly apostrophe badly; the key stays the text the site shows */
export const spokenText = (t) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export function quizLineList(all) {
  return quizVoiceLines(Object.values(all)).map((text) => ({ key: quizLineKey(text), text: spokenText(text) }));
}
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/quiz-voice-lines.mjs"))
  console.log(JSON.stringify(quizLineList(ITEM_QUIZ), null, 1));
