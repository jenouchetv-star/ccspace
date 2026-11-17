// Books: a subtle page-turn sound each time the reader turns a page (owner, 2026-11-16: "a subtle book flipping sound ... to create an immersive effect").
// Sounds made in code came out like static, then like blowing into a mic, so the owner picked a real recording:
// "page turn sound effect" by stumpbutt on Freesound (https://freesound.org/s/431871/), Creative Commons 0 (public domain, no credit needed).
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const reader = readFileSync(new URL("../books/reader.html", import.meta.url), "utf8");
const main = reader.split("document.addEventListener('DOMContentLoaded'")[1];
const fn = reader.split("function playPageFlip(){")[1].split("\n  }\n")[0];

describe("the page-turn sound", () => {
  it("plays the real page-turn recording, a small file kept with the books", () => {
    expect(reader).toContain('const FLIP_SOUND = "/assets/books/page-turn.mp3";');
    const size = statSync(new URL("../assets/books/page-turn.mp3", import.meta.url)).size;
    expect(size).toBeGreaterThan(10000);
    expect(size).toBeLessThan(60000);
  });
  it("keeps the recording's free license on record", () => {
    expect(reader).toContain("freesound.org/s/431871");
    expect(readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8")).toContain("assets/books/page-turn.mp3");
  });
  it("stays subtle: softer than the recording, cut short with a quick fade", () => {
    const vols = [...fn.matchAll(/gain\.setValueAtTime\((0\.\d+)/g)].map(m => parseFloat(m[1]));
    expect(vols.length).toBeGreaterThan(0);
    expect(Math.max(...vols)).toBeLessThanOrEqual(0.7);
    expect(fn).toMatch(/linearRampToValueAtTime\(0, t \+ 0\.\d+\)/);
  });
  it("no longer makes its own noise in code", () => {
    expect(reader).not.toContain("flipAir");
    expect(reader).not.toContain("createBiquadFilter");
  });
  it("never breaks reading when sound can't play", () => {
    expect(fn).toMatch(/try\s*\{/);
    expect(fn).toMatch(/catch\s*\(/);
  });
  it("loads the sound ahead of the first turn", () => {
    expect(main).toContain("window.CCS_READER.preloadPageFlip()");
  });
  it("plays on every turn: the desktop page turn and the phone's next and previous page", () => {
    const turn = main.split("function turnPage(paper, move) {")[1].split("\n  }\n")[0];
    expect(turn).toContain("CCS_READER.playPageFlip()");
    expect(main).toMatch(/function mobileNext\(\) \{[^\n]*CCS_READER\.playPageFlip\(\)/);
    expect(main).toMatch(/function mobilePrev\(\) \{[^\n]*CCS_READER\.playPageFlip\(\)/);
  });
});
