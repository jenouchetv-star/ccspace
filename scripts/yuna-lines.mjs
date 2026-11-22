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
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/yuna-lines.mjs"))
  console.log(JSON.stringify(LINES.map(text => ({ key: lineKey(text), text })), null, 1));
