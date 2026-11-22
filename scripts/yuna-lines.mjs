// Lists every line Yuna says in Write with Yuna, keyed by a short hash of the text, so the game can play a pre-recorded
// clip of it in Heart's voice (Kokoro, af_heart; "Yuna" is said "You-nah" by record-lines.mjs): the letters' names and
// sounds, the words and sentences, the steps, the stars and the tips. The lines come from the game's own pure block
// (allLines and lineKey), so they are keyed exactly as the game keys them.
//   node scripts/yuna-lines.mjs > lines.json      (then: node scripts/record-lines.mjs lines.json assets/games/write-with-yuna/voice)
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../games/write-with-yuna.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const G = new Function(pure + "\nreturn { allLines, lineKey };")();

export const lineKey = G.lineKey;
export const LINES = G.allLines();
// Kokoro misreads a few lines from their spelling. Those are recorded from exact phonemes instead (record-lines.mjs
// reads "ph"); the text, and so the clip key, stays. Letter sounds on their own ("ah", "fff", "ks") came out wrong
// (owner heard "Capital I says ah, like apple", 2026-11-22), so Yuna says "A is for apple." and the card shows the sound.
export const PHONEMES = {
  "Capital A. A is for apple.": "kˈæpɪɾəl ˈeɪ. ˈeɪ ɪz fɔːɹ ˈæpəl."   /* the second A was read "uh" */
};
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/yuna-lines.mjs"))
  console.log(JSON.stringify(LINES.map(text => PHONEMES[text] ? { key: lineKey(text), text, ph: PHONEMES[text] } : { key: lineKey(text), text }), null, 1));
