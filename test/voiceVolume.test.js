// Every voice plays at 80% (owner, 2026-11-23: "All voice audio should be set to 80%"): the Kokoro clips in the games,
// the site's "Hear it" words, the book reader's narration, and the device voice used when a clip is missing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const GAME_VOICES = {
  "games/drop-2048.html": 'voice.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);',
  "games/maze-quest.html": "wizVoice.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume('sfx') : 1);",
  "games/spelling-detective.html": "voice.volume = 0.8 * (window.CCSSound.volume ? window.CCSSound.volume('sfx') : 1);",
  "games/word-quest.html": 'a.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);',
  "games/write-with-yuna.html": 'voice.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);',
  "supabase/private-games/math-robot.html": 'voiceNow.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);',
  "supabase/private-games/remote-lunar-salvage.html": 'voiceClip.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);',
  "supabase/private-games/solar-system-sandbox.html": 'voiceClip.volume = 0.8 * (window.CCSSound && CCSSound.volume ? CCSSound.volume("sfx") : 1);'
};

describe("every voice at 80%", () => {
  for (const [file, line] of Object.entries(GAME_VOICES)) it(file + " plays its voice at 80% of the Game sounds level", () => {
    expect(read(file)).toContain(line);
  });
  it("Robo Math Buddy keeps it at 80% when the volume panel moves", () => {
    expect(read("supabase/private-games/math-robot.html")).toContain("CCSSound.onVolume(function(v){ voiceNow.volume = 0.8 * v.sfx; });");
  });
  it("the site's Hear it words, its device voice, and the book reader all speak at 80%", () => {
    const index = read("index.html");
    expect(index).toContain('const a = window.__wordClip = new Audio("/assets/words/" + slug + ".mp3");\n      a.volume = 0.8;');
    for (const u of ['u.lang = "en-US"; u.rate = 0.9; u.volume = 0.8;', 'u.lang = "en-US"; u.rate = 0.8; u.volume = 0.8;']) expect(index).toContain(u);
    const reader = read("books/reader.html");
    expect(reader).toMatch(/new Audio\('\/assets\/books\/narration\/' \+ storyId \+ '\/' \+ pg\.src\);\n    a\.volume = 0\.8;/);
    expect(reader).toContain("const a = new Audio('/assets/books/narration/' + storyId + '/word.mp3'); a.volume = 0.8;");
    expect(reader).toContain("u.lang = 'en-US'; u.rate = 0.9; u.volume = 0.8;");
    expect(reader).toContain("u.lang = 'en-US'; u.rate = 0.85; u.volume = 0.8;");
  });
  it("leaves no device voice at full volume", () => {
    for (const f of ["index.html", "books/reader.html", "games/word-quest.html"]){
      const n = (read(f).match(/new SpeechSynthesisUtterance\(/g) || []).length, v = (read(f).match(/u\.volume = 0\.8;/g) || []).length;
      expect(v, f).toBe(n);
    }
  });
});
