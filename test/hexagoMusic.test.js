// HexaGone! background music is the owner's pick from Pixabay (2026-11-17): "Retro Arcade Synthwave Loop 90 BPM, Dark Neon
// Background" (#577617), looped seamlessly under the Music slider. Sound effects stay made on the spot.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/hexago.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sound = game.split("const Sound = {")[1].split("\n};\n")[0];

describe("HexaGone! music", () => {
  it("plays the Pixabay synthwave loop from the site", () => {
    expect(game).toContain('const MUSIC_URL = "/assets/games/hexago/music.mp3";');
    expect(statSync(new URL("../assets/games/hexago/music.mp3", import.meta.url)).size).toBeGreaterThan(500000);
    expect(readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8")).toContain("retro-arcade-synthwave-loop-90-bpm-dark-neon-background-577617");
  });
  it("loops it without a gap, through the Music volume", () => {
    expect(sound).toContain("src.loop = true;");
    expect(sound).toContain("src.loopStart = tr.start; src.loopEnd = tr.end;");
    expect(sound).toContain("src.connect(this.music);");
  });
  it("keeps playing from one level to the next instead of starting over, and stops on the title screen", () => {
    expect(sound).toContain("if (this.src) return;");
    expect(sound).toMatch(/stopMusic\(keepWant\)\{[^\n]*this\.src\.stop\(\)/);
  });
  it("no longer makes its own tune", () => {
    expect(game).not.toContain("const MUSIC = {");
    expect(sound).not.toContain("schedule(){");
  });
});
