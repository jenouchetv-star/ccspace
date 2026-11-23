// Lists every line the voice says in Drop 2048, keyed by a short hash of the text, so the game can play a pre-recorded
// clip of it in Heart's voice (Kokoro, af_heart): the cheers and the quick doubling questions. The lines come from the
// game's own pure block (allLines and lineKey), so they are keyed exactly as the game keys them.
//   node scripts/drop2048-lines.mjs lines.json    (then: node scripts/record-lines.mjs lines.json assets/games/drop-2048/voice)
import { readFileSync, writeFileSync } from "node:fs";

const game = readFileSync(new URL("../games/drop-2048.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const G = new Function(pure + "\nreturn { allLines, lineKey };")();

export const lineKey = G.lineKey;
export const LINES = G.allLines();
// Kokoro reads "2048" as "twenty forty-eight"; a math game says the number: "two thousand forty-eight"
// (record-lines.mjs says a line with "ph" from those exact phonemes; the text, and so the clip key, stays)
export const PHONEMES = {
  "You made 2048! Amazing!": "juː mˌeɪd tˈuː θˈaʊzənd fˈoːɹɾi ˈeɪt! ɐmˈeɪzɪŋ!"
};
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/drop2048-lines.mjs") && process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(LINES.map(text => PHONEMES[text] ? { key: lineKey(text), text, ph: PHONEMES[text] } : { key: lineKey(text), text }), null, 1));
