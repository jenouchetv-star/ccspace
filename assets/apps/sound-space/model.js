(function (root) {
  const SS = root.SoundSpace = root.SoundSpace || {};

  const CONST = {
    SCHEMA_VERSION: 1,
    STEPS_PER_COUNT: 2,
    COUNTS: [4, 8, 16],
    MAX_TRACKS: 8,
    TEMPO_MIN: 60,
    TEMPO_MAX: 160,
    TEMPO_DEFAULT: 100
  };

  const SONG_KEYS = ["schemaVersion", "id", "title", "counts", "tempo", "loop", "countIn", "volume", "tracks", "updatedMs"];
  const TRACK_KEYS = ["id", "instrumentId", "volume", "mute", "solo", "notes"];
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
    return song.counts * CONST.STEPS_PER_COUNT;
  }

  function newSong(opts) {
    return {
      schemaVersion: CONST.SCHEMA_VERSION,
      id: makeId(),
      title: (opts && opts.title) || "My song",
      counts: 8,
      tempo: CONST.TEMPO_DEFAULT,
      loop: true,
      countIn: false,
      volume: 0.8,
      tracks: [],
      updatedMs: Date.now()
    };
  }

  function addTrack(song, instrumentId) {
    if (song.tracks.length >= CONST.MAX_TRACKS) return null;
    const track = { id: makeId(), instrumentId, volume: 0.8, mute: false, solo: false, notes: [] };
    song.tracks.push(track);
    return track;
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
    const newTotal = counts * CONST.STEPS_PER_COUNT;
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

  function quantizeStep(tSec, startSec, tempo, total) {
    const stepSec = 60 / tempo / CONST.STEPS_PER_COUNT;
    const k = Math.round((tSec - startSec) / stepSec);
    return ((k % total) + total) % total;
  }

  // The square a recorded press belongs to. A kid presses when they HEAR the
  // beat, and sound reaches the speakers `latencySec` after the audio clock
  // says it plays (outputLatency + baseLatency), so the press is moved back by
  // that much before snapping to the nearest square.
  function recordedStep(pressSec, startSec, tempo, total, latencySec) {
    const lat = isNum(latencySec) && latencySec > 0 ? latencySec : 0;
    return quantizeStep(pressSec - lat, startSec, tempo, total);
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
    if (typeof obj.loop !== "boolean" || typeof obj.countIn !== "boolean") return bad("bad_field");
    if (!isNum(obj.volume) || obj.volume < 0 || obj.volume > 1) return bad("bad_field");
    if (!isNum(obj.updatedMs)) return bad("bad_field");
    if (!Array.isArray(obj.tracks)) return bad("bad_tracks");
    if (obj.tracks.length > CONST.MAX_TRACKS) return bad("too_many_tracks");
    const total = obj.counts * CONST.STEPS_PER_COUNT;
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
    return { ok: true, song: clone(obj), missing };
  }

  function applyPattern(track, patternNotes, patternCounts, songCounts) {
    const pTotal = patternCounts * CONST.STEPS_PER_COUNT;
    const sTotal = songCounts * CONST.STEPS_PER_COUNT;
    for (let off = 0; off < sTotal; off += pTotal) {
      patternNotes.forEach((n) => {
        const step = n.step + off;
        if (n.step < pTotal && step < sTotal) {
          track.notes.push({ step, pitch: n.pitch, len: Math.max(1, Math.min(n.len, sTotal - step)), vel: n.vel });
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
    newSong,
    addTrack,
    totalSteps,
    toggleNote,
    setNoteLength,
    resizeSong,
    quantizeStep,
    recordedStep,
    validateSong,
    applyPattern,
    createHistory
  };
})(typeof window !== "undefined" ? window : globalThis);
