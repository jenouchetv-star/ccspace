// Every game's page has the green "Word to know" card: one word, how to say it, what it means for ages
// 6 to 8, and a try-it line. The words live in seedGames() (and in the live games table, see
// supabase/game-words.sql); the page and the admin editor that use them are pinned here too.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/game-words.sql", import.meta.url), "utf8");
const block = html.split("/* GAME_WORDS_BEGIN */")[1].split("/* GAME_WORDS_END */")[0];
const WORDS = new Function(block + "; return WORDS;")();
const seeded = [...html.split("function seedGames(){")[1].split("function seedStories")[0].matchAll(/G\(\{ id:"(game-[a-z-]+)"/g)].map(m => m[1]);
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("a word to know on every game page", () => {
  it("has a word for every game, and no stray ones", () => {
    expect(seeded.length).toBeGreaterThanOrEqual(17);
    expect(Object.keys(WORDS).sort()).toEqual([...seeded].sort());
  });

  it("fills in all four boxes for each, in a few plain words", () => {
    for (const [id, w] of Object.entries(WORDS)) {
      for (const k of ["vocabWord", "vocabSay", "vocabMeaning", "vocabExample"]) expect(String(w[k] || "").trim().length, id + " " + k).toBeGreaterThan(2);
      expect(w.vocabWord.length).toBeLessThanOrEqual(20);
      expect(w.vocabMeaning.length).toBeLessThanOrEqual(130);        // short enough for a young reader
      expect(w.vocabSay).toMatch(/· (noun|verb)$/);
    }
  });

  it("gives every game a different word", () => {
    const words = Object.values(WORDS).map(w => w.vocabWord);
    expect(new Set(words).size).toBe(words.length);
  });

  it("shows the green card on the game's page, after How to play", () => {
    const v = body("viewGame");
    expect(v).toContain("portalWordHTML(g)");
    expect(v.indexOf("How to play")).toBeLessThan(v.indexOf("portalWordHTML(g)"));
  });

  it("can be changed in the admin game editor", () => {
    const games = html.split("  games: [")[1].split("  videos: [")[0];
    for (const k of ["vocabWord", "vocabSay", "vocabMeaning", "vocabExample"]) expect(games).toContain('key:"' + k + '"');
  });

  it("is in the SQL that adds the words to the live games, for every game", () => {
    for (const id of Object.keys(WORDS)) expect(sql).toContain("('" + id + "'");
    expect(sql).toContain("g.data || w.patch");                       // adds the four fields, changes nothing else
  });
});
