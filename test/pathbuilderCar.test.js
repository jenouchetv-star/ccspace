// Pathbuilder's car sounds like a car (owner, 2026-11-16: "Use sound effects for the car driving in the Pathfinder game"):
// a motor that hums while your car drives (a little higher as it speeds up), a cartoon drive-off as it sets out, and a
// toy-car beep beep when it gets home. Pixabay: "Motor Loop 2", "Cartoon drive car game sound", "Bobby-Car Hooting".
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../games/pathbuilder.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("Pathbuilder car sounds", () => {
  it("has the three car sounds, credited", () => {
    for (const f of ["motor-loop.mp3", "drive-off.mp3", "honk.mp3"]) expect(statSync(new URL("../assets/games/pathbuilder/sfx/" + f, import.meta.url)).size).toBeGreaterThan(5000);
    const credits = readFileSync(new URL("../docs/image-credits.md", import.meta.url), "utf8");
    for (const id of ["103532", "38094", "31906"]) expect(credits).toContain(id);
  });
  it("hums while your own car drives, and is quiet when it stops", () => {
    expect(game).toContain("const ENGINE = window.CCSSound ? CCSSound.loop('motor') : null;");
    expect(game).toContain("if (ENGINE){ const mine = players[me] && players[me].anim; ENGINE.set(mine ? 0.45 : 0, mine ? 0.95 + Math.min(0.25, (players[me].speedNow || 0) * 0.1) : 1); }");
  });
  it("drives off with a cartoon vroom and beeps twice on arriving home", () => {
    expect(game.split("function startDrive(p, path){")[1].split("\n}\n")[0]).toContain('sfx("driveOff", { volume: p.id === me ? 0.35 : 0.15 });');
    const a = game.split("function arrive(p){")[1].split("\n}\n")[0];
    expect(a).toContain('sfx("honk", { volume: 0.8 }); setTimeout(() => sfx("honk", { volume: 0.8, pitch: 1.05 }), 230);');
  });
});
