// Cosmic Blast! (games/ufo-target-practice.html) is one self-contained 3D page. Its level data
// lives between BEGIN/END markers as plain data, so the eight planets, their fun facts and the
// difficulty ramp can be checked here without a browser.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/ufo-target-practice.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN levels */")[1].split("/* END levels */")[0];
const { LEVELS, CRAFTS, ROCKS } = new Function(block + "; return { LEVELS, CRAFTS, ROCKS };")();

const roles = lv => Object.keys(lv.crafts).map(k => CRAFTS[k].role);

describe("the eight levels", () => {
  it("are the eight planets in order from the Sun", () => {
    expect(LEVELS.map(l => l.name)).toEqual(
      ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]);
  });

  it("each have a fun fact, a tagline, a planet to show and a positive points goal", () => {
    for (const lv of LEVELS) {
      expect(lv.fact.trim().length).toBeGreaterThan(20);
      expect(lv.tag.trim().length).toBeGreaterThan(0);
      expect(lv.planet).toBeTruthy();
      expect(lv.goal).toBeGreaterThan(0);
    }
  });

  it("never make the goal smaller as you go up", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].goal).toBeGreaterThanOrEqual(LEVELS[i - 1].goal);
  });

  it("only use craft that exist, and always keep the classic saucers", () => {
    for (const lv of LEVELS) {
      expect(lv.crafts.saucer).toBeGreaterThan(0);
      for (const k of Object.keys(lv.crafts)) expect(CRAFTS[k]).toBeTruthy();
    }
  });
});

describe("the difficulty ramp", () => {
  it("brings in craft that shoot back from level 3, and not before", () => {
    LEVELS.forEach((lv, i) => {
      const shoots = roles(lv).includes("shooter");
      expect(shoots).toBe(i >= 2);
      expect(lv.maxShooters > 0).toBe(i >= 2);
      expect(lv.shotEvery > 0).toBe(i >= 2);
    });
  });

  it("brings in radar craft that jam your lasers from level 5, and not before", () => {
    LEVELS.forEach((lv, i) => {
      const radar = roles(lv).includes("radar");
      expect(radar).toBe(i >= 4);
      expect(lv.maxRadar > 0).toBe(i >= 4);
      expect(lv.waveEvery > 0).toBe(i >= 4);
    });
  });

  it("gives the ship shields exactly when something can shoot at it", () => {
    LEVELS.forEach(lv => expect(lv.shields > 0).toBe(roles(lv).includes("shooter")));
  });

  it("never gets slower or calmer as the levels go up", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].speed).toBeGreaterThanOrEqual(LEVELS[i - 1].speed);
      expect(LEVELS[i].spawnPerSec).toBeGreaterThanOrEqual(LEVELS[i - 1].spawnPerSec);
    }
  });

  it("keeps the classic saucer points: blue 1, green 2, red 3", () => {
    expect(CRAFTS.saucer.points).toEqual([1, 2, 3]);
    expect(ROCKS.name).toBeTruthy();
  });
});

describe("the page", () => {
  it("loads the shared skin, the shared sound kit and the vendored 3D library", () => {
    expect(page).toContain('href="game-skin.css"');
    expect(page).toContain('<script src="game-sound.js"></script>');
    expect(page).toContain('src="../assets/vendor/three.min.js"');
  });

  it("saves progress on this device under its own keys, and keeps the old best-score key", () => {
    expect(page).toContain("'cosmic-level'");
    expect(page).toContain("'cosmic-best'");
    expect(page).toContain("'ufo-best'");
  });

  it("still explains efficiency and has a friendly note when 3D isn't available", () => {
    expect(page).toContain("What's efficiency?");
    expect(page).toContain("This game needs 3D");
  });
});
