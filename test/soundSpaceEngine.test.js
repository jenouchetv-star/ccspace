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

// ---- Reverb and Sustain on each track ---------------------------------------

describe("Sound Space reverb and sustain", () => {
  const E = SS.engine;
  const songWith = (tracks) => {
    const song = SS.model.newSong();
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
    expect(E.REVERB_LEVELS.map((l) => l && l.name)).toEqual([null, "Room", "Hall", "Big hall"]);
    expect(E.REVERB_LEVELS.slice(1).map((l) => l.sec)).toEqual([0.8, 1.8, 3.2]);
    const wets = E.REVERB_LEVELS.slice(1).map((l) => l.wet);
    expect(wets[0]).toBeLessThan(wets[1]);
    expect(wets[1]).toBeLessThan(wets[2]);
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
