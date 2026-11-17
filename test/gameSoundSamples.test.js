// The shared game sound kit can play real recordings (owner, 2026-11-16: "Use Freesound to add sound effects ... for an immersive feel").
// A game hands CCSSound a list of recordings; play() uses the recording once it's loaded, and the kit's own made-in-code sound until then.
// loop() gives a sound that keeps going (a rover's motor, a drill) whose volume and speed a game can change every frame.
// Everything still obeys the one sound on/off button.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../games/game-sound.js", import.meta.url), "utf8");

/* a tiny pretend browser: enough Web Audio to see what the kit asks for */
function fakeWorld({ soundOff = false } = {}){
  const log = [];
  const param = (name) => ({ value: 1, setValueAtTime(v, t){ log.push([name, "set", v, t]); this.value = v; }, linearRampToValueAtTime(v, t){ log.push([name, "ramp", v, t]); this.value = v; }, exponentialRampToValueAtTime(v, t){ log.push([name, "exp", v, t]); }, setTargetAtTime(v, t, k){ log.push([name, "target", v]); this.value = v; } });
  const node = (kind) => ({ kind, connect(){}, disconnect(){} });
  class Ctx {
    constructor(){ this.currentTime = 10; this.state = "running"; this.sampleRate = 44100; this.destination = node("dest"); }
    resume(){}
    createGain(){ const n = node("gain"); n.gain = param("gain"); return n; }
    createDynamicsCompressor(){ const n = node("comp"); n.threshold = param("th"); n.ratio = param("ratio"); return n; }
    createOscillator(){ const n = node("osc"); n.frequency = param("freq"); n.start = () => log.push(["osc"]); n.stop = () => {}; return n; }
    createBiquadFilter(){ const n = node("filter"); n.frequency = param("ffreq"); return n; }
    createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource(){ const n = node("src"); n.playbackRate = param("rate"); n.start = (t, off, dur) => log.push(["start", t, off, dur, n.buffer && n.buffer.name, n.loop, n.loopStart, n.loopEnd]); n.stop = (t) => log.push(["stop", t]); return n; }
    decodeAudioData(bytes){ return Promise.resolve({ name: bytes.name, duration: 5 }); }
  }
  const listeners = {};
  const win = {
    AudioContext: Ctx, performance: { now: () => Date.now() },
    addEventListener(t, f){ (listeners[t] = listeners[t] || []).push(f); },
    fetch: (url) => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: url, slice(){ return this; } }) }),
  };
  const store = { getItem: () => soundOff ? "off" : null, setItem(){} };
  const doc = { createElement: () => ({ style: {}, dataset: {}, addEventListener(){}, setAttribute(){}, appendChild(){} }), head: { appendChild(){} }, currentScript: { src: "https://example.org/games/game-sound.js" } };
  new Function("window", "localStorage", "document", "fetch", src)(win, store, doc, win.fetch);
  const unlock = () => (listeners.pointerdown || []).forEach(f => f());
  return { S: win.CCSSound, log, unlock };
}
const flush = () => new Promise(r => setTimeout(r, 0));

describe("recorded sounds in the shared kit", () => {
  it("plays a game's recording, trimmed and at its own volume, once it has loaded", async () => {
    const { S, log, unlock } = fakeWorld();
    S.samples({ laser: { src: "/assets/games/sfx/laser.mp3", start: 0.1, end: 0.9, volume: 0.5 } });
    unlock(); await flush(); await flush();
    S.play("laser");
    const st = log.find(l => l[0] === "start");
    expect(st[4]).toBe("/assets/games/sfx/laser.mp3");
    expect(st[2]).toBeCloseTo(0.1);
    expect(st[3]).toBeCloseTo(0.8);
    expect(log.some(l => l[0] === "gain" && l[2] === 0.5)).toBe(true);
    expect(log.some(l => l[0] === "osc")).toBe(false);             // the recording, not the made-in-code laser
  });
  it("uses the made-in-code sound until the recording is ready", () => {
    const { S, log, unlock } = fakeWorld();
    S.samples({ laser: { src: "/x/laser.mp3" } });
    unlock();
    S.play("laser");
    expect(log.some(l => l[0] === "osc")).toBe(true);
  });
  it("keeps a looping sound going, and lets the game set its volume and speed each frame", async () => {
    const { S, log, unlock } = fakeWorld();
    S.samples({ motor: { src: "/x/motor.mp3", start: 1, end: 3, volume: 0.6, loop: true } });
    unlock(); await flush(); await flush();
    const m = S.loop("motor");
    m.set(0.5, 1.2);
    const st = log.find(l => l[0] === "start");
    expect(st[5]).toBe(true);                                         // looping
    expect([st[6], st[7]]).toEqual([1, 3]);                           // between start and end
    expect(log.some(l => l[0] === "gain" && l[1] === "target" && Math.abs(l[2] - 0.3) < 1e-9)).toBe(true);   // 0.5 of its 0.6 volume
    expect(log.some(l => l[0] === "rate" && l[1] === "target" && l[2] === 1.2)).toBe(true);
    m.stop();
    expect(log.some(l => l[0] === "stop")).toBe(true);
  });
  it("stays silent when the player turned sound off", async () => {
    const { S, log, unlock } = fakeWorld({ soundOff: true });
    S.samples({ laser: { src: "/x/laser.mp3" }, motor: { src: "/x/motor.mp3", loop: true } });
    unlock(); await flush(); await flush();
    S.play("laser");
    const m = S.loop("motor"); m.set(1, 1);
    expect(log.filter(l => l[0] === "start" || l[0] === "osc").length).toBe(0);
  });
  it("does nothing, and never throws, for a sound it doesn't know", () => {
    const { S, unlock } = fakeWorld();
    unlock();
    expect(() => S.play("nope")).not.toThrow();
    const m = S.loop("nope");
    expect(() => { m.set(1, 1); m.stop(); }).not.toThrow();
  });
});
