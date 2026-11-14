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
    expect(n("bass")).toBeGreaterThanOrEqual(40);
    expect(n("melody")).toBeGreaterThanOrEqual(60);
    expect(n("chords")).toBeGreaterThanOrEqual(40);
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

  it("lesson 1 can be finished", () => {
    const l = LS.LESSONS[0];
    const song = JSON.parse(JSON.stringify(l.startSong));
    const ui = ui0();
    ui.events.play = 1;
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
