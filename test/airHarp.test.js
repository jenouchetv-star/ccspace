// Air Harp (owner, 2026-11-19): kids pinch with both hands to stretch up to 8 strings, then strum them in the air.
// The longer the string, the lower the note, and every note snaps to a scale that always sounds good together.
// Strum speed sets how loud. Source: supabase/private-games/air-harp.html (a subscribers-only portal game).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../supabase/private-games/air-harp.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = html.split("/* AH:PURE */")[1].split("/* /AH:PURE */")[0];
const R = new Function(pure + "; return { MAX_STRINGS, SCALE, rawMidi, noteFor, noteName, loudness, crosses, nearestBall, minLen, isFling, colorFor, strumStep, sideDist, inSpan, matchHands, pinchesTouch };")();
const D = 1000;   /* a stage whose diagonal is 1000 px */

describe("the rules of the strings", () => {
  it("holds up to 8 strings", () => {
    expect(R.MAX_STRINGS).toBe(8);
  });
  it("uses a five-note scale (C D E G A) from C3 to C6, so any notes sound good together", () => {
    expect(R.SCALE[0]).toBe(48);
    expect(R.SCALE[R.SCALE.length - 1]).toBe(84);
    for (const m of R.SCALE) expect([0, 2, 4, 7, 9]).toContain(m % 12);
  });
  it("plays a lower note for a longer string, like a real one (an octave down for twice the length)", () => {
    expect(R.rawMidi(80, D)).toBeCloseTo(84);
    expect(R.rawMidi(160, D)).toBeCloseTo(72);
    expect(R.rawMidi(320, D)).toBeCloseTo(60);
  });
  it("snaps every length to a note in the scale, never lower for a shorter string", () => {
    let last = Infinity;
    for (let len = 40; len <= 1400; len += 7){
      const m = R.noteFor(len, D);
      expect(R.SCALE).toContain(m);
      expect(m).toBeLessThanOrEqual(last);
      last = m;
    }
    expect(R.noteFor(30, D)).toBe(84);     /* tiny: the highest note */
    expect(R.noteFor(5000, D)).toBe(48);   /* huge: the lowest note */
  });
  it("names notes the way a music class would", () => {
    expect(R.noteName(60)).toBe("C4");
    expect(R.noteName(57)).toBe("A3");
    expect(R.noteName(84)).toBe("C6");
  });
  it("keeps a string from shrinking to nothing", () => {
    expect(R.minLen(D)).toBe(60);
  });
});

describe("strumming", () => {
  it("is soft when slow and loud when fast, never silent and never past full", () => {
    expect(R.loudness(0, D)).toBeCloseTo(0.12);
    expect(R.loudness(250, D)).toBeCloseTo(0.12);
    expect(R.loudness(3000, D)).toBeCloseTo(1);
    expect(R.loudness(99999, D)).toBe(1);
    let last = 0;
    for (let v = 0; v <= 4000; v += 100){ const l = R.loudness(v, D); expect(l).toBeGreaterThanOrEqual(last); last = l; }
  });
  it("plucks when the fingertip's path crosses the string, and not when it only gets close", () => {
    const a = { x:0, y:0 }, b = { x:100, y:0 };
    expect(R.crosses({ x:50, y:-10 }, { x:50, y:10 }, a, b)).toBe(true);
    expect(R.crosses({ x:50, y:-10 }, { x:50, y:-1 }, a, b)).toBe(false);
    expect(R.crosses({ x:150, y:-10 }, { x:150, y:10 }, a, b)).toBe(false);   /* past the end ball */
    expect(R.crosses({ x:10, y:5 }, { x:90, y:5 }, a, b)).toBe(false);        /* sliding alongside */
  });
});

describe("making a string with two hands (owner, 2026-11-19)", () => {
  it("starts only when the two pinches touch, not when they pinch apart", () => {
    expect(R.pinchesTouch({ x:500, y:300 }, { x:530, y:310 }, D)).toBe(true);
    expect(R.pinchesTouch({ x:500, y:300 }, { x:544, y:300 }, D)).toBe(true);
    expect(R.pinchesTouch({ x:200, y:300 }, { x:700, y:300 }, D)).toBe(false);
    expect(R.pinchesTouch({ x:500, y:300 }, { x:560, y:300 }, D)).toBe(false);
  });
  it("only stretches a new string from two pinches that touched first", () => {
    const pair = html.split("function pairPinch(now){")[1].split("\n  }\n")[0];
    expect(pair).toContain("if (!pinchesTouch(A.pin, B.pin, DIAG))");
    expect(html).toContain('does:"Pinch with both hands, touch the pinches together, then pull apart to stretch a new string"');
  });
});

describe("a camera fingertip (it shakes a little even when still)", () => {
  it("plucks once when it goes clearly past the string, and not while it rests on it", () => {
    let side = 0, plucks = 0;
    const step = d => { const r = R.strumStep(side, d, 8); side = r.side; if (r.pluck) plucks++; };
    step(-20);                                   /* one side of the string */
    for (const d of [-3, 4, -5, 6, -2, 5]) step(d);   /* resting on it: tiny shakes across */
    expect(plucks).toBe(0);
    step(20); expect(plucks).toBe(1);            /* a real pass */
    step(25); expect(plucks).toBe(1);
    step(-30); expect(plucks).toBe(2);           /* and back again */
  });
  it("measures which side of the string a point is on, and whether it is between the balls", () => {
    const a = { x:0, y:0 }, b = { x:100, y:0 };
    expect(Math.sign(R.sideDist({ x:50, y:10 }, a, b))).toBe(-Math.sign(R.sideDist({ x:50, y:-10 }, a, b)));
    expect(Math.abs(R.sideDist({ x:50, y:10 }, a, b))).toBeCloseTo(10);
    expect(R.inSpan({ x:50, y:30 }, a, b)).toBe(true);
    expect(R.inSpan({ x:130, y:0 }, a, b)).toBe(false);
  });
});

describe("telling the two hands apart", () => {
  it("keeps each hand's identity by where it was, even when the AI lists them in the other order", () => {
    const prev = [{ key:"h1", x:100, y:200 }, { key:"h2", x:600, y:220 }];
    expect(R.matchHands(prev, [{ x:610, y:225 }, { x:95, y:205 }], 250)).toEqual(["h2", "h1"]);
  });
  it("treats a hand far from any it knew as a new hand", () => {
    const prev = [{ key:"h1", x:100, y:200 }];
    expect(R.matchHands(prev, [{ x:110, y:190 }, { x:700, y:300 }], 250)).toEqual(["h1", null]);
    expect(R.matchHands([], [{ x:1, y:1 }], 250)).toEqual([null]);
  });
});

describe("grabbing and throwing away", () => {
  const strings = [{ a:{ x:0, y:0 }, b:{ x:200, y:0 } }, { a:{ x:0, y:100 }, b:{ x:200, y:100 } }];
  it("grabs the nearest ball within reach, and nothing when no ball is near", () => {
    expect(R.nearestBall(strings, 195, 4, 30)).toEqual({ i:0, end:"b" });
    expect(R.nearestBall(strings, 8, 92, 30)).toEqual({ i:1, end:"a" });
    expect(R.nearestBall(strings, 100, 50, 30)).toBe(null);
  });
  it("counts a quick throw as removing the string, and a gentle let-go as keeping it", () => {
    expect(R.isFling(2600, 0, D)).toBe(true);
    expect(R.isFling(0, -2500, D)).toBe(true);
    expect(R.isFling(600, 600, D)).toBe(false);
  });
});

describe("the page", () => {
  it("opens on the logo loading screen with the game's name", () => {
    expect(html).toContain('<div id="ccsLoad" role="status" aria-live="polite" data-name="Air Harp">');
  });
  it("follows both hands, through the site's camera relay, and never draws the video", () => {
    expect(html).toContain("maxNumHands:2");
    expect(html).toContain('window.parent.postMessage({ ccsCamera:"start" }, "*");');
    expect(html.match(/drawImage/g)).toHaveLength(1);                 /* only into the AI's own hidden canvas */
    expect(html).toContain("c.getContext(\"2d\").drawImage(bmp, 0, 0);");
  });
  it("carries the four harp recordings inside the file, and a guitar made in code", () => {
    const samples = JSON.parse(html.split("/*HARP:*/")[1].split("/*:HARP*/")[0]);
    expect(Object.keys(samples).sort()).toEqual(["40", "56", "71", "87"]);
    for (const b64 of Object.values(samples)) expect(b64.length).toBeGreaterThan(50000);
    expect(html).toContain("function guitarBuffer(midi, bright){");
    expect(html).toContain('id="snd-harp"');
    expect(html).toContain('id="snd-guitar"');
  });
  it("shows how many of the 8 strings are used, and lists the four gestures", () => {
    expect(html).toContain('<b id="count-n">0</b> / 8 strings');
    for (const k of ["Make", "Move", "Play", "Remove"]) expect(html).toContain('kind:"' + k + '"');
  });
  it("lets a hand that leaves the picture just let go, never throw a string away", () => {
    expect(html).toContain('if (h.mode === "grab") releaseGrab(k, false);');
  });
  it("keeps a long-enough string when one hand leaves the picture while stretching it", () => {
    const lost = html.split("function handLost(k){")[1].split("\n  }\n")[0];
    expect(lost).toContain("finishDraft();");
  });
  it("ignores a last picture from the AI that arrives after the camera was turned off", () => {
    expect(html).toContain('function onResults(res){\n    if (!running || state.mode !== "camera") return;');
  });
  it("starts sound only after the player clicks, taps or turns the camera on", () => {
    expect(html).not.toMatch(/\n\s*audio\(\);\s*\n\s*\}\)\(\);/);
    expect(html).toContain('$("start-mouse").addEventListener("click", function(){ audio(); useMouse(); });');
  });
  it("has no emojis", () => {
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe("on the Digital Activities page (owner, 2026-11-20: moved there from the Play page)", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const fn = (name) => index.split("function " + name + "(")[1].split("\nfunction ")[0];
  it("a subscribers-only Computer activity is a portal game: its card says play, not lesson", () => {
    const card = fn("membersActivityCard");
    expect(card).toContain('const game = a.type === "computer";');
    expect(card).toContain("Join our mailing list to play this game and other exclusive content.");
    expect(card).toContain("(game ? ' Play the game' : ' Open the lesson')");
    expect(card).toContain("(game ? ' Join free to play' : ' Join free to see it')");
    /* the join box speaks of playing a game unless it is told this is a lesson */
    expect(card).toContain(`'" data-game="' + E(a.title) + '"' + (game ? "" : ' data-what="lesson"')`);
  });
  it("a shared link to it shows the game's poster, where a subscriber plays it right there", () => {
    expect(fn("viewActivity")).toContain('membersPoster({ title: a.title, portalSlug: a.portalSlug, cover: a.image, p1: typeMeta(a.type).p1, p2: typeMeta(a.type).p2 }, a.type === "computer" ? "game" : "lesson")');
  });
  it("the activity editor can point a card at a portal game as well as a lesson", () => {
    expect(index).toContain('{ key:"portalSlug", label:"Subscriber’s Portal lesson or game", type:"select", wide:true, options:() => [{ value:"", label:"Choose a portal entry..." }].concat(db.list("portalEntries").filter(e => e.layout === "lesson" || e.layout === "game" || String(e.aiPrompt || "").trim())');
  });
});

describe("colors", () => {
  it("gives low notes warm colors and high notes cool ones, as the draft shows", () => {
    expect(R.colorFor(48)).toBe("#F472B6");
    expect(R.colorFor(84)).toBe("#A78BFA");
  });
});
