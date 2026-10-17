// Doodle Dash is one self-contained page (games/Doodle-Dash.html). Its room-code and
// room-leader helpers live between BEGIN/END markers so they can be tested without a
// browser, and the page, its art and its registration on the site are pinned here.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/Doodle-Dash.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const { genCode, cleanCode, fmtCode, splitChunks, leaderOf } = new Function(
  block + "; return { genCode, cleanCode, fmtCode, splitChunks, leaderOf };"
)();

describe("room codes", () => {
  it("always make a six digit code that never starts with 0", () => {
    for (const u of [0, 1, 899999, 900000, 123456789, 4294967295, -1]) {
      expect(genCode(u)).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it("clean up what a player types and reject anything that is not six digits", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("123-456")).toBe("123456");
    expect(cleanCode("12345")).toBe("");
    expect(cleanCode("1234567")).toBe("");
    expect(cleanCode(null)).toBe("");
  });

  it("show the code in two easy to read groups", () => {
    expect(fmtCode("123456")).toBe("123 456");
  });
});

describe("level sharing", () => {
  it("splits a long level code into pieces that rejoin exactly", () => {
    const s = "abcdefghij".repeat(37);
    expect(splitChunks(s, 64).join("")).toBe(s);
    expect(splitChunks(s, 64).every((c) => c.length <= 64)).toBe(true);
  });

  it("prefers the host as the level leader, then the lowest id", () => {
    const st = { b: [{ lv: 1 }], a: [{ lv: 1 }], h: [{ lv: 1, host: 1 }], z: [{}] };
    expect(leaderOf(st)).toBe("h");
    delete st.h;
    expect(leaderOf(st)).toBe("a");
    expect(leaderOf({})).toBe("");
  });
});

describe("the game page", () => {
  it("never writes pictures to the database or uploads them", () => {
    expect(page).not.toMatch(/\.from\(['"]/); // no table access
    expect(page).not.toMatch(/supabase\.co\/storage/);
    expect(page).not.toMatch(/\.upload\(/);
  });

  it("has a Launch game button in the banner and a Next level button for the sample levels", () => {
    expect(page).toMatch(/<div class="hl"><button[^>]*id="bLaunch"/);
    expect(page).toContain('id="bNext"');
    expect(page).toContain("loadBuiltin(BI+1)");
  });

  it("has every character head image on disk", () => {
    for (const f of ["chike", "zech", "mateo", "kylah", "corey", "stacey", "averi", "yuna"]) {
      expect(existsSync(new URL(`../assets/games/doodle-dash/${f}.webp`, import.meta.url))).toBe(true);
    }
  });
});

describe("registration on the site", () => {
  it("is in the games list with its cover images present", () => {
    expect(index).toContain('slug:"doodle-dash"');
    expect(index).toContain('path:"games/Doodle-Dash.html"');
    expect(existsSync(new URL("../assets/games/doodle-dash.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/doodle-dash-thumb.jpg", import.meta.url))).toBe(true);
  });

  it("lets the framed game use the camera", () => {
    expect(index).toContain('allow="fullscreen; camera; clipboard-write"');
  });
});
