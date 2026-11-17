// Maze Quest's old wizard speaks (owner, 2026-11-17: "add a voice to the wizard in the Maze Quest Game"; picked voice B,
// Kokoro bm_lewis, from samples in docs/mockups/wizard-voice). Every fixed wizard line and every spelling clue question has
// a pre-recorded clip named by a hash of its exact text; math questions are made up each time, so they stay on screen.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../games/maze-quest.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = html.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const SPELL = new Function(pure + ";return SPELL_BY_GRADE;")();
const listOf = (name) => new Function("return [" + html.split("const " + name + " = [")[1].split("];")[0] + "];")();
const wizKey = new Function(html.split("function wizKey(text) {")[1].split("\n")[0].replace(/^/, "return function(text){").replace(/$/, ";")) ();
const clip = (text) => new URL("../assets/games/maze-quest/wizard/" + wizKey(text) + ".mp3", import.meta.url);

describe("the wizard's voice", () => {
  it("has a recording for every line he says", () => {
    for (const name of ["WIZARD_QUESTION_LINES", "WIZARD_SHORT_LINES", "WIZARD_CORRECT_LINES", "WIZARD_WRONG_LINES"]){
      for (const line of listOf(name)) expect(existsSync(clip(line)), line).toBe(true);
    }
  });
  it("reads every spelling clue aloud", () => {
    for (const [, clue] of SPELL.flat()){
      const q = `Clue: ${clue} Which spelling is right?`;
      expect(existsSync(clip(q)), q).toBe(true);
    }
  });
  it("speaks when the card opens and after the answer, and the card waits for him to finish", () => {
    expect(html).toContain("wizardSay([intro, picked.kind === 'spell' ? picked.q : null]);");
    expect(html.match(/wizardSay\(\[said\]\);/g)).toHaveLength(2);
    expect(html).toContain("if (wizardTalking() && Date.now() < latest) { quizCloseTimer = setTimeout(closeQuiz, 200); return; }");
  });
  it("follows the sound button and the volume panel", () => {
    expect(html).toContain("wizQueue = (window.CCSSound && !CCSSound.isOn()) ? [] : texts.filter(Boolean);");
    expect(html).toContain("wizVoice.volume = window.CCSSound && CCSSound.volume ? CCSSound.volume('sfx') : 1;");
  });
});
