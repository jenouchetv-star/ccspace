// Records a list of lines ([{key, text, ph?}], e.g. from scripts/lunar-lines.mjs) in Kokoro's Heart voice as <out>/<key>.mp3.
// Same setup as record-words.mjs. Names are said the owner's way (Chike = Chee-kay, Zech = Zack, Yuna = You-nah).
//   node record-lines.mjs <lines.json> <out folder>
import { KokoroTTS } from "kokoro-js";
import lamejs from "@breezystack/lamejs";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const LIST = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const SAY = [[/\bChike\b/g, "Chee-kay"], [/\bZech\b/g, "Zack"], [/\bYuna\b/g, "You-nah"], [/\bAveri\b/g, "Avery"]];
const spoken = t => SAY.reduce((s, [re, to]) => s.replace(re, to), t);

function mp3(f, sr){
  let a = 0, b = f.length - 1; while (a < b && Math.abs(f[a]) < 0.01) a++; while (b > a && Math.abs(f[b]) < 0.01) b--;
  a = Math.max(0, a - Math.floor(sr * 0.02)); b = Math.min(f.length - 1, b + Math.floor(sr * 0.1));
  const enc = new lamejs.Mp3Encoder(1, sr, 48), pcm = new Int16Array(b - a + 1);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, f[a + i] * 32767));
  const parts = []; for (let i = 0; i < pcm.length; i += 1152){ const x = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (x.length) parts.push(Buffer.from(x)); }
  const end = enc.flush(); if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
let made = 0;
for (const { key, text, ph } of LIST){
  const file = OUT + "/" + key + ".mp3";
  if (existsSync(file)) continue;
  /* a line with "ph" is said from those exact phonemes (Kokoro misreads some spellings, e.g. letter sounds) */
  const a = ph
    ? await tts.generate_from_ids(tts.tokenizer(ph, { truncation: true }).input_ids, { voice: "af_heart", speed: 0.92 })
    : await tts.generate(spoken(text), { voice: "af_heart", speed: 0.92 });
  writeFileSync(file, mp3(a.audio, a.sampling_rate)); made++;
}
console.log("recorded", made, "new lines into", OUT);
