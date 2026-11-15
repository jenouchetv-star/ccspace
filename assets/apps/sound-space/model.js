(function (root) {
  const SS = root.SoundSpace = root.SoundSpace || {};

  const CONST = {
    SCHEMA_VERSION: 1,
    STEPS_PER_COUNT: 2,
    COUNTS: [4, 8, 16],
    GRIDS: [2, 4],
    MAX_TRACKS: 8,
    TEMPO_MIN: 60,
    TEMPO_MAX: 160,
    TEMPO_DEFAULT: 120,
    // New songs start on sixteenths. STEPS_PER_COUNT (2) stays the fallback for songs saved before `grid` existed: they play as eighths.
    GRID_DEFAULT: 4
  };

  const SONG_KEYS = ["schemaVersion", "id", "title", "counts", "tempo", "grid", "loop", "countIn", "volume", "tracks", "updatedMs"];
  // reverb: 0 Off, 1 Room, 2 Hall, 3 Big hall, 4 Stadium. sustain: notes ring on after they end (pitched instruments only).
  // Songs saved before these two have neither; they open as reverb 0 and sustain false.
  // chorus, dyn and eq: each track's Chorus, Dynamics and EQ. Songs saved before them have none; they open with every
  // effect off (fillTrackDefaults).
  const TRACK_KEYS = ["id", "instrumentId", "volume", "mute", "solo", "notes", "reverb", "sustain", "chorus", "dyn", "eq"];
  const REVERB_MAX = 4;
  // chorus: { kind, amount 0-100 }; dyn: { kind, amount 0-100 }; eq: { low, mid, high: whole dB from -12 to 12, lowcut }.
  // No gate: Sound Space's sounds have no background noise for one to take away.
  const FX = {
    CHORUS_KINDS: ["off", "chorus", "flanger", "phaser"],
    DYN_KINDS: ["off", "compress", "limit"],
    EQ_MAX: 12,
    CHORUS_AMOUNT: 45,
    DYN_AMOUNT: 50
  };
  const defaultChorus = () => ({ kind: "off", amount: FX.CHORUS_AMOUNT });
  const defaultDyn = () => ({ kind: "off", amount: FX.DYN_AMOUNT });
  const defaultEq = () => ({ low: 0, mid: 0, high: 0, lowcut: false });
  const NOTE_KEYS = ["step", "pitch", "len", "vel"];

  function makeId() {
    const c = root.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isInt = (n) => typeof n === "number" && Number.isInteger(n);
  const isNum = (n) => typeof n === "number" && isFinite(n);

  function totalSteps(song) {
    return song.counts * (song.grid || CONST.STEPS_PER_COUNT);
  }

  const NOTE_VALUES = [
    { id: "whole", name: "Whole note", beats: 4 },
    { id: "half", name: "Half note", beats: 2 },
    { id: "quarter", name: "Quarter note", beats: 1 },
    { id: "eighth", name: "Eighth note", beats: 0.5 },
    { id: "sixteenth", name: "Sixteenth note", beats: 0.25 }
  ];

  // How many squares a note value covers on a grid, or null when it does not
  // fall on whole squares (a sixteenth on eighths).
  function noteSquares(valueId, grid) {
    const v = NOTE_VALUES.find((x) => x.id === valueId);
    if (!v) return null;
    const sq = v.beats * (grid || CONST.STEPS_PER_COUNT);
    return Number.isInteger(sq) && sq >= 1 ? sq : null;
  }

  function newSong(opts) {
    return {
      schemaVersion: CONST.SCHEMA_VERSION,
      id: makeId(),
      title: (opts && opts.title) || "My song",
      counts: 8,
      grid: CONST.GRID_DEFAULT,
      tempo: CONST.TEMPO_DEFAULT,
      loop: true,
      countIn: true,
      volume: 0.8,
      tracks: [],
      updatedMs: Date.now()
    };
  }

  function addTrack(song, instrumentId) {
    if (song.tracks.length >= CONST.MAX_TRACKS) return null;
    const track = { id: makeId(), instrumentId, volume: 0.8, mute: false, solo: false, notes: [], reverb: 0, sustain: false,
      chorus: defaultChorus(), dyn: defaultDyn(), eq: defaultEq() };
    song.tracks.push(track);
    return track;
  }

  // Gives every track that lacks them reverb 0, sustain false and every effect off (songs saved before those existed).
  function fillTrackDefaults(song) {
    (song.tracks || []).forEach((t) => {
      if (t.reverb === undefined) t.reverb = 0;
      if (t.sustain === undefined) t.sustain = false;
      if (t.chorus === undefined) t.chorus = defaultChorus();
      if (t.dyn === undefined) t.dyn = defaultDyn();
      if (t.eq === undefined) t.eq = defaultEq();
    });
    return song;
  }

  // An effect's settings: an object with exactly these keys.
  const exactKeys = (o, keys) => !!o && typeof o === "object" && !Array.isArray(o) &&
    Object.keys(o).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));
  const isAmount = (n) => isInt(n) && n >= 0 && n <= 100;
  const isBand = (n) => isInt(n) && n >= -FX.EQ_MAX && n <= FX.EQ_MAX;
  function validKindAmount(o, kinds) {
    return exactKeys(o, ["kind", "amount"]) && kinds.indexOf(o.kind) >= 0 && isAmount(o.amount);
  }
  function validEq(o) {
    return exactKeys(o, ["low", "mid", "high", "lowcut"]) && isBand(o.low) && isBand(o.mid) && isBand(o.high) && typeof o.lowcut === "boolean";
  }

  function toggleNote(track, step, pitch, vel) {
    const i = track.notes.findIndex((n) => n.step === step && n.pitch === pitch);
    if (i >= 0) {
      track.notes.splice(i, 1);
      return false;
    }
    track.notes.push({ step, pitch, len: 1, vel: vel === undefined ? 0.9 : vel });
    return true;
  }

  // Clamps the length so the note never runs past the song end. `total` (the
  // song's total steps) is required; without a valid one nothing changes.
  function setNoteLength(track, step, pitch, len, total) {
    if (!isInt(total) || total < 1 || !isNum(len)) return;
    const n = track.notes.find((x) => x.step === step && x.pitch === pitch);
    if (!n) return;
    n.len = Math.max(1, Math.min(Math.floor(len), total - step));
  }

  const hasNote = (list, n) => list.some((x) => x.step === n.step && x.pitch === n.pitch);

  function resizeSong(song, counts, stash) {
    const st = stash || {};
    const out = clone(song);
    const oldTotal = totalSteps(song);
    const newTotal = counts * (song.grid || CONST.STEPS_PER_COUNT);
    out.counts = counts;
    out.updatedMs = Date.now();
    out.tracks.forEach((t) => {
      if (newTotal < oldTotal) {
        const hidden = t.notes.filter((n) => n.step >= newTotal);
        t.notes = t.notes.filter((n) => n.step < newTotal);
        t.notes.forEach((n) => { n.len = Math.max(1, Math.min(n.len, newTotal - n.step)); });
        if (hidden.length) {
          const list = st[t.id] || [];
          hidden.forEach((n) => { if (!hasNote(list, n)) list.push(n); });
          st[t.id] = list;
        }
      } else if (newTotal > oldTotal) {
        const stashed = st[t.id];
        if (stashed && stashed.length) {
          const back = stashed.filter((n) => n.step < newTotal);
          const rest = stashed.filter((n) => n.step >= newTotal);
          back.forEach((n) => { if (!hasNote(t.notes, n)) t.notes.push(n); });
          if (rest.length) st[t.id] = rest; else delete st[t.id];
        } else {
          const base = t.notes.slice();
          for (let off = oldTotal; off < newTotal; off += oldTotal) {
            base.forEach((n) => {
              if (n.step + off < newTotal) {
                t.notes.push({ step: n.step + off, pitch: n.pitch, len: Math.min(n.len, newTotal - (n.step + off)), vel: n.vel });
              }
            });
          }
        }
      }
    });
    return { song: out, stash: st };
  }

  function quantizeStep(tSec, startSec, tempo, total, grid) {
    const stepSec = 60 / tempo / (grid || CONST.STEPS_PER_COUNT);
    const k = Math.round((tSec - startSec) / stepSec);
    return ((k % total) + total) % total;
  }

  // The square a recorded press belongs to. A kid presses when they HEAR the
  // beat, and sound reaches the speakers `latencySec` after the audio clock
  // says it plays (outputLatency + baseLatency), so the press is moved back by
  // that much before snapping to the nearest square.
  function recordedStep(pressSec, startSec, tempo, total, latencySec, grid) {
    const lat = isNum(latencySec) && latencySec > 0 ? latencySec : 0;
    return quantizeStep(pressSec - lat, startSec, tempo, total, grid);
  }

  // A held note counts a square once 30% of it has been held, so a natural
  // early release still keeps the length that was meant.
  function recordedLength(heldSec, stepSec) {
    return Math.max(1, Math.ceil(heldSec / stepSec - 0.3 - 1e-9));
  }

  function validateSong(obj, catalogIds) {
    const bad = (error) => ({ ok: false, error });
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return bad("not_an_object");
    if (Object.keys(obj).some((k) => SONG_KEYS.indexOf(k) < 0)) return bad("unknown_field");
    if (obj.schemaVersion !== CONST.SCHEMA_VERSION) return bad("bad_schema_version");
    if (CONST.COUNTS.indexOf(obj.counts) < 0) return bad("bad_counts");
    if (!isNum(obj.tempo) || obj.tempo < CONST.TEMPO_MIN || obj.tempo > CONST.TEMPO_MAX) return bad("bad_tempo");
    if (typeof obj.id !== "string" || !obj.id) return bad("bad_field");
    if (typeof obj.title !== "string" || obj.title.length > 60) return bad("bad_field");
    if (obj.grid !== undefined && CONST.GRIDS.indexOf(obj.grid) < 0) return bad("bad_field");
    if (typeof obj.loop !== "boolean" || typeof obj.countIn !== "boolean") return bad("bad_field");
    if (!isNum(obj.volume) || obj.volume < 0 || obj.volume > 1) return bad("bad_field");
    if (!isNum(obj.updatedMs)) return bad("bad_field");
    if (!Array.isArray(obj.tracks)) return bad("bad_tracks");
    if (obj.tracks.length > CONST.MAX_TRACKS) return bad("too_many_tracks");
    const total = obj.counts * (obj.grid || CONST.STEPS_PER_COUNT);
    const missing = [];
    const seen = new Set();
    for (const t of obj.tracks) {
      if (!t || typeof t !== "object" || Array.isArray(t)) return bad("bad_track");
      if (Object.keys(t).some((k) => TRACK_KEYS.indexOf(k) < 0)) return bad("unknown_field");
      if (typeof t.id !== "string" || !t.id) return bad("bad_field");
      if (seen.has(t.id)) return bad("duplicate_track_id");
      seen.add(t.id);
      if (typeof t.instrumentId !== "string" || !t.instrumentId) return bad("bad_field");
      if (!isNum(t.volume) || t.volume < 0 || t.volume > 1) return bad("bad_field");
      if (typeof t.mute !== "boolean" || typeof t.solo !== "boolean") return bad("bad_field");
      if (t.reverb !== undefined && (!isInt(t.reverb) || t.reverb < 0 || t.reverb > REVERB_MAX)) return bad("bad_field");
      if (t.sustain !== undefined && typeof t.sustain !== "boolean") return bad("bad_field");
      if (t.chorus !== undefined && !validKindAmount(t.chorus, FX.CHORUS_KINDS)) return bad("bad_field");
      if (t.dyn !== undefined && !validKindAmount(t.dyn, FX.DYN_KINDS)) return bad("bad_field");
      if (t.eq !== undefined && !validEq(t.eq)) return bad("bad_field");
      if (!Array.isArray(t.notes)) return bad("bad_notes");
      for (const n of t.notes) {
        if (!n || typeof n !== "object" || Array.isArray(n)) return bad("bad_note");
        if (Object.keys(n).some((k) => NOTE_KEYS.indexOf(k) < 0)) return bad("unknown_field");
        if (!isInt(n.step) || n.step < 0 || n.step > total - 1) return bad("bad_note_step");
        if (!isInt(n.pitch)) return bad("bad_note_pitch");
        if (!isInt(n.len) || n.len < 1) return bad("bad_note_len");
        if (!isNum(n.vel) || n.vel < 0 || n.vel > 1) return bad("bad_note_vel");
      }
      if (!catalogIds.has(t.instrumentId) && missing.indexOf(t.instrumentId) < 0) missing.push(t.instrumentId);
    }
    return { ok: true, song: fillTrackDefaults(clone(obj)), missing };
  }

  // Switch the song between eighths (2) and sixteenths (4). Going finer is
  // lossless; going coarser snaps each note to the nearest eighth (halves round
  // up), keeps at least one square of length, and drops duplicates. `moved` is
  // true when any note changed because of that.
  function setGrid(song, grid) {
    const out = clone(song);
    const from = song.grid || CONST.STEPS_PER_COUNT;
    let moved = false;
    if (CONST.GRIDS.indexOf(grid) < 0 || grid === from) return { song: out, moved };
    out.grid = grid;
    out.updatedMs = Date.now();
    const total = out.counts * grid;
    out.tracks.forEach((t) => {
      if (grid > from) {
        const f = grid / from;
        t.notes.forEach((n) => { n.step *= f; n.len *= f; });
      } else {
        const f = from / grid;
        const kept = [];
        t.notes.forEach((n) => {
          const step = Math.min(Math.floor((n.step + f / 2) / f), total - 1);
          const len = Math.max(1, Math.min(Math.round(n.len / f), total - step));
          if (step !== n.step / f || len !== n.len / f) moved = true;
          if (kept.some((k) => k.step === step && k.pitch === n.pitch)) { moved = true; return; }
          kept.push({ step, pitch: n.pitch, len, vel: n.vel });
        });
        t.notes = kept;
      }
    });
    return { song: out, moved };
  }

  function applyPattern(track, patternNotes, patternCounts, songCounts, patternGrid, songGrid) {
    const pg = patternGrid || CONST.STEPS_PER_COUNT;
    const sg = songGrid || CONST.STEPS_PER_COUNT;
    const pTotal = patternCounts * sg;
    const sTotal = songCounts * sg;
    for (let off = 0; off < sTotal; off += pTotal) {
      patternNotes.forEach((n) => {
        const base = pg === sg ? n.step : Math.floor(n.step * sg / pg);
        const len = pg === sg ? n.len : Math.max(1, Math.round(n.len * sg / pg));
        const step = base + off;
        if (n.step < patternCounts * pg && step < sTotal) {
          track.notes.push({ step, pitch: n.pitch, len: Math.max(1, Math.min(len, sTotal - step)), vel: n.vel });
        }
      });
    }
  }

  // Holds up to `limit` undo steps (limit + 1 states, the newest being the
  // current song). Pushing after an undo drops the redo branch.
  function createHistory(limit) {
    const max = (limit === undefined ? 100 : limit) + 1;
    let states = [];
    let idx = -1;
    return {
      push(song) {
        states = states.slice(0, idx + 1);
        states.push(clone(song));
        if (states.length > max) states.shift();
        idx = states.length - 1;
      },
      undo() {
        if (idx <= 0) return null;
        idx--;
        return clone(states[idx]);
      },
      redo() {
        if (idx >= states.length - 1) return null;
        idx++;
        return clone(states[idx]);
      },
      canUndo() { return idx > 0; },
      canRedo() { return idx < states.length - 1; }
    };
  }

  SS.model = {
    CONST,
    TRACK_KEYS,
    FX,
    newSong,
    addTrack,
    fillTrackDefaults,
    totalSteps,
    NOTE_VALUES,
    noteSquares,
    setGrid,
    toggleNote,
    setNoteLength,
    resizeSong,
    quantizeStep,
    recordedStep,
    recordedLength,
    validateSong,
    applyPattern,
    createHistory
  };
})(typeof window !== "undefined" ? window : globalThis);
