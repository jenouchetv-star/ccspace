import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const SS = loadSS("model.js", "instruments.js", "notation.js");
const N = SS.notation;

/* the vendored abcjs, to prove what toAbc writes parses cleanly */
const ABCJS = (() => {
  const src = readFileSync(new URL("../assets/vendor/abcjs/abcjs-basic-min.js", import.meta.url), "utf8");
  const mod = { exports: {} };
  new Function("module", "exports", src)(mod, mod.exports);
  return mod.exports;
})();
function parse(abc) {
  const tune = ABCJS.parseOnly(abc)[0];
  return { warnings: tune.warnings || [], tune };
}

let nextId = 0;
function track(instrumentId, notes, extra = {}) {
  return Object.assign({ id: "t" + ++nextId, instrumentId, volume: 0.8, mute: false, solo: false, reverb: 0, sustain: false,
    notes: notes.map(([step, pitch, len]) => ({ step, pitch, len, vel: 100 })) }, extra);
}
function song(tracks, extra = {}) {
  return Object.assign({ schemaVersion: 1, id: "s1", title: "My song", counts: 4, tempo: 120, grid: 4, loop: true, countIn: true, volume: 0.8, tracks, updatedMs: 1 }, extra);
}
/* the music lines of one voice (the line after its V: line) */
function body(abc, voice = 0) {
  const lines = abc.split("\n");
  const vs = lines.map((l, i) => (l.startsWith("V:") ? i : -1)).filter((i) => i >= 0);
  return lines[vs[voice] + 1];
}
function lyrics(abc, voice = 0) {
  const lines = abc.split("\n");
  const vs = lines.map((l, i) => (l.startsWith("V:") ? i : -1)).filter((i) => i >= 0);
  const next = lines[vs[voice] + 2] || "";
  return next.startsWith("w:") ? next : null;
}

const CDEF = () => song([track("grand-piano", [[0, 60, 4], [4, 62, 4], [8, 64, 4], [12, 65, 4]])]);

describe("SS.notation.toAbc", () => {
  it("is a pure module on SS.notation", () => {
    expect(typeof N.toAbc).toBe("function");
    const src = readFileSync(new URL("../assets/apps/sound-space/notation.js", import.meta.url), "utf8");
    expect(src).not.toMatch(/document\.|window\.document|localStorage/);
  });

  it("a grid-4 song with C D E F quarters at 120: the header and C4 D4 E4 F4 |", () => {
    const abc = N.toAbc(CDEF(), { tracks: "all", names: false });
    const head = abc.split("\nV:")[0];
    expect(head).toMatch(/^X:1\n/);
    expect(head).toContain("T:My song\n");
    expect(head).toContain("M:4/4\n");
    expect(head).toContain("L:1/16\n");
    expect(head).toContain("Q:1/4=120\n");
    expect(head).toMatch(/\nK:C$/);
    expect(body(abc)).toBe("C4 D4 E4 F4 |");
    expect(parse(abc).warnings).toEqual([]);
  });

  it("grid 2 (and a missing grid) gives L:1/8 with the lengths halved", () => {
    const s = song([track("grand-piano", [[0, 60, 2], [2, 62, 2], [4, 64, 2], [6, 65, 2]])], { grid: 2 });
    const abc = N.toAbc(s, { names: false });
    expect(abc).toContain("L:1/8\n");
    expect(body(abc)).toBe("C2 D2 E2 F2 |");
    const old = song([track("grand-piano", [[0, 60, 2], [2, 62, 2], [4, 64, 2], [6, 65, 2]])]);
    delete old.grid;
    expect(N.toAbc(old, { names: false })).toBe(abc);
  });

  it("counts are beats: 16 counts is 4 bars", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 4]])], { counts: 16 }), { names: false });
    expect(body(abc)).toBe("C4 z4 z8 | z16 | z16 | z16 |");
    expect(parse(abc).warnings).toEqual([]);
  });

  it("splits a note crossing a bar line with a tie", () => {
    const s = song([track("grand-piano", [[12, 60, 8]])], { counts: 8 });
    const abc = N.toAbc(s, { names: false });
    expect(body(abc)).toBe("z8 z4 C4- | C4 z4 z8 |");
    const t = parse(abc);
    expect(t.warnings).toEqual([]);
  });

  it("splits a note crossing the middle of the bar from an off-beat", () => {
    const abc = N.toAbc(song([track("grand-piano", [[6, 60, 4]])]), { names: false });
    expect(body(abc)).toBe("z4 z2C2- C2z2 z4 |");
  });

  it("writes lengths music can show: a 5-step note is a tied 4 and 1", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 5]])]), { names: false });
    expect(body(abc)).toBe("C4- Cz3 z8 |");
    expect(parse(abc).warnings).toEqual([]);
  });

  it("fills a gap with rests of the right lengths", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 2], [8, 62, 4]])]), { names: false });
    expect(body(abc)).toBe("C2z2 z4 D4 z4 |");
    const g2 = N.toAbc(song([track("grand-piano", [[0, 60, 1], [5, 62, 2]])], { grid: 2 }), { names: false });
    expect(body(g2)).toBe("Cz z2 zD2 z |");
    expect(parse(g2).warnings).toEqual([]);
  });

  it("writes a chord as [CEG]4", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 4], [0, 64, 4], [0, 67, 4]])]), { names: false });
    expect(body(abc)).toBe("[CEG]4 z4 z8 |");
  });

  it("a chord with different lengths uses the shortest and ties the longer notes on", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 8], [0, 64, 4]])]), { names: false });
    expect(body(abc)).toBe("[C-E]4 C4 z8 |");
    expect(parse(abc).warnings).toEqual([]);
  });

  it("a later note cuts an earlier one short", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 60, 8], [4, 62, 4]])]), { names: false });
    expect(body(abc)).toBe("C4 D4 z8 |");
  });

  it("pitches: 61 is ^C, 48 is C, , 72 is c, 84 is c'", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 61, 4], [4, 48, 4], [8, 72, 4], [12, 84, 4]])]), { names: false });
    expect(body(abc)).toBe("^C4 C,4 c4 c'4 |");
    expect(N.pitchToAbc(61)).toBe("^C");
    expect(N.pitchToAbc(48)).toBe("C,");
    expect(N.pitchToAbc(36)).toBe("C,,");
    expect(N.pitchToAbc(70)).toBe("^A");
  });

  it("a natural after a sharp in the same bar gets its natural sign, and the next bar starts fresh", () => {
    const abc = N.toAbc(song([track("grand-piano", [[0, 61, 4], [4, 60, 4], [8, 61, 4], [16, 60, 4]])], { counts: 8 }), { names: false });
    expect(body(abc)).toBe("^C4 =C4 ^C4 z4 | C4 z4 z8 |");
    const t = parse(abc).tune;
    const pitches = t.lines[0].staff[0].voices[0].filter((e) => e.el_type === "note" && !e.rest).map((e) => e.pitches[0].accidental || "");
    expect(pitches).toEqual(["sharp", "natural", "sharp", ""]);
  });

  it("a low bass track gets clef=bass, and an empty pitched track is treble", () => {
    const s = song([track("double-bass", [[0, 36, 4], [4, 43, 4]]), track("grand-piano", [])]);
    const abc = N.toAbc(s, { names: false });
    const v = abc.split("\n").filter((l) => l.startsWith("V:"));
    expect(v[0]).toMatch(/clef=bass/);
    expect(v[0]).toContain('name="Double bass"');
    expect(v[1]).toMatch(/clef=treble/);
    expect(body(abc, 0)).toBe("C,,4 G,,4 z8 |");
  });

  it("a kit track gets clef=perc, kick on F and snare and clap on c, as chords at each step, with no names", () => {
    // 0 kick, 1 snare, 2 closed hat, 4 clap
    const s = song([track("classic-kit", [[0, 0, 1], [0, 2, 1], [4, 1, 1], [8, 0, 1], [12, 4, 1], [12, 1, 1]])]);
    const abc = N.toAbc(s, { names: true });
    const v = abc.split("\n").find((l) => l.startsWith("V:"));
    expect(v).toMatch(/clef=perc/);
    expect(v).toContain('name="Classic kit"');
    expect(body(abc)).toBe("[F^g]4 c4 F4 c4 |");
    expect(lyrics(abc)).toBe(null);
    expect(abc).toMatch(/%%percmap \^g closed-hi-hat x/);
    expect(parse(abc).warnings).toEqual([]);
  });

  it("maps every kit slot to its drum-staff place", () => {
    const s = song([track("classic-kit", [0, 1, 2, 3, 4, 5, 6, 7].map((p, i) => [i * 2, p, 1]))]);
    const abc = N.toAbc(s, { names: false });
    expect(body(abc)).toBe("F2c2 ^g2^a2 c2A2 e2^b2 |");
  });

  it("an fx track is one line at c, each hit a short note", () => {
    const s = song([track("siren", [[0, 0, 1], [8, 0, 2]])]);
    const abc = N.toAbc(s, { names: true });
    const v = abc.split("\n").find((l) => l.startsWith("V:"));
    expect(v).toMatch(/clef=perc/);
    expect(v).toMatch(/stafflines=1/);
    expect(body(abc)).toBe("cz3 z4 c2z2 z4 |");
    expect(lyrics(abc)).toBe(null);
    expect(parse(abc).warnings).toEqual([]);
  });

  it("names adds a w: line with the letters, aligned: * for rests and tied-on notes, # for sharps, a chord by its root", () => {
    const s = song([track("grand-piano", [[0, 61, 4], [8, 60, 4], [8, 64, 4], [8, 67, 4], [12, 62, 8]])], { counts: 8 });
    const abc = N.toAbc(s, { names: true });
    expect(body(abc)).toBe("^C4 z4 [=CEG]4 D4- | D4 z4 z8 |");
    expect(lyrics(abc)).toBe("w: C# * C D * * *");
    // abcjs puts each letter under its own note
    const t = parse(abc);
    expect(t.warnings).toEqual([]);
    const notes = t.tune.lines[0].staff[0].voices[0].filter((e) => e.el_type === "note");
    const under = notes.map((e) => (e.lyric ? e.lyric.map((l) => l.syllable).join("") : ""));
    expect(under).toEqual(["C#", "", "C", "D", "", "", ""]);
    expect(N.toAbc(s, { names: false })).not.toMatch(/\nw:/);
  });

  it("several tracks: one voice each, in track order, on their own staffs", () => {
    const s = song([
      track("grand-piano", [[0, 72, 4]]),
      track("double-bass", [[0, 36, 8]]),
      track("classic-kit", [[0, 0, 4]]),
    ]);
    const abc = N.toAbc(s, { names: true });
    expect(abc).toMatch(/\n%%score \(T1\) \(T2\) \(T3\)\n/);
    const v = abc.split("\n").filter((l) => l.startsWith("V:"));
    expect(v.map((l) => l.split(" ")[0])).toEqual(["V:T1", "V:T2", "V:T3"]);
    expect(v[0]).toContain('name="Grand piano"');
    const t = parse(abc);
    expect(t.warnings).toEqual([]);
    expect(t.tune.lines[0].staff.length).toBe(3);
  });

  it("tracks: <id> gives only that voice", () => {
    const piano = track("grand-piano", [[0, 72, 4]]), bass = track("double-bass", [[0, 36, 8]]);
    const abc = N.toAbc(song([piano, bass]), { tracks: bass.id, names: false });
    expect(abc.split("\n").filter((l) => l.startsWith("V:")).length).toBe(1);
    expect(abc).toContain('name="Double bass"');
    expect(abc).not.toContain("%%score");
  });

  it("leaves a muted track out, and shows solo'd tracks as normal", () => {
    const s = song([track("grand-piano", [[0, 72, 4]], { mute: true }), track("double-bass", [[0, 36, 8]], { solo: true }), track("classic-kit", [[0, 0, 4]])]);
    const abc = N.toAbc(s, { names: false });
    expect(abc).not.toContain("Grand piano");
    expect(abc).toContain("Double bass");
    expect(abc).toContain("Classic kit");
  });

  it("ignores notes past the song's counts, and cuts a note at the song's end", () => {
    const abc = N.toAbc(song([track("grand-piano", [[12, 60, 8], [20, 62, 4]])]), { names: false });
    expect(body(abc)).toBe("z8 z4 C4 |");
  });

  it("keeps the title safe: no line breaks or comment marks", () => {
    const abc = N.toAbc(song([], { title: "Fun 100% song\nX:2" }), { names: false });
    expect(abc).toContain("T:Fun 100\\% song X:2\n");
    expect(abc.split("\n").filter((l) => l.startsWith("X:")).length).toBe(1);
  });

  it("the same song always gives the same string", () => {
    const s = song([track("grand-piano", [[0, 64, 4], [0, 60, 4], [4, 67, 2]]), track("classic-kit", [[0, 2, 1], [0, 0, 1]])]);
    const a = N.toAbc(s, { names: true });
    const b = N.toAbc(JSON.parse(JSON.stringify(s)), { names: true });
    expect(a).toBe(b);
    expect(a).toContain("[CE]4");
  });

  it("hasNotes says when there is nothing to show", () => {
    expect(N.hasNotes(song([]))).toBe(false);
    expect(N.hasNotes(song([track("grand-piano", [])]))).toBe(false);
    expect(N.hasNotes(song([track("grand-piano", [[0, 60, 4]], { mute: true })]))).toBe(false);
    expect(N.hasNotes(song([track("grand-piano", [[20, 60, 4]])]))).toBe(false);
    expect(N.hasNotes(CDEF())).toBe(true);
  });

  it("the starter, every finished lesson song and every library pattern parse in abcjs with no warnings", () => {
    const all = loadSS("model.js", "engine.js", "instruments.js", "icons.js", "library.js", "lessons.js", "notation.js");
    const copy = (o) => JSON.parse(JSON.stringify(o));
    const songs = all.library.STARTERS.map((st) => copy(st.song));
    // each lesson's start song with every guide's notes filled in: the songs kids finish
    all.lessons.LESSONS.forEach((l) => {
      if (!l.startSong) return;
      const s = copy(l.startSong);
      l.steps.forEach((st) => {
        if (!st.guide) return;
        let t = s.tracks.find((x) => st.guide.track(all.instruments.byId(x.instrumentId)));
        if (!t) { t = track("grand-piano", []); s.tracks.push(t); }
        const g = s.grid || 2;
        st.guide.notes.forEach((n) => t.notes.push({ step: n.step * (g / 2), pitch: n.pitch, len: n.len * (g / 2), vel: 100 }));
      });
      songs.push(s);
    });
    const forType = { drums: "classic-kit", bass: "double-bass", fx: "siren" };
    all.library.PATTERNS.forEach((p) => {
      songs.push(song([track(forType[p.type] || "grand-piano", p.notes.map((n) => [n.step, n.pitch, n.len]))], { counts: p.counts, grid: p.grid, title: p.name }));
    });
    expect(songs.length).toBeGreaterThan(300);
    let voices = 0;
    for (const s of songs) {
      for (const names of [true, false]) {
        const abc = all.notation.toAbc(s, { names });
        voices += (abc.match(/\nV:/g) || []).length;
        expect(parse(abc).warnings, s.title + "\n" + abc).toEqual([]);
      }
    }
    expect(voices).toBeGreaterThan(600);
  });

  it("every voice's bars add up: each bar is exactly 4 counts long", () => {
    const all = loadSS("model.js", "engine.js", "instruments.js", "icons.js", "library.js", "lessons.js", "notation.js");
    const forType = { drums: "classic-kit", bass: "double-bass", fx: "siren" };
    all.library.PATTERNS.forEach((p) => {
      const s = song([track(forType[p.type] || "grand-piano", p.notes.map((n) => [n.step, n.pitch, n.len]))], { counts: p.counts, grid: p.grid });
      const abc = all.notation.toAbc(s, { names: false });
      const bar = 4 * (p.grid === 4 ? 4 : 2);
      const bars = body(abc).split("|").slice(0, -1);
      expect(bars.length, p.name).toBe(p.counts / 4);
      bars.forEach((b) => {
        const units = [...b.matchAll(/(?:\[[^\]]*\]|[=^]?[A-Ga-gz][,']*)(\d*)/g)].reduce((sum, m) => sum + (m[1] ? +m[1] : 1), 0);
        expect(units, p.name + ": " + b).toBe(bar);
      });
    });
  });
});
