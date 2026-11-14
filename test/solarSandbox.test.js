import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/* subscribers only: the code lives in the Subscriber's Portal (portal_game_files pg-solar-system-sandbox), never on the public site */
const html = readFileSync(new URL("../supabase/private-games/solar-system-sandbox.html", import.meta.url), "utf8");
const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* the game's small pure helpers and its fact sheet, run on their own */
const helpers = html.slice(html.indexOf("/* ---------- small pure helpers"), html.indexOf("/* ---------- scene"));
const H = new Function(helpers + "\nreturn { orbitXZ, periodFor, yearText, milesText, weighLb, clampOrbit, padDead, cutawayYaw, INFO };")();

describe("Solar System Sandbox: the physics and numbers", () => {
  it("sends planets counter-clockwise seen from above, as the real ones go", () => {
    /* three.js: +x is right and -z is up the screen when looking down from above */
    const [x0, z0] = H.orbitXZ(10, 0), [x1, z1] = H.orbitXZ(10, 0.1);
    const a0 = Math.atan2(-z0, x0), a1 = Math.atan2(-z1, x1);
    expect(a1).toBeGreaterThan(a0);
    expect(H.orbitXZ(10, Math.PI / 2)[1]).toBeCloseTo(-10);
  });
  it("lengthens the year by Kepler's third law when a planet moves out", () => {
    expect(H.periodFor(365, 28, 28)).toBeCloseTo(365);
    expect(H.periodFor(365, 28, 112)).toBeCloseTo(365 * 8);          /* 4x farther, 8x longer */
    expect(H.periodFor(687, 35, 17.5)).toBeCloseTo(687 / Math.pow(2, 1.5));
  });
  it("writes years and distances the way a kid reads them", () => {
    expect(H.yearText(88)).toBe("88 days");
    expect(H.yearText(687)).toBe("687 days");
    expect(H.yearText(819)).toBe("2.2 years");
    expect(H.yearText(4333)).toBe("12 years");
    expect(H.yearText(60190)).toBe("165 years");
    expect(H.milesText(93)).toBe("93 million mi");
    expect(H.milesText(1784)).toBe("1.8 billion mi");
    expect(H.weighLb(0.38)).toBe(23);
    expect(H.weighLb(2.53)).toBe(152);
  });
  it("keeps a moved planet between the Sun and the edge, and ignores a resting stick", () => {
    expect(H.clampOrbit(3, 12, 122)).toBe(12);
    expect(H.clampOrbit(500, 12, 122)).toBe(122);
    expect(H.padDead(0.1, 0.18)).toBe(0);
    expect(H.padDead(1, 0.18)).toBeCloseTo(1);
    expect(H.padDead(-0.59, 0.18)).toBeCloseTo(-0.5);
  });
  it("turns the cutaway's open quarter toward the camera from any side", () => {
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [3, -4]]){
      const t = H.cutawayYaw(dx, dz), x = -1, z = 1;                  /* the open quarter points along (-1, 0, 1) */
      const rx = x * Math.cos(t) + z * Math.sin(t), rz = -x * Math.sin(t) + z * Math.cos(t);
      const len = Math.hypot(dx, dz);
      expect(rx / Math.SQRT2).toBeCloseTo(dx / len);
      expect(rz / Math.SQRT2).toBeCloseTo(dz / len);
    }
  });
});

describe("Solar System Sandbox: the belts", () => {
  /* each planet's orbit (a) and drawn size (r), and each belt's inner and outer edge, read from the game */
  const planets = Object.fromEntries([...html.matchAll(/\{ id: "(\w+)",\s+name: "\w+",\s+r: ([\d.]+),\s+a: ([\d.]+),/g)].map(m => [m[1], { r: +m[2], a: +m[3] }]));
  const belts = [...html.matchAll(/makeBelt\(\d+, ([\d.]+), ([\d.]+),/g)].map(m => [+m[1], +m[2]]);
  it("puts the asteroid belt between Mars and Jupiter, clear of both planets as they are drawn", () => {
    const [lo, hi] = belts[0], mars = planets.mars, jup = planets.jupiter;
    expect(lo).toBeGreaterThan(mars.a + mars.r + 2);
    expect(hi).toBeLessThan(jup.a - jup.r - 2);
  });
  it("puts the Kuiper belt past Neptune", () => {
    const [lo] = belts[1], nep = planets.neptune;
    expect(lo).toBeGreaterThan(nep.a + nep.r + 2);
  });
});

describe("Solar System Sandbox: the cards", () => {
  const ids = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
  it("has a card, a weight and inside layers for the Sun and every planet", () => {
    expect(Object.keys(H.INFO)).toEqual(ids);
    for (const id of ids){
      const d = H.INFO[id];
      expect(d.kind).toBeTruthy(); expect(d.about).toBeTruthy(); expect(d.g).toBeGreaterThan(0);
      expect(d.layers.length).toBeGreaterThanOrEqual(3);
      expect(d.layers[0][2]).toBe(1);                                  /* outermost layer is the surface */
      d.layers.forEach((L, i) => { if (i) expect(L[2]).toBeLessThan(d.layers[i - 1][2]); });
      if (id !== "sun"){ expect(d.moons).toBeTruthy(); expect(d.size).toBeTruthy(); expect(d.miles).toBeGreaterThan(0); }
    }
  });
  it("uses no emojis and none of the old jargon", () => {
    expect(/\p{Extended_Pictographic}/u.test(html)).toBe(false);
    for (const w of ["Engine Console", "Warp Orbits", "Gravitational dilution", "m/s²", "km/s", "Spacetime Sandbox"]) expect(html).not.toContain(w);
  });
});

describe("Solar System Sandbox: the page", () => {
  it("loads only three.js, its orbit controls and the shared sound kit (no Tailwind or MathJax)", () => {
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    expect(srcs).toEqual([
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
      "/games/game-sound.js"
    ]);
  });
  it("is subscribers only: no public copy, the Play card leads to the portal, and site files load from root paths inside the sealed frame", () => {
    expect(existsSync(new URL("../games/spacetime-sandbox-simulator.html", import.meta.url))).toBe(false);
    const start = site.indexOf('G({ id:"game-spacetime"'), row = site.slice(start, site.indexOf('leadsTo:', start));
    expect(row).toContain('kind:"members"');
    expect(row).toContain('portalSlug:"solar-system-sandbox"');
    expect(row).toContain('path:""');
    expect(html).toContain('const TEX = "/assets/games/solar-system/";');
  });
  it("uses NASA maps that are really in the site's assets folder", () => {
    const names = [...new Set([...html.matchAll(/tex\("([a-z-]+\.jpg)"\)/g)].map(m => m[1]))];
    expect(names.sort()).toEqual(["earth.jpg", "jupiter.jpg", "mars.jpg", "mercury.jpg", "milky-way.jpg", "moon.jpg", "neptune.jpg", "saturn.jpg"]);
    for (const n of names) expect(existsSync(new URL("../assets/games/solar-system/" + n, import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/solar-system/SOURCES.md", import.meta.url))).toBe(true);
  });
  it("can be played with a controller and a keyboard", () => {
    expect(html).toContain("function pollPad(dt)");
    expect(html).toContain("pollPad(real);");
    expect(html).toContain('addEventListener("keydown"');
  });
  it("tells players about the new controls on the Play page", () => {
    const start = site.indexOf('G({ id:"game-spacetime"'), row = site.slice(start, site.indexOf('leadsTo:"act-orrery"', start));
    expect(row).toContain("Press Move on a planet's card");
    expect(row).toContain("Press See inside");
    expect(site).not.toContain("Warp Orbits");
  });
});
