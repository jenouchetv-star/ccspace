// Puts four real concert harp recordings (the same ones Sound Space uses) inside the Air Harp game file, because a
// game in the Subscriber's Portal runs in a sealed frame and can't fetch site files. Each recording's raw 16-bit
// samples (mono, 22050 Hz) are stored as base64 between the /*HARP:*/ and /*:HARP*/ markers; the game turns them back
// into sound itself. Run again after changing which recordings are used:
//   node scripts/air-harp-samples.mjs
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const GAME = new URL("supabase/private-games/air-harp.html", ROOT);
const BASES = [40, 56, 71, 87];

function pcm(wav){
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  let at = 12, fmt = null;
  while (at + 8 <= wav.length){
    const id = wav.toString("ascii", at, at + 4), size = wav.readUInt32LE(at + 4), body = at + 8;
    if (id === "fmt ") fmt = { channels: wav.readUInt16LE(body + 2), rate: wav.readUInt32LE(body + 4), bits: wav.readUInt16LE(body + 14) };
    if (id === "data"){
      if (!fmt || fmt.channels !== 1 || fmt.rate !== 22050 || fmt.bits !== 16) throw new Error("expected mono 16-bit 22050 Hz");
      return wav.subarray(body, body + size);
    }
    at = body + size + (size & 1);
  }
  throw new Error("no sound data");
}

const samples = {};
for (const b of BASES) samples[b] = pcm(readFileSync(new URL("assets/apps/sound-space/samples/concert-harp/" + b + ".wav", ROOT))).toString("base64");
const html = readFileSync(GAME, "utf8");
const start = html.indexOf("/*HARP:*/"), end = html.indexOf("/*:HARP*/");
if (start < 0 || end < start) throw new Error("markers not found in air-harp.html");
writeFileSync(GAME, html.slice(0, start + 9) + JSON.stringify(samples) + html.slice(end));
console.log("harp recordings stored:", BASES.join(", "), "-", Math.round(JSON.stringify(samples).length / 1024), "KB");
