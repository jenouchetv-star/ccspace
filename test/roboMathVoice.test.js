// Robo Math Buddy's own voice (owner's pick, 2026-11-17: voice B, Kokoro af_nova with a light metallic robot effect,
// "a robot sound but with a human cadence"). Fixed sentences are pre-recorded; in math sentences the words between the
// numbers are recorded once and numbers are joined from number words; names stay out of the voice (they're in the chat).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { FIXED, MATH, NAME, BOT, COLOR } from "../scripts/robot-lines.mjs";

const html = readFileSync(new URL("../supabase/private-games/math-robot.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const V = new Function(html.split("/* BEGIN voice-pure */")[1].split("/* END voice-pure */")[0] + "; return { voicePlan, numberWords };")();
const clips = new Set(html.match(/"([A-Za-z0-9_ -]*)"\.split\(" "\)\.forEach\(function\(k\)\{ if \(k\) VOICE_CLIPS/)[1].split(" "));
const has = (k) => clips.has(k);
const file = (k) => new URL("../assets/games/robo-math/voice/" + k + ".mp3", import.meta.url);

describe("what the robot says aloud", () => {
  it("reads numbers the way a person says them", () => {
    expect(V.numberWords("1,234.5")).toEqual(["one", "thousand", "two", "hundred", "thirty", "four", "point", "five"]);
    expect(V.numberWords("70")).toEqual(["seventy"]);
    expect(V.numberWords("0")).toEqual(["zero"]);
  });
  it("leaves names out, and says something that still makes sense instead", () => {
    expect(V.voicePlan("Nice to meet you, Maya! What grade are you in?", ["Maya"], has).map(p => p.text)).toEqual(["Nice to meet you!", "What grade are you in?"]);
    expect(V.voicePlan("Your name is Maya! I remembered.", ["Maya"], has).map(p => p.text)).toEqual(["I remembered."]);
    expect(V.voicePlan("Blue is a great color!", ["Blue"], has).map(p => p.text)).toEqual(["That's a great color!"]);
  });
  it("joins a math sentence from recorded words and numbers", () => {
    expect(V.voicePlan("What is 12 − 5?", [], has).map(p => p.text)).toEqual(["what is", "twelve", "minus", "five"]);
    expect(V.voicePlan("The answer is 4 remainder 2 (or 4.5).", [], has).map(p => p.text)).toEqual(["the answer is", "four", "remainder", "two", "or", "four", "point", "five"]);
  });
});

describe("the recordings", () => {
  it("cover every message in scripts/robot-lines.mjs", () => {
    for (const m of FIXED) for (const p of V.voicePlan(m, [NAME, BOT, COLOR], has)){ expect(has(p.key), m + " / " + p.text).toBe(true); expect(existsSync(file(p.key)), p.text).toBe(true); }
    for (const m of MATH) for (const p of V.voicePlan(m, [NAME, BOT, COLOR], has)){ expect(has(p.key), m + " / " + p.text).toBe(true); expect(existsSync(file(p.key)), p.text).toBe(true); }
  });
  it("cover every line the robot can say (a line added to the game must be added to scripts/robot-lines.mjs)", () => {
    const corpus = FIXED.concat(MATH).join(" | ");
    const chat = html.split("function respond(")[1];
    const lines = (html.split("var ASK_MENU")[0].split("function greeting(){")[1] + chat).split("\n").filter(l => /\bsay\(|offerAnother\(|pick\(\[|var yes|return "Good/.test(l));
    for (const l of lines){
      for (const m of l.matchAll(/"((?:[^"\\]|\\.)*)"/g)){
        const lit = m[1].replace(/\\"/g, '"').replace(/^[\s!.?]+/, "").trim();
        if (lit.length < 4 || !/[ !?]/.test(lit)) continue;          /* moods, keys and the like */
        expect(corpus.includes(lit), lit).toBe(true);
      }
    }
  });
});

describe("the voice in the game", () => {
  it("is the robot's own recordings, never the browser's built-in voice", () => {
    expect(html).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance/);
    expect(html).toContain('robotSpeak(text, [mem.name, mem.botName].concat(skip || []));');
    expect(html).toContain('var talking = now < talkUntil || (state.voice && robotTalking());');
  });
  it("has a volume button beside the Voice button, remembered like every game's (owner, 2026-11-17)", () => {
    expect(html).toContain('<script src="/games/game-sound.js"></script>');
    expect(html).toContain('var vb = CCSSound.mixer({ className: "voice-vol" });');
    expect(html).toContain('$("voice").after(vb);');
    /* every voice at 80% (owner, 2026-11-23) */
    expect(html).toContain('CCSSound.onVolume(function(v){ voiceNow.volume = 0.8 * v.sfx; });');
  });
});
