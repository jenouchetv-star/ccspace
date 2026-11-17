// Lists every line Remote Lunar Salvage reads aloud (the step being worked on, each quiz question with its choices, and
// each quiz answer's explanation), keyed by a short hash of the text, so the game can play a pre-recorded clip of it.
//   node scripts/lunar-lines.mjs > lines.json        (then record them with scripts/record-lines.mjs)
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const S = new Function(pure + "; return { MISSIONS, QUIZ_BANKS };")();

/* the same hash the game uses (FNV-1a, 32 bit, base 36) */
export function lineKey(text){
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
export function quizLine(q){ return q.q + " " + q.opts.map(o => o.t).join(", or "); }

const lines = new Set();
for (const m of Object.values(S.MISSIONS)) for (const s of m.steps) lines.add(s.text);
/* the "goal reached" lines (outside the pure block, so read straight from the source) */
const done = game.split("const DONE_LINE = {")[1].split("\n")[0];
for (const m of done.matchAll(/\["([^"]+)", "[a-zA-Z]+"\]/g)) lines.add(m[1]);
for (const bands of Object.values(S.QUIZ_BANKS)) for (const list of Object.values(bands)) for (const q of list){
  lines.add(quizLine(q));
  lines.add("Right! " + q.why);
  lines.add("Not quite. " + q.why);
}
if (import.meta.url === "file:///" + process.argv[1].replace(/\\/g, "/") || process.argv[1].endsWith("lunar-lines.mjs"))
  console.log(JSON.stringify([...lines].map(text => ({ key: lineKey(text), text })), null, 1));
