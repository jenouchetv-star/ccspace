// HOW TO RUN (re-record a book after its words change, or record a new book):
//   1. In an empty folder outside this project:  npm init -y && npm install kokoro-js@1.2.1 @breezystack/lamejs@1.2.7
//      (@huggingface/transformers comes with kokoro-js; the voice and Whisper models download on first run)
//   2. Copy this file into that folder and run:  node narrate-books.mjs <path to this project> [book id ...]
//      With no book ids it records every published book. It writes assets/books/narration/<id>.json and <id>/p<page>.mp3.
//   The reader only plays a page's recording while its words still match exactly; a changed page falls back
//   to the browser's voice until it is re-recorded.
// Records the books' "Read to me" narration in Kokoro's Heart voice (owner's pick, 2026-11-16),
// times every word with Whisper, and writes small MP3s plus one timing file per book.
// usage: node narrate.mjs <site root> [storyId ...]
import { KokoroTTS } from "kokoro-js";
import { pipeline } from "@huggingface/transformers";
import lamejs from "@breezystack/lamejs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const ROOT = process.argv[2];
const ONLY = process.argv.slice(3);
const READER = readFileSync(ROOT + "/books/reader.html", "utf8");
const URL_ = READER.match(/const SUPABASE_URL = "([^"]+)"/)[1];
const KEY = READER.match(/const SUPABASE_ANON_KEY = "([^"]+)"/)[1];
const VOICE = "af_heart", SPEED = 0.92;

/* the same words the reader wraps: tags become spaces, entities decoded, split on any whitespace */
function decode(s){
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
export function tokens(html){ return decode(String(html || "").replace(/<[^>]*>/g, " ")).split(/\s+/).filter(Boolean); }

/* how the names are said (owner, 2026-11-16): only the audio changes, the page keeps the real spelling */
const SAY = [[/\bChike\b/g, "Chee-kay"], [/\bZech\b/g, "Zack"], [/\bYuna\b/g, "You-nah"], [/\bZectune\b/g, "Zack-tune"], [/\bChikopia\b/g, "Chee-koh-pee-uh"], [/\bLED\b/g, "L E D"], [/\bAveri\b/g, "Avery"]];
function spoken(layerWords){
  /* a pause between text boxes: a heading like "The End" gets a full stop before the next box */
  return layerWords.filter(w => w.length).map(w => { const t = w.join(" "); return /[.!?:"”’)]$/.test(t) ? t : t + "."; }).join(" ")
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ").trim()
    .replace(/[^]*/, (t) => SAY.reduce((s, [re, to]) => s.replace(re, to), t));
}

/* the green "What you learned" page, matching books/reader.html (learnPageHTML and pagesWithLearn): what it reads aloud, in order */
function learnItems(learn){
  const t = learn.takeaways || [];
  return ["3 big takeaways", t[0] && t[0].title, learn.word, t[0] && t[0].text, t[1] && t[1].title, t[1] && t[1].text, t[2] && t[2].title, t[2] && t[2].text,
    learn.tryIt ? "Try it at home: " + learn.tryIt : ""].filter(Boolean);
}
function pagesWithLearn(pages, learn){
  if (!learn || !(learn.takeaways || []).length) return pages;
  const words = (p) => (p.layers || []).filter(l => l.type === "text").map(l => String(l.content || "").replace(/<[^>]*>/g, " ")).join(" ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const out = pages.slice(), last = out.length - 1;
  if (last >= 0 && /^The End\b/i.test(words(out[last]))) out[last] = { learnPage: true };
  else out.push({ learnPage: true });
  return out;
}

/* match Whisper's words to the page's words, letter by letter, then fill any gaps between neighbours */
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS = { cheekay: "chike", chikay: "chike", zack: "zech", zach: "zech", younah: "yuna", yuna: "yuna", zacktune: "zectune", cheekohpeeuh: "chikopia", led: "led", avery: "averi" };
function sim(a, b){
  a = ALIAS[a] || a; b = ALIAS[b] || b;
  if (!a || !b) return 0; if (a === b) return 1;
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function align(page, heard){
  const P = page.map(norm), H = heard.map(h => norm(h[0])), m = P.length, n = H.length;
  const S = Array.from({ length: m + 1 }, () => new Float64Array(n + 1)), B = Array.from({ length: m + 1 }, () => new Int8Array(n + 1));
  for (let i = 1; i <= m; i++){ S[i][0] = -0.4 * i; B[i][0] = 1; }
  for (let j = 1; j <= n; j++){ S[0][j] = -0.4 * j; B[0][j] = 2; }
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
    const s = sim(P[i - 1], H[j - 1]), diag = S[i - 1][j - 1] + (s > 0.45 ? s : -0.6);
    const up = S[i - 1][j] - 0.4, left = S[i][j - 1] - 0.4;
    if (diag >= up && diag >= left){ S[i][j] = diag; B[i][j] = 0; } else if (up >= left){ S[i][j] = up; B[i][j] = 1; } else { S[i][j] = left; B[i][j] = 2; }
  }
  const t = new Array(m).fill(null);
  for (let i = m, j = n; i > 0 || j > 0;){
    const b = i > 0 && j > 0 ? B[i][j] : i > 0 ? 1 : 2;
    if (b === 0){ if (sim(P[i - 1], H[j - 1]) > 0.45) t[i - 1] = [heard[j - 1][1], heard[j - 1][2]]; i--; j--; }
    else if (b === 1) i--; else j--;
  }
  /* a page word Whisper didn't catch shares the time between the words around it */
  for (let i = 0; i < m; i++){
    if (t[i]) continue;
    let a = i - 1; while (a >= 0 && !t[a]) a--;
    let b = i + 1; while (b < m && !t[b]) b++;
    const from = a >= 0 ? t[a][1] : 0, to = b < m ? t[b][0] : from + 0.5 * (b - a);
    const span = (to - from) / (b - a);
    for (let k = a + 1; k < b; k++) t[k] = [from + span * (k - a - 1), from + span * (k - a)];
  }
  return { times: t.map(([s, e]) => [+s.toFixed(2), +Math.max(e, s + 0.05).toFixed(2)]), matched: t.filter(Boolean).length };
}

function resample(f, from, to){ const n = Math.floor(f.length * to / from), o = new Float32Array(n); for (let i = 0; i < n; i++){ const x = i * from / to, a = Math.floor(x), k = x - a; o[i] = (f[a] || 0) * (1 - k) + (f[a + 1] || 0) * k; } return o; }
function mp3(f, sr){
  const enc = new lamejs.Mp3Encoder(1, sr, 48), pcm = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, f[i] * 32767));
  const parts = []; for (let i = 0; i < pcm.length; i += 1152){ const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const end = enc.flush(); if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

const res = await fetch(URL_ + "/rest/v1/stories?select=id,data", { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
const stories = (await res.json()).filter(s => s.data && s.data.status === "published" && (s.data.pages || []).length && (!ONLY.length || ONLY.includes(s.id)));
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en_timestamped", { dtype: "fp32" });

for (const s of stories){
  const dir = ROOT + "/assets/books/narration/" + s.id; mkdirSync(dir, { recursive: true });
  const out = { voice: "kokoro " + VOICE, speed: SPEED, pages: {} };
  /* the pages the reader shows: the "The End" page becomes the green "What you learned" page (or it's added at the end) */
  const shown = pagesWithLearn(s.data.pages, s.data.learn);
  for (let p = 0; p < shown.length; p++){
    const layers = shown[p].learnPage ? learnItems(s.data.learn).map(tokens) : (shown[p].layers || []).filter(l => l.type === "text").map(l => tokens(l.content));
    const words = layers.flat();
    if (!words.length) continue;
    const say = spoken(layers);
    const audio = await tts.generate(say, { voice: VOICE, speed: SPEED });
    const f = audio.audio, sr = audio.sampling_rate;
    const r = await asr(resample(f, sr, 16000), { return_timestamps: "word", chunk_length_s: 30 });
    const heard = r.chunks.map(c => [c.text.trim(), c.timestamp[0], c.timestamp[1] ?? c.timestamp[0] + 0.3]);
    const { times, matched } = align(words, heard);
    writeFileSync(dir + "/p" + p + ".mp3", mp3(f, sr));
    out.pages[p] = { text: words.join(" "), src: "p" + p + ".mp3", dur: +(f.length / sr).toFixed(2), t: times };
    console.log(s.id, "page", p, words.length, "words,", matched, "matched", (f.length / sr).toFixed(1) + "s");
  }
  /* "Hear it" on the green page: the word to know, on its own */
  if (s.data.learn && s.data.learn.word){
    const w = await tts.generate(spoken([tokens(s.data.learn.word)]).replace(/\.$/, ""), { voice: VOICE, speed: 0.85 });
    writeFileSync(dir + "/word.mp3", mp3(w.audio, w.sampling_rate));
  }
  writeFileSync(ROOT + "/assets/books/narration/" + s.id + ".json", JSON.stringify(out));
}
