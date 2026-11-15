import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

describe("Sound Space model", () => {
  it("exposes the song constants from the design", () => {
    const SS = loadSS("model.js");
    expect(SS.model.CONST).toEqual({ SCHEMA_VERSION: 1, STEPS_PER_COUNT: 2, COUNTS: [4, 8, 16], GRIDS: [2, 4], MAX_TRACKS: 8, TEMPO_MIN: 60, TEMPO_MAX: 160, TEMPO_DEFAULT: 120, GRID_DEFAULT: 4 });
  });

  const M = () => loadSS("model.js").model;
  const stepsOf = (t) => t.notes.map((n) => n.step).sort((a, b) => a - b);
  const mk = (counts, steps) => {
    const m = M();
    const song = m.newSong();
    song.counts = counts;
    song.grid = 2;   // these tests are about the eighth grid
    const t = m.addTrack(song, "piano");
    steps.forEach((s) => m.toggleNote(t, s, 60));
    return { m, song, t };
  };

  it("a new song is 8 counts at 120, looping, with no tracks", () => {
    const s = M().newSong();
    expect(s.schemaVersion).toBe(1);
    expect(s.title).toBe("My song");
    expect(s.counts).toBe(8);
    expect(s.tempo).toBe(120);
    expect(s.grid).toBe(4);
    expect(s.loop).toBe(true);
    expect(s.countIn).toBe(true);
    expect(s.volume).toBe(0.8);
    expect(s.tracks).toEqual([]);
    expect(typeof s.id).toBe("string");
    expect(typeof s.updatedMs).toBe("number");
    expect(M().newSong({ title: "Hi" }).title).toBe("Hi");
    expect(M().totalSteps(s)).toBe(32);
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

  it("a recorded press lands on the square the kid heard, after taking off the speakers' delay", () => {
    const m = M();
    // 100 bpm: a square is 0.3 s; 4 counts = 8 squares = 2.4 s a pass; recording started at 10 s
    const start = 10, sq = 0.3;
    // pressed exactly as the kick on square 2 came out of the speakers, 0.1 s after it was played
    expect(m.recordedStep(start + 2 * sq + 0.1, start, 100, 8, 0.1)).toBe(2);
    // the same press without the correction would be read 0.1 s late; a slightly late kid then lands a square late
    expect(m.recordedStep(start + 2 * sq + 0.1 + 0.06, start, 100, 8, 0)).toBe(3);
    expect(m.recordedStep(start + 2 * sq + 0.1 + 0.06, start, 100, 8, 0.1)).toBe(2);
    // a little early or a little late still lands on the square
    expect(m.recordedStep(start + 4 * sq - 0.12 + 0.1, start, 100, 8, 0.1)).toBe(4);
    expect(m.recordedStep(start + 4 * sq + 0.12 + 0.1, start, 100, 8, 0.1)).toBe(4);
    // just before the loop comes round, it belongs to the first square of the next pass
    expect(m.recordedStep(start + 8 * sq - 0.05 + 0.1, start, 100, 8, 0.1)).toBe(0);
    // second pass, square 6
    expect(m.recordedStep(start + 2.4 + 6 * sq + 0.1, start, 100, 8, 0.1)).toBe(6);
    // no latency known (or a bad value) means no correction
    expect(m.recordedStep(start + 2 * sq, start, 100, 8, undefined)).toBe(2);
    expect(m.recordedStep(start + 2 * sq, start, 100, 8, -1)).toBe(2);
    expect(m.recordedStep(start + 2 * sq, start, 100, 8, NaN)).toBe(2);
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

  describe("sixteenth-note grid (task 7b)", () => {
    const validIds = new Set(["piano"]);
    it("a new song is on sixteenths, a song saved without a grid is still eighths, and older files still open", () => {
      const m = M();
      expect(m.newSong().grid).toBe(4);
      expect(m.CONST.GRID_DEFAULT).toBe(4);
      expect(m.CONST.STEPS_PER_COUNT).toBe(2);
      const old = m.newSong(); delete old.grid; old.counts = 8;
      expect(m.totalSteps(old)).toBe(16);
      const r = m.validateSong(old, validIds);
      expect(r.ok).toBe(true);
      expect(r.song.grid || 2).toBe(2);
      const bad = m.newSong(); bad.grid = 3;
      expect(m.validateSong(bad, validIds)).toEqual({ ok: false, error: "bad_field" });
      const good = m.newSong(); good.grid = 4;
      expect(m.validateSong(good, validIds).ok).toBe(true);
    });

    it("sixteenths double the squares", () => {
      const SS = loadSS("model.js", "engine.js");
      const song = SS.model.newSong(); song.counts = 8; song.grid = 4;
      expect(SS.model.totalSteps(song)).toBe(32);
      expect(SS.engine.stepSeconds(100, 4)).toBeCloseTo(0.15, 10);
      expect(SS.engine.stepSeconds(100)).toBeCloseTo(0.3, 10);
    });

    it("a note on the last sixteenth square is valid", () => {
      const m = M();
      const song = m.newSong(); song.grid = 4;
      const t = m.addTrack(song, "piano"); m.toggleNote(t, 31, 60);
      expect(m.validateSong(song, validIds).ok).toBe(true);
    });

    it("switching to sixteenths loses nothing; back to eighths snaps and merges", () => {
      const { m, song, t } = mk(8, []);
      t.notes.push({ step: 1, pitch: 60, len: 2, vel: 0.9 }, { step: 3, pitch: 60, len: 2, vel: 0.9 });
      const up = m.setGrid(song, 4);
      expect(up.moved).toBe(false);
      expect(up.song.grid).toBe(4);
      expect(up.song).not.toBe(song);
      expect(up.song.tracks[0].notes.map((n) => [n.step, n.len])).toEqual([[2, 4], [6, 4]]);
      const down = m.setGrid(up.song, 2);
      expect(down.moved).toBe(false);
      expect(down.song.grid).toBe(2);
      expect(down.song.tracks[0].notes.map((n) => [n.step, n.len])).toEqual([[1, 2], [3, 2]]);

      const s2 = m.newSong(); s2.grid = 4;
      const t2 = m.addTrack(s2, "piano");
      t2.notes.push({ step: 4, pitch: 60, len: 2, vel: 0.9 }, { step: 3, pitch: 60, len: 1, vel: 0.9 });
      const d2 = m.setGrid(s2, 2);
      expect(d2.moved).toBe(true);
      expect(d2.song.tracks[0].notes.map((n) => [n.step, n.pitch, n.len])).toEqual([[2, 60, 1]]);
      expect(m.validateSong(d2.song, validIds).ok).toBe(true);
    });

    it("note values in squares", () => {
      const m = M();
      expect(m.NOTE_VALUES.map((v) => v.id)).toEqual(["whole", "half", "quarter", "eighth", "sixteenth"]);
      expect(m.noteSquares("whole", 2)).toBe(8);
      expect(m.noteSquares("quarter", 4)).toBe(4);
      expect(m.noteSquares("sixteenth", 4)).toBe(1);
      expect(m.noteSquares("sixteenth", 2)).toBe(null);
    });

    it("fast playing lands exactly on sixteenths", () => {
      const m = M();
      expect(m.quantizeStep(0.14, 0, 100, 32, 4)).toBe(1);
      expect(m.quantizeStep(0.31, 0, 100, 32, 4)).toBe(2);
      expect(m.quantizeStep(0.14, 0, 100, 16)).toBe(0);
      expect(m.quantizeStep(0.31, 0, 100, 16)).toBe(1);
      expect(m.recordedStep(0.31, 0, 100, 32, 0, 4)).toBe(2);
    });

    it("an eighth pattern on a sixteenths song keeps its rhythm", () => {
      const m = M();
      const t = { notes: [] };
      m.applyPattern(t, [{ step: 3, pitch: 60, len: 1, vel: 0.9 }], 4, 4, 2, 4);
      expect(t.notes.map((n) => [n.step, n.len])).toEqual([[6, 2]]);
      const t2 = { notes: [] };
      m.applyPattern(t2, [{ step: 3, pitch: 60, len: 1, vel: 0.9 }], 4, 8, 2, 4);
      expect(t2.notes.map((n) => n.step)).toEqual([6, 22]);
    });
  });

  it("a recorded note counts a square once 30% of it is held", () => {
    const m = M();
    const step = 0.3;
    const cases = [[3.4, 4], [2.2, 2], [2.31, 3], [1.7, 2], [1.1, 1], [0.85, 1], [0.2, 1]];
    for (const [steps, want] of cases) {
      expect(m.recordedLength(steps * step, step), `${steps} steps`).toBe(want);
      expect(m.recordedLength(steps * 0.15, 0.15), `${steps} steps grid 4`).toBe(want);
    }
  });

  describe("reverb and sustain on each track", () => {
    const ids = new Set(["piano", "grand-piano", "classic-kit", "hip-hop-kit", "synth-bass", "electric-piano", "lo-fi-kit", "marimba"]);
    const good = () => { const m = M(); const s = m.newSong(); m.addTrack(s, "piano"); return JSON.parse(JSON.stringify(s)); };

    it("new tracks start dry with sustain off, and both keys are track keys", () => {
      const m = M();
      const s = m.newSong();
      const t = m.addTrack(s, "piano");
      expect(t.reverb).toBe(0);
      expect(t.sustain).toBe(false);
      expect(m.TRACK_KEYS).toContain("reverb");
      expect(m.TRACK_KEYS).toContain("sustain");
    });

    it("starters and lesson songs start dry with sustain off", () => {
      const SS = loadSS("model.js", "instruments.js", "icons.js", "library.js", "lessons.js");
      const songs = SS.library.STARTERS.map((st) => st.song).concat(SS.lessons.LESSONS.map((l) => l.startSong));
      expect(songs.length).toBeGreaterThan(0);
      for (const s of songs) for (const t of s.tracks) {
        expect(t.reverb, s.title).toBe(0);
        expect(t.sustain, s.title).toBe(false);
      }
    });

    it("a song saved before reverb and sustain opens with them off", () => {
      const m = M();
      const old = good();
      delete old.tracks[0].reverb; delete old.tracks[0].sustain;
      const r = m.validateSong(old, ids);
      expect(r.ok).toBe(true);
      expect(r.song.tracks[0].reverb).toBe(0);
      expect(r.song.tracks[0].sustain).toBe(false);
      expect(old.tracks[0]).not.toHaveProperty("reverb");   // the input is left as it was
      const filled = m.fillTrackDefaults({ tracks: [{ id: "a" }, { id: "b", reverb: 2, sustain: true }] });
      expect(filled.tracks.map((t) => [t.reverb, t.sustain])).toEqual([[0, false], [2, true]]);
    });

    it("keeps good values and rejects bad ones", () => {
      const m = M();
      for (const lv of [0, 1, 2, 3, 4]) {   // 4 is Stadium
        const o = good(); o.tracks[0].reverb = lv; o.tracks[0].sustain = lv % 2 === 1;
        const r = m.validateSong(o, ids);
        expect(r.ok, "reverb " + lv).toBe(true);
        expect(r.song.tracks[0].reverb).toBe(lv);
        expect(r.song.tracks[0].sustain).toBe(lv % 2 === 1);
      }
      for (const bad of [-1, 5, 1.5, "1", null, true]) {
        const o = good(); o.tracks[0].reverb = bad;
        expect(m.validateSong(o, ids), "reverb " + JSON.stringify(bad)).toEqual({ ok: false, error: "bad_field" });
      }
      for (const bad of ["yes", 1, 0, null, "true"]) {
        const o = good(); o.tracks[0].sustain = bad;
        expect(m.validateSong(o, ids), "sustain " + JSON.stringify(bad)).toEqual({ ok: false, error: "bad_field" });
      }
    });
  });

  // Owner: Chorus, Dynamics and EQ on each track (docs/mockups/sound-space-track-effects-draft.html).
  describe("chorus, dynamics and EQ on each track", () => {
    const ids = new Set(["piano"]);
    const good = () => { const m = M(); const s = m.newSong(); m.addTrack(s, "piano"); return JSON.parse(JSON.stringify(s)); };
    const OFF = { chorus: { kind: "off", amount: 45 }, dyn: { kind: "off", amount: 50 }, eq: { low: 0, mid: 0, high: 0, lowcut: false } };

    it("new tracks start with every effect off, and the three are track keys", () => {
      const m = M();
      const t = m.addTrack(m.newSong(), "piano");
      expect({ chorus: t.chorus, dyn: t.dyn, eq: t.eq }).toEqual(OFF);
      for (const k of ["chorus", "dyn", "eq"]) expect(m.TRACK_KEYS).toContain(k);
      expect(m.FX.CHORUS_KINDS).toEqual(["off", "chorus", "flanger", "phaser"]);
      expect(m.FX.DYN_KINDS).toEqual(["off", "compress", "limit"]);
      expect(m.FX.EQ_MAX).toBe(12);
    });

    it("a song saved before the effects opens with them off, and the input is left as it was", () => {
      const m = M();
      const old = good();
      for (const k of ["chorus", "dyn", "eq"]) delete old.tracks[0][k];
      const r = m.validateSong(old, ids);
      expect(r.ok).toBe(true);
      const t = r.song.tracks[0];
      expect({ chorus: t.chorus, dyn: t.dyn, eq: t.eq }).toEqual(OFF);
      expect(old.tracks[0]).not.toHaveProperty("chorus");
      const filled = m.fillTrackDefaults({ tracks: [{ id: "a" }, { id: "b", chorus: { kind: "phaser", amount: 70 }, dyn: { kind: "limit", amount: 10 }, eq: { low: 3, mid: 0, high: -5, lowcut: true } }] });
      expect(filled.tracks[0].chorus).toEqual(OFF.chorus);
      expect(filled.tracks[0].eq).toEqual(OFF.eq);
      expect(filled.tracks[1].chorus).toEqual({ kind: "phaser", amount: 70 });
      expect(filled.tracks[1].eq).toEqual({ low: 3, mid: 0, high: -5, lowcut: true });
      // each track gets its own objects, never one shared default
      const two = m.fillTrackDefaults({ tracks: [{ id: "a" }, { id: "b" }] });
      expect(two.tracks[0].eq).not.toBe(two.tracks[1].eq);
    });

    it("keeps good values", () => {
      const m = M();
      for (const kind of ["off", "chorus", "flanger", "phaser"]) for (const amount of [0, 45, 100]) {
        const o = good(); o.tracks[0].chorus = { kind, amount };
        const r = m.validateSong(o, ids);
        expect(r.ok, kind + " " + amount).toBe(true);
        expect(r.song.tracks[0].chorus).toEqual({ kind, amount });
      }
      for (const kind of ["off", "compress", "limit"]) {
        const o = good(); o.tracks[0].dyn = { kind, amount: 100 };
        expect(m.validateSong(o, ids).ok, kind).toBe(true);
      }
      const o = good(); o.tracks[0].eq = { low: -12, mid: 0, high: 12, lowcut: true };
      expect(m.validateSong(o, ids).song.tracks[0].eq).toEqual({ low: -12, mid: 0, high: 12, lowcut: true });
    });

    it("rejects bad kinds, amounts out of range or not whole, bad EQ bands, and extra or missing keys", () => {
      const m = M();
      const bad = (field, value) => { const o = good(); o.tracks[0][field] = value; return m.validateSong(o, ids); };
      const no = { ok: false, error: "bad_field" };
      for (const c of [
        { kind: "wah", amount: 45 }, { kind: "chorus", amount: 101 }, { kind: "chorus", amount: 4.5 }, { kind: "chorus", amount: -1 },
        { kind: "chorus", amount: "45" }, { kind: "chorus" }, { amount: 45 }, { kind: "chorus", amount: 45, rate: 2 }, null, "chorus", [], 3,
        { kind: "compress", amount: 50 },
      ]) expect(bad("chorus", c), "chorus " + JSON.stringify(c)).toEqual(no);
      for (const d of [
        { kind: "gate", amount: 50 }, { kind: "compress", amount: 101 }, { kind: "limit", amount: 4.5 }, { kind: "limit", amount: 50, knee: 3 }, { kind: "limit" }, null,
        { kind: "phaser", amount: 50 },
      ]) expect(bad("dyn", d), "dyn " + JSON.stringify(d)).toEqual(no);
      for (const e of [
        { low: -13, mid: 0, high: 0, lowcut: false }, { low: 0, mid: 13, high: 0, lowcut: false }, { low: "3", mid: 0, high: 0, lowcut: false },
        { low: 1.5, mid: 0, high: 0, lowcut: false }, { low: 0, mid: 0, high: 0, lowcut: "yes" }, { low: 0, mid: 0, high: 0 },
        { low: 0, mid: 0, high: 0, lowcut: false, bass: 2 }, null, [],
      ]) expect(bad("eq", e), "eq " + JSON.stringify(e)).toEqual(no);
    });

    it("a full song with every effect on every track stays far under the 500 KB song limit", () => {
      const m = M();
      const s = m.newSong();
      for (let i = 0; i < m.CONST.MAX_TRACKS; i++) {
        const t = m.addTrack(s, "piano");
        t.chorus = { kind: "flanger", amount: 100 }; t.dyn = { kind: "compress", amount: 100 }; t.eq = { low: -12, mid: 12, high: -12, lowcut: true };
      }
      const plain = JSON.parse(JSON.stringify(s));
      plain.tracks.forEach((t) => { delete t.chorus; delete t.dyn; delete t.eq; });
      const extra = JSON.stringify(s).length - JSON.stringify(plain).length;
      expect(extra).toBeLessThan(2000);   // about 150 bytes a track
      expect(m.validateSong(JSON.parse(JSON.stringify(s)), ids).ok).toBe(true);
    });
  });
});
