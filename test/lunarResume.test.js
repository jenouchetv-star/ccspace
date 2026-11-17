// Remote Lunar Salvage: save and continue (owner, 2026-11-16: "auto save where they left off on the checklist, but give them
// the option to continue where they left off or start game from the beginning"). Draft: docs/mockups/lunar-visuals/continue-draft.png
// Checked in the browser: continuing from all 40 checklist steps in all four worlds lands on that exact step and holds there.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => "function " + name + "(" + game.split("function " + name + "(")[1].split("\n}\n")[0] + "\n}";
const restore = game.split("const RESTORE = {")[1].split("\n};\n")[0];
const stepsOf = (name) => (game.split("const " + name + " = [")[1].split("\n];")[0].match(/\{ id: "/g) || []).length;

describe("it saves as you go", () => {
  it("remembers the world, mission, step, time and Field Notes whenever the checklist moves on", () => {
    const s = fn("saveResume");
    expect(s).toContain("SAVE.resume = { world: G.world.id, mission: G.mission, step: G.step, t: Math.round(G.t), notes: [...G.notes], at: Date.now() };");
    expect(s).toContain("writeSave();");
    expect(game).toMatch(/if \(G\.started && !G\.done\) updateStep\(\);\n\s*saveResume\(\);/);
  });
  it("never saves mid-flight, during the landing, in the 2 player contest or while rebuilding", () => {
    expect(fn("saveResume")).toContain("if (RESTORING || CT.on || !G.started || G.done || G.landing || FL.on");
  });
  it("keeps the saved spot when the site's save and this device's meet (the newer one wins), and forgets it once you're home", () => {
    expect(fn("mergeSave")).toContain("out.resume = { world: r.world, mission: r.mission, step: r.step");
    expect(fn("combineSaves")).toContain("(rb.at || 0) >= (ra.at || 0) ? rb : ra");
    expect(fn("showHomeEnd")).toContain("SAVE.resume = null; writeSave();");
  });
});

describe("it can rebuild every step of every mission", () => {
  const MISSION_STEPS = { repair: "STEPS", satellite: "SAT_STEPS", heat: "HEAT_STEPS", supply: "SUPPLY_STEPS", meteor: "METEOR_STEPS", beacon: "BEACON_STEPS", board: "BOARD_STEPS" };
  for (const [m, list] of Object.entries(MISSION_STEPS)){
    it(m + ": one rebuild for each of its " + stepsOf(list) + " steps", () => {
      const block = restore.split("\n  " + m + ": [")[1].split("\n  ]")[0];
      const n = (block.match(/^\s{4}\(\) =>/gm) || []).length;
      expect(n).toBe(stepsOf(list));
    });
  }
  it("rebuilds quietly: no sounds, radio lines, pop-ups or new notes while it works", () => {
    expect(game).toContain("function sfx(name, opts){ if (window.CCSSound && !RESTORING) CCSSound.play(name, opts); }");
    expect(fn("radio")).toContain("if (RESTORING) return;");
    expect(fn("learn")).toContain("if (RESTORING) return;");
    expect(game).toContain("function flash(text){ if (RESTORING) return;");
    expect(game.indexOf("let RESTORING = false;")).toBeLessThan(game.indexOf("function sfx(name, opts)"));
  });
  it("skips the landing scene and picks up the saved time and notes", () => {
    const c = fn("continueGame");
    expect(c).toContain("ROCKET.g.position.y = 0; ROCKET.hinge.rotation.z = ROCKET.OPEN;");
    expect(c).toContain("G.notes = new Set(r.notes || []);");
    expect(c).toContain("G.t = r.t || 0;");
    expect(c).toContain('radio("Welcome back to " + w.name + "! "');
  });
});

describe("the start screen offers Continue or Start from the beginning", () => {
  it("shows a saved-game card with the world, step, next task and when it was saved", () => {
    expect(game).toContain('<div class="resume" id="resumeCard" hidden>');
    const p = fn("paintResume");
    expect(p).toContain('w.name + ": step " + (r.step + 1) + " of " + n');
    expect(p).toContain('"Next: " + st.text + " Saved " + agoText(r.at) + "."');
    expect(p).toContain('"Start " + w.name + " from the beginning"');
  });
  it("Continue rebuilds the world; Start from the beginning forgets the save and starts that world fresh", () => {
    expect(game).toContain('$("bContinue").onclick = () => continueGame();');
    expect(game).toContain('$("bFresh").onclick = () => { const r = SAVE.resume; SAVE.resume = null; writeSave(); G.pickWorld = r && r.world; startGame(); };');
  });
  it("Enter, Space or a controller's A button continue when there's a saved game", () => {
    expect(fn("startPress")).toContain('if (!$("resumeCard").hidden) return continueGame();');
  });
});
