// Cosmic Blast! background music is the owner's pick from Pixabay (2026-11-16/17): "Ambient Science" by DRAGON-STUDIO (#634322).
// The track fades in and out, so the site's copy is a 21 s seamless loop cut from its steady middle (the end blended into the
// start); the mp3 encoder puts 1105 samples (0.02506 s) of lead-in before it, which the loop points skip.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../games/ufo-target-practice.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("Cosmic Blast! music", () => {
  it("loops the Pixabay track through the site's sound kit, so the sound button turns it off too", () => {
    expect(game).toContain("CCSSound.samples({ music: { src: '/assets/games/cosmic-blast/music.mp3', start: 0.02506, end: 21.02506, loop: true, volume: 1, music: true } });");
    expect(game).toContain("const music = window.CCSSound ? CCSSound.loop('music') : null;");
    expect(statSync(new URL("../assets/games/cosmic-blast/music.mp3", import.meta.url)).size).toBeGreaterThan(300000);
    expect(readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8")).toContain("musical-ambient-science-634322");
  });
  it("sits under the lasers while you play, and drops low while the game is paused", () => {
    expect(game).toContain("if (music) music.set(paused ? 0.12 : phase === 'play' ? 0.3 : 0.42);");
  });
});
