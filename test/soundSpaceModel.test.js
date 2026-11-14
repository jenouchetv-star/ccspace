import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

describe("Sound Space model", () => {
  it("exposes the song constants from the design", () => {
    const SS = loadSS("model.js");
    expect(SS.model.CONST).toEqual({ SCHEMA_VERSION: 1, STEPS_PER_COUNT: 2, COUNTS: [4, 8, 16], MAX_TRACKS: 8, TEMPO_MIN: 60, TEMPO_MAX: 160, TEMPO_DEFAULT: 100 });
  });

  const M = () => loadSS("model.js").model;
  const stepsOf = (t) => t.notes.map((n) => n.step).sort((a, b) => a - b);
  const mk = (counts, steps) => {
    const m = M();
    const song = m.newSong();
    song.counts = counts;
    const t = m.addTrack(song, "piano");
    steps.forEach((s) => m.toggleNote(t, s, 60));
    return { m, song, t };
  };

  it("a new song is 8 counts at 100, looping, with no tracks", () => {
    const s = M().newSong();
    expect(s.schemaVersion).toBe(1);
    expect(s.title).toBe("My song");
    expect(s.counts).toBe(8);
    expect(s.tempo).toBe(100);
    expect(s.loop).toBe(true);
    expect(s.countIn).toBe(false);
    expect(s.volume).toBe(0.8);
    expect(s.tracks).toEqual([]);
    expect(typeof s.id).toBe("string");
    expect(typeof s.updatedMs).toBe("number");
    expect(M().newSong({ title: "Hi" }).title).toBe("Hi");
    expect(M().totalSteps(s)).toBe(16);
  });

  it("allows 8 tracks and refuses a ninth", () => {
    const m = M();
    const song = m.newSong();
    const results = [];
    for (let i = 0; i < 9; i++) results.push(m.addTrack(song, "piano"));
    expect(results[8]).toBeNull();
    expect(song.tracks.length).toBe(8);
    expect(results[0]).toMatchObject({ instrumentId: "piano", volume: 0.8, mute: false, solo: false, notes: [] });
  });

  it("toggling a pad adds then removes the note; chords are allowed", () => {
    const { m, t } = mk(8, []);
    expect(m.toggleNote(t, 0, 60)).toBe(true);
    expect(m.toggleNote(t, 0, 64)).toBe(true);
    expect(t.notes.length).toBe(2);
    expect(m.toggleNote(t, 0, 60)).toBe(false);
    expect(t.notes.length).toBe(1);
  });

  it("a note never runs past the end", () => {
    const { m, song, t } = mk(8, [14]);
    m.setNoteLength(t, 14, 60, 5, m.totalSteps(song));
    expect(t.notes[0].len).toBe(2);
    expect(m.totalSteps(song)).toBe(16);
  });

  it("lengthening repeats the song; shortening hides the rest and lengthening brings it back", () => {
    const { m, song } = mk(8, [1, 13]);
    const r1 = m.resizeSong(song, 4);
    expect(r1.song.counts).toBe(4);
    expect(stepsOf(r1.song.tracks[0])).toEqual([1]);
    expect(song.counts).toBe(8);
    const r2 = m.resizeSong(r1.song, 8, r1.stash);
    expect(stepsOf(r2.song.tracks[0])).toEqual([1, 13]);
    const b = mk(4, [3]);
    const r3 = b.m.resizeSong(b.song, 16);
    expect(stepsOf(r3.song.tracks[0])).toEqual([3, 11, 19, 27]);
  });

  it("recorded presses snap to the nearest square", () => {
    const m = M();
    expect(m.quantizeStep(0.44, 0, 100, 16)).toBe(1);
    expect(m.quantizeStep(4.79, 0, 100, 16)).toBe(0);
  });

  it("opening a file checks every field", () => {
    const m = M();
    const ids = new Set(["piano"]);
    const good = () => {
      const s = m.newSong();
      m.addTrack(s, "piano");
      return JSON.parse(JSON.stringify(s));
    };
    expect(m.validateSong({ schemaVersion: 2 }, ids).ok).toBe(false);
    expect(m.validateSong(good(), ids)).toMatchObject({ ok: true, missing: [] });
    let o = good(); o.counts = 5;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tempo = 300;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tracks[0].notes.push({ step: 99, pitch: 60, len: 1, vel: 0.9 });
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tracks[0].notes.push({ step: 1, pitch: 60, len: 0, vel: 0.9 });
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tracks[0].notes.push({ step: 1, pitch: 60, len: 1, vel: 2 });
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); for (let i = 0; i < 8; i++) o.tracks.push({ ...o.tracks[0], id: "x" + i });
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tracks[0].instrumentId = "mystery";
    expect(m.validateSong(o, ids)).toMatchObject({ ok: true, missing: ["mystery"] });
    o = good(); o.audioUrl = "x";
    expect(m.validateSong(o, ids)).toEqual({ ok: false, error: "unknown_field" });
    o = good(); o.tracks[0].extra = 1;
    expect(m.validateSong(o, ids)).toEqual({ ok: false, error: "unknown_field" });
    o = good(); o.tracks[0].notes.push({ step: 1, pitch: 60, len: 1, vel: 0.9, x: 1 });
    expect(m.validateSong(o, ids)).toEqual({ ok: false, error: "unknown_field" });
  });

  it("a pattern repeats to fill the song and is cut at its end", () => {
    const m = M();
    const song = m.newSong();
    const t = m.addTrack(song, "piano");
    m.applyPattern(t, [{ step: 2, pitch: 60, len: 1, vel: 0.9 }], 4, 8);
    expect(stepsOf(t)).toEqual([2, 10]);
    const song2 = m.newSong();
    song2.counts = 4;
    const t2 = m.addTrack(song2, "piano");
    m.applyPattern(t2, [{ step: 1, pitch: 60, len: 1, vel: 0.9 }, { step: 20, pitch: 60, len: 1, vel: 0.9 }], 16, 4);
    expect(stepsOf(t2)).toEqual([1]);
  });

  it("undo and redo restore earlier songs, 100 deep", () => {
    const m = M();
    const h = m.createHistory();
    for (let i = 0; i < 101; i++) { const s = m.newSong(); s.tempo = 60 + (i % 100); s.title = "s" + i; h.push(s); }
    expect(h.canRedo()).toBe(false);
    let last;
    for (let i = 0; i < 100; i++) last = h.undo();
    expect(last.title).toBe("s0");
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo().title).toBe("s1");
    expect(h.canRedo()).toBe(true);
  });

  it("note length still clamps on a resized (cloned) song", () => {
    const { m, song } = mk(8, [6]);
    const { song: short } = m.resizeSong(song, 4);
    const t = short.tracks[0];
    m.setNoteLength(t, 6, 60, 5, m.totalSteps(short));
    expect(t.notes[0].len).toBe(2);
    m.setNoteLength(t, 6, 60, NaN, m.totalSteps(short));
    m.setNoteLength(t, 6, 60, 1, undefined);
    expect(t.notes[0].len).toBe(2);
  });

  it("opening a file rejects bad or missing basic fields", () => {
    const m = M();
    const ids = new Set(["piano"]);
    const good = () => { const s = m.newSong(); m.addTrack(s, "piano"); return JSON.parse(JSON.stringify(s)); };
    let o = good(); o.volume = "x";
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); delete o.id;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); delete o.tracks[0].id;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); m.addTrack(o, "piano"); o.tracks[1].id = o.tracks[0].id;
    expect(m.validateSong(JSON.parse(JSON.stringify(o)), ids).ok).toBe(false);
    o = good(); o.title = "x".repeat(61);
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.loop = 1;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.tracks[0].mute = "no";
    expect(m.validateSong(o, ids).ok).toBe(false);
  });

  it("shorten, undo, lengthen leaves no duplicate notes", () => {
    const { m, song } = mk(8, [1, 13]);
    const h = m.createHistory();
    h.push(song);
    const r1 = m.resizeSong(song, 4);
    h.push(r1.song);
    const back = h.undo();
    const r2 = m.resizeSong(back, 4, r1.stash);
    const r3 = m.resizeSong(r2.song, 8, r2.stash);
    const keys = r3.song.tracks[0].notes.map((n) => n.step + ":" + n.pitch);
    expect(new Set(keys).size).toBe(keys.length);
    expect(stepsOf(r3.song.tracks[0])).toEqual([1, 13]);
    const st = {};
    m.resizeSong(song, 4, st);
    m.resizeSong(song, 4, st);
    expect(Object.values(st)[0].length).toBe(1);
  });
});
