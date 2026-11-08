// Chrono Billiards is one self-contained page (games/chrono-billiards.html): a 3D pool table where the angle
// and speed of every shot are drawn right on the felt. Its rules and physics (grades, pockets, how a ball
// rolls, bounces and hits, the aim guide, scoring) live between BEGIN/END markers so they can be tested
// without a browser. The aim guide must tell the truth: what it draws is what the table then does.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../games/chrono-billiards.html", import.meta.url), "utf8");
const block = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const R = new Function(
  block + "; return { TABLE, PHYS, GRADES, GRADE_ORDER, MODES, MAX_LEVEL, CUE_SPOT, makeRng, norm360, degOf, dirOf, railAngle, levelFromDistance, speedOf, stopDistance, speedAfter, pocketsFor, wallOpen, rackBalls, makeWorld, shoot, stepWorld, isMoving, predictShot, bankDeg, pocketPoints, nextCombo, rackSize, trickShots, trickStars, respotCue, TWO_PLAYER_BALLS, makeCode, readCode, formatCode, twoPlayerTurn, winnerOf, packBalls, unpackBalls };"
)();

/* a table with just the balls we place, for exact shots */
function table(grade, cue, others) {
  const w = R.makeWorld(grade, 0, 1);
  w.balls[0].x = cue.x; w.balls[0].z = cue.z;
  others.forEach((p, i) => w.balls.push({ id: i + 1, num: i + 1, color: "#FFD23F", x: p.x, z: p.z, vx: 0, vz: 0, alive: true, roll: 0, rollDir: 0 }));
  return w;
}
/* run the table until everything stops; collect what happened */
function run(w, onEvent) {
  for (let i = 0; i < 480 * 60 && R.isMoving(w); i++) {
    const ev = R.stepWorld(w, R.PHYS.DT);
    ev.forEach((e) => onEvent && onEvent(e, w));
  }
}
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe("grades", () => {
  it("run K to 5th: more balls and smaller pockets as kids get older", () => {
    expect(R.GRADE_ORDER).toEqual(["K", "1", "2", "3", "4", "5"]);
    expect(R.GRADE_ORDER.map((g) => R.GRADES[g].label)).toEqual(["K", "1st", "2nd", "3rd", "4th", "5th"]);
    for (let i = 1; i < 6; i++) {
      const a = R.GRADES[R.GRADE_ORDER[i - 1]], b = R.GRADES[R.GRADE_ORDER[i]];
      expect(b.balls).toBeGreaterThan(a.balls);
      expect(b.pocket).toBeLessThan(a.pocket);
    }
  });
  it("show K to 2nd where a hit ball will go and whether it drops in; older grades work it out", () => {
    expect(R.GRADE_ORDER.map((g) => R.GRADES[g].helper)).toEqual([true, true, true, false, false, false]);
  });
});

describe("aim and speed", () => {
  it("measure angles in whole degrees, counterclockwise from straight right", () => {
    expect(R.degOf(1, 0)).toBe(0);
    expect(R.degOf(0, 1)).toBe(90);
    expect(R.degOf(-1, 0)).toBe(180);
    expect(R.degOf(0, -1)).toBe(270);
    for (const d of [0, 17, 45, 133, 270, 359]) expect(Math.round(R.degOf(R.dirOf(d).x, R.dirOf(d).z)) % 360).toBe(d);
    expect(R.norm360(-30)).toBe(330);
  });
  it("are shown like a protractor reads them: 0 to 90 from the line along the table, on the side the shot goes", () => {
    expect(R.railAngle(0)).toEqual({ deg: 0, ref: 0 });
    expect(R.railAngle(35)).toEqual({ deg: 35, ref: 0 });
    expect(R.railAngle(347)).toEqual({ deg: 13, ref: 0 });
    expect(R.railAngle(90)).toEqual({ deg: 90, ref: 0 });
    expect(R.railAngle(170)).toEqual({ deg: 10, ref: 180 });
    expect(R.railAngle(200)).toEqual({ deg: 20, ref: 180 });
    expect(R.railAngle(270)).toEqual({ deg: 90, ref: 0 });
  });
  it("turn a longer pull into a faster shot, from speed 1 to 10, half a meter per second each", () => {
    expect(R.levelFromDistance(0.03)).toBe(0);
    expect(R.levelFromDistance(0.1)).toBe(1);
    expect(R.levelFromDistance(5)).toBe(R.MAX_LEVEL);
    let last = 0;
    for (let d = 0.05; d < 0.8; d += 0.01) { const l = R.levelFromDistance(d); expect(l).toBeGreaterThanOrEqual(last); last = l; }
    expect(R.MAX_LEVEL).toBe(10);
    expect(R.speedOf(7)).toBe(3.5);
  });
});

describe("the felt", () => {
  it("slows a rolling ball so it stops where the guide says", () => {
    for (const level of [1, 2, 3]) {
      const w = table("K", { x: 0.3, z: 0.56 }, []);
      R.shoot(w, 0, level);
      const v = R.speedOf(level);
      let bounced = false;
      run(w, (e) => { if (e.type === "cushion") bounced = true; });
      expect(bounced).toBe(false);
      const travelled = w.balls[0].x - 0.3;
      expect(Math.abs(travelled - R.stopDistance(v)) / R.stopDistance(v)).toBeLessThan(0.03);
    }
    expect(R.speedAfter(3, 0)).toBeCloseTo(3, 6);
    expect(R.speedAfter(3, R.stopDistance(3) + 0.01)).toBe(0);
  });
});

describe("cushions", () => {
  it("bounce a ball off at the same angle it came in, like the guide shows", () => {
    const w = table("3", { x: 0.7, z: 0.56 }, []);
    const pred = R.predictShot(w, 60, 6, 1);
    expect(pred.bounces.length).toBe(1);
    const b = pred.bounces[0];
    expect(b.wall).toBe("far");
    expect(b.deg).toBe(60);
    R.shoot(w, 60, 6);
    let before = null, after = null, at = null;
    for (let i = 0; i < 480 * 5 && !after; i++) {
      const c = w.balls[0], vx = c.vx, vz = c.vz;
      const ev = R.stepWorld(w, R.PHYS.DT);
      if (ev.some((e) => e.type === "cushion")) { before = { x: vx, z: vz }; after = { x: c.vx, z: c.vz }; at = { x: c.x, z: c.z }; }
    }
    const inDeg = Math.atan2(Math.abs(before.z), Math.abs(before.x)) * 180 / Math.PI;
    const outDeg = Math.atan2(Math.abs(after.z), Math.abs(after.x)) * 180 / Math.PI;
    expect(Math.abs(inDeg - outDeg)).toBeLessThan(0.01);
    expect(Math.abs(at.x - b.x)).toBeLessThan(0.02);
  });
  it("leave a gap at every pocket so balls can drop in", () => {
    const w = R.makeWorld("K", 0, 1);
    expect(R.wallOpen(w, "near", 0.02)).toBe(true);
    expect(R.wallOpen(w, "near", R.TABLE.L / 2)).toBe(true);
    expect(R.wallOpen(w, "near", R.TABLE.L / 3)).toBe(false);
    expect(R.wallOpen(w, "left", R.TABLE.W / 2)).toBe(false);
  });
});

describe("hitting a ball", () => {
  it("sends a ball hit straight on straight ahead, and the white ball almost stops", () => {
    const w = table("K", { x: 0.5, z: 0.56 }, [{ x: 1.0, z: 0.56 }]);
    R.shoot(w, 0, 4);
    run(w);
    const obj = w.balls[1];
    expect(Math.abs(obj.z - 0.56)).toBeLessThan(0.002);
    expect(obj.x).toBeGreaterThan(1.1);
    expect(w.balls[0].x).toBeLessThan(1.0);
  });
  it("sends the hit ball off at the angle the guide shows", () => {
    for (const [deg, oz] of [[0, 0.6], [3, 0.52], [358, 0.5], [10, 0.7]]) {
      const w = table("3", { x: 0.5, z: 0.56 }, [{ x: 1.1, z: oz }]);
      const pred = R.predictShot(w, deg, 5, 1);
      if (!pred.hit) continue;
      R.shoot(w, deg, 5);
      let first = null;
      run(w, (e, ww) => { if (e.type === "ball" && !first) { const o = ww.balls[1]; first = R.degOf(o.vx, o.vz); } });
      expect(first).not.toBeNull();
      expect(angDiff(first, pred.hit.deg)).toBeLessThanOrEqual(1);
    }
  });
  it("finds the ghost ball where the white ball will touch the other one", () => {
    const w = table("3", { x: 0.5, z: 0.56 }, [{ x: 1.1, z: 0.6 }]);
    const pred = R.predictShot(w, 0, 6, 1);
    expect(pred.hit.ball).toBe(1);
    const g = pred.hit.ghost;
    expect(Math.hypot(g.x - 1.1, g.z - 0.6)).toBeCloseTo(2 * R.TABLE.R, 6);
  });
});

describe("pockets", () => {
  it("swallow a ball rolled into a corner, and the guide warns when the white ball will fall in", () => {
    const L = R.TABLE.L, W = R.TABLE.W;
    const w = table("K", { x: L - 0.5, z: W - 0.5 }, []);
    const pred = R.predictShot(w, 45, 6, 2);
    expect(pred.pocket).toBe(5);
    R.shoot(w, 45, 6);
    const dropped = [];
    run(w, (e) => { if (e.type === "pocket") dropped.push(e); });
    expect(dropped).toEqual([{ type: "pocket", ball: 0, pocket: 5 }]);
  });
  it("puts the white ball back on its spot after it falls in, never on top of another ball", () => {
    const w = table("K", { x: 0.5, z: 0.56 }, [{ x: R.CUE_SPOT.x, z: R.CUE_SPOT.z }]);
    w.balls[0].alive = false;
    R.respotCue(w);
    const c = w.balls[0];
    expect(c.alive).toBe(true);
    expect(Math.hypot(c.x - w.balls[1].x, c.z - w.balls[1].z)).toBeGreaterThanOrEqual(2 * R.TABLE.R);
  });
});

describe("racks", () => {
  it("place every ball on the table, apart from each other, the pockets and the white ball, the same way for the same seed", () => {
    for (const g of R.GRADE_ORDER) {
      for (const seed of [1, 7, 99, 1234]) {
        const n = R.rackSize(g, 4);
        const pts = R.rackBalls(g, n, seed);
        expect(pts.length).toBe(n);
        const pockets = R.pocketsFor(g);
        pts.forEach((p, i) => {
          expect(p.x).toBeGreaterThan(R.TABLE.R); expect(p.x).toBeLessThan(R.TABLE.L - R.TABLE.R);
          expect(p.z).toBeGreaterThan(R.TABLE.R); expect(p.z).toBeLessThan(R.TABLE.W - R.TABLE.R);
          expect(Math.hypot(p.x - R.CUE_SPOT.x, p.z - R.CUE_SPOT.z)).toBeGreaterThan(0.3);
          pockets.forEach((k) => expect(Math.hypot(p.x - k.x, p.z - k.z)).toBeGreaterThan(k.r + 0.05));
          pts.slice(i + 1).forEach((q) => expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(2 * R.TABLE.R));
        });
        expect(R.rackBalls(g, n, seed)).toEqual(pts);
      }
    }
  });
  it("add a ball each new table, up to three more", () => {
    expect(R.rackSize("K", 1)).toBe(R.GRADES.K.balls);
    expect(R.rackSize("K", 2)).toBe(R.GRADES.K.balls + 1);
    expect(R.rackSize("K", 30)).toBe(R.GRADES.K.balls + 3);
  });
});

describe("scoring", () => {
  it("pays 100 a ball, more for every cushion the white ball banks off first, times the combo", () => {
    expect(R.pocketPoints(0, 1)).toBe(100);
    expect(R.pocketPoints(1, 1)).toBe(200);
    expect(R.pocketPoints(2, 3)).toBe(900);
    expect(R.pocketPoints(9, 1)).toBe(400);
  });
  it("builds a combo on shots that sink a ball, and a miss or a fallen white ball starts it over", () => {
    expect(R.nextCombo(1, 1, false)).toBe(2);
    expect(R.nextCombo(5, 2, false)).toBe(5);
    expect(R.nextCombo(3, 0, false)).toBe(1);
    expect(R.nextCombo(3, 1, true)).toBe(1);
  });
  it("gives Trick Shots a few spare shots per table and stars for using fewer", () => {
    expect(R.trickShots("K", 3)).toBe(7);
    expect(R.trickShots("5", 8)).toBe(11);
    expect(R.trickStars(3, 3)).toBe(3);
    expect(R.trickStars(5, 3)).toBe(2);
    expect(R.trickStars(9, 3)).toBe(1);
    expect(R.MODES.arcade.time).toBe(90);
  });
});

describe("two players", () => {
  it("make 6-digit room codes that never start with 0, and read a typed code with or without spaces", () => {
    for (const n of [0, 1, 99999, 123456, 899999, 900000, 4294967295]) expect(R.makeCode(n)).toMatch(/^[1-9]\d{5}$/);
    expect(R.readCode(" 482 913 ")).toBe("482913");
    expect(R.readCode("482913")).toBe("482913");
    expect(R.readCode("48291")).toBe(null);
    expect(R.readCode("4829135")).toBe(null);
    expect(R.readCode("48a913")).toBe(null);
    expect(R.formatCode("482913")).toBe("482 913");
  });
  it("keep the turn after sinking a ball, and pass it on a miss or when the white ball falls in", () => {
    expect(R.twoPlayerTurn(0, 1, false)).toBe(0);
    expect(R.twoPlayerTurn(1, 2, false)).toBe(1);
    expect(R.twoPlayerTurn(0, 0, false)).toBe(1);
    expect(R.twoPlayerTurn(1, 0, false)).toBe(0);
    expect(R.twoPlayerTurn(0, 2, true)).toBe(1);
  });
  it("play one table of 9 balls on every grade, and whoever sinks more wins", () => {
    expect(R.TWO_PLAYER_BALLS).toBe(9);
    for (const g of R.GRADE_ORDER) for (const seed of [3, 77, 2024]) expect(R.rackBalls(g, 9, seed).length).toBe(9);
    expect(R.winnerOf([5, 4])).toBe(0);
    expect(R.winnerOf([3, 6])).toBe(1);
    expect(R.winnerOf([2, 2])).toBe(-1);
  });
  it("send the table as small whole numbers and rebuild it on the other screen", () => {
    const w = R.makeWorld("3", 9, 42);
    w.balls[0].x = 0.61234567; w.balls[3].alive = false;
    const packed = R.packBalls(w);
    expect(JSON.stringify(packed).length).toBeLessThan(400);
    packed.flat().forEach((n) => expect(Number.isInteger(n)).toBe(true));
    const w2 = R.makeWorld("3", 9, 42);
    R.unpackBalls(w2, packed);
    w.balls.forEach((b, i) => {
      expect(Math.abs(w2.balls[i].x - b.x)).toBeLessThan(1e-5);
      expect(Math.abs(w2.balls[i].z - b.z)).toBeLessThan(1e-5);
      expect(w2.balls[i].alive).toBe(b.alive);
    });
  });
  it("play the same shot exactly the same way on both screens", () => {
    const a = R.makeWorld("2", 9, 31337), b = R.makeWorld("2", 9, 31337);
    R.shoot(a, 23, 9); R.shoot(b, 23, 9);
    run(a); run(b);
    expect(R.packBalls(b)).toEqual(R.packBalls(a));
    expect(a.balls.map((x) => [x.x, x.z, x.alive])).toEqual(b.balls.map((x) => [x.x, x.z, x.alive]));
  });
});

describe("its place on the Play page", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/chrono-billiards.sql", import.meta.url), "utf8");
  const words = readFileSync(new URL("../supabase/game-words.sql", import.meta.url), "utf8");
  it("is listed as a New free online game with a real cover and its thumbnail", () => {
    expect(index).toContain('G({ id:"game-chrono-billiards", title:"Chrono Billiards", slug:"chrono-billiards",');
    expect(index).toContain('kind:"embed", interactive:true, featured:true, badge:"New", order:0, path:"games/chrono-billiards.html"');
    expect(index).toContain('cover:{ src:"assets/games/chrono-billiards.jpg"');
    expect(existsSync(new URL("../assets/games/chrono-billiards.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/chrono-billiards-thumb.jpg", import.meta.url))).toBe(true);
  });
  it("has the SQL row for the live games table, matching the page's word to know", () => {
    const row = JSON.parse(sql.split("$j$")[1]);
    expect(row).toMatchObject({ id: "game-chrono-billiards", kind: "embed", status: "published", badge: "New", path: "games/chrono-billiards.html", interactive: true, vocabWord: "angle", leadsTo: "act-marble-run" });
    expect(index).toContain('"game-chrono-billiards": { vocabWord:"angle"');
    expect(words).toContain("('game-chrono-billiards', ");
  });
  it("is in the window-fit check", () => {
    expect(index).toContain('["games/chrono-billiards.html",    "#play"]');
  });
  it("tells families it can be played with a friend online, and about the Hints switch", () => {
    const row = JSON.parse(sql.split("$j$")[1]);
    expect(row.players).toBe("1, or 2 online (share a code)");
    expect(row.rules.join(" ")).toContain("6-digit code");
    expect(row.rules.join(" ")).toContain("Turn Hints off");
    expect(index).toContain('players:"1, or 2 online (share a code)"');
  });
});

describe("the page", () => {
  it("uses the site's game skin and sounds, and no outside style kit", () => {
    expect(page).toContain('href="game-skin.css"');
    expect(page).toContain('src="game-sound.js"');
    expect(page).not.toContain("tailwindcss");
  });
  it("draws the angle and speed on the table itself, not in a panel", () => {
    expect(page).toContain("drawProtractor");
    expect(page).toContain("drawSpeed");
    expect(page).toContain("drawBounce");
    expect(page).not.toContain("telemetry");
  });
  it("has a Hints switch on the title screen and a Hints button while playing, and draws no guide when hints are off", () => {
    expect(page).toMatch(/id="hints-switch"[^>]*role="switch"|role="switch"[^>]*id="hints-switch"/);
    expect(page).toContain('id="hints-btn"');
    expect(page).toContain("if (hints && o.aim && o.aim.on) drawGuide(");
  });
  it("lets a friend join with a 6-digit code, and asks for nothing else: no names, no chat", () => {
    expect(page).toContain('data-mode="duo"');
    expect(page).toMatch(/<input[^>]*id="join-code"[^>]*inputmode="numeric"/);
    expect((page.match(/<input\b/g) || []).length).toBe(1);
    expect(page).not.toMatch(/<textarea/);
    expect(page).toContain("'chronobilliards-room-' + code");
  });
  it("shows how to play along the bottom and keeps emojis out", () => {
    expect(page).toContain('class="howto"');
    expect((page.match(/<li data-step="\d"/g) || []).length).toBe(3);
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
