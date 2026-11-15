import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const SS = loadSS("model.js", "instruments.js", "icons.js", "library.js", "lessons.js");
const M = SS.model;
const I = SS.instruments;
const L = SS.library;
const LS = SS.lessons;

const pageUrl = new URL("../assets/apps/sound-space.html", import.meta.url);
const html = existsSync(pageUrl) ? readFileSync(pageUrl, "utf8") : "";
const src = (f) => readFileSync(new URL(`../assets/apps/sound-space/${f}`, import.meta.url), "utf8");

const STYLES = ["Pop", "Hip hop", "Rock", "Funk", "Reggae", "Latin", "Lo-fi", "Electronic", "March", "Lullaby", "Spooky", "Space"];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const CATALOG = new Set(I.LIST.map((x) => x.id));
const catColor = Object.fromEntries(I.CATEGORIES.map((c) => [c.id, c.color]));

describe("Sound Space icons", () => {
  it("every instrument and category has its own icon, and no two icons are the same", () => {
    const ids = I.LIST.map((x) => x.id).concat(I.CATEGORIES.map((c) => c.id));
    expect(ids.length).toBe(126);
    const svgs = ids.map((id) => SS.icons.svg(id));
    svgs.forEach((s, i) => {
      expect(typeof s, ids[i]).toBe("string");
      expect(s.startsWith("<svg"), ids[i]).toBe(true);
      expect(s, ids[i]).toContain('viewBox="0 0 48 48"');
      expect(s, ids[i]).toContain('stroke-width="2.5"');
      expect(s, ids[i]).toContain('stroke-linecap="round"');
      expect(s, ids[i]).not.toMatch(/<script/i);
      expect(s, ids[i]).not.toMatch(/href/i);
      expect(s, ids[i]).not.toMatch(/\son\w+=/i);
      const inst = I.byId(ids[i]);
      const color = catColor[inst ? inst.category : ids[i]];
      expect(s.toUpperCase(), ids[i]).toContain(color.toUpperCase());
    });
    expect(new Set(svgs).size).toBe(126);
  });

  // lookalikes from the review: each pair is drawn a different way, and the bass versions carry a big bass clef
  it("tells look-alike instruments apart at tile size", () => {
    const svg = SS.icons.svg;
    const blackKeys = (s) => (s.match(/rx="0\.6"/g) || []).length;
    expect(blackKeys(svg("harpsichord")), "harpsichord shows its two keyboards from above").toBeGreaterThan(0);
    expect(svg("grand-piano"), "grand piano is seen from the side with its lid up").toContain("<!--lid-->");
    expect(blackKeys(svg("grand-piano"))).toBe(0);
    expect(svg("funky-bass"), "funky bass has a star-shaped body").toContain("<polygon");
    expect(svg("electric-style-bass")).not.toContain("<polygon");
    for (const id of ["tuba-bass", "bassoon-bass", "low-marimba", "timpani-bass"]) {
      expect(svg(id), id).toContain("<!--big clef-->");
    }
    for (const id of ["tuba", "bassoon", "timpani", "marimba"]) expect(svg(id), id).not.toContain("<!--big clef-->");
  });
});

describe("Sound Space pattern library", () => {
  const P = L.PATTERNS;

  it("the library has at least 300 patterns with unique names and unique notes", () => {
    expect(P.length).toBeGreaterThanOrEqual(300);
    expect(new Set(P.map((p) => p.name)).size).toBe(P.length);
    expect(new Set(P.map((p) => p.id)).size).toBe(P.length);
    const hashes = P.map((p) => JSON.stringify(p.notes.slice().sort((a, b) => a.step - b.step || a.pitch - b.pitch)));
    expect(new Set(hashes).size).toBe(P.length);
  });

  it("the library meets the size target for each type", () => {
    const n = (t) => P.filter((p) => p.type === t).length;
    expect(n("drums")).toBeGreaterThanOrEqual(40);
    expect(n("bass")).toBeGreaterThanOrEqual(70);
    expect(n("melody")).toBeGreaterThanOrEqual(60);
    expect(n("chords")).toBeGreaterThanOrEqual(70);
    expect(P.every((p) => ["drums", "bass", "melody", "chords", "fx"].includes(p.type))).toBe(true);
    expect(P.filter((p) => p.grid === 4).length).toBeGreaterThanOrEqual(40);
  });

  it("every style has at least one drum beat, bass line, melody and chord pattern", () => {
    expect(L.STYLES).toEqual(STYLES);
    expect(P.every((p) => STYLES.includes(p.style))).toBe(true);
    for (const s of STYLES) {
      for (const t of ["drums", "bass", "melody", "chords"]) {
        expect(P.some((p) => p.style === s && p.type === t), `${s} ${t}`).toBe(true);
      }
    }
  });

  it("every style has two different bass lines and two different chord progressions", () => {
    for (const s of STYLES) {
      for (const t of ["bass", "chords"]) {
        // the seeds: the 8-count eighth-note versions without a variant suffix
        const seeds = P.filter((p) => p.style === s && p.type === t && p.counts === 8 && p.grid === 2 && !p.name.includes(","));
        expect(seeds.length, `${s} ${t}`).toBeGreaterThanOrEqual(2);
        const pitchSets = seeds.map((p) => JSON.stringify([...new Set(p.notes.map((n) => n.pitch))].sort()));
        expect(new Set(pitchSets).size, `${s} ${t}`).toBe(seeds.length);
      }
    }
  });

  it("every note fits its pattern", () => {
    for (const p of P) {
      expect([4, 8, 16], p.name).toContain(p.counts);
      expect([2, 4], p.name).toContain(p.grid);
      expect(p.notes.length, p.name).toBeGreaterThan(0);
      const total = p.counts * p.grid;
      for (const n of p.notes) {
        expect(Number.isInteger(n.step) && n.step >= 0 && n.step < total, p.name).toBe(true);
        expect(Number.isInteger(n.len) && n.len >= 1 && n.step + n.len <= total, p.name).toBe(true);
        expect(n.vel > 0 && n.vel <= 1, p.name).toBe(true);
        if (p.type === "drums") expect(n.pitch >= 0 && n.pitch < I.KIT_SLOTS.length, p.name).toBe(true);
        else if (p.type === "fx") expect(n.pitch, p.name).toBe(0);
        else expect(WHITE, `${p.name} ${n.pitch}`).toContain(((n.pitch % 12) + 12) % 12);
      }
      const seen = new Set(p.notes.map((n) => n.step + ":" + n.pitch));
      expect(seen.size, p.name).toBe(p.notes.length);
    }
  });

  it("patterns fit any instrument they are used on", () => {
    const melodies = P.filter((p) => p.type === "melody").slice(0, 5);
    const pitched = I.LIST.filter((x) => x.kind === "pitched");
    for (const inst of pitched) {
      for (const p of melodies) {
        const out = L.fitPattern(p, inst);
        expect(out.length, `${inst.id} ${p.name}`).toBeGreaterThan(0);
        for (const n of out) {
          expect(n.pitch >= inst.range[0] && n.pitch <= inst.range[1], `${inst.id} ${p.name} ${n.pitch}`).toBe(true);
        }
      }
    }
    const kit = I.LIST.find((x) => x.kind === "kit");
    const fx = I.LIST.find((x) => x.kind === "fx");
    for (const p of P.slice(0, 80)) {
      expect(L.fitPattern(p, kit).every((n) => n.pitch >= 0 && n.pitch < 8)).toBe(true);
      expect(L.fitPattern(p, fx).every((n) => n.pitch === 0)).toBe(true);
    }
  });

  it("offers each track the patterns that suit it", () => {
    expect(L.typesFor(I.byId("classic-kit"))).toEqual(["drums"]);
    expect(L.typesFor(I.byId("pop"))).toEqual(["fx"]);
    expect(L.typesFor(I.byId("synth-bass"))).toContain("bass");
    expect(L.typesFor(I.byId("flute"))).toEqual(expect.arrayContaining(["melody", "chords"]));
    expect(L.typesFor(I.byId("flute"))).not.toContain("drums");
  });

  it("the starter song and every lesson open as valid songs", () => {
    expect(L.STARTERS.map((s) => [s.id, s.name])).toEqual([["hiphop-pop", "Hip hop/pop starter"]]);
    const songs = L.STARTERS.map((s) => s.song).concat(LS.LESSONS.map((l) => l.startSong));
    for (const s of songs) {
      const v = M.validateSong(s, CATALOG);
      expect(v.ok, s.title).toBe(true);
      expect(v.missing).toEqual([]);
    }
    const st = L.STARTERS[0].song;
    expect(st.tracks.map((t) => I.byId(t.instrumentId).category)).toEqual(["drums", "bass", "keys"]);
    expect(st.tracks.every((t) => t.notes.length > 0)).toBe(true);
  });

  it("the starter is on sixteenths with Count-in on and speed 92, and sounds exactly as it did on eighths", () => {
    const st = L.STARTERS[0].song;
    expect(st.grid).toBe(4);
    expect(st.countIn).toBe(true);
    expect(st.tempo).toBe(92);
    // the same song built on the old eighth grid
    const old = L.makeSong("old", { counts: 8, tempo: 92, grid: 2 }, [
      { instrumentId: "hip-hop-kit", pattern: "Boom bap beat", volume: 0.85 },
      { instrumentId: "synth-bass", pattern: "Pop bass line", volume: 0.75 },
      { instrumentId: "grand-piano", pattern: "Pop chords, short hits", volume: 0.6 },
    ]);
    expect(old.grid).toBe(2);
    const secs = (song) => song.tracks.map((t) => t.notes.map((n) => {
      const sec = 60 / song.tempo / song.grid;
      return [+(n.step * sec).toFixed(6), +(n.len * sec).toFixed(6), n.pitch, n.vel];
    }).sort((a, b) => a[0] - b[0] || a[2] - b[2]));
    expect(secs(st)).toEqual(secs(old));
    expect(secs(st).every((t) => t.length > 0)).toBe(true);
  });

  it("nothing is called a guitar, and no emojis", () => {
    for (const f of ["icons.js", "library.js", "lessons.js"]) {
      expect(src(f), f).not.toMatch(/guitar/i);
      expect(src(f).match(/\p{Extended_Pictographic}/gu) || [], f).toEqual([]);
    }
  });
});

describe("Sound Space music lessons", () => {
  const ui0 = () => ({ selectedTrackId: null, playing: false, recording: false, events: {} });
  const copy = (o) => JSON.parse(JSON.stringify(o));

  // The approved draft's notes (docs/mockups/sound-space-song-lessons-draft.html), as [pitch, eighths]; null is a rest.
  // Jingle Bells is the draft's first 32 eighths (the app's counts stop at 16).
  const SONG_DATA = {
    twinkle: [[60, 2], [60, 2], [67, 2], [67, 2], [69, 2], [69, 2], [67, 4], [65, 2], [65, 2], [64, 2], [64, 2], [62, 2], [62, 2], [60, 4]],
    jingleBells: [[64, 2], [64, 2], [64, 4], [64, 2], [64, 2], [64, 4], [64, 2], [67, 2], [60, 3], [62, 1], [64, 8]],
    mountainKing: [[45, 1], [47, 1], [48, 1], [50, 1], [52, 1], [48, 1], [52, 2], [51, 1], [47, 1], [51, 2], [50, 1], [46, 1], [50, 2], [45, 1], [47, 1], [48, 1], [50, 1], [52, 1], [48, 1], [52, 1], [57, 1], [55, 1], [52, 1], [48, 1], [52, 1], [55, 4]],
    canonBass: [[50, 4], [45, 4], [47, 4], [42, 4], [43, 4], [38, 4], [43, 4], [45, 4]],
    canonChords: [[[62, 66, 69], 4], [[61, 64, 69], 4], [[62, 66, 71], 4], [[61, 66, 69], 4], [[62, 67, 71], 4], [[62, 66, 69], 4], [[62, 67, 71], 4], [[61, 64, 69], 4]],
    odeToJoy: [[64, 2], [64, 2], [65, 2], [67, 2], [67, 2], [65, 2], [64, 2], [62, 2], [60, 2], [60, 2], [62, 2], [64, 2], [64, 3], [62, 1], [62, 4], [64, 2], [64, 2], [65, 2], [67, 2], [67, 2], [65, 2], [64, 2], [62, 2], [60, 2], [60, 2], [62, 2], [64, 2], [62, 3], [60, 1], [60, 4]],
    furElise: [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 2], [null, 1], [60, 1], [64, 1], [69, 1], [71, 2], [null, 1], [64, 1], [68, 1], [71, 1], [72, 2], [null, 1], [64, 1], [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1]],
    fourChordBass: [[48, 8], [43, 8], [45, 8], [41, 8]],
    fourChords: [[[60, 64, 67], 8], [[59, 62, 67], 8], [[57, 60, 64], 8], [[57, 60, 65], 8]],
    popBeat: { kick: [0, 4], clap: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  };
  // [pitch or chord, eighths] -> notes on the eighth grid, in order
  const N = (seq) => {
    const out = [];
    let s = 0;
    seq.forEach(([p, l]) => { if (p !== null) [].concat(p).forEach((m) => out.push({ step: s, pitch: m, len: l })); s += l; });
    return out;
  };
  const sortNotes = (list) => list.map((n) => ({ step: n.step, pitch: n.pitch, len: n.len })).sort((a, b) => a.step - b.step || a.pitch - b.pitch);
  const byId = (id) => LS.LESSONS.find((l) => l.id === id);
  const guidesOf = (l) => l.steps.filter((s) => s.guide).map((s) => s.guide);
  const guideSum = (l) => sortNotes([].concat(...guidesOf(l).map((g) => g.notes)));
  const inst = (t) => I.byId(t.instrumentId);
  // a track the guide fills: the first one that passes its test, or a new one of that kind
  const MAKE = { kit: "classic-kit", bass: "synth-bass", tune: "grand-piano" };
  function trackFor(song, guide) {
    const t = song.tracks.find((x) => guide.track(inst(x)));
    if (t) return t;
    const id = Object.values(MAKE).find((m) => guide.track(I.byId(m)));
    return M.addTrack(song, id);
  }
  // put each guide note on the song (scaled to its grid), replacing a note already on that square
  function fill(song, guide, lenOf) {
    const t = trackFor(song, guide), f = (song.grid || 2) / 2;
    guide.notes.forEach((g) => {
      t.notes = t.notes.filter((n) => !(n.step === g.step * f && n.pitch === g.pitch));
      t.notes.push({ step: g.step * f, pitch: g.pitch, len: lenOf ? lenOf(g, f) : g.len * f, vel: 0.9 });
    });
    return t;
  }

  it("there are eight lessons, each building a song, with its music word", () => {
    expect(LS.LESSONS.map((l) => [l.id, l.title, l.song, l.word, !!l.recipe])).toEqual([
      ["keep-the-beat", "Keep the beat", "The pop beat", "beat", true],
      ["first-melody", "Your first melody", "Twinkle Twinkle Little Star", "melody", false],
      ["long-and-short", "Long and short notes", "Jingle Bells", "rhythm", false],
      ["bass-line", "A tune down low", "In the Hall of the Mountain King", "bass", false],
      ["loops-and-counts", "Chords that go round", "Canon in D", "loop", false],
      ["record-what-you-play", "Play it and record it", "Ode to Joy", "tempo", false],
      ["quiet-spaces", "Quiet spaces", "Für Elise", "rest", false],
      ["whole-song", "Build a pop song", "The four-chord song", "harmony", true],
    ]);
    const meaning = Object.fromEntries(LS.LESSONS.map((l) => [l.word, l.meaning]));
    expect(meaning).toEqual({
      beat: "The beat is the steady pulse of music: the part you clap or tap your foot to.",
      melody: "A melody is a tune: notes played one after another that you could sing or hum.",
      rhythm: "Rhythm is the pattern of long and short notes in a song.",
      bass: "Bass is the low part of a song. It follows the beat and holds the music up.",
      loop: "A loop is a part of music that plays again and again.",
      tempo: "Tempo is how fast or slow the beat goes. Musicians count it in beats a minute.",
      rest: "A rest is a little silence in music, a space where no note plays.",
      harmony: "Harmony is different notes sounding together, like the notes in a chord, so they sound good as one.",
    });
  });

  it("keeps each song's notes once, as data, exactly the approved draft's notes", () => {
    expect(LS.SONGS).toEqual(SONG_DATA);
    // public domain, each one named with its composer or as traditional; no words to any song
    const s = src("lessons.js");
    for (const who of ["traditional", "James Lord Pierpont", "Edvard Grieg", "Johann Pachelbel", "Ludwig van Beethoven"]) expect(s).toContain(who);
    expect(s).toMatch(/public domain/i);
    expect(s).not.toMatch(/how I wonder|dashing through|freude/i);
    expect(LS.notesOf(SONG_DATA.furElise)).toEqual(N(SONG_DATA.furElise));
    expect(LS.notesOf(SONG_DATA.fourChords)).toEqual(N(SONG_DATA.fourChords));
  });

  it("the guide notes, line by line, are the whole song", () => {
    const beat = byId("keep-the-beat");
    const B = SONG_DATA.popBeat;
    expect(guideSum(beat)).toEqual(sortNotes([].concat(
      B.kick.map((step) => ({ step, pitch: 0, len: 1 })), B.clap.map((step) => ({ step, pitch: 4, len: 1 })), B.hat.map((step) => ({ step, pitch: 2, len: 1 })))));
    expect(guideSum(byId("first-melody"))).toEqual(sortNotes(N(SONG_DATA.twinkle)));
    expect(guideSum(byId("long-and-short"))).toEqual(sortNotes(N(SONG_DATA.jingleBells)));
    expect(guideSum(byId("bass-line"))).toEqual(sortNotes(N(SONG_DATA.mountainKing)));
    expect(guideSum(byId("loops-and-counts"))).toEqual(sortNotes(N(SONG_DATA.canonBass)));
    expect(guideSum(byId("quiet-spaces"))).toEqual(sortNotes(N(SONG_DATA.furElise)));
    const pop = byId("whole-song");
    const [drums, bass, chords] = guidesOf(pop);
    expect(sortNotes(drums.notes)).toEqual(guideSum(beat));
    expect(sortNotes(bass.notes)).toEqual(sortNotes(N(SONG_DATA.fourChordBass)));
    expect(sortNotes(chords.notes)).toEqual(sortNotes(N(SONG_DATA.fourChords)));
    // the record lesson's lit keys are Ode to Joy, note by note
    const rec = byId("record-what-you-play");
    const lit = rec.steps.filter((s) => s.litKeys);
    expect(lit.length).toBe(1);
    expect(lit[0].litKeys).toEqual(SONG_DATA.odeToJoy.map((x) => x[0]));
    // Canon in D starts with its chords, each triad held for 4 eighths, scaled to the song's grid
    const canon = byId("loops-and-counts").startSong, f = canon.grid / 2;
    const chordTrack = canon.tracks.find((t) => inst(t).kind === "pitched" && inst(t).category !== "bass");
    expect(sortNotes(chordTrack.notes)).toEqual(sortNotes(N(SONG_DATA.canonChords).map((n) => ({ step: n.step * f, pitch: n.pitch, len: n.len * f }))));
  });

  it("each guide is one line of 16 eighths or fewer (the pop song's bass and chords are the whole 16 counts), on a track that can play it", () => {
    for (const l of LS.LESSONS) {
      for (const g of guidesOf(l)) {
        expect(typeof g.track, l.id).toBe("function");
        const first = Math.min(...g.notes.map((n) => n.step)), end = Math.max(...g.notes.map((n) => n.step + n.len));
        expect(end - first, l.id).toBeLessThanOrEqual(l.id === "whole-song" ? 32 : 16);
        expect(end, l.id).toBeLessThanOrEqual(l.startSong.counts * 2);
        const t = l.startSong.tracks.find((x) => g.track(inst(x)));
        const i = t ? inst(t) : I.byId(Object.values(MAKE).find((m) => g.track(I.byId(m))));
        if (i.kind === "pitched") for (const n of g.notes) expect(n.pitch >= i.range[0] && n.pitch <= i.range[1], `${l.id} ${i.id} ${n.pitch}`).toBe(true);
        else for (const n of g.notes) expect(n.pitch >= 0 && n.pitch < 8, l.id).toBe(true);
      }
    }
  });

  it("a guide step is done once every outlined note is on a matching track, at any grid, and extra notes never block it", () => {
    let n = 0;
    for (const l of LS.LESSONS) {
      l.steps.forEach((step, i) => {
        if (!step.guide) return;
        n++;
        const song = copy(l.startSong);
        expect(song.grid, l.id).toBe(4);
        expect(step.check(song, ui0()), `${l.id} step ${i + 1} on the start song`).toBe(false);
        // the guide's eighths laid straight onto the sixteenth grid (unscaled) are in the wrong places
        const wrong = copy(l.startSong);
        if (step.guide.notes.some((g) => g.step > 0)) {
          const w = trackFor(wrong, step.guide);
          step.guide.notes.forEach((g) => { if (!w.notes.some((x) => x.step === g.step && x.pitch === g.pitch)) w.notes.push({ step: g.step, pitch: g.pitch, len: g.len, vel: 0.9 }); });
          expect(step.check(wrong, ui0()), `${l.id} step ${i + 1} unscaled`).toBe(false);
        }
        fill(song, step.guide);
        expect(step.check(song, ui0()), `${l.id} step ${i + 1} filled`).toBe(true);
        expect(LS.guideDone(song, step.guide), l.id).toBe(true);
        // extra notes the kid adds never block it
        const t = trackFor(song, step.guide);
        t.notes.push({ step: 1, pitch: t.notes[0].pitch + 1, len: 1, vel: 0.9 });
        expect(step.check(song, ui0()), `${l.id} step ${i + 1} with extras`).toBe(true);
        // the kid switches to eighths: the guide scales with the song and still lines up
        const eighths = M.setGrid(song, 2).song;
        expect(eighths.grid).toBe(2);
        expect(step.check(eighths, ui0()), `${l.id} step ${i + 1} on eighths`).toBe(true);
        expect(LS.guideNotes(step.guide, 4)).toEqual(step.guide.notes.map((g) => ({ step: g.step * 2, pitch: g.pitch, len: g.len * 2 })));
        expect(LS.guideNotes(step.guide, 2)).toEqual(step.guide.notes.map((g) => ({ step: g.step, pitch: g.pitch, len: g.len })));
      });
    }
    expect(n).toBeGreaterThanOrEqual(13);
  });

  it("only the rhythm lesson needs each note's length to match", () => {
    for (const l of LS.LESSONS) {
      l.steps.forEach((step, i) => {
        if (!step.guide) return;
        const song = copy(l.startSong);
        fill(song, step.guide, () => 1);   // every note one square long
        const long = step.guide.notes.some((g) => g.len * song.grid / 2 > 1);
        expect(step.check(song, ui0()), `${l.id} step ${i + 1}`).toBe(l.id === "long-and-short" && long ? false : true);
      });
    }
    // Jingle Bells: one long note too short fails, then right
    const l = byId("long-and-short"), step = l.steps.find((s) => s.guide);
    const song = copy(l.startSong);
    const t = fill(song, step.guide);
    expect(step.check(song, ui0())).toBe(true);
    const longest = step.guide.notes.reduce((a, b) => (b.len > a.len ? b : a));
    const note = t.notes.find((x) => x.step === longest.step * 2 && x.pitch === longest.pitch);
    note.len -= 1;
    expect(step.check(song, ui0())).toBe(false);
    note.len += 2;
    expect(step.check(song, ui0())).toBe(false);
    note.len -= 1;
    expect(step.check(song, ui0())).toBe(true);
  });

  it("the lit key moves on only when the kid plays its note, and goes round again after the last", () => {
    const keys = [64, 64, 65];
    expect(LS.nextLit(keys, 0, 60)).toBe(0);
    expect(LS.nextLit(keys, 0, 64)).toBe(1);
    expect(LS.nextLit(keys, 1, 65)).toBe(1);
    expect(LS.nextLit(keys, 1, 64)).toBe(2);
    expect(LS.nextLit(keys, 2, 76)).toBe(2);
    expect(LS.nextLit(keys, 2, 65)).toBe(0);
  });

  it("the record lesson is done once Record stops with 8 or more notes on a tune track", () => {
    const l = byId("record-what-you-play"), step = l.steps.find((s) => s.litKeys);
    expect(step.target).toBe("#ss-record");
    const song = copy(l.startSong);
    const p = song.tracks.find((t) => inst(t).kind === "pitched");
    LS.SONGS.odeToJoy.slice(0, 7).forEach(([m], k) => p.notes.push({ step: k * 2, pitch: m, len: 1, vel: 0.9 }));
    expect(step.check(song, ui0())).toBe(false);
    p.notes.push({ step: 20, pitch: 60, len: 1, vel: 0.9 });
    expect(step.check(song, { ...ui0(), recording: true })).toBe(false);
    expect(step.check(song, ui0())).toBe(true);
  });

  it("lessons point only at real controls", () => {
    expect(LS.LESSONS.length).toBe(8);
    for (const l of LS.LESSONS) {
      expect(l.steps.length, l.title).toBeGreaterThanOrEqual(3);
      expect(l.steps.length, l.title).toBeLessThanOrEqual(5);
      for (const s of l.steps) {
        expect(s.target, s.text).toMatch(/^#ss-[\w-]+$/);
        const n = (html.match(new RegExp(`id="${s.target.slice(1)}"`, "g")) || []).length;
        expect(n, s.target).toBe(1);
        expect(typeof s.text).toBe("string");
        expect(typeof s.check).toBe("function");
      }
    }
  });

  it("no step is already done when its lesson opens", () => {
    for (const l of LS.LESSONS) {
      for (const s of l.steps) expect(s.check(l.startSong, ui0()), `${l.title}: ${s.text}`).toBe(false);
    }
  });

  // Each step done the way its tip asks. Play steps are done with the song already playing (Loop is on by default,
  // so Play does nothing new then): the step must still pass.
  const first = (song, test) => song.tracks.find((t) => test(inst(t)));
  const addWith = (song, id, patternName) => {
    const t = M.addTrack(song, id);
    if (patternName) {
      const p = L.byName(patternName);
      M.applyPattern(t, L.fitPattern(p, I.byId(id)), p.counts, song.counts, p.grid, song.grid || 2);
    }
    return t;
  };
  const playing = (song, ui) => { ui.playing = true; };
  const guided = (step) => (song) => { fill(song, step.guide); };
  const DO = {
    "keep-the-beat": [playing, "guide", "guide", "guide", (s, ui) => { ui.events.pads = 4; }],
    "first-melody": ["guide", "guide", playing],
    "long-and-short": ["guide", "guide", playing],
    "bass-line": ["guide", "guide", (s) => { first(s, (i) => i.category === "bass").solo = true; }, playing],
    "loops-and-counts": [playing, "guide", "guide", (s, ui) => { s.loop = false; ui.playing = true; }],
    "record-what-you-play": [
      (s) => { s.tempo = 80; },
      (s) => { s.countIn = true; },
      (s, ui) => { const p = first(s, (i) => i.kind === "pitched"); LS.SONGS.odeToJoy.slice(0, 8).forEach(([m], k) => M.toggleNote(p, k * s.grid, m)); ui.recording = false; },
      (s, ui) => { s.tempo = 100; ui.playing = true; },
    ],
    "quiet-spaces": ["guide", "guide", playing],
    "whole-song": [
      (s) => { addWith(s, "classic-kit", "Sunny pop beat"); },   // the library's pop beat does it too
      "guide",
      "guide",
      (s) => { const t = addWith(s, "flute"); [72, 74, 76, 79].forEach((m, k) => M.toggleNote(t, k * s.grid, m)); },
      playing,
    ],
  };

  it("every lesson can be finished by doing what each tip asks, even with the song already playing", () => {
    for (const l of LS.LESSONS) {
      const song = copy(l.startSong);
      expect(DO[l.id], l.id).toBeDefined();
      expect(DO[l.id].length, l.id).toBe(l.steps.length);
      l.steps.forEach((step, i) => {
        const ui = ui0();
        expect(step.check(song, ui), `${l.title} step ${i + 1} before`).toBe(false);
        const act = DO[l.id][i] === "guide" ? guided(step) : DO[l.id][i];
        act(song, ui);
        expect(step.check(song, ui), `${l.title} step ${i + 1}: ${step.text}`).toBe(true);
      });
    }
  });

  it("the pop song's own tune has to go on a new track, not on the chords", () => {
    const l = byId("whole-song"), own = l.steps[3];
    const song = copy(l.startSong);
    l.steps.slice(1, 3).forEach((s) => fill(song, s.guide));
    expect(own.check(song, ui0())).toBe(false);   // the chords track already has 12 notes
    const t = addWith(song, "flute");
    [72, 74, 76].forEach((m, k) => M.toggleNote(t, k * 4, m));
    expect(own.check(song, ui0())).toBe(false);
    M.toggleNote(t, 12, 79);
    expect(own.check(song, ui0())).toBe(true);
  });

  it("every lesson starts on the sixteenth grid, at the draft's speed, with counts that fit", () => {
    for (const l of LS.LESSONS) expect(l.startSong.grid, l.id).toBe(4);
    expect(LS.LESSONS.map((l) => l.startSong.tempo)).toEqual([100, 100, 110, 96, 84, 96, 84, 104]);
    expect(LS.LESSONS.map((l) => l.startSong.counts)).toEqual([4, 16, 16, 16, 16, 16, 16, 16]);
    expect(L.makeSong("x", { counts: 4 }, []).tempo).toBe(120);
    expect(L.makeSong("x", { counts: 4, grid: 2 }, []).grid).toBe(2);
  });

  it("the Count-in lesson starts with Count-in off, so its step still teaches it", () => {
    const l = byId("record-what-you-play");
    expect(l.startSong.countIn).toBe(false);
    const step = l.steps.find((s) => s.target === "#ss-countin");
    expect(step.check(l.startSong, ui0())).toBe(false);
    const on = copy(l.startSong); on.countIn = true;
    expect(step.check(on, ui0())).toBe(true);
  });

  it("every Play step passes while the song is already playing", () => {
    for (const l of LS.LESSONS) {
      l.steps.filter((s) => s.target === "#ss-play").forEach((s) => expect(s.check.toString(), `${l.title}: ${s.text}`).toMatch(/played\(ui\)/));
    }
  });

  it("no lesson asks for the track volume slider, which phones hide", () => {
    for (const l of LS.LESSONS) {
      for (const s of l.steps) {
        expect(s.text, s.text).not.toMatch(/slider/i);
        expect(s.check.toString(), s.text).not.toMatch(/volume/);
      }
    }
  });

  it("guide tips say what to do in kid words", () => {
    for (const l of LS.LESSONS) {
      for (const s of l.steps) {
        if (s.guide) expect(s.text, `${l.id}: ${s.text}`).toMatch(/outline/i);
        const words = s.text.split(/\s+/);
        expect(words.length, s.text).toBeLessThanOrEqual(34);
        for (const w of words) expect(w.replace(/[^A-Za-z]/g, "").length, `${l.id}: ${w}`).toBeLessThanOrEqual(11);
      }
    }
  });

  it("lesson 1 can be finished", () => {
    const l = LS.LESSONS[0];
    const song = copy(l.startSong);
    const ui = ui0();
    ui.playing = true;
    expect(l.steps[0].check(song, ui)).toBe(true);
    const kit = song.tracks.find((t) => inst(t).kind === "kit");
    const g = song.grid || 2;
    const put = (step, slot) => { if (!kit.notes.some((n) => n.step === step && n.pitch === slot)) M.toggleNote(kit, step, slot); };
    [0, 2].forEach((c) => put(c * g, 0));   // kick on counts 1 and 3
    expect(l.steps[1].check(song, ui)).toBe(true);
    [1, 3].forEach((c) => put(c * g, 4));   // clap on 2 and 4
    expect(l.steps[2].check(song, ui)).toBe(true);
    for (let e = 0; e < 8; e++) put(e * g / 2, 2);   // closed hat on every eighth
    expect(l.steps[3].check(song, ui)).toBe(true);
    ui.events.pads = 4;
    expect(l.steps[4].check(song, ui)).toBe(true);
  });
});

describe("Sound Space page wiring", () => {
  it("loads the content modules after the catalog", () => {
    const order = ["model.js", "instruments.js", "icons.js", "library.js", "lessons.js"].map((f) => html.indexOf(`<script src="sound-space/${f}"></script>`));
    order.forEach((i) => expect(i).toBeGreaterThan(0));
    expect(order.slice().sort((a, b) => a - b)).toEqual(order);
  });

  it("fills the library panel, the lessons and the starter from the content modules", () => {
    expect(html).not.toContain("are on their way");
    expect(html).not.toContain("Music lessons are coming in a moment");
    expect(html).toMatch(/L = SS\.library, LS = SS\.lessons/);
    expect(html).toMatch(/L\.PATTERNS\.filter\(/);
    expect(html).toMatch(/LS\.LESSONS\.map\(/);
    expect(html).toMatch(/L\.STARTERS\.find\(/);
    expect(html).toMatch(/M\.applyPattern\(/);
    expect(html).toMatch(/L\.fitPattern\(/);
  });
});
