// Volume control for every game with music or sound (owner, 2026-11-17: "Add volume control to the music and remember
// the users preference", then "Do this for all games with background music or sound"; draft docs/mockups/music-volume-draft.html).
// The shared sound kit has two levels, music and game sounds, set with a volume button beside the sound button and
// remembered for every game on the device. Sealed private games keep it through the site page.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../games/game-sound.js", import.meta.url), "utf8");

function fakeWorld({ saved = null, sealed = false, framed = false } = {}){
  const log = [], posted = [], stored = {};
  if (saved) stored["ccs-game-save:volume"] = JSON.stringify(saved);
  const param = (name, v) => ({ value: v == null ? 1 : v, setValueAtTime(x){ this.value = x; }, linearRampToValueAtTime(x){ this.value = x; }, exponentialRampToValueAtTime(){}, setTargetAtTime(x){ log.push([name, x]); this.value = x; } });
  let n = 0;
  const node = (kind) => { const o = { kind, id: kind + (n++), to: [], connect(t){ o.to.push(t); }, disconnect(){} }; return o; };
  const gains = [];
  class Ctx {
    constructor(){ this.currentTime = 1; this.state = "running"; this.sampleRate = 44100; this.destination = node("dest"); }
    resume(){}
    createGain(){ const g = node("gain"); g.gain = param("gain"); gains.push(g); return g; }
    createDynamicsCompressor(){ const c = node("comp"); c.threshold = param("th"); c.ratio = param("r"); return c; }
    createOscillator(){ const o = node("osc"); o.frequency = param("f"); o.start = () => {}; o.stop = () => {}; return o; }
    createBiquadFilter(){ const f = node("filter"); f.frequency = param("ff"); return f; }
    createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource(){ const s = node("src"); s.playbackRate = param("rate"); s.start = () => {}; s.stop = () => {}; return s; }
    decodeAudioData(b){ return Promise.resolve({ name: b.name, duration: 5 }); }
  }
  const listeners = {};
  const parent = { postMessage(m){ posted.push(m); } };
  const win = {
    AudioContext: Ctx, performance: { now: () => Date.now() },
    addEventListener(t, f){ (listeners[t] = listeners[t] || []).push(f); },
    fetch: (url) => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: url, slice(){ return this; } }) }),
  };
  win.parent = framed ? parent : win;
  const store = sealed
    ? { getItem(){ throw new Error("SecurityError"); }, setItem(){ throw new Error("SecurityError"); } }
    : { getItem: (k) => (k in stored ? stored[k] : null), setItem: (k, v) => { stored[k] = v; } };
  const doc = { createElement: () => ({ style: {}, dataset: {}, addEventListener(){}, setAttribute(){}, appendChild(){} }), head: { appendChild(){} } };
  new Function("window", "localStorage", "document", "fetch", src)(win, store, doc, win.fetch);
  const unlock = () => (listeners.pointerdown || []).forEach(f => f());
  const fire = (t, e) => (listeners[t] || []).forEach(f => f(e));
  return { S: win.CCSSound, log, posted, stored, unlock, fire, gains };
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

describe("the volume levels", () => {
  it("start full, and remember what the player chose for every game on this device", async () => {
    const w = fakeWorld();
    expect(w.S.volume("music")).toBe(1);
    expect(w.S.volume("sfx")).toBe(1);
    w.S.setVolume("music", 0.4);
    w.S.setVolume("sfx", 2);                        /* kept between 0 and 1 */
    await wait(300);
    expect(JSON.parse(w.stored["ccs-game-save:volume"])).toEqual({ music: 0.4, sfx: 1 });
    const again = fakeWorld({ saved: { music: 0.4, sfx: 0.7 } });
    expect(again.S.volume("music")).toBe(0.4);
    expect(again.S.volume("sfx")).toBe(0.7);
  });
  it("a sealed private game asks the site page for the setting and saves it there", async () => {
    const w = fakeWorld({ sealed: true, framed: true });
    expect(w.posted[0]).toEqual({ ccsSave: "get", game: "volume" });
    w.fire("message", { data: { ccsSave: "data", game: "volume", data: { music: 0.25, sfx: 0.5 } } });
    expect(w.S.volume("music")).toBe(0.25);
    w.S.setVolume("sfx", 0.8);
    await wait(300);
    expect(w.posted.at(-1)).toEqual({ ccsSave: "set", game: "volume", data: { music: 0.25, sfx: 0.8 } });
  });
  it("music recordings follow the music level, and every other sound follows the game sounds level", async () => {
    const w = fakeWorld({ saved: { music: 0.3, sfx: 0.6 } });
    w.S.samples({ song: { src: "/m.mp3", loop: true, music: true }, motor: { src: "/e.mp3", loop: true } });
    w.unlock(); await wait(0); await wait(0);
    const [master, sfxBus, musicBus] = w.gains;
    expect(sfxBus.gain.value).toBe(0.6);
    expect(musicBus.gain.value).toBe(0.3);
    expect(sfxBus.to[0]).toBe(master);
    w.S.loop("song").set(1); w.S.loop("motor").set(1);
    const loops = w.gains.slice(3);
    expect(loops[0].to[0]).toBe(musicBus);
    expect(loops[1].to[0]).toBe(sfxBus);
    w.S.setVolume("music", 0.9);
    expect(musicBus.gain.value).toBe(0.9);
  });
  it("tells a game that makes its own sounds, now and whenever the player changes it", () => {
    const w = fakeWorld({ saved: { music: 0.5, sfx: 1 } });
    const heard = [];
    w.S.onVolume(v => heard.push(v.music));
    w.S.setVolume("music", 0.2);
    expect(heard).toEqual([0.5, 0.2]);
  });
  it("a recording marked as music adds a Music slider to the panel", () => {
    const btn = src.split("function togglePanel(b){")[1];
    expect(btn).toContain('var rows = (hasMusicFlag ? [["music", "Music"]] : []).concat([["sfx", hasMusicFlag ? "Game sounds" : "Sound volume"]]);');
    expect(src).toContain("if (s.music) hasMusic(true);");
  });
  it("the volume button appears beside every kit sound button, and the panel's keys never move the game", () => {
    expect(src).toContain("if (opts.mixer !== false){");
    expect(src).toContain("b.parentNode.insertBefore(m, b)");
    expect(src).toContain("if (panel.contains(document.activeElement)) e.stopPropagation();");
    expect(src).toContain('note.textContent = "Remembered for every game on this device.";');
  });
});
