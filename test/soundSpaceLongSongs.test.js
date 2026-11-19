import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

/* Owner, 2026-11-18: a song can be up to 64 bars (about 2 minutes), new bars start empty, recording stays inside a
   loop of 4, 8 or 16 counts, and any part of a track can be copied and pasted into a track or a new one. */
const M = () => loadSS("model.js").model;
const note = (step, pitch, len = 1, vel = 0.9) => ({ step, pitch, len, vel });
const songOf = (m, counts, grid, notes) => {
  const s = m.newSong();
  s.counts = counts; s.grid = grid;
  const t = m.addTrack(s, "piano");
  (notes || []).forEach((n) => t.notes.push(n));
  return { s, t };
};
const steps = (t) => t.notes.slice().sort((a, b) => a.step - b.step || a.pitch - b.pitch).map((n) => n.step + ":" + n.pitch + ":" + n.len);

describe("Sound Space long songs", () => {
  it("a song is up to 64 bars (256 counts), a whole number of bars; the loop sizes stay 4, 8 and 16", () => {
    const m = M();
    expect(m.CONST.MAX_COUNTS).toBe(256);
    expect(m.CONST.COUNTS).toEqual([4, 8, 16]);
    [4, 8, 12, 16, 20, 64, 256].forEach((n) => expect(m.validCounts(n), String(n)).toBe(true));
    [0, 2, 6, 10, 260, 512, 4.5, "8", null].forEach((n) => expect(m.validCounts(n), String(n)).toBe(false));
  });

  it("opening a file takes a long song and its loop, and refuses a bad length or loop", () => {
    const m = M();
    const ids = new Set(["piano"]);
    const good = () => { const s = m.newSong(); m.addTrack(s, "piano"); return JSON.parse(JSON.stringify(s)); };
    let o = good(); o.counts = 256; o.tracks[0].notes.push(note(1023, 60));
    expect(m.validateSong(o, ids).ok).toBe(true);
    o = good(); o.counts = 40; o.loopCounts = 16; o.loopStart = 24;
    expect(m.validateSong(o, ids).ok).toBe(true);
    o = good(); o.counts = 260;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.loopCounts = 12;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.loopStart = -4;
    expect(m.validateSong(o, ids).ok).toBe(false);
    o = good(); o.loopStart = 1.5;
    expect(m.validateSong(o, ids).ok).toBe(false);
  });

  it("the loop: the biggest of 4, 8, 16 that fits when none is set, from count 1; a set loop is kept inside the song", () => {
    const m = M();
    const at = (counts, loopCounts, loopStart) => { const s = m.newSong(); s.counts = counts; if (loopCounts !== undefined) s.loopCounts = loopCounts; if (loopStart !== undefined) s.loopStart = loopStart; return m.loopOf(s); };
    expect(at(8)).toEqual({ start: 0, counts: 8 });
    expect(at(4)).toEqual({ start: 0, counts: 4 });
    expect(at(12)).toEqual({ start: 0, counts: 8 });
    expect(at(256)).toEqual({ start: 0, counts: 16 });
    expect(at(64, 8, 16)).toEqual({ start: 16, counts: 8 });
    expect(at(64, 16, 60)).toEqual({ start: 48, counts: 16 });
    expect(at(8, 16, 0)).toEqual({ start: 0, counts: 8 });
    const s = m.newSong(); s.counts = 64; s.grid = 4; s.loopCounts = 8; s.loopStart = 16;
    expect(m.loopSteps(s)).toEqual({ from: 64, to: 96 });
  });

  it("making a song longer adds empty bars; shorter hides the end, and longer again brings it back", () => {
    const m = M();
    const { s } = songOf(m, 8, 2, [note(1, 60), note(13, 60)]);
    const r1 = m.resizeSong(s, 64);
    expect(r1.song.counts).toBe(64);
    expect(steps(r1.song.tracks[0])).toEqual(["1:60:1", "13:60:1"]);
    const r2 = m.resizeSong(r1.song, 4, r1.stash);
    expect(steps(r2.song.tracks[0])).toEqual(["1:60:1"]);
    const r3 = m.resizeSong(r2.song, 8, r2.stash);
    expect(steps(r3.song.tracks[0])).toEqual(["1:60:1", "13:60:1"]);
    expect(m.resizeSong(s, 260).song.counts).toBe(8);
    expect(m.resizeSong(s, 10).song.counts).toBe(8);
  });

  it("a length change keeps the loop where it was, and pulls it back inside a shorter song", () => {
    const m = M();
    const { s } = songOf(m, 8, 4, []);
    const long = m.resizeSong(s, 64).song;
    expect(m.loopOf(long)).toEqual({ start: 0, counts: 8 });
    long.loopStart = 40;
    const short = m.resizeSong(long, 44).song;
    expect(m.loopOf(short)).toEqual({ start: 36, counts: 8 });
    const tiny = m.resizeSong(short, 4).song;
    expect(m.loopOf(tiny)).toEqual({ start: 0, counts: 4 });
  });

  it("a bigger loop than the song makes the song that long, with empty counts", () => {
    const m = M();
    const { s } = songOf(m, 8, 2, [note(3, 60)]);
    const r = m.setLoopSize(s, 16, {});
    expect(r.song.counts).toBe(16);
    expect(m.loopOf(r.song)).toEqual({ start: 0, counts: 16 });
    expect(steps(r.song.tracks[0])).toEqual(["3:60:1"]);
    const big = m.resizeSong(s, 64).song;
    big.loopStart = 56;
    const r2 = m.setLoopSize(big, 16, {});
    expect(r2.song.counts).toBe(64);
    expect(m.loopOf(r2.song)).toEqual({ start: 48, counts: 16 });
    expect(m.setLoopSize(s, 12, {}).song.counts).toBe(8);
  });

  it("the loop moves by whole bars and stays inside the song", () => {
    const m = M();
    const s = m.newSong(); s.counts = 32; s.loopCounts = 8;
    expect(m.moveLoop(s, 9)).toBe(true);
    expect(m.loopOf(s).start).toBe(8);
    m.moveLoop(s, 30);
    expect(m.loopOf(s).start).toBe(24);
    m.moveLoop(s, -5);
    expect(m.loopOf(s).start).toBe(0);
    expect(m.moveLoop(s, 0)).toBe(false);
  });

  it("a song's length in seconds", () => {
    const m = M();
    const s = m.newSong(); s.counts = 256; s.tempo = 120;
    expect(m.songSeconds(s)).toBe(128);
  });
});

describe("Sound Space copy and paste", () => {
  it("copies the notes that start in the part, from its start, cut at its end", () => {
    const m = M();
    const { t } = songOf(m, 16, 2, [note(0, 60, 2), note(3, 62, 4), note(6, 64, 1), note(9, 65, 1)]);
    expect(m.copyNotes(t, 2, 8)).toEqual([note(1, 62, 4), note(4, 64, 1)]);
    expect(m.copyNotes(t, 4, 6)).toEqual([]);
    const n = m.copyNotes(t, 0, 4);
    n[0].pitch = 1;
    expect(t.notes[0].pitch).toBe(60);
    expect(m.copyNotes(t, 2, 5)[0].len).toBe(2);
  });

  it("pasting replaces that part of the track; a note running into it is cut short", () => {
    const m = M();
    const { t } = songOf(m, 16, 2, [note(0, 60, 6), note(8, 62), note(12, 64)]);
    const clip = { steps: 4, grid: 2, notes: [note(0, 70), note(2, 71, 2)] };
    const r = m.pasteNotes(t, clip, 4, 32, 2);
    expect(r).toEqual({ placed: 2, cut: 0 });
    expect(steps(t)).toEqual(["0:60:4", "4:70:1", "6:71:2", "8:62:1", "12:64:1"]);
  });

  it("pasting past the end of the song leaves out what doesn't fit and says how many", () => {
    const m = M();
    const { t } = songOf(m, 4, 2, []);
    const clip = { steps: 8, grid: 2, notes: [note(0, 60), note(3, 60, 4), note(6, 60)] };
    const r = m.pasteNotes(t, clip, 4, 8, 2);
    expect(r).toEqual({ placed: 2, cut: 1 });
    expect(steps(t)).toEqual(["4:60:1", "7:60:1"]);
  });

  it("pasting onto the other grid moves the notes onto it", () => {
    const m = M();
    const { t } = songOf(m, 8, 4, []);
    m.pasteNotes(t, { steps: 4, grid: 2, notes: [note(1, 60, 2)] }, 0, 32, 4);
    expect(steps(t)).toEqual(["2:60:4"]);
    const b = songOf(m, 8, 2, []);
    const r = m.pasteNotes(b.t, { steps: 8, grid: 4, notes: [note(2, 60, 3), note(3, 60), note(5, 62)] }, 0, 16, 2);
    expect(steps(b.t)).toEqual(["1:60:2", "2:62:1"]);
    expect(r.placed).toBe(2);
  });

  it("the same part pasted twice in a row never doubles a note", () => {
    const m = M();
    const { t } = songOf(m, 8, 2, []);
    const clip = { steps: 4, grid: 2, notes: [note(0, 60), note(1, 62)] };
    m.pasteNotes(t, clip, 4, 16, 2);
    m.pasteNotes(t, clip, 4, 16, 2);
    expect(steps(t)).toEqual(["4:60:1", "5:62:1"]);
  });

  it("a clip from somewhere else is checked before it is used", () => {
    const m = M();
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "pitched", notes: [note(0, 60)] })).toEqual({ steps: 8, grid: 2, kind: "pitched", notes: [note(0, 60)], track: null });
    expect(m.cleanClip(null)).toBe(null);
    expect(m.cleanClip({ steps: 0, grid: 2, kind: "pitched", notes: [] })).toBe(null);
    expect(m.cleanClip({ steps: 8, grid: 3, kind: "pitched", notes: [] })).toBe(null);
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "x", notes: [] })).toBe(null);
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "kit", notes: [{ step: 9, pitch: 1, len: 1, vel: 1 }] })).toBe(null);
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "kit", notes: [{ step: 0, pitch: 1, len: 0, vel: 1 }] })).toBe(null);
    const t = { instrumentId: "piano", volume: 0.5, reverb: 2, sustain: true, chorus: { kind: "off", amount: 45 }, dyn: { kind: "off", amount: 50 }, eq: { low: 0, mid: 0, high: 0, lowcut: false } };
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "pitched", notes: [], track: t }).track).toEqual(t);
    expect(m.cleanClip({ steps: 8, grid: 2, kind: "pitched", notes: [], track: { instrumentId: 5 } }).track).toBe(null);
  });
});

import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("Sound Space page: Length, the loop, Copy and Paste", () => {
  it("Length sits beside Counts with - and + and the song's time; Counts is the loop's size", () => {
    expect(html).toContain('<input id="ss-length" type="number" min="1" max="64" step="1"');
    expect(html).toContain('data-act="len-down"');
    expect(html).toContain('data-act="len-up"');
    expect(html).toContain('title="Counts: how long the loop is. Recording stays inside it."');
    expect(html).toMatch(/const r = M\.setLoopSize\(song, n, stash\);/);
    expect(html).toMatch(/if \(act === "len-up"\) return setLength\(song\.counts \+ 4\);/);
  });

  it("Play goes round the loop with Loop on, from the start with it off; recording stays in the loop", () => {
    expect(html).toContain("player.start(song, { fromStep: song.loop ? M.loopSteps(song).from : 0 });");
    expect(html).toContain("player.start(song, { fromStep:range.from, click:true, range });");
    expect(html).toContain("step:recFrom + M.recordedStep(");
  });

  it("the editor has Copy and Paste, Paste opens a menu, and Ctrl+C and Ctrl+V do the same", () => {
    expect(html).toContain('data-act="copy" aria-label="Copy"');
    expect(html).toContain('data-act="paste" aria-label="Paste" aria-haspopup="menu"');
    expect(html).toContain('<div id="paste-menu" class="pastemenu" role="menu" aria-label="Paste" hidden>');
    expect(html).toMatch(/k === "c" && !e\.shiftKey\)\{[^\n]*copyPart\(\)/);
    expect(html).toMatch(/k === "v" && !e\.shiftKey\)\{ e\.preventDefault\(\); pasteKey\(\); \}/);
  });

  it("what was copied is kept on this device and checked when it is read back", () => {
    expect(html).toContain('const CLIP_KEY = "ss-clip";');
    expect(html).toContain('try { clip = M.cleanClip(JSON.parse(localStorage.getItem(CLIP_KEY) || "null")); } catch(e){ clip = null; }');
  });

  it("the loop's bar is a slider the arrow keys move a bar at a time", () => {
    expect(html).toContain('<i class="gloop" id="ss-loopbar" role="slider" tabindex="0"');
    expect(html).toMatch(/e\.key === "ArrowLeft" \|\| e\.key === "ArrowDown" \? L0\.start - 4/);
  });

  it("a pattern fills the loop, and a long song can't be exported past 5 minutes", () => {
    expect(html).toContain("M.applyPattern(filled, L.fitPattern(p, instOf(t)), p.counts, (loop.to - loop.from) / g, p.grid, g);");
    expect(html).toContain("const EXPORT_MAX_SEC = 300;");
  });
});

describe("the loop's bar: its ends resize it (owner, 2026-11-18: it looked draggable but did nothing on a song as long as the loop)", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "../assets/apps/sound-space.html"), "utf8").replace(/\r\n/g, "\n");
  it("dragging the right end picks the nearest loop size that fits, keeping the start", () => {
    const m = M(), { s } = songOf(m, 8, 4);
    s.loopStart = 0; s.loopCounts = 8;
    expect(m.dragLoopEnd(s, "b", 3)).toBe(true);           /* count 4 (0-based 3): a 4-count loop */
    expect(m.loopOf(s)).toEqual({ start: 0, counts: 4 });
    expect(m.dragLoopEnd(s, "b", 30)).toBe(true);          /* past the end: the biggest that fits, 8 */
    expect(m.loopOf(s)).toEqual({ start: 0, counts: 8 });
    expect(m.dragLoopEnd(s, "b", 7)).toBe(false);          /* no change */
  });
  it("dragging the left end keeps the loop's end and moves its start", () => {
    const m = M(), { s } = songOf(m, 32, 4);
    s.loopStart = 8; s.loopCounts = 16;                    /* counts 9 to 24 */
    expect(m.dragLoopEnd(s, "a", 16)).toBe(true);
    expect(m.loopOf(s)).toEqual({ start: 16, counts: 8 });
    expect(m.dragLoopEnd(s, "a", 0)).toBe(true);           /* as far left as it goes: 16 counts ending at 24 */
    expect(m.loopOf(s)).toEqual({ start: 8, counts: 16 });
  });
  it("the bar has two real end handles, and says when it can't move", () => {
    expect(html).toContain('<b class="lh" data-end="a" aria-hidden="true"></b><b class="lh" data-end="b" aria-hidden="true"></b>');
    expect(html).toContain('bar.classList.toggle("whole", L0.counts >= counts);');
    expect(html).toMatch(/\.gloop\.whole\{[^}]*cursor:default/);
  });
});
