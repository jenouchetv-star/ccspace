// Records single words in Kokoro's Heart voice (owner's pick, 2026-11-16) as small MP3s, one file per word,
// for games that read words aloud (Word Quest first). Same setup as narrate-books.mjs:
//   1. In an empty folder outside this project:  npm init -y && npm install kokoro-js@1.2.1 @breezystack/lamejs@1.2.7
//   2. Copy this file there and run:  node record-words.mjs <out folder> WORD WORD ...   (or --from <file with one word per line>)
// Files are named by the lowercase word (cat.mp3). Existing files are kept, so re-running only adds new words.
import { KokoroTTS } from "kokoro-js";
import lamejs from "@breezystack/lamejs";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
let words = process.argv.slice(3);
if (words[0] === "--from") words = readFileSync(words[1], "utf8").split(/\s+/).filter(Boolean);
mkdirSync(OUT, { recursive: true });

function mp3(f, sr){
  /* trim the quiet before and after the word, keep a short tail so it doesn't clip */
  let a = 0, b = f.length - 1; while (a < b && Math.abs(f[a]) < 0.01) a++; while (b > a && Math.abs(f[b]) < 0.01) b--;
  a = Math.max(0, a - Math.floor(sr * 0.02)); b = Math.min(f.length - 1, b + Math.floor(sr * 0.08));
  const enc = new lamejs.Mp3Encoder(1, sr, 48), pcm = new Int16Array(b - a + 1);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, f[a + i] * 32767));
  const parts = []; for (let i = 0; i < pcm.length; i += 1152){ const x = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (x.length) parts.push(Buffer.from(x)); }
  const end = enc.flush(); if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
let made = 0;
for (const w of words){
  const name = w.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const file = OUT + "/" + name + ".mp3";
  if (existsSync(file)) continue;
  const a = await tts.generate(w.toLowerCase() + ".", { voice: "af_heart", speed: 0.85 });
  writeFileSync(file, mp3(a.audio, a.sampling_rate)); made++;
}
console.log("recorded", made, "new words into", OUT);
