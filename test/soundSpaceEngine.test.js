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
  // each node gets its own params (extra is a function, so two oscillators never share one frequency)
  const source = (kind, extra) => () =>
    makeNode(ctx, kind, {
      isSource: true,
      start(t) {
        this.startedAt = t === undefined ? ctx.currentTime : t;
      },
      stop(t) {
        this.stoppedAt = t === undefined ? ctx.currentTime : t;
      },
      ...extra(),
    });
  ctx.createOscillator = source("osc", () => ({
    type: "sine",
    frequency: makeParam(440),
    detune: makeParam(0),
    setPeriodicWave() {},
  }));
  ctx.createBufferSource = source("buf", () => ({
    buffer: null,
    loop: false,
    playbackRate: makeParam(1),
  }));
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
  ctx.createConvolver = () => makeNode(ctx, "convolver", { buffer: null, normalize: true });
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

  it("the live bus is a gain into a zero-latency soft clipper, with no compressor", () => {
    const ctx = fakeCtx();
    ctx.createWaveShaper = () => makeNode(ctx, "shaper", { curve: null, oversample: "none" });
    const bus = SS.engine.createLiveBus(ctx);
    const gain = ctx.nodes.find((n) => n.kind === "gain");
    const pre = ctx.nodes.filter((n) => n.kind === "gain")[1];
    const shaper = ctx.nodes.find((n) => n.kind === "shaper");
    expect(ctx.nodes.some((n) => n.kind === "comp")).toBe(false);
    expect(bus).toBe(gain);
    expect(gain.connected).toContain(pre);
    expect(pre.connected).toContain(shaper);
    expect(pre.gain.value).toBe(0.5);
    expect(shaper.connected).toContain(ctx.destination);
    expect(shaper.oversample).toBe("none");
    const c = shaper.curve;
    expect(c.length).toBeGreaterThan(64);
    // the shaper sees half level, so the real level is twice its input
    const x = (i) => 2 * ((i / (c.length - 1)) * 2 - 1);
    for (let i = 0; i < c.length; i++) {
      expect(Math.abs(c[i])).toBeLessThanOrEqual(1);
      if (i) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
      if (Math.abs(x(i)) <= 0.3 && Math.abs(x(i)) > 0.01) expect(Math.abs(c[i] / x(i) - 1)).toBeLessThan(0.03);
    }
    expect(c[0]).toBeCloseTo(-c[c.length - 1], 10);
  });

  it("recording click: one soft tick per count on the audio clock, accent every fourth, none on plain play or export", () => {
    const run = (opts) => {
      const song = SS.model.newSong(); song.counts = 8; song.grid = 2; song.tempo = 100;
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
    const a = SS.model.newSong(); a.grid = 2; a.tempo = 100;
    const b = SS.model.newSong(); b.grid = 4; b.tempo = 100;
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

// ---- Reverb and Sustain on each track ---------------------------------------

describe("Sound Space reverb and sustain", () => {
  const E = SS.engine;
  const songWith = (tracks) => {
    const song = SS.model.newSong();
    song.grid = 2; song.tempo = 100;   // these tests count seconds on the eighth grid at 100
    for (const [id, reverb, sustain] of tracks) {
      const t = SS.model.addTrack(song, id);
      t.reverb = reverb;
      t.sustain = sustain;
      SS.model.toggleNote(t, 0, id === "drums" ? 1 : 60, 1);
    }
    return song;
  };
  const playFor = (song, ticks = 10) => {
    const ctx = fakeCtx();
    const voices = E.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    let tick = null;
    const player = E.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
    player.start(song, { fromStep: 0 });
    for (let i = 0; i < ticks; i++) { ctx.currentTime += 0.025; tick(); }
    const comp = ctx.nodes.find((n) => n.kind === "comp");
    const bus = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(comp));
    return { ctx, player, bus, convolvers: ctx.nodes.filter((n) => n.kind === "convolver") };
  };

  it("names the levels and the tail the brief gives", () => {
    expect(E.SUSTAIN_TAIL).toBe(1.5);
    expect(E.REVERB_LEVELS.map((l) => l && l.name)).toEqual([null, "Room", "Hall", "Big hall", "Stadium"]);
    expect(E.REVERB_LEVELS.slice(1).map((l) => l.sec)).toEqual([0.8, 1.8, 3.2, 5.0]);
    const wets = E.REVERB_LEVELS.slice(1).map((l) => l.wet);
    expect(wets[0]).toBeLessThan(wets[1]);
    expect(wets[1]).toBeLessThan(wets[2]);
    expect(wets[2]).toBeLessThan(wets[3]);
    expect(wets[3]).toBeCloseTo(0.65, 2);
  });

  it("a Stadium track gets a 5.0 s convolver, shared on its master, with a longer tail than Big hall", () => {
    const { ctx, player, bus, convolvers } = playFor(songWith([["ep", 4, false], ["organ", 4, false]]));
    expect(convolvers.length).toBe(1);   // one per level, per master
    expect(convolvers[0].buffer.length).toBe(Math.round(5.0 * 44100));
    const wet = convolvers[0].connected[0];
    expect(wet.gain.value).toBeCloseTo(E.REVERB_LEVELS[4].wet, 10);
    expect(wet.connected).toContain(bus);
    player.stop();
    const big = songWith([["ep", 3, false]]), stadium = songWith([["ep", 4, false]]);
    expect(E.songTail(stadium)).toBeGreaterThan(E.songTail(big));
    expect(E.songTail(stadium)).toBeGreaterThanOrEqual(5.0);
    expect(E.exportFrames(stadium, 1)).toBeGreaterThan(E.exportFrames(big, 1));
    expect(E.songTail(songWith([["ep", 4, true]]))).toBeGreaterThanOrEqual(5.0 + 1.5);
  });

  it("events carry their track's reverb and sustain, and older tracks play dry", () => {
    const song = songWith([["ep", 2, true], ["drums", 0, false]]);
    delete song.tracks[1].reverb; delete song.tracks[1].sustain;
    const evs = E.compileEvents(song, 0, 4);
    expect(evs.find((e) => e.instrumentId === "ep")).toMatchObject({ reverb: 2, sustain: true });
    expect(evs.find((e) => e.instrumentId === "drums")).toMatchObject({ reverb: 0, sustain: false });
  });

  it("a Hall track gets a 1.8 s convolver whose wet path reaches the master bus, and the dry path stays at full level", () => {
    const { ctx, player, bus, convolvers } = playFor(songWith([["ep", 2, false]]));
    expect(convolvers.length).toBe(1);
    const conv = convolvers[0];
    expect(conv.buffer.length).toBe(Math.round(1.8 * 44100));
    expect(conv.buffer.numberOfChannels).toBe(2);
    const wet = conv.connected[0];
    expect(wet.kind).toBe("gain");
    expect(wet.gain.value).toBeCloseTo(E.REVERB_LEVELS[2].wet, 10);
    expect(wet.connected).toContain(bus);
    // the send feeds the bus directly (dry, gain 1) and the convolver
    const send = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(conv) && n.connected.includes(bus));
    expect(send).toBeTruthy();
    expect(send.gain.value).toBe(1);
    player.stop();
    expect(conv.disconnected).toBe(true);
    expect(wet.disconnected).toBe(true);
    expect(send.disconnected).toBe(true);
  });

  it("the impulse is the same every time and dies away", () => {
    const a = playFor(songWith([["ep", 1, false]])).convolvers[0].buffer.getChannelData(0);
    const b = playFor(songWith([["ep", 1, false]])).convolvers[0].buffer.getChannelData(0);
    expect(a.length).toBe(Math.round(0.8 * 44100));
    expect(Array.from(a.slice(0, 200))).toEqual(Array.from(b.slice(0, 200)));
    const energy = (from, to) => a.slice(from, to).reduce((s, x) => s + x * x, 0);
    expect(energy(0, 2000)).toBeGreaterThan(energy(a.length - 2000, a.length) * 100);
    expect(Math.abs(a[a.length - 1])).toBeLessThan(0.01);
  });

  it("two tracks on the same level share one convolver; a different level gets its own", () => {
    expect(playFor(songWith([["ep", 2, false], ["organ", 2, false]])).convolvers.length).toBe(1);
    expect(playFor(songWith([["ep", 2, false], ["organ", 3, false]])).convolvers.length).toBe(2);
  });

  it("a dry track builds no convolver", () => {
    expect(playFor(songWith([["ep", 0, false], ["drums", 0, true]])).convolvers.length).toBe(0);
  });

  it("a level first used during playback gets its send then", () => {
    const song = songWith([["ep", 0, false]]);
    const ctx = fakeCtx();
    const voices = E.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    let tick = null;
    const player = E.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
    player.start(song, { fromStep: 0 });
    for (let i = 0; i < 4; i++) { ctx.currentTime += 0.025; tick(); }
    const convs = () => ctx.nodes.filter((n) => n.kind === "convolver");
    expect(convs().length).toBe(0);
    // the change applies to the notes that follow: the next time round the loop
    const changed = JSON.parse(JSON.stringify(song));
    changed.tracks[0].reverb = 3;
    player.update(changed);
    for (let i = 0; i < 220; i++) { ctx.currentTime += 0.025; tick(); }
    expect(convs().length).toBe(1);
    expect(convs()[0].buffer.length).toBe(Math.round(3.2 * 44100));
    player.stop();
  });

  it("a pitched note with sustain keeps every voice going at least 1.5 s past its end, and ends silent", () => {
    for (const rec of recipeRecords.filter((r) => r.kind === "pitched")) {
      const ctx = fakeCtx();
      const voices = E.createVoices(ctx, stubCatalog(recipeRecords), "samples");
      voices.play({ ...evFor(rec.id, 60), dur: 0.5, sustain: true }, 1, ctx.createGain());
      const srcs = ctx.sources();
      expect(srcs.length, rec.recipe.type).toBeGreaterThan(0);
      for (const s of srcs) expect(s.stoppedAt, rec.recipe.type).toBeGreaterThanOrEqual(1 + 0.5 + 1.5);
      const env = ctx.nodes.filter((n) => n.kind === "gain" && n.gain.events.length > 2).pop();
      const evs = env.gain.events.slice().sort((a, b) => a.t - b.t);
      expect(evs[evs.length - 1].v, rec.recipe.type).toBe(0);
      expect(evs[evs.length - 1].t, rec.recipe.type).toBeLessThanOrEqual(Math.min(...srcs.map((s) => s.stoppedAt)));
      // without sustain the same note stops well before that
      const c2 = fakeCtx();
      E.createVoices(c2, stubCatalog(recipeRecords), "samples").play({ ...evFor(rec.id, 60), dur: 0.5 }, 1, c2.createGain());
      expect(Math.max(...c2.sources().map((s) => s.stoppedAt)), rec.recipe.type).toBeLessThan(1 + 0.5 + 1.5);
    }
  });

  it("a recorded pitched sample with sustain rings on, capped by the sample's own length", async () => {
    const rec = { id: "grand", kind: "pitched", source: "recorded", range: [36, 96], samples: { notes: [60] } };
    const mk = async (seconds) => {
      const ctx = fakeCtx();
      ctx.decodeAudioData = async () => ctx.createBuffer(1, Math.round(44100 * seconds), 44100);
      const v = E.createVoices(ctx, stubCatalog([rec]), "samples", { fetchArrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
      await v.load("grand");
      return { ctx, v };
    };
    const long = await mk(5);
    long.v.play({ ...evFor("grand", 60), dur: 0.5, sustain: true }, 1, long.ctx.createGain());
    expect(long.ctx.sources()[0].stoppedAt).toBeGreaterThanOrEqual(1 + 0.5 + 1.5);
    const short = await mk(1);
    short.v.play({ ...evFor("grand", 60), dur: 0.5, sustain: true }, 1, short.ctx.createGain());
    expect(short.ctx.sources()[0].stoppedAt).toBeLessThanOrEqual(1 + 1 + 0.05 + 1e-9);
  });

  it("sustain does nothing to a drum hit or an effect", () => {
    const stops = (id, pitch, sustain) => {
      const ctx = fakeCtx();
      E.createVoices(ctx, stubCatalog(recipeRecords), "samples").play({ ...evFor(id, pitch), dur: 0.5, sustain }, 1, ctx.createGain());
      return ctx.sources().map((n) => [n.startedAt, n.stoppedAt]);
    };
    for (const slot of [0, 1, 3, 7]) expect(stops("drums", slot, true)).toEqual(stops("drums", slot, false));
    expect(stops("zap", 0, true)).toEqual(stops("zap", 0, false));
  });

  it("playback hands sustain to the voices", () => {
    const ctx = fakeCtx();
    const got = [];
    const voices = { play: (ev) => { got.push(ev); return []; } };
    let tick = null;
    const player = E.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
    player.start(songWith([["ep", 0, true]]), { fromStep: 0 });
    tick();
    expect(got[0].sustain).toBe(true);
    player.stop();
  });

  it("the WAV tail grows for Big hall and for sustain, and stays 2 s when a song uses neither", () => {
    const frames = (song) => E.exportFrames(song, 1) - Math.round(SS.model.totalSteps(song) * E.stepSeconds(song.tempo, song.grid) * 44100);
    const dry = songWith([["ep", 0, false], ["drums", 0, false]]);
    expect(E.exportFrames(dry, 1)).toBe(Math.round((4.8 + 2) * 44100));
    const big = songWith([["ep", 3, false]]);
    expect(frames(big)).toBeGreaterThan(frames(dry));
    expect(frames(big) / 44100).toBeGreaterThanOrEqual(3.2);
    const both = songWith([["ep", 3, true]]);
    expect(frames(both) / 44100).toBeGreaterThanOrEqual(3.2 + 1.5);
    expect(E.exportFrames(big, 1, 44100, 2)).toBe(E.exportFrames(dry, 1));   // an explicit tail still wins
  });

  it("with Loop off, the automatic stop waits for a Big hall tail and still waits 1.2 s for a dry song", () => {
    const run = (reverb) => {
      const song = SS.model.newSong();
      song.counts = 4; song.loop = false;
      const t = SS.model.addTrack(song, "ep");
      t.reverb = reverb;
      SS.model.toggleNote(t, 0, 60, 1);
      const ctx = fakeCtx();
      const voices = E.createVoices(ctx, stubCatalog(recipeRecords), "samples");
      let tick = null;
      const player = E.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
      player.start(song, { fromStep: 0 });
      const songEnd = 0.06 + SS.model.totalSteps(song) * E.stepSeconds(song.tempo, song.grid);
      const stopsAt = () => {
        for (let i = 0; i < 2000; i++) { ctx.currentTime += 0.025; if (tick) tick(); if (!player.playing) return ctx.currentTime - songEnd; }
        return Infinity;
      };
      return { after: stopsAt(), tail: E.songTail(song) };
    };
    const big = run(3), dry = run(0), stadium = run(4);
    expect(stadium.tail).toBeGreaterThan(big.tail);
    expect(stadium.after).toBeGreaterThanOrEqual(stadium.tail - 0.05);
    expect(big.tail).toBeGreaterThan(3);
    expect(big.after).toBeGreaterThanOrEqual(big.tail - 0.05);
    expect(dry.after).toBeGreaterThanOrEqual(1.2 - 0.05);
    expect(dry.after).toBeLessThan(big.after);
  });

  it("renderOffline builds the same sends, so the WAV has the reverb", async () => {
    const song = songWith([["ep", 2, true], ["organ", 2, false], ["drums", 1, false]]);
    const { Offline, last } = fakeOffline();
    await E.renderOffline(song, 1, (ctx) => E.createVoices(ctx, stubCatalog(recipeRecords), "samples"), { OfflineAudioContext: Offline });
    const ctx = last();
    const convs = ctx.nodes.filter((n) => n.kind === "convolver");
    expect(convs.map((c) => c.buffer.length).sort((a, b) => a - b)).toEqual([Math.round(0.8 * 44100), Math.round(1.8 * 44100)]);
    const comp = ctx.nodes.find((n) => n.kind === "comp");
    const bus = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(comp));
    for (const c of convs) expect(c.connected[0].connected).toContain(bus);
    expect(ctx.args[1]).toBe(E.exportFrames(song, 1));
    // the sustained piano note rings on in the file too
    expect(Math.max(...ctx.sources().map((s) => s.stoppedAt))).toBeGreaterThanOrEqual(E.stepSeconds(song.tempo) + 1.5);
  });

  it("the live path: a send's dry side is a plain connection, and the live bus itself is unchanged", () => {
    const ctx = fakeCtx();
    const bus = E.createLiveBus(ctx);
    const before = ctx.nodes.length;
    const fx = E.createReverb(ctx, bus);
    expect(ctx.nodes.length).toBe(before);              // nothing is built until a level is used
    expect(fx.wet(0)).toBe(null);
    const conv = fx.wet(2);
    expect(conv.kind).toBe("convolver");
    expect(fx.wet(2)).toBe(conv);
    expect(conv.connected[0].connected).toContain(bus);
    expect(ctx.nodes.some((n) => n.kind === "comp" || n.kind === "delay")).toBe(false);
    expect(fx.input(0)).toBe(bus);
    fx.disconnect();
    expect(conv.disconnected).toBe(true);
  });
});

// ---- Chorus, Dynamics and EQ on each track ---------------------------------
// Owner: docs/mockups/sound-space-track-effects-draft.html. Order: EQ, Chorus, Dynamics, then the dry output and the
// reverb send. Nothing is built for an effect that is off.

describe("Sound Space track effects", () => {
  const E = SS.engine;
  const OFF = () => ({ chorus: { kind: "off", amount: 45 }, dyn: { kind: "off", amount: 50 }, eq: { low: 0, mid: 0, high: 0, lowcut: false } });
  const songWith = (fx, opts = {}) => {
    const song = SS.model.newSong();
    song.grid = 2; song.tempo = 100;
    const t = SS.model.addTrack(song, opts.id || "ep");
    Object.assign(t, OFF(), fx);
    if (opts.strip) { delete t.chorus; delete t.dyn; delete t.eq; }
    t.reverb = opts.reverb || 0;
    for (let s = 0; s < (opts.notes || 4); s++) SS.model.toggleNote(t, s, 60, 1);
    return song;
  };
  const playFor = (song, ticks = 40) => {
    const ctx = fakeCtx();
    const voices = E.createVoices(ctx, stubCatalog(recipeRecords), "samples");
    let tick = null;
    const player = E.createPlayer(ctx, voices, { setInterval: (fn) => ((tick = fn), 1), clearInterval: () => {} });
    player.start(song, { fromStep: 0 });
    for (let i = 0; i < ticks; i++) { ctx.currentTime += 0.025; tick(); }
    return { ctx, player, tick: () => tick() };
  };
  const kinds = (ctx, k) => ctx.nodes.filter((n) => n.kind === k);
  const comps = (ctx) => kinds(ctx, "comp");

  it("events carry their track's effects", () => {
    const song = songWith({ chorus: { kind: "phaser", amount: 60 }, eq: { low: 3, mid: 0, high: -5, lowcut: true } });
    const ev = E.compileEvents(song, 0, 1)[0];
    expect(ev.chorus).toEqual({ kind: "phaser", amount: 60 });
    expect(ev.eq).toEqual({ low: 3, mid: 0, high: -5, lowcut: true });
    expect(ev.dyn).toEqual({ kind: "off", amount: 50 });
  });

  it("a track with every effect off builds exactly what a song from before the effects builds", () => {
    const a = playFor(songWith({})), b = playFor(songWith({}, { strip: true }));
    expect(a.ctx.nodes.map((n) => n.kind)).toEqual(b.ctx.nodes.map((n) => n.kind));
    expect(kinds(a.ctx, "delay").length).toBe(0);
    expect(comps(a.ctx).length).toBe(1);   // the master's own
    expect(E.trackFxOn(OFF())).toEqual({ chorus: false, dyn: false, eq: false, any: false });
    expect(E.trackFxOn({})).toEqual({ chorus: false, dyn: false, eq: false, any: false });
  });

  it("chorus builds two modulated delays of 15-25 ms with slow LFOs, and amount 0 is dry", () => {
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { ...OFF(), chorus: { kind: "chorus", amount: 100 } });
    const delays = kinds(ctx, "delay");
    expect(delays.length).toBe(2);
    for (const d of delays) {
      expect(d.delayTime.value).toBeGreaterThanOrEqual(0.015);
      expect(d.delayTime.value).toBeLessThanOrEqual(0.025);
    }
    expect(ch.lfos.length).toBeGreaterThanOrEqual(1);
    for (const o of ch.lfos) {
      expect(o.frequency.value).toBeGreaterThanOrEqual(0.6);
      expect(o.frequency.value).toBeLessThanOrEqual(1.2);
      expect(o.startedAt).not.toBe(null);
      const depth = ctx.nodes.find((n) => n.kind === "gain" && o.connected.includes(n));
      expect(depth.gain.value).toBeGreaterThan(0);
      expect(delays.some((d) => depth.connected.includes(d.delayTime))).toBe(true);
    }
    // amount 0: the wet side is silent and the dry side is at full level
    const c0 = fakeCtx();
    const dry = E.buildTrackChain(c0, { ...OFF(), chorus: { kind: "chorus", amount: 0 } });
    expect(dry.wet.gain.value).toBe(0);
    expect(dry.dry.gain.value).toBe(1);
  });

  it("flanger: one short delay with a faster sweep and feedback that can never run away", () => {
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { ...OFF(), chorus: { kind: "flanger", amount: 100 } });
    const delays = kinds(ctx, "delay");
    expect(delays.length).toBe(1);
    expect(delays[0].delayTime.value).toBeGreaterThanOrEqual(0.001);
    expect(delays[0].delayTime.value).toBeLessThanOrEqual(0.005);
    expect(ch.lfos.length).toBe(1);
    expect(ch.lfos[0].frequency.value).toBeGreaterThan(1.2);
    const fb = ctx.nodes.find((n) => n.kind === "gain" && delays[0].connected.includes(n) && n.connected.includes(delays[0]));
    expect(fb).toBeTruthy();
    expect(fb.gain.value).toBeGreaterThan(0);
    expect(fb.gain.value).toBeLessThanOrEqual(E.FLANGER_FEEDBACK_MAX);
    expect(E.FLANGER_FEEDBACK_MAX).toBeLessThan(0.8);
  });

  it("phaser: 4 allpass filters swept by an LFO and mixed with the dry sound", () => {
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { ...OFF(), chorus: { kind: "phaser", amount: 60 } });
    const ap = kinds(ctx, "filter").filter((f) => f.type === "allpass");
    expect(ap.length).toBe(4);
    expect(ch.lfos.length).toBe(1);
    const lfo = ch.lfos[0];
    for (const f of ap) expect(ctx.nodes.some((g) => g.kind === "gain" && lfo.connected.includes(g) && g.connected.includes(f.frequency))).toBe(true);
    expect(ch.dry.gain.value).toBeGreaterThan(0);
    expect(ch.wet.gain.value).toBeGreaterThan(0);
  });

  it("compress: a compressor whose threshold falls and ratio rises with amount, with makeup so the level stays about the same", () => {
    const at = (amount) => { const ctx = fakeCtx(); E.buildTrackChain(ctx, { ...OFF(), dyn: { kind: "compress", amount } }); return comps(ctx)[0]; };
    const lo = at(0), hi = at(100), mid = at(50);
    expect(lo.threshold.value).toBeCloseTo(-10, 5);
    expect(hi.threshold.value).toBeCloseTo(-34, 5);
    expect(lo.ratio.value).toBeCloseTo(2, 5);
    expect(hi.ratio.value).toBeCloseTo(6, 5);
    expect(mid.threshold.value).toBeLessThan(lo.threshold.value);
    expect(mid.ratio.value).toBeGreaterThan(lo.ratio.value);
    // The browser's compressor lifts its output by (1 / gain at full level)^0.6 (the Web Audio spec); the makeup gain on
    // top brings a typical note back to where it was.
    const level = (kind, amount, inDb) => {
      const s = E.dynSettings(kind, amount);
      const out = (x) => (x <= s.threshold ? x : s.threshold + (x - s.threshold) / s.ratio);
      const auto = -0.6 * out(0);
      return out(inDb) + auto + s.makeupDb;
    };
    for (const kind of ["compress", "limit"]) for (const a of [0, 25, 50, 75, 100]) {
      expect(Math.abs(level(kind, a, E.DYN_TYPICAL_DB) - E.DYN_TYPICAL_DB), kind + " " + a).toBeLessThan(1.5);
    }
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { ...OFF(), dyn: { kind: "compress", amount: 100 } });
    const c = comps(ctx)[0];
    const makeup = ctx.nodes.find((n) => n.kind === "gain" && c.connected.includes(n));
    expect(makeup.gain.value).toBeCloseTo(Math.pow(10, E.dynSettings("compress", 100).makeupDb / 20), 6);
    expect(ch.output).toBe(makeup);
  });

  it("limit: ratio 20, a 1 ms attack, and a threshold from -1 to -12 dB", () => {
    const at = (amount) => { const ctx = fakeCtx(); E.buildTrackChain(ctx, { ...OFF(), dyn: { kind: "limit", amount } }); return comps(ctx)[0]; };
    const lo = at(0), hi = at(100);
    expect(lo.ratio.value).toBe(20);
    expect(lo.attack.value).toBeCloseTo(0.001, 6);
    expect(lo.threshold.value).toBeCloseTo(-1, 5);
    expect(hi.threshold.value).toBeCloseTo(-12, 5);
  });

  it("EQ: low cut is a 90 Hz highpass, then a 200 Hz low shelf, a 1 kHz peak (Q 0.8) and a 4 kHz high shelf, in that order", () => {
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { ...OFF(), eq: { low: 3, mid: -4, high: 5, lowcut: true } });
    const f = kinds(ctx, "filter");
    expect(f.map((x) => x.type)).toEqual(["highpass", "lowshelf", "peaking", "highshelf"]);
    expect(f.map((x) => x.frequency.value)).toEqual([90, 200, 1000, 4000]);
    expect(f[0].Q.value).toBeCloseTo(0.7, 6);
    expect(f[2].Q.value).toBeCloseTo(0.8, 6);
    expect(f.slice(1).map((x) => x.gain.value)).toEqual([3, -4, 5]);
    // chained in order from the input
    expect(ch.input.connected).toContain(f[0]);
    for (let i = 0; i < 3; i++) expect(f[i].connected).toContain(f[i + 1]);
    // a band at 0 builds nothing
    const c2 = fakeCtx();
    E.buildTrackChain(c2, { ...OFF(), eq: { low: 0, mid: 0, high: 2, lowcut: false } });
    expect(kinds(c2, "filter").map((x) => x.type)).toEqual(["highshelf"]);
    expect(E.buildTrackChain(fakeCtx(), OFF())).toBe(null);
  });

  it("the order is EQ, then Chorus, then Dynamics", () => {
    const ctx = fakeCtx();
    const ch = E.buildTrackChain(ctx, { chorus: { kind: "chorus", amount: 50 }, dyn: { kind: "compress", amount: 50 }, eq: { low: 0, mid: 0, high: 4, lowcut: false } });
    const shelf = kinds(ctx, "filter").find((f) => f.type === "highshelf");
    const delays = kinds(ctx, "delay");
    const comp = comps(ctx)[0];
    // the shelf feeds the chorus: its dry gain and both delays
    expect(shelf.connected).toContain(ch.dry);
    for (const d of delays) expect(shelf.connected).toContain(d);
    // the chorus's mix feeds the compressor
    const mix = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(comp));
    expect(ch.dry.connected).toContain(mix);
    expect(ch.wet.connected).toContain(mix);
  });

  it("playback builds each track's chain once and reuses it for every note, then into the reverb send", () => {
    const song = songWith({ chorus: { kind: "chorus", amount: 50 }, dyn: { kind: "compress", amount: 50 } }, { notes: 8, reverb: 2 });
    const { ctx, player } = playFor(song, 60);
    expect(kinds(ctx, "delay").length).toBe(2);
    expect(comps(ctx).length).toBe(2);   // the track's and the master's
    const conv = kinds(ctx, "convolver")[0];
    const send = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(conv));
    const trackComp = comps(ctx).find((c) => !c.connected.includes(ctx.destination));
    const makeup = ctx.nodes.find((n) => n.kind === "gain" && trackComp.connected.includes(n));
    expect(makeup.connected).toContain(send);
    player.stop();
  });

  it("a change applies to the notes that follow; the old chain is let go after its notes end", () => {
    const song = songWith({ chorus: { kind: "chorus", amount: 50 } }, { notes: 16 });
    const { ctx, player, tick } = playFor(song, 10);
    expect(kinds(ctx, "delay").length).toBe(2);
    const first = kinds(ctx, "delay");
    const changed = JSON.parse(JSON.stringify(song));
    changed.tracks[0].chorus = { kind: "flanger", amount: 80 };
    player.update(changed);
    for (let i = 0; i < 40; i++) { ctx.currentTime += 0.025; tick(); }
    expect(kinds(ctx, "delay").length).toBe(3);
    // switching every effect off goes back to the plain path for the notes after
    const off = JSON.parse(JSON.stringify(changed));
    off.tracks[0].chorus.kind = "off";
    player.update(off);
    const before = kinds(ctx, "delay").length;
    for (let i = 0; i < 400; i++) { ctx.currentTime += 0.025; tick(); }
    expect(kinds(ctx, "delay").length).toBe(before);
    // long after, the retired chains are taken out of the graph
    for (const d of first) expect(d.disconnected).toBe(true);
    player.stop();
  });

  it("stop() stops every LFO and takes every effect node out of the graph", () => {
    const song = songWith({ chorus: { kind: "phaser", amount: 70 }, dyn: { kind: "limit", amount: 50 }, eq: { low: 2, mid: 0, high: 0, lowcut: true } });
    const { ctx, player } = playFor(song);
    const lfos = ctx.sources().filter((s) => s.kind === "osc" && s.frequency.value < 5);
    expect(lfos.length).toBeGreaterThan(0);
    const fx = ctx.nodes.filter((n) => n.kind === "filter" && (n.type === "allpass" || n.type === "highpass" || n.type === "lowshelf"));
    player.stop();
    for (const o of lfos) expect(o.stoppedAt).not.toBe(null);
    for (const n of fx) expect(n.disconnected).toBe(true);
    for (const c of comps(ctx)) expect(c.disconnected).toBe(true);
  });

  it("renderOffline puts each track through its chain, so the WAV has the effects", async () => {
    const song = songWith({ chorus: { kind: "flanger", amount: 60 }, eq: { low: 0, mid: 6, high: 0, lowcut: false } }, { notes: 4 });
    const { Offline, last } = fakeOffline();
    await E.renderOffline(song, 2, (ctx) => E.createVoices(ctx, stubCatalog(recipeRecords), "samples"), { OfflineAudioContext: Offline });
    const ctx = last();
    expect(kinds(ctx, "delay").length).toBe(1);   // once, for all 8 notes
    expect(kinds(ctx, "filter").filter((f) => f.type === "peaking").length).toBe(1);
    const comp = comps(ctx)[0];
    const bus = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(comp));
    const mix = ctx.nodes.find((n) => n.kind === "gain" && n.connected.includes(bus) && n !== bus);
    expect(mix).toBeTruthy();
  });

  it("the export tail covers a flanger's feedback", () => {
    const base = songWith({}, { reverb: 4 });
    const fl = songWith({ chorus: { kind: "flanger", amount: 100 } }, { reverb: 4 });
    expect(E.songTail(fl)).toBeGreaterThan(E.songTail(base));
    expect(E.exportFrames(fl, 1)).toBeGreaterThan(E.exportFrames(base, 1));
  });

  // Fix round 1: chains are never left running for a track that no longer plays.
  it("an idle chain is let go once its notes have rung out (LFOs stopped), and the next note builds it again", () => {
    const ctx = fakeCtx();
    const bus = ctx.createGain();
    const chains = E.createTrackChains(ctx);
    const t = { trackId: "a", ...OFF(), chorus: { kind: "chorus", amount: 50 } };
    const first = chains.input(t, [bus], 5);
    const lfos = ctx.sources().filter((s) => s.kind === "osc");
    expect(lfos.length).toBe(2);
    chains.sweep(4.9);
    expect(first.disconnected).toBe(false);
    expect(chains.input(t, [bus], 5)).toBe(first);   // still in use: reused
    chains.sweep(5.1);
    expect(first.disconnected).toBe(true);
    for (const o of lfos) expect(o.stoppedAt).not.toBe(null);
    const again = chains.input(t, [bus], 9);
    expect(again).not.toBe(first);
    expect(kinds(ctx, "delay").length).toBe(4);
  });

  it("a track deleted mid-loop has its chain let go soon after, while the song keeps playing", () => {
    const song = songWith({ chorus: { kind: "chorus", amount: 50 } }, { notes: 16 });
    const t2 = SS.model.addTrack(song, "organ");
    Object.assign(t2, OFF(), { chorus: { kind: "phaser", amount: 50 } });
    for (let s = 0; s < 16; s++) SS.model.toggleNote(t2, s, 64, 1);
    const { ctx, player, tick } = playFor(song, 20);
    const phaser = kinds(ctx, "filter").filter((f) => f.type === "allpass");
    const chorusDelays = kinds(ctx, "delay");
    expect(phaser.length).toBe(4);
    const without = JSON.parse(JSON.stringify(song));
    without.tracks.pop();
    player.update(without);
    for (let i = 0; i < 240; i++) { ctx.currentTime += 0.025; tick(); }   // 6 s later, still playing
    expect(player.playing).toBe(true);
    for (const f of phaser) expect(f.disconnected).toBe(true);
    for (const d of chorusDelays) expect(d.disconnected).toBe(false);   // the track still playing keeps its chain
    player.stop();
  });

  it("an effects track never sounds Chorus or Dynamics, even when its song has them on; its EQ still works", () => {
    const S2 = loadSS("model.js", "instruments.js", "engine.js");
    const fxId = S2.instruments.LIST.find((i) => i.kind === "fx").id;
    const on = { chorus: { kind: "flanger", amount: 80 }, dyn: { kind: "compress", amount: 80 }, eq: { low: 0, mid: 0, high: 0, lowcut: false } };
    expect(S2.engine.trackFxOn({ instrumentId: fxId, ...on })).toEqual({ chorus: false, dyn: false, eq: false, any: false });
    expect(S2.engine.buildTrackChain(fakeCtx(), { instrumentId: fxId, ...on })).toBe(null);
    const ctx = fakeCtx();
    const ch = S2.engine.buildTrackChain(ctx, { instrumentId: fxId, ...on, eq: { low: 0, mid: 5, high: 0, lowcut: false } });
    expect(ch).not.toBe(null);
    expect(kinds(ctx, "delay").length + comps(ctx).length).toBe(0);
    expect(kinds(ctx, "filter").map((f) => f.type)).toEqual(["peaking"]);
    // a piano with the same settings gets them all
    expect(S2.engine.trackFxOn({ instrumentId: "grand-piano", ...on })).toMatchObject({ chorus: true, dyn: true });
  });

  it("live: a track with every effect off adds nothing, so its notes keep today's compressor-free path", () => {
    const ctx = fakeCtx();
    const bus = E.createLiveBus(ctx);
    const chains = E.createTrackChains(ctx);
    const before = ctx.nodes.length;
    expect(chains.input({ trackId: "a", ...OFF() }, [bus], 10)).toBe(null);
    expect(ctx.nodes.length).toBe(before);
    expect(comps(ctx).length).toBe(0);
    // EQ only: still no compressor
    const eqIn = chains.input({ trackId: "b", ...OFF(), eq: { low: 4, mid: 0, high: 0, lowcut: false } }, [bus], 10);
    expect(eqIn).toBeTruthy();
    expect(comps(ctx).length).toBe(0);
    // only a track with Dynamics on goes through a compressor, and it is built once
    const d1 = chains.input({ trackId: "c", ...OFF(), dyn: { kind: "compress", amount: 40 } }, [bus], 10);
    const d2 = chains.input({ trackId: "c", ...OFF(), dyn: { kind: "compress", amount: 40 } }, [bus], 10);
    expect(d1).toBe(d2);
    expect(comps(ctx).length).toBe(1);
    chains.disconnect();
    expect(comps(ctx)[0].disconnected).toBe(true);
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
