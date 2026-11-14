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
  return {
    value: v,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
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
    node(kind, { isSource: true, start() {}, stop() {}, ...extra });
  ctx.createOscillator = src("osc", { type: "sine", frequency: makeParam(440), detune: makeParam(0), setPeriodicWave() {} });
  ctx.createBufferSource = src("buf", { buffer: null, loop: false, playbackRate: makeParam(1) });
  ctx.createGain = () => node("gain", { gain: makeParam(1) });
  ctx.createBiquadFilter = () =>
    node("filter", { type: "lowpass", frequency: makeParam(350), Q: makeParam(1), gain: makeParam(0) });
  ctx.createPeriodicWave = () => ({});
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
