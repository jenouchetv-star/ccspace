import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

const SS = loadSS("model.js", "engine.js", "wav.js");

describe("Sound Space engine", () => {
  it("8 counts at 100 are 4.8 seconds", () => {
    expect(SS.engine.stepSeconds(100) * 16).toBeCloseTo(4.8, 10);
  });

  it("mute and solo decide which tracks play", () => {
    const song = SS.model.newSong();
    const ids = ["a", "b", "c"].map((n) => {
      const t = SS.model.addTrack(song, "piano");
      SS.model.toggleNote(t, 0, 60, 1);
      return t;
    });
    const [A, B] = ids;
    A.mute = true;
    let ev = SS.engine.compileEvents(song, 0, 4);
    expect(ev.some((e) => e.trackId === A.id)).toBe(false);
    expect(ev.length).toBe(2);
    A.mute = false;
    B.solo = true;
    ev = SS.engine.compileEvents(song, 0, 4);
    expect(ev.length).toBe(1);
    expect(ev[0].trackId).toBe(B.id);
    expect(ev[0].gain).toBeCloseTo(B.volume * song.volume * 1, 10);
  });

  it("a hidden tab never plays a burst of missed notes", () => {
    const r = SS.engine.stepsToSchedule(1.0, 3.0, 0.1, 0.3);
    expect(r.skipped).toBeGreaterThanOrEqual(6);
    expect(r.steps).toBeLessThanOrEqual(1);
  });

  it("export length covers the times through plus the tail", () => {
    const song = SS.model.newSong();
    song.counts = 8;
    song.tempo = 100;
    expect(SS.engine.exportFrames(song, 2)).toBe(Math.round((9.6 + 2) * 44100));
  });

  it("the WAV header says stereo, 44.1 kHz, 16-bit, and loud samples are clipped", () => {
    const l = new Float32Array([1.5, 0]);
    const r = new Float32Array([-1.5, 0]);
    const buf = SS.wav.encodeWav([l, r], 44100);
    const v = new DataView(buf);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32767);
    expect(buf.byteLength).toBe(44 + 8);
  });
});

// ---- Task 4: sound making -------------------------------------------------

function makeParam(v = 0) {
  return {
    value: v,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  };
}

function makeNode(ctx, kind, extra = {}) {
  const n = {
    kind,
    connected: [],
    disconnected: false,
    startedAt: null,
    stoppedAt: null,
    connect(d) {
      this.connected.push(d);
      return d;
    },
    disconnect() {
      this.disconnected = true;
    },
    ...extra,
  };
  ctx.nodes.push(n);
  return n;
}

function fakeCtx(sampleRate = 44100) {
  const ctx = {
    currentTime: 0,
    sampleRate,
    nodes: [],
    destination: { kind: "destination" },
  };
  const source = (kind, extra) => () =>
    makeNode(ctx, kind, {
      isSource: true,
      start(t) {
        this.startedAt = t === undefined ? ctx.currentTime : t;
      },
      stop(t) {
        this.stoppedAt = t === undefined ? ctx.currentTime : t;
      },
      ...extra,
    });
  ctx.createOscillator = source("osc", {
    type: "sine",
    frequency: makeParam(440),
    detune: makeParam(0),
    setPeriodicWave() {},
  });
  ctx.createBufferSource = source("buf", {
    buffer: null,
    loop: false,
    playbackRate: makeParam(1),
  });
  ctx.createGain = () => makeNode(ctx, "gain", { gain: makeParam(1) });
  ctx.createBiquadFilter = () =>
    makeNode(ctx, "filter", {
      type: "lowpass",
      frequency: makeParam(350),
      Q: makeParam(1),
      gain: makeParam(0),
    });
  ctx.createDynamicsCompressor = () =>
    makeNode(ctx, "comp", {
      threshold: makeParam(-24),
      knee: makeParam(30),
      ratio: makeParam(12),
      attack: makeParam(0.003),
      release: makeParam(0.25),
    });
  ctx.createWaveShaper = () => makeNode(ctx, "shaper", { curve: null });
  ctx.createDelay = () => makeNode(ctx, "delay", { delayTime: makeParam(0) });
  ctx.createPeriodicWave = () => ({});
  ctx.createBuffer = (ch, len, rate) => {
    const data = new Float32Array(len);
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: rate,
      duration: len / rate,
      getChannelData: () => data,
    };
  };
  ctx.sources = () => ctx.nodes.filter((n) => n.isSource);
  return ctx;
}

const stubCatalog = (records) => ({
  byId: (id) => records.find((r) => r.id === id) || null,
});

const recipeRecords = [
  { id: "ep", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "fm", ratio: 2, index: 3 } },
  { id: "gtr", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "pluck" } },
  { id: "organ", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "additive", partials: [1, 0.5, 0.25] } },
  { id: "lead", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "subtractive", wave: "sawtooth", cutoff: 1800 } },
  { id: "chip", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "chip", duty: 0.25 } },
  { id: "drums", kind: "kit", source: "code", range: [0, 7], slots: ["Kick", "Snare", "Closed hat", "Open hat", "Clap", "Low tom", "High tom", "Cymbal"], recipe: { type: "noiseDrum" } },
  { id: "zap", kind: "fx", source: "code", range: [0, 0], recipe: { type: "fx", params: { effect: "laser" } } },
];

const evFor = (instrumentId, pitch = 60) => ({
  step: 0, trackId: "t", instrumentId, pitch, len: 2, vel: 1, gain: 0.8,
});

describe("Sound Space sound making", () => {
  it("every recipe type makes sound without errors", () => {
    for (const rec of recipeRecords) {
      const ctx = fakeCtx();
      const voices = SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples");
      const dest = ctx.createGain();
      const pitch = rec.kind === "kit" ? 1 : 60;
      expect(() => voices.play(evFor(rec.id, pitch), 1.5, dest)).not.toThrow();
      const srcs = ctx.sources();
      expect(srcs.length, rec.recipe.type).toBeGreaterThan(0);
      expect(srcs.some((s) => s.startedAt === 1.5), rec.recipe.type).toBe(true);
    }
  });

  it("every kit slot makes sound", () => {
    const ctx = fakeCtx();
    const voices = SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    const dest = ctx.createGain();
    for (let s = 0; s < 8; s++) {
      const before = ctx.sources().length;
      voices.play(evFor("drums", s), 0, dest);
      expect(ctx.sources().length).toBeGreaterThan(before);
    }
  });

  it("stop leaves no sound playing", () => {
    const ctx = fakeCtx();
    const song = SS.model.newSong();
    const t = SS.model.addTrack(song, "ep");
    for (let s = 0; s < 8; s++) SS.model.toggleNote(t, s, 60, 1);
    const voices = SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    let tick = null;
    const player = SS.engine.createPlayer(ctx, voices, {
      setInterval: (fn) => ((tick = fn), 1),
      clearInterval: () => {
        tick = null;
      },
    });
    player.start(song, { fromStep: 0 });
    expect(player.playing).toBe(true);
    for (let i = 0; i < 40; i++) {
      ctx.currentTime += 0.025;
      tick();
    }
    expect(ctx.sources().length).toBeGreaterThan(0);
    player.stop();
    expect(player.playing).toBe(false);
    expect(tick).toBe(null);
    for (const s of ctx.sources()) {
      expect(s.stoppedAt !== null || s.disconnected).toBe(true);
    }
  });

  it("a recorded instrument that fails to load says so and is never swapped for a code sound", async () => {
    const rec = { id: "grand", kind: "pitched", source: "recorded", range: [36, 96], samples: { notes: [48, 60, 72] } };
    const ctx = fakeCtx();
    ctx.decodeAudioData = async () => ctx.createBuffer(1, 100, 44100);
    const voices = SS.engine.createVoices(ctx, stubCatalog([rec]), "samples", {
      fetchArrayBuffer: () => Promise.reject(new Error("offline")),
    });
    const res = await voices.load("grand");
    expect(res.ok).toBe(false);
    voices.play(evFor("grand", 60), 0, ctx.createGain());
    expect(ctx.sources().length).toBe(0);
  });

  it("sample voices play the nearest prepared note, repitched", async () => {
    const rec = { id: "grand", kind: "pitched", source: "recorded", range: [36, 96], samples: { notes: [48, 60, 72] } };
    const ctx = fakeCtx();
    const urls = [];
    ctx.decodeAudioData = async () => ctx.createBuffer(1, 100, 44100);
    const voices = SS.engine.createVoices(ctx, stubCatalog([rec]), "samples", {
      fetchArrayBuffer: (u) => {
        urls.push(u);
        return Promise.resolve(new ArrayBuffer(8));
      },
    });
    expect((await voices.load("grand")).ok).toBe(true);
    expect(urls).toContain("samples/grand/60.wav");
    voices.play(evFor("grand", 64), 2, ctx.createGain());
    const src = ctx.sources().find((s) => s.kind === "buf");
    expect(src.startedAt).toBe(2);
    expect(src.playbackRate.value).toBeCloseTo(Math.pow(2, 4 / 12), 10);
  });

  it("the player does not burst after a long gap", () => {
    const ctx = fakeCtx();
    const song = SS.model.newSong();
    const t = SS.model.addTrack(song, "ep");
    for (let s = 0; s < 16; s++) SS.model.toggleNote(t, s, 60, 1);
    const voices = SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    let tick = null;
    const player = SS.engine.createPlayer(ctx, voices, {
      setInterval: (fn) => ((tick = fn), 1),
      clearInterval: () => {},
    });
    player.start(song, { fromStep: 0 });
    tick();
    ctx.currentTime = 30; // hidden tab
    const before = ctx.sources().length;
    tick();
    expect(ctx.sources().length - before).toBeLessThanOrEqual(4); // at most 2 notes, 2 oscillators each
    player.stop();
  });

  it("renderOffline schedules every note on an offline context", async () => {
    const song = SS.model.newSong();
    const t = SS.model.addTrack(song, "ep");
    SS.model.toggleNote(t, 0, 60, 1);
    SS.model.toggleNote(t, 4, 64, 1);
    let made = null;
    class FakeOffline {
      constructor(ch, len, rate) {
        Object.assign(this, fakeCtx(rate));
        this.args = [ch, len, rate];
        made = this;
      }
      startRendering() {
        return Promise.resolve({ fake: true });
      }
    }
    const buf = await SS.engine.renderOffline(
      song,
      1,
      (ctx) => SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples"),
      { OfflineAudioContext: FakeOffline }
    );
    expect(buf.fake).toBe(true);
    expect(made.args).toEqual([2, SS.engine.exportFrames(song, 1), 44100]);
    expect(made.sources().length).toBeGreaterThanOrEqual(2);
  });
});
