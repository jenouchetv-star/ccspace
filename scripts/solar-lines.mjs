// Lists every line Solar System Sandbox's tours read aloud, keyed by a short hash of the text, so the game can play a
// pre-recorded clip of it in Heart's voice (Kokoro, owner's pick): each stop's words at the three reading levels (a "do
// something" stop with its ask, and with its yes when Hear it again is pressed after the find), the yes lines, the
// "That's Venus. Try another one!" line for everything a child can tap, the K-1 questions with their two answers, the K-1
// "You got it!" and "Good try!" lines, and the end line.
//   node scripts/solar-lines.mjs > lines.json      (then: node scripts/record-lines.mjs lines.json assets/games/solar-tours/voice)
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/solar-system-sandbox.html", import.meta.url), "utf8");
const TOURS = JSON.parse(game.match(/<script type="application\/json" id="toursData">([\s\S]*?)<\/script>/)[1]);
/* the Sun and the planets, as the dock names them */
const PLANETS = [...game.matchAll(/\{ id: "(\w+)",\s*name: "(\w+)",/g)].map(m => m[2]);
const LEVELS = ["k1", "g23", "g45"];

/* the same hash the game uses (FNV-1a, 32 bit, base 36) */
export function lineKey(text){
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
/* the lines exactly as the game builds them (makeTours in the game file) */
export const stopLine = (s, L, got) => s.text[L] + (s.kind === "do" ? " " + (got ? s.do.yes[L] : s.do.ask[L]) : "");
export const quizLine = q => q.q + " " + q.choices.join(", or ") + "?";
export const wrongLine = name => "That's " + name + ". Try another one!";
export const endLine = (n, of) => "You got " + n + " of " + of + " right!";

const lines = new Set();
for (const t of TOURS){
  for (const s of t.stops) for (const L of LEVELS){
    lines.add(stopLine(s, L, false));
    if (s.kind === "do"){ lines.add(stopLine(s, L, true)); lines.add(s.do.yes[L]); }
  }
  /* only K-1 questions are read aloud */
  for (const q of t.quiz){
    lines.add(quizLine(q.k1));
    lines.add("You got it! " + q.k1.why);
    lines.add("Good try! " + q.k1.why);
  }
  for (let n = 0; n <= t.quiz.length; n++) lines.add(endLine(n, t.quiz.length));
}
for (const name of ["the Sun"].concat(PLANETS)) lines.add(wrongLine(name));

export const LINES = [...lines].map(text => text.trim());
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/solar-lines.mjs"))
  console.log(JSON.stringify(LINES.map(text => ({ key: lineKey(text), text })), null, 1));
