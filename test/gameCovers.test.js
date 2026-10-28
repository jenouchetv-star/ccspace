// The six "away from the screen" games on the Play page have photo covers, and the Business page has its photo.
// Each picture and its small -thumb copy must exist, and every picture must be credited in docs/image-credits.md.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const root = f => new URL("../" + f, import.meta.url);
const index = readFileSync(root("index.html"), "utf8");
const seed = JSON.parse(readFileSync(root("supabase/seed-data.json"), "utf8"));
const credits = readFileSync(root("docs/image-credits.md"), "utf8");

const OFFLINE = {
  "game-materials-mashup": "materials-mashup",
  "game-draw-what-i-say": "draw-what-i-say",
  "game-sound-hunt": "sound-scavenger-hunt",
  "game-bridge-challenge": "bridge-challenge",
  "game-story-relay": "story-relay",
  "game-freeze-swap": "freeze-and-swap"
};

describe("photo covers for the offline games", () => {
  for (const [id, slug] of Object.entries(OFFLINE)) {
    it(id + " has a cover picture, a thumbnail, alt text and a credit", () => {
      const src = "assets/games/" + slug + ".jpg";
      expect(existsSync(root(src))).toBe(true);
      expect(existsSync(root("assets/games/" + slug + "-thumb.jpg"))).toBe(true);
      expect(index).toContain('cover:{ src:"' + src + '"');
      const g = seed.games.find(x => x.id === id);
      expect(g.cover.src).toBe(src);
      expect(g.cover.alt.length).toBeGreaterThan(10);
      expect(credits).toContain(src);
    });
  }
  it("is recorded for the live database in supabase/game-covers.sql", () => {
    const sql = readFileSync(root("supabase/game-covers.sql"), "utf8");
    for (const [id, slug] of Object.entries(OFFLINE)) {
      expect(sql).toContain("'" + id + "'");
      expect(sql).toContain("assets/games/" + slug + ".jpg");
    }
  });
});

describe("the offline game page", () => {
  it("shows the game's photo above How to play when the game has no board of its own", () => {
    const view = index.split("function viewGame(id){")[1].split("/* ====")[0];
    expect(view).toContain("!board && g.cover && g.cover.src ? '<figure class=\"gamephoto\">");
    expect(view.indexOf("gamephoto")).toBeLessThan(view.indexOf("How to play"));
  });
});

describe("the Business page photo", () => {
  it("shows a teacher helping a student under the intro text, with alt text", () => {
    expect(existsSync(root("assets/about/teacher-helping-student.jpg"))).toBe(true);
    expect(index).toContain('<figure class="bizphoto"><img src="assets/about/teacher-helping-student.jpg"');
    expect(credits).toContain("assets/about/teacher-helping-student.jpg");
  });
});
