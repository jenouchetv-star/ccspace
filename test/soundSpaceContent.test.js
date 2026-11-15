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

  it("the starter song and six lessons open as valid songs", () => {
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

  it("lessons point only at real controls", () => {
    expect(LS.LESSONS.length).toBe(6);
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

  it("each lesson teaches its word", () => {
    expect(LS.LESSONS.map((l) => l.word)).toEqual(["beat", "melody", "bass", "loop", "tempo", "harmony"]);
    expect(LS.LESSONS.map((l) => l.title)).toEqual([
      "Keep the beat", "Your first melody", "Add a bass line", "Loops and counts", "Record what you play", "Build a whole song",
    ]);
    LS.LESSONS.forEach((l) => expect(l.meaning.length, l.word).toBeGreaterThan(10));
  });

  it("no step is already done when its lesson opens", () => {
    for (const l of LS.LESSONS) {
      for (const s of l.steps) expect(s.check(l.startSong, ui0()), `${l.title}: ${s.text}`).toBe(false);
    }
  });

  // Each step done the way its tip asks. Play steps are done with the song already playing (Loop is on by default,
  // so Play does nothing new then): the step must still pass.
  const kindOf = (t) => I.byId(t.instrumentId);
  const first = (song, test) => song.tracks.find((t) => test(kindOf(t)));
  const addWith = (song, id, patternName) => {
    const t = M.addTrack(song, id);
    if (patternName) {
      const p = L.byName(patternName);
      M.applyPattern(t, L.fitPattern(p, I.byId(id)), p.counts, song.counts, p.grid, song.grid || 2);
    }
    return t;
  };
  const playing = (song, ui) => { ui.playing = true; };
  const DO = {
    "keep-the-beat": [
      playing,
      (s) => { const k = first(s, (i) => i.kind === "kit"); for (let c = 1; c < 4; c++) M.toggleNote(k, c * s.grid, 0); },
      (s) => { const k = first(s, (i) => i.kind === "kit"); M.toggleNote(k, s.grid, 4); M.toggleNote(k, 3 * s.grid, 4); },
      (s, ui) => { ui.events.pads = 4; },
    ],
    "first-melody": [
      (s, ui) => { ui.events.keys = 3; },
      (s) => { const p = first(s, (i) => i.kind === "pitched"); [60, 64, 67, 72].forEach((m, i) => M.toggleNote(p, i * s.grid, m)); },
      (s) => { const p = first(s, (i) => i.kind === "pitched"); M.setNoteLength(p, 0, 60, 2, M.totalSteps(s)); },
      playing,
    ],
    "bass-line": [
      (s) => { addWith(s, "synth-bass"); },
      (s) => { const b = first(s, (i) => i.category === "bass"); [0, 1, 2, 3].forEach((c) => M.toggleNote(b, c * s.grid, 36)); },
      playing,
      (s) => { first(s, (i) => i.category === "bass").solo = true; },
    ],
    "loops-and-counts": [
      playing,
      (s) => { Object.assign(s, M.resizeSong(s, 8, {}).song); },
      (s) => { Object.assign(s, M.resizeSong(s, 16, {}).song); },
      (s, ui) => { s.loop = false; ui.playing = true; },
    ],
    "record-what-you-play": [
      (s) => { s.tempo = 85; },
      (s) => { s.countIn = true; },
      (s, ui) => { const p = first(s, (i) => i.kind === "pitched"); [60, 62, 64].forEach((m, i) => M.toggleNote(p, i * s.grid, m)); ui.recording = false; },
      (s, ui) => { ui.events.grid = 1; },
    ],
    "whole-song": [
      (s) => { addWith(s, "drum-machine", "Boom bap beat"); },
      (s) => { addWith(s, "synth-bass", "Pop bass line"); },
      (s) => { addWith(s, "grand-piano", "Pop chords"); },
      (s) => { const f = addWith(s, "coin"); M.toggleNote(f, 0, 0); },
      playing,
    ],
  };

  it("every lesson can be finished by doing what each tip asks, even with the song already playing", () => {
    for (const l of LS.LESSONS) {
      const song = JSON.parse(JSON.stringify(l.startSong));
      expect(DO[l.id], l.id).toBeDefined();
      expect(DO[l.id].length, l.id).toBe(l.steps.length);
      l.steps.forEach((step, i) => {
        const ui = ui0();
        expect(step.check(song, ui), `${l.title} step ${i + 1} before`).toBe(false);
        DO[l.id][i](song, ui);
        expect(step.check(song, ui), `${l.title} step ${i + 1}: ${step.text}`).toBe(true);
      });
    }
  });

  it("every lesson starts on the sixteenth grid and its checks are given the intended notes at grid 4", () => {
    for (const l of LS.LESSONS) expect(l.startSong.grid, l.id).toBe(4);
    // lesson 1: kick on counts 1-4 is steps 0, 4, 8, 12
    const song = JSON.parse(JSON.stringify(LS.LESSONS[0].startSong));
    const kit = song.tracks[0];
    [4, 8, 12].forEach((st) => M.toggleNote(kit, st, 0));
    expect(LS.LESSONS[0].steps[1].check(song, ui0())).toBe(true);
    // an eighth-grid kick (steps 2, 4, 6) is not on the counts of a grid-4 song
    const wrong = JSON.parse(JSON.stringify(LS.LESSONS[0].startSong));
    [2, 4, 6].forEach((st) => M.toggleNote(wrong.tracks[0], st, 0));
    expect(LS.LESSONS[0].steps[1].check(wrong, ui0())).toBe(false);
    // lesson 3's bass on the counts
    const l3 = JSON.parse(JSON.stringify(LS.LESSONS[2].startSong));
    const bass = M.addTrack(l3, "synth-bass");
    [0, 4, 8, 12].forEach((st) => M.toggleNote(bass, st, 36));
    expect(LS.LESSONS[2].steps[1].check(l3, ui0())).toBe(true);
  });

  it("the Count-in lesson starts with Count-in off, so its step still teaches it", () => {
    const l = LS.LESSONS.find((x) => x.id === "record-what-you-play");
    expect(l.startSong.countIn).toBe(false);
    const step = l.steps.find((s) => s.target === "#ss-countin");
    expect(step.check(l.startSong, ui0())).toBe(false);
    const on = JSON.parse(JSON.stringify(l.startSong)); on.countIn = true;
    expect(step.check(on, ui0())).toBe(true);
  });

  it("lessons keep the speed they set; a song made with no speed is 120", () => {
    expect(LS.LESSONS.map((l) => l.startSong.tempo)).toEqual([90, 96, 96, 100, 116, 100]);
    expect(L.makeSong("x", { counts: 4 }, []).tempo).toBe(120);
    expect(L.makeSong("x", { counts: 4, grid: 2 }, []).grid).toBe(2);
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

  it("lesson 1 can be finished", () => {
    const l = LS.LESSONS[0];
    const song = JSON.parse(JSON.stringify(l.startSong));
    const ui = ui0();
    ui.playing = true;
    expect(l.steps[0].check(song, ui)).toBe(true);
    const kit = song.tracks.find((t) => I.byId(t.instrumentId).kind === "kit");
    const g = song.grid || 2;
    for (let c = 0; c < song.counts; c++) if (!kit.notes.some((n) => n.step === c * g && n.pitch === 0)) M.toggleNote(kit, c * g, 0);
    expect(l.steps[1].check(song, ui)).toBe(true);
    for (let c = 1; c < song.counts; c += 2) M.toggleNote(kit, c * g, 4);
    expect(l.steps[2].check(song, ui)).toBe(true);
    ui.events.pads = 4;
    expect(l.steps[3].check(song, ui)).toBe(true);
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
