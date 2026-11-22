// Solar System Sandbox's music and transitions (owner, 2026-11-16: "find ambient space music for Solar System Sandbox and
// some transition sound effects when the user zooms into a planet or switches to compare view. the compare view music
// should be similar but different"). Pixabay: "Ambient soundscapes 001" and "003 (space atmosphere)" by AudioPapkin,
// each cut into a seamless loop; "Airy Whoosh" by DRAGON-STUDIO; "Cinematic Designed Sci-Fi Whoosh" by RescopicSound.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/solar-system-sandbox.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const A = "../assets/games/solar-system/audio/";

describe("Solar System Sandbox sound", () => {
  it("has its two music loops and two transition sounds, small enough to load quickly", () => {
    for (const f of ["space-main.mp3", "space-compare.mp3", "zoom.mp3", "compare.mp3"]){
      const size = statSync(new URL(A + f, import.meta.url)).size;
      expect(size).toBeGreaterThan(20000);
      expect(size).toBeLessThan(2500000);
    }
    const credits = readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8");
    for (const id of ["303246", "303242", "433003", "228295"]) expect(credits).toContain(id);
  });
  it("plays the space music, and a similar-but-different track in Compare, crossfading slowly between them", () => {
    expect(game).toContain("const MUSIC = window.CCSSound ? { main: CCSSound.loop('spaceMain'), cmp: CCSSound.loop('spaceCompare'), a: 0, b: 0 } : null;");
    /* half as loud as the first 0.38 (owner, 2026-11-22) */
    expect(game).toContain("MUSIC.a += ((comparing ? 0 : 0.19) - MUSIC.a) * 0.025; MUSIC.b += ((comparing ? 0.19 : 0) - MUSIC.b) * 0.025;");
    expect(game).toContain("MUSIC.main.set(MUSIC.a); MUSIC.cmp.set(MUSIC.b);");
  });
  it("whooshes when you zoom into a planet, and with a sci-fi sweep when you switch to Compare", () => {
    expect(game.split("function select(p){")[1].split("\n}\n")[0]).toContain('sfx("zoomIn", { volume: 0.7 });');
    expect(game.split("function setCompare(on){")[1].split("\n}\n")[0]).toContain('sfx(on ? "toCompare" : "whoosh", on ? { volume: 0.6 } : { volume: 0.5 });');
  });
});
