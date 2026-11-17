// Remote Lunar Salvage: real sound effects (owner, 2026-11-16: "Use Freesound to add sound effects ... for an immersive feel").
// The owner picked each recording by ear from docs/mockups/lunar-sounds (free CC0 sounds); they are trimmed into assets/games/lunar-salvage/sfx.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8");
const credits = readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8");
const reg = game.split("CCSSound.samples({")[1].split("});")[0];
const fileOf = (name) => (reg.match(new RegExp("\\b" + name + ":\\s*\\{\\s*src:\\s*SFX_DIR \\+ \"([a-z0-9-]+\\.mp3)\"")) || [])[1];
const body = (fn) => game.split("function " + fn + "(")[1].split("\n}\n")[0];

const PICKS = { rocketLand: "rocket-land.mp3", rocketLaunch: "rocket-launch.mp3", doorOpen: "door-open.mp3", doorClose: "door-close.mp3", rampDown: "ramp-down.mp3",
  drillStart: "drill-start.mp3", drillLoop: "drill-loop.mp3", hoseLoop: "hose-loop.mp3", rocksBurst: "rocks-burst.mp3", rockCrack: "rock-crack.mp3",
  magnetHum: "magnet-hum.mp3", powerUp: "power-up.mp3", arm1: "arm-1.mp3", arm2: "arm-2.mp3", countdown: "countdown.mp3",
  laserLoop: "laser-loop.mp3", roverLoop: "rover-loop.mp3", windGust: "wind-gust.mp3", clunk: "clunk.mp3" };

describe("the game still runs", () => {
  it("its main script parses (a repeated name once stopped the whole game)", () => {
    const scripts = [...game.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(t => t.includes("function stepSfx("));
    expect(scripts.length).toBe(1);
    expect(() => new Function(scripts[0])).not.toThrow();      // parsed only, never run
  });
});

describe("the game's recorded sounds", () => {
  it("loads every sound the owner picked, from small files kept with the game", () => {
    expect(game).toContain('const SFX_DIR = "/assets/games/lunar-salvage/sfx/";');
    for (const [name, file] of Object.entries(PICKS)){
      expect(fileOf(name)).toBe(file);
      const size = statSync(new URL("../assets/games/lunar-salvage/sfx/" + file, import.meta.url)).size;
      expect(size).toBeGreaterThan(5000);
      expect(size).toBeLessThan(250000);
    }
  });
  it("lists where every sound came from", () => {
    for (const file of Object.values(PICKS)) expect(credits).toContain("assets/games/lunar-salvage/sfx/" + file);
  });
  it("marks the drill, hose and magnet as loops", () => {
    for (const n of ["drillLoop", "hoseLoop", "magnetHum", "laserLoop", "roverLoop"]) expect(reg).toMatch(new RegExp(n + ":\\s*\\{[^}]*loop: true"));
  });
});

describe("when each sound plays", () => {
  it("the rocket's thrusters roar as it lands, then its door opens", () => {
    const show = body("stepRocketShow");
    expect(show).toContain('sfx("rocketLand")');
    expect(show).toContain('sfx("doorOpen")');
  });
  it("the door closes behind the rover when it boards", () => {
    expect(body("stepBoarding")).toContain('sfx("doorClose")');
  });
  it("the countdown beeps, and lift-off roars", () => {
    const show = body("stepRocketShow");
    expect(show).toMatch(/flash\(String\(n\)\); sfx\("countdown"\)/);
    expect(show).toContain('sfx("rocketLaunch")');
  });
  it("the bridge comes down with its own sound when the lever is pulled", () => {
    expect(body("stepLever")).toContain('sfx("rampDown")');
  });
  it("the laser cracks a boulder, and the meteor strike bursts rocks", () => {
    expect(body("breakBoulder")).toContain('sfx("rockCrack")');
    expect(game).toMatch(/emberAfterStrike\(\); sfx\("rocksBurst"\)/);
  });
  it("the drill spins up when it starts", () => {
    expect(game).toMatch(/G\.drilling = on;[^\n]*if \(on\) sfx\("drillStart"\)/);
  });
  it("power comes back on with a power-up sound", () => {
    expect(body("gustoPowerUp")).toContain('sfx("powerUp")');
    expect(game).toMatch(/G\.flags\.lit = true; sfx\("powerUp"\)/);
  });
});

describe("round two: grab, set down and wind", () => {
  it("a part clangs when the arm or magnet grabs it, and when it lands", () => {
    expect(game).toMatch(/hold\(c\);\s*sfx\("clunk"\);/);
    expect(game).toMatch(/G\.held\.push\(p\); load \+= PART_TYPES\[p\.type\]\.kg;\s*sfx\("clunk"/);
    expect(game).toMatch(/sfx\("clunk", \{ volume: Math\.min\(1, impact \/ 2\.5\) \}\)/);
  });
  it("a gust of wind blows each time Gusto Canyon's wind picks up", () => {
    expect(body("stepGusto")).toMatch(/if \(gust > 0\.05 && !GUSTO\.gusting\)\{ GUSTO\.gusting = true; sfx\("windGust"\); \}/);
  });
});

describe("the sounds that keep going", () => {
  const step = body("stepSfx");
  it("the drill, hose and magnet hum only while they're in use, and stop when the game is paused", () => {
    expect(step).toContain('loopSfx("drill", live && G.drilling ? 1 : 0)');
    expect(step).toContain('loopSfx("hose", live && hose.spraying ? 1 : 0)');
    expect(step).toContain('loopSfx("magnet", live && G.magOn ? 1 : 0)');
    expect(step).toContain("const live = G.started && !G.paused && !G.landing && !FL.on");
  });
  it("the laser hums while it fires, instead of the old beep", () => {
    expect(step).toContain('loopSfx("laser", live && laser.firing ? 1 : 0)');
    expect(game).not.toMatch(/if \(laser\.firing\) sfx\("laser"/);
  });
  it("the rover's motor gets louder and higher the faster it drives, and it purrs as it rolls in and out of the rocket", () => {
    expect(step).toContain("Math.min(1, Math.abs(rover.v) / ROVER.maxF)");
    expect(step).toMatch(/loopSfx\("rover", speed > 0\.02 \? 0\.35 \+ speed \* 0\.65 : 0, 0\.85 \+ speed \* 0\.4\)/);
    expect(step).toContain("G.boarding || (G.landing && R.group.visible)");
  });
  it("the arm's motors whir when it starts to move, taking turns between two recordings", () => {
    expect(step).toMatch(/sfx\(SFXS\.armNext = SFXS\.armNext === "arm1" \? "arm2" : "arm1"\)/);
  });
  it("runs every frame, during the landing and the flight too", () => {
    const frame = game.split("function frame(now){")[1].split("\n}\n")[0];
    expect(frame.indexOf("stepSfx(dt)")).toBeGreaterThan(-1);
    expect(frame.indexOf("stepSfx(dt)")).toBeLessThan(frame.indexOf("if (G.landing || FL.on)"));
  });
});
