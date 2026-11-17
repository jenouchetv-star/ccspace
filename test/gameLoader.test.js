// Every game opens on the same loading screen: the Chike's Creative Space logo, a yellow bar that fills while the
// game loads, and the game's name. It shows for at least a second (or until the game has loaded), then fades away.
// Each file carries its own copy, so it appears at once even inside a sealed frame. Draft: docs/mockups/game-loader-draft.html
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const GAMES = {
  "games/Doodle-Dash.html": "Doodle Dash",
  "games/air-hockey.html": "Air Hockey Arcade",
  "games/balloon-pop-math.html": "Balloon Pop Math",
  "games/bounce-and-bank.html": "Bounce & Bank",
  "games/brick-builder-3d.html": "Brick Builder 3D",
  "games/chrono-billiards.html": "Chrono Billiards",
  "games/drop-blox.html": "Fruit Drop",
  "games/echo-matrix.html": "Echo Matrix",
  "games/maze-quest.html": "Maze Quest",
  "games/memory-match.html": "Memory Match",
  "games/pathbuilder.html": "Pathbuilder",
  "games/spelling-detective.html": "Spelling Detective",
  "games/ufo-target-practice.html": "Cosmic Blast!",
  "games/voxel-builder.html": "Voxel Builder",
  "games/word-quest.html": "Word Quest",
  "supabase/private-games/chikes-gravity-four.html": "Chike's Gravity 4",
  "supabase/private-games/hands-free-builder.html": "Hands-Free Builder",
  "supabase/private-games/hexago.html": "HexaGone!",
  "supabase/private-games/math-robot.html": "Robo Math Buddy",
  "supabase/private-games/matching-suits.html": "Stack 'Em Up!",   /* was Matching Suits (owner renamed it, 2026-11-17) */
  "supabase/private-games/number-dash.html": "Math Runner",
  "supabase/private-games/pic-pop-puzzle.html": "Pic-a-Puzzle",
  "supabase/private-games/remote-lunar-salvage.html": "Remote Lunar Salvage",
  "supabase/private-games/solar-system-sandbox.html": "Solar System Sandbox"
};
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

describe("every game opens on the logo loading screen", () => {
  for (const [file, name] of Object.entries(GAMES)) {
    it(file + " shows the logo and its name while it loads", () => {
      const h = read(file);
      expect(h.match(/<div id="ccsLoad"/g)).toHaveLength(1);
      /* Pic-a-Puzzle may not load anything from the site, so its logo is inside the file */
      expect(h).toMatch(file.endsWith("pic-pop-puzzle.html") ? /src="data:image\/webp;base64,[^"]+" alt="Chike's Creative Space"/ : /src="\/assets\/brand\/logo\.webp" alt="Chike's Creative Space"/);
      expect(h).toContain('data-name="' + esc(name) + '"');
      /* the styles sit in the head, and the screen is the first thing in the body, so it shows before the game paints */
      expect(h.indexOf('<style id="ccsLoadCss">')).toBeLessThan(h.indexOf("</head>"));
      expect(h).toMatch(/<body[^>]*>\s*<div id="ccsLoad"/);
      /* it fades out, never bounces, holds still for reduced motion, and can't get stuck */
      expect(h).toContain("cubic-bezier(.2,.7,.2,1)");
      expect(h).toMatch(/@media \(prefers-reduced-motion: reduce\)\{[^}]*#ccsLoad/);
      expect(h).toMatch(/setTimeout\(function\(\)\{ hide\(\); \}, 9000\)/);
    });
  }
  /* the logo sound, the owner's pick 1A (2026-11-17): Pixabay "Effect for logo intro" at 1.5x; draft docs/mockups/game-loader-sound-draft.html */
  for (const file of Object.keys(GAMES)) {
    if (file.endsWith("pic-pop-puzzle.html")) continue;
    it(file + " plays the logo sound, faster, and fades it with the screen", () => {
      const h = read(file);
      expect(h).toContain('snd = new Audio("/assets/games/loader/logo-intro.mp3"); snd.volume = 0.7; snd.playbackRate = 1.5;');
      /* the site's sound-off setting is honored where the page can read it; a sealed frame can't, and must still play */
      if (file.endsWith("chikes-gravity-four.html")) expect(h).toContain("var on = true; /* this sealed frame can't read the site's sound setting */");
      else expect(h).toContain('var on = true; try { on = localStorage.getItem("ccs-sound") !== "off"; } catch (e) {');
      expect(h).toContain("if (on){ try { snd = new Audio(");
      expect(h).toContain("p.then(function(){ hold = 1600; }, function(){ snd = null; })");
      expect(h).toContain('el.className = "ready gone"; fade();');
    });
  }
  it("Pic-a-Puzzle loads nothing from the site, so its loader stays quiet", () => {
    expect(read("supabase/private-games/pic-pop-puzzle.html")).not.toContain("logo-intro.mp3");
  });
  it("the phone controller is a remote, not a game, so it has none", () => {
    expect(read("games/lunar-salvage-remote.html")).not.toContain('id="ccsLoad"');
  });
  it("the Hands-Free Reader (AI Lesson 05) stays free of Chike's branding, so it has none", () => {
    expect(read("supabase/private-games/gesture-lab.html")).not.toContain('id="ccsLoad"');
  });
});
