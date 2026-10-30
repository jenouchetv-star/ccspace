// Air Hockey Arcade is drawn in 3D (three.js), but the whole game - pucks, paddles, Chike's play, goals and the
// running sums - lives in plain table units between the LOGIC-START / LOGIC-END markers, with no drawing in it.
// That block is run here on its own: physics keeps every puck on the table, goals add the number on the puck,
// the player can never cross the centre line, and Easy / Medium / Hard play like they say they do.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/air-hockey.html", import.meta.url), "utf8");
const block = page.slice(page.indexOf("/* LOGIC-START */"), page.indexOf("/* LOGIC-END */"));
const G = new Function(block + `; return { W, L, MID, GOAL_W, PUCK_R, PADDLE_R, WIN_SCORE, PUCK_COUNT, PLAYER_SPEED, LEVELS,
  makeRng, clampToHalf, newMatch, makePuck, steerPaddle, hitWalls, hitPaddle, hitPucks, predictX, aiTarget, tallyText, addGoal, step };`)();

const puck = (x, y, vx, vy, value = 5) => ({ id: 99, x, y, px: x, py: y, vx, vy, r: G.PUCK_R, value, ax: x, ay: y, since: 0 });

/* a 6-8 year old, roughly: slow to react, a bit wobbly, chases the nearest puck on their half and pushes it forward */
function kid(w, rng, st){
  const me = w.player;
  if (w.tick >= st.next){
    st.next = w.tick + 12 + Math.floor(rng() * 12);
    let best = null, bd = Infinity;
    for (const p of w.pucks){
      if (p.y < G.MID - 20) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y) - (p.vy > 0 ? 60 : 0);
      if (d < bd){ bd = d; best = p; }
    }
    if (best && me.y < best.y + 10){ st.tx = best.x + (me.x < best.x ? -70 : 70); st.ty = best.y + 55; }   // go round it
    else if (best){ st.tx = best.x + (rng() - 0.5) * 70; st.ty = best.y + 25; }                             // push it
    else { st.tx = G.W / 2 + (rng() - 0.5) * 80; st.ty = G.L - 120; }
  }
  const dx = st.tx - st.x, dy = st.ty - st.y, d = Math.hypot(dx, dy), sp = Math.min(d, 7);
  if (d > 0){ st.x += dx / d * sp; st.y += dy / d * sp; }
  const c = G.clampToHalf("player", st.x, st.y); st.x = c.x; st.y = c.y;
  return { x: st.x, y: st.y };
}
function playMatch(level, seed){
  const rng = G.makeRng(seed), w = G.newMatch(level), st = { next: 0, x: G.W / 2, y: G.L - 110, tx: G.W / 2, ty: G.L - 110 };
  for (let t = 0; t < 60 * 60 * 6 && !w.winner; t++) G.step(w, kid(w, rng, st), rng);
  return w;
}
function kidWins(level, n = 24){
  let wins = 0;
  for (let i = 0; i < n; i++) if (playMatch(level, 7000 + i).winner === "player") wins++;
  return wins / n;
}

describe("the table", () => {
  it("keeps the old match: five numbered pucks (1 to 9) at once, first to 25", () => {
    expect(G.PUCK_COUNT).toBe(5);
    expect(G.WIN_SCORE).toBe(25);
    const rng = G.makeRng(1), w = G.newMatch("easy");
    const values = new Set();
    for (let i = 0; i < 400; i++) values.add(G.makePuck(w, rng).value);
    expect([...values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let t = 0; t < 200; t++) G.step(w, { x: 250, y: 900 }, rng);
    expect(w.pucks.length).toBe(5);
  });
  it("bounces pucks off the side rails and the end rails beside the goals", () => {
    const out = { wall: 0 };
    const a = puck(5, 300, -8, 0);
    expect(G.hitWalls(a, out)).toBe(null);
    expect(a.x).toBe(G.PUCK_R); expect(a.vx).toBeGreaterThan(0); expect(out.wall).toBe(8);
    const b = puck(G.W - 2, 300, 6, 1);
    G.hitWalls(b, { wall: 0 }); expect(b.x).toBe(G.W - G.PUCK_R); expect(b.vx).toBeLessThan(0);
    const c = puck(40, G.L - 5, 0, 9);                    // beside the player's goal, not in it
    expect(G.hitWalls(c, { wall: 0 })).toBe(null);
    expect(c.y).toBe(G.L - G.PUCK_R); expect(c.vy).toBeLessThan(0);
    const d = puck(G.W - 40, 3, 0, -9);                   // beside Chike's goal
    expect(G.hitWalls(d, { wall: 0 })).toBe(null);
    expect(d.y).toBe(G.PUCK_R); expect(d.vy).toBeGreaterThan(0);
  });
  it("scores a puck that goes into a goal mouth: Chike's goal is a point for you, yours is a point for Chike", () => {
    expect(G.hitWalls(puck(G.W / 2, -1, 0, -9), { wall: 0 })).toBe("player");
    expect(G.hitWalls(puck(G.W / 2 + G.GOAL_W / 2 - 30, G.L + 1, 0, 9), { wall: 0 })).toBe("ai");
    expect(G.hitWalls(puck(G.W / 2, G.L / 2, 0, 9), { wall: 0 })).toBe(null);
  });
  it("knocks a puck away from a paddle, harder when the paddle swings at it", () => {
    const pad = { x: 250, y: 800, vx: 0, vy: -20, r: G.PADDLE_R };
    const p = puck(250, 800 - G.PADDLE_R - G.PUCK_R + 4, 0, 0);
    const hit = G.hitPaddle(p, pad, 0.9, 2.5);
    expect(hit).toBeGreaterThan(0);
    expect(p.vy).toBeLessThan(-20);                       // flies off toward Chike's end
    expect(Math.hypot(p.x - pad.x, p.y - pad.y)).toBeCloseTo(G.PADDLE_R + G.PUCK_R, 5);
    const far = puck(100, 100, 0, 0);
    expect(G.hitPaddle(far, pad, 0.9, 2.5)).toBe(0);
  });
  it("lets two pucks bounce off each other without passing through", () => {
    const a = puck(200, 500, 6, 0), b = puck(200 + G.PUCK_R * 2 - 3, 500, -6, 0);
    expect(G.hitPucks(a, b)).toBeGreaterThan(0);
    expect(a.vx).toBeLessThan(0); expect(b.vx).toBeGreaterThan(0);
    expect(b.x - a.x).toBeGreaterThanOrEqual(G.PUCK_R * 2 - 1e-9);
  });
  it("never lets a puck leave the table, over thousands of wild ticks at every level", () => {
    for (const level of ["easy", "medium", "hard"]){
      const rng = G.makeRng(42), w = G.newMatch(level);
      for (let t = 0; t < 5000; t++){
        const ang = t / 9;
        G.step(w, { x: 250 + Math.cos(ang) * 400, y: 750 + Math.sin(ang * 1.7) * 400 }, rng);   // a frantic player
        for (const p of w.pucks){
          expect(p.x).toBeGreaterThanOrEqual(p.r - 1e-9);
          expect(p.x).toBeLessThanOrEqual(G.W - p.r + 1e-9);
          expect(p.y).toBeGreaterThan(-p.r);
          expect(p.y).toBeLessThan(G.L + p.r);
          expect(Number.isFinite(p.vx) && Number.isFinite(p.vy)).toBe(true);
          expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(w.cfg.maxPuck + 1e-9);
        }
        if (w.winner) break;
      }
    }
  });
});

describe("the paddles", () => {
  it("keeps the player's paddle on the player's half, never over the centre line", () => {
    expect(G.clampToHalf("player", 250, 100).y).toBe(G.MID + G.PADDLE_R);
    expect(G.clampToHalf("player", -50, 5000)).toEqual({ x: G.PADDLE_R, y: G.L - G.PADDLE_R });
    expect(G.clampToHalf("ai", 250, 900).y).toBe(G.MID - G.PADDLE_R);
    const rng = G.makeRng(3), w = G.newMatch("medium");
    for (let t = 0; t < 600; t++){
      G.step(w, { x: 250 + Math.sin(t) * 300, y: -500 }, rng);             // the pointer is up at Chike's end
      expect(w.player.y).toBeGreaterThanOrEqual(G.MID + G.PADDLE_R - 1e-9);
      expect(w.ai.y).toBeLessThanOrEqual(G.MID - G.PADDLE_R + 1e-9);
    }
  });
  it("moves the player's paddle no faster than its top speed", () => {
    const p = { x: 250, y: 900, vx: 0, vy: 0, r: G.PADDLE_R };
    G.steerPaddle(p, "player", 0, 520, G.PLAYER_SPEED);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(G.PLAYER_SPEED, 6);
  });
  it("plans Chike's moves on its own half, and reads bounces off the rails", () => {
    // 81 units to the left rail (its centre stops at PUCK_R = 19), then 119 back out: x = 138
    expect(G.predictX(100, -10, 20)).toBeCloseTo(138, 6);
    expect(G.predictX(250, 0, 50)).toBe(250);
    const rng = G.makeRng(5), w = G.newMatch("hard");
    w.pucks.push(puck(300, 300, -3, -10));
    const t = G.aiTarget(w, "ai", w.cfg, rng);
    expect(t.y).toBeLessThan(G.MID);
  });
});

describe("scoring", () => {
  it("adds the number on the puck to the scorer's sum and keeps the addition", () => {
    const w = G.newMatch("easy");
    expect(G.addGoal(w, "player", 4)).toEqual({ before: 0, total: 4 });
    expect(G.addGoal(w, "player", 7)).toEqual({ before: 4, total: 11 });
    G.addGoal(w, "ai", 9);
    expect(w.score).toEqual({ player: 11, ai: 9 });
    expect(w.tally.player).toEqual([4, 7]);
    expect(w.winner).toBe(null);
    G.addGoal(w, "player", 9); G.addGoal(w, "player", 6);
    expect(w.score.player).toBe(26);
    expect(w.winner).toBe("player");
  });
  it("writes each side's goals as true addition, folding old goals into the first number", () => {
    expect(G.tallyText([], 3)).toBe("");
    expect(G.tallyText([5], 3)).toBe("5");
    expect(G.tallyText([2, 4], 3)).toBe("2 + 4 = 6");
    expect(G.tallyText([2, 4, 7, 5], 3)).toBe("6 + 7 + 5 = 18");
    expect(G.tallyText([1, 1, 1, 1, 1, 9], 4)).toBe("3 + 1 + 1 + 9 = 14");
  });
  it("turns a puck crossing into Chike's goal into a goal event worth its number, then serves a new puck", () => {
    const rng = G.makeRng(9), w = G.newMatch("easy");
    w.queue = [];
    w.pucks = [puck(G.W / 2, 4, 0, -8, 6)];
    const ev = G.step(w, { x: 250, y: 900 }, rng);
    const goal = ev.find((e) => e.type === "goal");
    expect(goal).toMatchObject({ scorer: "player", value: 6, before: 0, total: 6 });
    expect(w.pucks.length).toBe(0);
    expect(w.queue.length).toBe(1);
    for (let t = 0; t < 60; t++) G.step(w, { x: 250, y: 900 }, rng);
    expect(w.pucks.length).toBe(1);
  });
  it("announces the winner once, when a sum reaches 25", () => {
    const rng = G.makeRng(11), w = G.newMatch("easy");
    w.queue = []; w.score.ai = 22; w.tally.ai = [22];
    w.pucks = [puck(G.W / 2, G.L - 4, 0, 8, 3)];
    const ev = G.step(w, { x: 60, y: 600 }, rng);
    expect(ev.filter((e) => e.type === "win")).toEqual([{ type: "win", winner: "ai" }]);
    expect(G.step(w, { x: 60, y: 600 }, rng).some((e) => e.type === "win")).toBe(false);
  });
});

describe("Chike at each level, against a scripted young player", () => {
  const rates = {};
  it("Easy: the kid wins most matches", () => {
    rates.easy = kidWins("easy");
    expect(rates.easy).toBeGreaterThanOrEqual(0.75);
  });
  it("Medium: a real match, harder than Easy", () => {
    rates.medium = kidWins("medium");
    expect(rates.medium).toBeGreaterThan(0.1);
    expect(rates.medium).toBeLessThan(rates.easy ?? kidWins("easy"));
  });
  it("Hard: Chike beats the kid almost every time", () => {
    rates.hard = kidWins("hard");
    expect(rates.hard).toBeLessThanOrEqual(0.1);
  });
  it("plays the same match again from the same seed", () => {
    const a = playMatch("medium", 123), b = playMatch("medium", 123);
    expect(a.score).toEqual(b.score);
    expect(a.tally).toEqual(b.tally);
  });
});

describe("the page", () => {
  it("loads three.js r128 and the shared sound kit, with a sound button", () => {
    expect(page).toContain('src="https://unpkg.com/three@0.128.0/build/three.min.js"');
    expect(page).toContain('<script src="game-sound.js"></script>');
    expect(page).toContain("CCSSound.button(");
  });
  it("keeps Easy / Medium / Hard, Reset match, mouse, arrow keys and touch", () => {
    for (const lv of ["easy", "medium", "hard"]) expect(page).toContain(`data-difficulty="${lv}"`);
    expect(page).toContain('id="difficulty-selection"');                 // the site's fit-the-window check looks for it
    expect(page).toContain("Reset match");
    expect(page).toContain("Move your paddle with the mouse, or with the Arrow keys.");
    expect(page).toContain('"pointermove"');
    expect(page).toContain("ArrowUp");
  });
  it("tells screen readers about goals, and tones things down for reduced motion", () => {
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("prefers-reduced-motion: reduce");
  });
  it("caps the pixel ratio at 2 and pauses when the tab is hidden", () => {
    expect(page).toContain("Math.min(2, window.devicePixelRatio || 1)");
    expect(page).toContain('"visibilitychange"');
  });
});
