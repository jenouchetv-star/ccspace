// Hands-Free Builder's futuristic sounds (owner, 2026-11-16: "use futuristic sound effect in Hands-Free Builder", and a
// futuristic ambience): a HUD ping when you grab a block, a digital hit when it lands, a glitch when the tower tips, a
// hologram sweep for a new challenge, a button blip for undo, an AI "activated" sound for a finished build, and a soft
// spaceship hum underneath, with a sound on/off button. Pixabay, see docs/image-credits.md.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/hands-free-builder.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const NAMES = ["grab", "place", "tip", "next", "undo", "win", "hum-loop"];

describe("Hands-Free Builder sounds", () => {
  it("has every sound, credited", () => {
    for (const n of NAMES) expect(statSync(new URL("../assets/games/hands-free-builder/sfx/" + n + ".mp3", import.meta.url)).size).toBeGreaterThan(4000);
    const credits = readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8");
    for (const id of ["547867", "604636", "604624", "546562", "198922", "606990", "296976"]) expect(credits).toContain(id);
  });
  it("plays each one at its moment, falling back to the old beeps until it has loaded", () => {
    expect(game).toContain('function fx(name, vol, fallback){');
    for (const call of ['fx("grab", 0.6, function(){ blip(520); });', 'fx("place", 0.7, function(){ blip(300 + b.y * 60); });', 'fx("undo", 0.7, function(){ blip(420); });',
      'fx("tip", 0.7, thud);', 'fx("next", 0.7, function(){ blip(640); });', 'fx("win", 0.8, function(){'])
      expect(game).toContain(call);
  });
  it("hums softly underneath, and the sound button turns everything off", () => {
    expect(game).toContain('<button class="btn btn--icon" type="button" id="btn-sound" aria-pressed="true" aria-label="Sound" title="Turn sound off"></button>');
    expect(game).toContain("hum.g.gain.setTargetAtTime(soundOn ? 0.09 : 0, audio.currentTime, 0.4);");
    expect(game.split("function tone(")[1].split("\n  }\n")[0]).toContain("if (!soundOn) return;");
  });
});
