// Spelling Detective reads aloud in Kokoro's Heart voice (owner, 2026-11-16: "Use kokoro for the word quest, spelling
// detective"): each clue is read when a case opens (and again with Hear the clue), and the word is said when the case
// closes. Every word and clue is pre-recorded (scripts/record-spelling.mjs); nothing uses the browser's voice.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const game = readFileSync(new URL("../games/spelling-detective.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const words = [...game.matchAll(/\{ word: '([^']+)', definition: /g)].map(m => m[1]);

describe("Spelling Detective's voice", () => {
  it("has a recording of every word and every clue", () => {
    expect(words.length).toBe(186);
    for (const w of words){
      expect(existsSync(new URL("../assets/games/spelling-detective/words/" + w + ".mp3", import.meta.url)), w).toBe(true);
      expect(existsSync(new URL("../assets/games/spelling-detective/clues/" + w + ".mp3", import.meta.url)), w).toBe(true);
    }
  });
  it("reads the clue when a case opens, and on Hear the clue", () => {
    expect(game).toContain('<button type="button" class="hear" id="hear-clue" aria-label="Hear the clue">');
    expect(game).toContain("hearClue.addEventListener('click', () => sayClip('clues', currentWordData.word));");
    expect(game).toMatch(/clueVoiceTimer = setTimeout\(\(\) => sayClip\('clues', currentWordData\.word\), \d+\);/);
  });
  it("says the word when the case closes, solved or not", () => {
    expect((game.match(/sayClip\('words', currentWordData\.word\)/g) || []).length).toBe(2);
  });
  it("stays quiet when sound is off, and never uses the browser's voice", () => {
    expect(game).toContain("if (!window.CCSSound || !window.CCSSound.isOn()) return;");
    expect(game).not.toContain("speechSynthesis");
  });
});
