import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

const SS = loadSS("model.js", "engine.js", "instruments.js");
const I = SS.instruments;

describe("Sound Space instrument catalog", () => {
  it("has the six categories in order with their colors", () => {
    expect(I.CATEGORIES).toEqual([
      { id: "drums", name: "Drums and percussion", color: "#D946EF" },
      { id: "keys", name: "Keys and mallets", color: "#5B8CFF" },
      { id: "strings", name: "Strings", color: "#8B5CF6" },
      { id: "winds", name: "Brass and winds", color: "#F2C14E" },
      { id: "bass", name: "Bass", color: "#14B8A6" },
      { id: "fx", name: "Sound effects", color: "#FF5C8A" },
    ]);
    expect(I.KIT_SLOTS).toEqual([
      "Kick", "Snare", "Closed hat", "Open hat", "Clap", "Low tom", "High tom", "Cymbal",
    ]);
  });

  it("20 instruments in each of the 6 categories", () => {
    expect(I.LIST.length).toBe(120);
    for (const c of I.CATEGORIES) {
      expect(I.LIST.filter((x) => x.category === c.id).length).toBe(20);
    }
  });

  it("every name is unique and every id is unique", () => {
    expect(new Set(I.LIST.map((x) => x.name)).size).toBe(120);
    expect(new Set(I.LIST.map((x) => x.id)).size).toBe(120);
    for (const x of I.LIST) expect(I.byId(x.id)).toBe(x);
    expect(I.byId("nope")).toBeUndefined();
  });

  it("a sound made in code never takes a real instrument's name", () => {
    const real = [
      "Piano", "Grand piano", "Upright piano", "Violin", "Viola", "Cello", "Guitar",
      "Trumpet", "Trombone", "French horn", "Tuba", "Flute", "Clarinet", "Oboe",
      "Bassoon", "Saxophone", "Harp", "Marimba", "Xylophone", "Vibraphone", "Glockenspiel",
    ];
    for (const x of I.LIST.filter((i) => i.source === "code")) {
      for (const r of real) {
        expect(x.name === r || x.name.startsWith(r), `${x.name} vs ${r}`).toBe(false);
      }
    }
    for (const x of I.LIST) expect(x.name).not.toContain("Guitar");
  });

  it("the instruments that need accuracy are recordings", () => {
    for (const n of [
      "Grand piano", "Upright piano", "Violin", "Cello", "Trumpet", "Trombone", "Tuba",
      "Flute", "Clarinet", "Tenor saxophone", "Classic kit", "Hand drums",
    ]) {
      const x = I.LIST.find((i) => i.name === n);
      expect(x, n).toBeTruthy();
      expect(x.source).toBe("recorded");
    }
  });

  it("every kit has the 8 standard slots and every pitched instrument a sensible range", () => {
    for (const x of I.LIST) {
      if (x.kind === "kit") expect(x.slots.length, x.name).toBe(8);
      if (x.kind === "pitched") {
        expect(x.range[0], x.name).toBeGreaterThanOrEqual(24);
        expect(x.range[0], x.name).toBeLessThan(x.range[1]);
        expect(x.range[1], x.name).toBeLessThanOrEqual(108);
      }
    }
  });

  it("rulings: kinds of the special instruments and of every effect", () => {
    expect(I.byId("timpani").kind).toBe("pitched");
    expect(I.byId("triangles-and-bells").kind).toBe("pitched");
    expect(I.byId("gongs-and-cymbals").kind).toBe("kit");
    for (const x of I.LIST.filter((i) => i.category === "fx")) expect(x.kind).toBe("fx");
  });

  it("recorded entries describe the files to prepare", () => {
    for (const x of I.LIST.filter((i) => i.source === "recorded")) {
      if (x.kind === "pitched") {
        const n = x.samples.notes;
        expect(n.length, x.name).toBeGreaterThanOrEqual(4);
        expect(n.length, x.name).toBeLessThanOrEqual(6);
        for (const m of n) {
          expect(m).toBeGreaterThanOrEqual(x.range[0]);
          expect(m).toBeLessThanOrEqual(x.range[1]);
        }
      } else if (x.kind === "kit") {
        expect(x.samples.files).toEqual(["0.wav", "1.wav", "2.wav", "3.wav", "4.wav", "5.wav", "6.wav", "7.wav"]);
      } else {
        expect(x.samples.files).toEqual(["0.wav"]);
      }
      expect(x.recipe).toBeUndefined();
    }
  });

  it("code recipes use only the seven engine types", () => {
    const types = ["fm", "pluck", "additive", "subtractive", "chip", "noiseDrum", "fx"];
    for (const x of I.LIST.filter((i) => i.source === "code")) {
      expect(types, x.name).toContain(x.recipe.type);
      if (x.kind === "kit") expect(x.recipe.type).toBe("noiseDrum");
      if (x.kind === "fx") expect(x.recipe.type).toBe("fx");
      if (x.kind === "fx") expect(x.recipe.params.effect).toBeTruthy();
      expect(x.samples).toBeUndefined();
    }
  });
});

// ---- every code instrument really makes a sound ---------------------------

function makeParam(v = 0) {
  const events = [];
  const rec = (k) => (val, t) => events.push([k, +Number(val).toFixed(4), +Number(t).toFixed(4)]);
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

function fakeCtx() {
  const ctx = { currentTime: 0, sampleRate: 44100, nodes: [], destination: {} };
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      connect(d) {
        return d;
      },
      disconnect() {},
      ...extra,
    };
    ctx.nodes.push(n);
    return n;
  };
  const src = (kind, extra) => () =>
    node(kind, {
      isSource: true,
      start(t) {
        this.startedAt = t;
      },
      stop(t) {
        this.stoppedAt = t;
      },
      ...extra,
    });
  ctx.createOscillator = src("osc", { type: "sine", frequency: makeParam(440), detune: makeParam(0), setPeriodicWave(w) { this.wave = w; } });
  ctx.createBufferSource = src("buf", { buffer: null, loop: false, playbackRate: makeParam(1) });
  ctx.createGain = () => node("gain", { gain: makeParam(1) });
  ctx.createBiquadFilter = () =>
    node("filter", { type: "lowpass", frequency: makeParam(350), Q: makeParam(1), gain: makeParam(0) });
  ctx.createDelay = () => node("delay", { delayTime: makeParam(0) });
  ctx.createPeriodicWave = (re, im) => ({ sum: Array.from(re).reduce((a, b) => a + b, 0) + Array.from(im).reduce((a, b) => a + b, 0) });
  ctx.createBuffer = (ch, len, rate) => {
    const data = new Float32Array(len);
    return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => data };
  };
  ctx.sources = () => ctx.nodes.filter((n) => n.isSource);
  return ctx;
}

describe("every code instrument plays through the engine", () => {
  const code = I.LIST.filter((x) => x.source === "code");
  it("there are code instruments to test", () => {
    expect(code.length).toBeGreaterThan(60);
  });
  for (const x of code) {
    it(`${x.name} makes at least one source`, () => {
      const ctx = fakeCtx();
      const voices = SS.engine.createVoices(ctx, I, "x");
      const pitch = x.kind === "pitched" ? Math.round((x.range[0] + x.range[1]) / 2) : x.kind === "kit" ? 1 : 60;
      let made;
      expect(() => {
        made = voices.play({ instrumentId: x.id, pitch, len: 2, gain: 0.8, dur: 0.5 }, 0, ctx.destination);
      }).not.toThrow();
      expect(made.length).toBeGreaterThan(0);
      expect(ctx.sources().length).toBeGreaterThan(0);
    });
  }
});

// ---- variety guard: every code sound must really differ ------------------
// A signature is what the engine asked the (fake) AudioContext to build for
// one note: node kinds, wave types, frequencies, filters, gains, scheduled
// times and the shape of any generated buffer.

function signature(inst, pitch) {
  const ctx = fakeCtx();
  const voices = SS.engine.createVoices(ctx, I, "x");
  voices.play({ instrumentId: inst.id, pitch, len: 2, gain: 0.8, dur: 0.5 }, 0, ctx.destination);
  const ev = (prm) => (prm && prm.events ? prm.events : []);
  return JSON.stringify(
    ctx.nodes.map((n) => {
      const o = { k: n.kind };
      if (n.type !== undefined) o.t = n.type;
      if (n.frequency) o.f = [n.frequency.value, ev(n.frequency)];
      if (n.Q) o.q = n.Q.value;
      if (n.gain && n.kind === "gain") o.g = [n.gain.value, ev(n.gain)];
      if (n.playbackRate) o.r = [+n.playbackRate.value.toFixed(5), ev(n.playbackRate)];
      if (n.detune) o.d = n.detune.value;
      if (n.wave) o.w = +n.wave.sum.toFixed(4);
      if (n.isSource) o.s = [n.startedAt, n.stoppedAt];
      if (n.buffer) {
        const d = n.buffer.getChannelData(0);
        let h = 0;
        for (let i = 0; i < d.length; i += 7) h += d[i] * ((i % 13) + 1);
        o.b = [d.length, +h.toFixed(3)];
      }
      return o;
    })
  );
}

function assertAllDistinct(label, sigs) {
  const seen = new Map();
  for (const [name, sig] of sigs) {
    expect(seen.has(sig), label + ": " + name + " sounds the same as " + seen.get(sig)).toBe(false);
    seen.set(sig, name);
  }
}

describe("code sounds do not collapse into each other", () => {
  const code = I.LIST.filter((x) => x.source === "code");

  it("the 8 code kits differ on every slot", () => {
    const kits = code.filter((x) => x.kind === "kit");
    expect(kits.length).toBe(8);
    for (let slot = 0; slot < 8; slot++) {
      assertAllDistinct("slot " + slot, kits.map((k) => [k.name, signature(k, slot)]));
    }
  });

  it("the 13 code effects all differ", () => {
    const fx = code.filter((x) => x.kind === "fx");
    expect(fx.length).toBe(13);
    assertAllDistinct("fx", fx.map((x) => [x.name, signature(x, 60)]));
  });

  it("every code pluck differs", () => {
    const plucks = code.filter((x) => x.recipe.type === "pluck");
    expect(plucks.length).toBeGreaterThanOrEqual(9);
    assertAllDistinct("pluck", plucks.map((x) => [x.name, signature(x, 60)]));
  });

  it("every code pitched instrument differs from every other", () => {
    assertAllDistinct(
      "pitched",
      code.filter((x) => x.kind === "pitched").map((x) => [x.name, signature(x, 60)])
    );
  });

  it("pick position shapes the whole note, not just the first period", () => {
    const grab = (pick) => {
      const ctx = fakeCtx();
      const rec = { id: "pk", kind: "pitched", source: "code", range: [36, 96], recipe: { type: "pluck", damp: 0.996, pick } };
      SS.engine
        .createVoices(ctx, { byId: () => rec }, "x")
        .play({ instrumentId: "pk", pitch: 60, len: 2, gain: 0.8, dur: 0.5 }, 0, ctx.destination);
      return ctx.sources().find((n) => n.kind === "buf").buffer.getChannelData(0);
    };
    const plain = grab(undefined);
    const combed = grab(0.2);
    const period = Math.round(44100 / (440 * Math.pow(2, -9 / 12)));
    let diff = 0;
    for (let i = 10 * period; i < 10 * period + 50; i++) diff += Math.abs(plain[i] - combed[i]);
    expect(diff).toBeGreaterThan(0.01);
    // and no jump where the loop takes over
    expect(Math.abs(combed[period] - combed[period - 1])).toBeLessThan(1.5);
  });

  it("Wobble bass LFO never drops the cutoff below 60 Hz and Rocket has its own effect", () => {
    const ctx = fakeCtx();
    SS.engine.createVoices(ctx, I, "x").play({ instrumentId: "wobble-bass", pitch: 40, len: 2, gain: 0.8, dur: 0.5 }, 0, ctx.destination);
    const lfoGain = ctx.nodes.find((n) => n.kind === "gain" && n.gain.value > 0 && n.gain.events.length === 0);
    const f = ctx.nodes.find((n) => n.kind === "filter");
    const low = Math.min(...f.frequency.events.map((e) => e[1]));
    expect(lfoGain.gain.value).toBeLessThanOrEqual(low - 60 + 1e-9);
    expect(I.byId("rocket").recipe.params.effect).toBe("rocket");
  });

  it("Wobble bass has a real LFO on its filter and the effects list is covered", () => {
    const wob = I.byId("wobble-bass");
    const ctx = fakeCtx();
    SS.engine.createVoices(ctx, I, "x").play({ instrumentId: wob.id, pitch: 40, len: 2, gain: 0.8, dur: 0.5 }, 0, ctx.destination);
    expect(ctx.sources().filter((s) => s.kind === "osc").length).toBe(3);
    for (const x of code.filter((i) => i.kind === "fx")) {
      expect(SS.engine.FX_EFFECTS).toContain(x.recipe.params.effect);
    }
  });

  it("every setting a catalog recipe sets is one the engine reads", () => {
    for (const x of code) {
      const read = SS.engine.RECIPE_PARAMS[x.recipe.type];
      const keys = Object.keys(x.recipe).filter((k) => k !== "type" && k !== "params");
      expect(Object.keys(x.recipe.params).sort(), x.name).toEqual(keys.sort());
      for (const k of keys) expect(read, x.name + "." + k).toContain(k);
      if (x.recipe.type === "noiseDrum") expect(SS.engine.DRUM_STYLES[x.recipe.style], x.name).toBeTruthy();
    }
  });
});
