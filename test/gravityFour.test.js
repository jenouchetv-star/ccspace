import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/* Chike's Gravity Four is a members-only game: its source is kept in supabase/private-games (never deployed as a file)
   and served by the portal Edge Function after a session check. */
const html = readFileSync(new URL("../supabase/private-games/chikes-gravity-four.html", import.meta.url), "utf8");

const logic = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = new Function(logic + "; return { COLS, ROWS, P1, P2, newBoard, rowFor, openCols, findWin, isFull, aiMove, winningCol };")();

/* a board built from column drops: [col, player] */
function play(drops){
  const b = L.newBoard();
  for (const [c, p] of drops){ const r = L.rowFor(b, c); expect(r).toBeGreaterThanOrEqual(0); b[r][c] = p; }
  return b;
}
/* mulberry32: a small seeded random generator, so the results are repeatable */
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe("the rules", () => {
  it("drops a chip to the lowest empty row of its column", () => {
    const b = L.newBoard();
    expect(L.rowFor(b, 2)).toBe(0);
    b[0][2] = 1; b[1][2] = 2;
    expect(L.rowFor(b, 2)).toBe(2);
    for (let r = 0; r < L.ROWS; r++) b[r][2] = 1;
    expect(L.rowFor(b, 2)).toBe(-1);
    expect(L.openCols(b)).toEqual([0, 1, 3, 4, 5, 6]);
  });

  it("finds four in a row across, up and down, and on both slants", () => {
    expect(L.findWin(play([[0, 1], [1, 1], [2, 1], [3, 1]])).cells).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
    expect(L.findWin(play([[6, 2], [6, 2], [6, 2], [6, 2]])).p).toBe(2);
    /* rising slant: 1 at (0,0) (1,1) (2,2) (3,3) */
    const up = play([[0, 1], [1, 2], [1, 1], [2, 2], [2, 2], [2, 1], [3, 2], [3, 2], [3, 2], [3, 1]]);
    expect(L.findWin(up).cells).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
    /* falling slant: 2 at (0,6)... mirrored */
    const down = play([[6, 2], [5, 1], [5, 2], [4, 1], [4, 1], [4, 2], [3, 1], [3, 1], [3, 1], [3, 2]]);
    expect(L.findWin(down).p).toBe(2);
    expect(L.findWin(play([[0, 1], [1, 1], [2, 1], [3, 2]]))).toBeNull();
    expect(L.findWin(L.newBoard())).toBeNull();
  });

  it("calls a full board with no winner a tie", () => {
    const b = L.newBoard();
    /* a known drawn pattern: columns in blocks of rows that never line up four */
    const pat = ["112211", "221122", "112211", "221122", "112211", "221122", "112211"];
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) b[r][c] = Number(pat[c][r]);
    expect(L.findWin(b)).toBeNull();
    expect(L.isFull(b)).toBe(true);
  });
});

describe("the robot", () => {
  it("takes a win when it has one, on either level", () => {
    const b = play([[0, 2], [1, 2], [2, 2], [0, 1], [1, 1], [2, 1]]);   /* 2 can win at column 3 */
    for (const level of ["easy", "smart"]) expect(L.aiMove(b, 2, level, seeded(7))).toBe(3);
  });

  it("the smart robot always blocks a win", () => {
    const b = play([[0, 1], [1, 1], [2, 1], [0, 2], [1, 2]]);           /* 1 threatens column 3 */
    for (let s = 1; s < 30; s++) expect(L.aiMove(b, 2, "smart", seeded(s))).toBe(3);
  });

  it("the easy robot blocks most of the time but not always", () => {
    const b = play([[0, 1], [1, 1], [2, 1], [0, 2], [1, 2]]);
    const picks = Array.from({ length: 200 }, (_, s) => L.aiMove(b, 2, "easy", seeded(s + 1)));
    const blocked = picks.filter((c) => c === 3).length;
    expect(blocked).toBeGreaterThan(100);
    expect(blocked).toBeLessThan(200);
  });

  it("only ever picks a column that is open, and does not change the board", () => {
    const b = play([[3, 1], [3, 2], [3, 1], [3, 2], [3, 1], [3, 2], [0, 1], [1, 2]]);
    const before = JSON.stringify(b);
    for (const level of ["easy", "smart"]) for (let s = 1; s < 20; s++){
      const c = L.aiMove(b, 2, level, seeded(s));
      expect(L.openCols(b)).toContain(c);
    }
    expect(JSON.stringify(b)).toBe(before);
    expect(L.aiMove(play(Array.from({ length: 7 }, (_, c) => Array.from({ length: 6 }, (_, r) => [c, ((c + r) % 4 < 2) ? 1 : 2])).flat()), 2, "smart", Math.random)).toBe(-1);
  });

  it("the smart robot beats the easy robot over a set of games", () => {
    let smart = 0, easy = 0;
    for (let g = 0; g < 10; g++){
      const b = L.newBoard(), rnd = seeded(g + 11);
      let turn = g % 2 === 0 ? 1 : 2;
      for (let i = 0; i < 42; i++){
        const col = L.aiMove(b, turn, turn === 1 ? "smart" : "easy", rnd);
        b[L.rowFor(b, col)][col] = turn;
        const w = L.findWin(b);
        if (w){ if (w.p === 1) smart++; else easy++; break; }
        turn = turn === 1 ? 2 : 1;
      }
    }
    expect(smart).toBeGreaterThan(easy);
  });
});

describe("the game page", () => {
  it("is on the site's brand: ink outlines, hard shadows, the brand colours and typeface", () => {
    for (const token of ["--ink:#1E2226", "--paper:#FAF4E6", "--sun:#F5B921", "--cyan:#17B3CE", "--plum:#7A4A86", "border:3px solid var(--ink)", "--hard:4px 4px 0 #1E2226", "Plus Jakarta Sans"])
      expect(html).toContain(token);
  });

  it("brings nothing in from outside except fonts, a pinned copy of three.js (with the site's own as a fallback) and its live-play client", () => {
    expect(html).not.toMatch(/tailwind|font-awesome|firebase|gstatic\.com\/firebasejs|cdnjs\.cloudflare|jsdelivr/i);
    expect(html).not.toMatch(/<script[^>]+\bsrc=/);                     /* every library is loaded by loadLibs() */
    expect(html).toContain("https://unpkg.com/three@0.128.0/build/three.min.js");
    expect(html).toContain("https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js");
    expect(html).toContain('"/assets/vendor/three.min.js"');
    expect(html).toContain("@supabase/supabase-js@2.112.4");
    for (const f of ["../assets/vendor/three.min.js", "../assets/vendor/three-orbit-controls.js"]) expect(existsSync(new URL(f, import.meta.url))).toBe(true);
  });

  it("does not use another company's game name, in the game or in the portal entry that goes with it", () => {
    const seed = readFileSync(new URL("../supabase/portal-gravity-four.sql", import.meta.url), "utf8");
    const name = /connect[ -]?(four|4)\b/i;
    expect(html).not.toMatch(name);
    expect(seed).not.toMatch(name);
  });

  it("works inside the player's sealed frame: no alert, no popups of its own, no clipboard shim", () => {
    expect(html).not.toMatch(/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(|execCommand/);
    expect(html).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });

  it("can be played without a mouse and announces what happens", () => {
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('"ArrowLeft"');
    expect(html).toContain('id="bDrop"');
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain('name="robots"');
  });

  it("only trusts well-formed messages from the other player", () => {
    expect(html).toContain("Number.isInteger(col) || col < 0 || col >= COLS");
    expect(html).toContain("m.i === NET.id");
    expect(html).toContain('"g4-room-"');
    expect(html).toMatch(/\\d\{6\}/);
  });
});
