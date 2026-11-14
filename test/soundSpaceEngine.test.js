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
