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
  const events = [];
  const rec = (k) => (val, t) => events.push({ k, v: val, t });
  return {
    value: v,
    events,
    setValueAtTime: rec("set"),
    linearRampToValueAtTime: rec("lin"),
    exponentialRampToValueAtTime: rec("exp"),
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
    decodeAudioData: async () => ctx.createBuffer(1, 100, 44100),
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
    // Scheduled notes still sound after "now" until stop() is called.
    expect(ctx.sources().some((s) => s.stoppedAt > ctx.currentTime)).toBe(true);
    const stopMoment = ctx.currentTime;
    player.stop();
    expect(player.playing).toBe(false);
    expect(tick).toBe(null);
    // Only stop() can pull every source's end back to the stop moment.
    for (const s of ctx.sources()) {
      expect(s.stoppedAt).toBeLessThanOrEqual(stopMoment);
      expect(s.disconnected).toBe(true);
    }
    const comp = ctx.nodes.find((n) => n.kind === "comp");
    expect(comp.disconnected).toBe(true);
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
    const { Offline, last } = fakeOffline();
    const res = await SS.engine.renderOffline(
      song,
      1,
      (ctx) => SS.engine.createVoices(ctx, stubCatalog(recipeRecords), "samples"),
      { OfflineAudioContext: Offline }
    );
    expect(res.buffer.fake).toBe(true);
    expect(res.failed).toEqual([]);
    expect(last().args).toEqual([2, SS.engine.exportFrames(song, 1), 44100]);
    expect(last().sources().length).toBeGreaterThanOrEqual(2);
  });

  it("renderOffline loads recorded instruments itself and reports ones that fail", async () => {
    const recs = [
      { id: "grand", kind: "pitched", source: "recorded", range: [36, 96], samples: { notes: [60] } },
      { id: "harp", kind: "pitched", source: "recorded", range: [36, 96], samples: { notes: [60] } },
    ];
    const song = SS.model.newSong();
    for (const id of ["grand", "harp"]) {
      const tr = SS.model.addTrack(song, id);
      SS.model.toggleNote(tr, 0, 60, 1);
    }
    const { Offline, last } = fakeOffline();
    const res = await SS.engine.renderOffline(
      song,
      1,
      (ctx) =>
        SS.engine.createVoices(ctx, stubCatalog(recs), "samples", {
          fetchArrayBuffer: (u) =>
            u.includes("/harp/") ? Promise.reject(new Error("404")) : Promise.resolve(new ArrayBuffer(8)),
        }),
      { OfflineAudioContext: Offline }
    );
    expect(res.failed).toEqual(["harp"]);
    // grand sounded, harp stayed silent
    expect(last().sources().length).toBe(1);
  });

  it("a long attack is clamped so the voice ends silent before it stops", () => {
    const ctx = fakeCtx();
    const recs = [{ id: "pad", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "subtractive", attack: 0.3 } }];
    const voices = SS.engine.createVoices(ctx, stubCatalog(recs), "samples");
    voices.play({ ...evFor("pad", 60), dur: 0.25 }, 0, ctx.createGain());
    const env = ctx.nodes.find((n) => n.kind === "gain" && n.gain.events.length > 2);
    const stopAt = Math.max(...ctx.sources().map((s) => s.stoppedAt));
    const evs = env.gain.events.slice().sort((a, b) => a.t - b.t);
    expect(evs.every((e) => e.t <= stopAt)).toBe(true);
    expect(evs[evs.length - 1].v).toBe(0);
    // peak is reached before the hold/release begins: values never drop and rise again
    const peakIdx = evs.findIndex((e) => e.v === Math.max(...evs.map((x) => x.v)));
    expect(evs.slice(peakIdx).every((e, i, a) => i === 0 || e.v <= a[i - 1].v)).toBe(true);
  });

  it("plucks are in tune across the range", () => {
    const recs = [{ id: "gtr", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "pluck" } }];
    for (const midi of [60, 72, 84, 96]) {
      const ctx = fakeCtx();
      const voices = SS.engine.createVoices(ctx, stubCatalog(recs), "samples");
      voices.play(evFor("gtr", midi), 0, ctx.createGain());
      const src = ctx.sources()[0];
      const target = 440 * Math.pow(2, (midi - 69) / 12);
      const P = Math.max(2, Math.round(44100 / target));
      const eff = (44100 * src.playbackRate.value) / (P - 0.5);
      const cents = Math.abs(1200 * Math.log2(eff / target));
      expect(cents, "midi " + midi).toBeLessThan(1);
    }
  });
  it("a drum hit sounds the same whatever its length", async () => {
    const stops = (voices, ctx, len, slot, durOf) => {
      const before = ctx.sources().length;
      voices.play(Object.assign(evFor("drums", slot), { len, dur: durOf(len) }), 1, ctx.createGain());
      return ctx.sources().slice(before).map((n) => [n.startedAt, n.stoppedAt]);
    };
    for (const slot of [0, 1, 2, 3, 4, 7]) {
      const c1 = fakeCtx(), c2 = fakeCtx();
      const v1 = SS.engine.createVoices(c1, stubCatalog(recipeRecords), "samples");
      const v2 = SS.engine.createVoices(c2, stubCatalog(recipeRecords), "samples");
      expect(stops(v2, c2, 8, slot, (l) => l * 0.3)).toEqual(stops(v1, c1, 1, slot, (l) => l * 0.3));
    }
    const kit = { id: "kit", kind: "kit", source: "recorded", range: [0, 7], samples: { files: ["0.wav", "1.wav"] } };
    const mk = async () => {
      const ctx = fakeCtx();
      ctx.decodeAudioData = async () => ctx.createBuffer(1, 44100, 44100);
      const v = SS.engine.createVoices(ctx, stubCatalog([kit]), "samples", { fetchArrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
      await v.load("kit");
      return { ctx, v };
    };
    const a = await mk(), b = await mk();
    const run = ({ ctx, v }, len) => {
      v.play(Object.assign(evFor("kit", 0), { len, dur: len * 0.3 }), 1, ctx.createGain());
      return ctx.sources().map((n) => [n.startedAt, n.stoppedAt]);
    };
    const one = run(a, 1);
    expect(one.length).toBeGreaterThan(0);
    expect(run(b, 8)).toEqual(one);
  });

  it("recording click: one soft tick per count on the audio clock, accent every fourth, none on plain play or export", () => {
    const run = (opts) => {
      const song = SS.model.newSong(); song.counts = 8;
      const ctx = fakeCtx();
      const voices = { play: () => [] };
      const hzOf = new Map();
      const make = ctx.createOscillator;
      ctx.createOscillator = () => {
        const o = make();
        let hz = 0;
        Object.defineProperty(o, "frequency", { value: { get value() { return hz; }, set value(v) { hz = v; }, setValueAtTime() {}, linearRampToValueAtTime() {} } });
        return o;
      };
      let tick = null;
      const player = SS.engine.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
      player.start(song, opts);
      for (let i = 0; i < 200; i++) { ctx.currentTime += 0.025; tick(); }
      const clicks = ctx.sources().filter((s) => s.kind === "osc").map((s) => ({ at: s.startedAt, hz: s.frequency.value }));
      return { clicks, player, ctx };
    };
    const on = run({ click: true });
    expect(on.clicks.length).toBeGreaterThanOrEqual(8);
    const beat = 0.6;
    on.clicks.slice(0, 8).forEach((c, k) => {
      expect(c.at - on.clicks[0].at).toBeCloseTo(k * beat, 6);
      expect(c.hz).toBe(k % 4 === 0 ? 1568 : 1046);
    });
    // loop pass keeps clicking on the same pulse
    expect(on.clicks[8].at - on.clicks[0].at).toBeCloseTo(8 * beat, 6);
    on.player.stop();
    for (const s of on.ctx.sources()) expect(s.stoppedAt).toBeLessThanOrEqual(on.ctx.currentTime);
    expect(run({}).clicks.length).toBe(0);
    expect(run({ fromStep: 0 }).clicks.length).toBe(0);
  });

  it("sixteenth grid: stepSeconds halves, export length keeps counts and speed, the player steps by sixteenths", () => {
    expect(SS.engine.stepSeconds(100, 4)).toBeCloseTo(0.15, 10);
    const a = SS.model.newSong();
    const b = SS.model.newSong(); b.grid = 4;
    expect(SS.engine.exportFrames(b, 1)).toBe(SS.engine.exportFrames(a, 1));
    const ctx = fakeCtx();
    const times = [];
    const voices = { play: (ev, when) => { times.push(when); return []; } };
    const t = SS.model.addTrack(b, "piano");
    for (let s = 0; s < 4; s++) SS.model.toggleNote(t, s, 60, 1);
    let tick = null;
    const player = SS.engine.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
    player.start(b, { fromStep: 0 });
    for (let i = 0; i < 40; i++) { ctx.currentTime += 0.025; tick(); }
    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(times[1] - times[0]).toBeCloseTo(0.15, 6);
    expect(times[3] - times[2]).toBeCloseTo(0.15, 6);
    player.stop();
  });
});

function fakeOffline() {
  let made = null;
  class Offline {
    constructor(ch, len, rate) {
      Object.assign(this, fakeCtx(rate));
      this.args = [ch, len, rate];
      made = this;
    }
    startRendering() {
      return Promise.resolve({ fake: true });
    }
  }
  return { Offline, last: () => made };
}
