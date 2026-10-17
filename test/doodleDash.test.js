// Doodle Dash is one self-contained page (games/Doodle-Dash.html). Its room-code and
// room-leader helpers live between BEGIN/END markers so they can be tested without a
// browser, and the page, its art and its registration on the site are pinned here.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/Doodle-Dash.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const { genCode, cleanCode, fmtCode, splitChunks, leaderOf, seatOf } = new Function(
  block + "; return { genCode, cleanCode, fmtCode, splitChunks, leaderOf, seatOf };"
)();

describe("room codes", () => {
  it("always make a six character code with at least one letter and one number", () => {
    for (let i = 0; i < 5000; i++) {
      const u = (i * 2654435761) >>> 0;
      const c = genCode(u);
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/); // no I, O, 0 or 1: they look alike
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[2-9]/);
    }
    for (const u of [0, 1, 4294967295, -1]) expect(genCode(u)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it("clean up what a player types, in any case, and reject anything else", () => {
    expect(cleanCode("abc 234")).toBe("ABC234");
    expect(cleanCode("a-b-c-2-3-4")).toBe("ABC234");
    expect(cleanCode("ABC23")).toBe("");
    expect(cleanCode("ABC2345")).toBe("");
    expect(cleanCode("ABCO12")).toBe(""); // O, 0, I and 1 are never in a code
    expect(cleanCode(null)).toBe("");
  });

  it("show the code in two easy to read groups", () => {
    expect(fmtCode("ABC234")).toBe("ABC 234");
  });
});

describe("two players per room", () => {
  const P = (at, extra) => [Object.assign({ at }, extra || {})];

  it("seats players in the order they arrived", () => {
    const st = { host: P(100), friend: P(200), third: P(300) };
    expect(seatOf(st, "host")).toBe(0);
    expect(seatOf(st, "friend")).toBe(1);
    expect(seatOf(st, "third")).toBe(2); // seat 2 or later means the room is full
  });

  it("settles two players arriving in the same instant the same way for everyone", () => {
    const st = { host: P(100), b: P(200), a: P(200) };
    expect(seatOf(st, "a")).toBe(1);
    expect(seatOf(st, "b")).toBe(2);
  });

  it("gives a seat back when someone leaves", () => {
    const st = { friend: P(200), third: P(300) };
    expect(seatOf(st, "third")).toBe(1);
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

  it("refuses a third player and tells them why", () => {
    expect(page).toContain("others().length>=2");
    expect(page).toContain("already has 2 players");
  });

  it("numbers level pieces with their own field, not the sender id that mpSend stamps on every message", () => {
    expect(page).toContain("p.i=MP.id");
    expect(page).toContain("ci:i,n:parts.length");
    expect(page).toContain("a.parts[p.ci]=p.d");
  });

  it("puts Back and Join a friend above the Make your level heading, with no long level code box left", () => {
    const make = page.split('<section id="make"')[1].split("</section>")[0];
    expect(make.indexOf('id="bMakeBack"')).toBeGreaterThan(-1);
    expect(make.indexOf('id="joinForm2"')).toBeGreaterThan(make.indexOf('id="bMakeBack"'));
    expect(make.indexOf("<h1>Make your level</h1>")).toBeGreaterThan(make.indexOf('id="joinForm2"'));
    expect(page).not.toContain("codeIn");
  });

  it("draws on a big pad with the options underneath, and shows each pen size as a sample line", () => {
    const draw = page.split('<section id="draw"')[1].split("</section>")[0];
    expect(draw.indexOf('id="dc"')).toBeLessThan(draw.indexOf('id="tools"'));
    for (const s of ["6", "12", "22"]) expect(draw).toMatch(new RegExp(`data-s="${s}"[^>]*><span class="sz"`));
  });

  it("sends rooms an uncompressed level, so older phones can read it", () => {
    expect(page).toContain("await enc(true)");
    expect(page).toContain("if(!raw)try{");
  });

  it("lets a joiner wait for a host who stepped away, and puts Join a friend in the top bar", () => {
    expect(page).toContain("Waiting for your friend to open room");
    expect(page).toMatch(/<div class="top">[\s\S]*<div class="tjoin">[\s\S]*id="joinForm"[\s\S]*id="bHow"/);
  });

  it("still works on phones without canvas roundRect: it is polyfilled first and Join is wired before start-up can throw", () => {
    const script = page.split("<script>")[1];
    expect(script.indexOf("CanvasRenderingContext2D.prototype.roundRect=")).toBeGreaterThan(-1);
    expect(script.indexOf("CanvasRenderingContext2D.prototype.roundRect=")).toBeLessThan(script.indexOf("const W=320"));
    expect(script.indexOf("wireJoin($('#joinForm'))")).toBeGreaterThan(-1);
    expect(script.indexOf("wireJoin($('#joinForm'))")).toBeLessThan(script.indexOf("setChar(Math.min("));
    expect(page).toContain('id="joinForm" autocomplete="off" onsubmit="return false"');
  });

  it("lists the colours in the agreed order", () => {
    const order = [...page.matchAll(/<li><span class="dot"[^>]*><\/span><canvas class="lg" data-k="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["plat", "start", "flag", "coin", "orb", "mover", "spike", "enemy"]);
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
