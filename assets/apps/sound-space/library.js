(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  // The Beats and patterns library. Every pattern here is written for Sound Space (none copies or imitates a known
  // song). Hand-written seeds per style (a drum groove, a bass line, two tunes, a chord progression, an effects
  // rhythm) are grown by expand*() into 4, 8 and 16-count versions, fills and sixteenth-note versions.
  //
  // A pattern: { id, name, type: "drums"|"bass"|"melody"|"chords"|"fx", style, counts: 4|8|16, grid: 2|4, notes }.
  // Drum notes use the kit slot numbers (SS.instruments.KIT_SLOTS); effects use slot 0; pitched notes are MIDI
  // numbers on the white keys only (C major or A minor).

  const STYLES = ["Pop", "Hip hop", "Rock", "Funk", "Reggae", "Latin", "Lo-fi", "Electronic", "March", "Lullaby", "Spooky", "Space"];
  const TYPES = ["drums", "bass", "melody", "chords", "fx"];
  const TYPE_NAMES = { drums: "Drum beat", bass: "Bass line", melody: "Melody", chords: "Chords", fx: "Effects" };

  // ---- note helpers --------------------------------------------------------------------------------------------
  const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const WK = [0, 2, 4, 5, 7, 9, 11];
  const midi = (name) => 12 * (Number(name.slice(1)) + 1) + LETTER[name[0]];
  const toIdx = (m) => Math.floor(m / 12) * 7 + WK.indexOf(((m % 12) + 12) % 12);
  const fromIdx = (i) => Math.floor(i / 7) * 12 + WK[((i % 7) + 7) % 7];
  const nt = (step, pitch, len, vel) => ({ step, pitch, len: len || 1, vel: vel === undefined ? 0.85 : vel });
  const sortN = (list) => list.sort((a, b) => a.step - b.step || a.pitch - b.pitch);
  function tidy(list, total) {
    const seen = new Set(), out = [];
    sortN(list).forEach((n) => {
      const k = n.step + ":" + n.pitch;
      if (n.step < 0 || n.step >= total || seen.has(k)) return;
      seen.add(k);
      out.push(nt(n.step, n.pitch, Math.max(1, Math.min(n.len, total - n.step)), Math.round(n.vel * 100) / 100));
    });
    return out;
  }
  const shift = (list, by) => list.map((n) => nt(n.step + by, n.pitch, n.len, n.vel));
  const finer = (list) => list.map((n) => nt(n.step * 2, n.pitch, n.len * 2, n.vel));
  // "0:C4:2 3:E4:1" -> notes
  const line = (s) => s.trim().split(/\s+/).map((tok) => { const q = tok.split(":"); return nt(Number(q[0]), midi(q[1]), Number(q[2] || 1)); });

  // ---- drum seeds: one bar (4 counts); K kick, S snare, H closed hat, O open hat, C clap, L low tom, T high tom,
  // Y cymbal. x is a hit, o a soft one. 8 letters a row = eighths, 16 = sixteenths.
  const SLOT = { K: 0, S: 1, H: 2, O: 3, C: 4, L: 5, T: 6, Y: 7 };
  const DRUMS = [
    ["Pop", "Sunny pop", { K: "x...x.x.", C: "..x...x.", H: "xoxoxoxo" }],
    ["Pop", "Bright pop", { K: "x..x..x.", S: "..x...x.", H: "x.x.x.x.", O: ".......x" }],
    ["Hip hop", "Boom bap", { K: "x....xx.", S: "..x...x.", H: "xoxoxoxo" }],
    ["Hip hop", "Head nod", { K: "x.....x...x.....", S: "....x.......x...", H: "x.x.x.x.x.x.x.x.", O: "..............x." }],
    ["Rock", "Garage rock", { K: "x.xx..x.", S: "..x...x.", Y: "x.......", H: ".xxxxxxx" }],
    ["Rock", "Stomp rock", { K: "xx..x...", S: "..x...x.", O: "x.x.x.x." }],
    ["Funk", "Funky feet", { K: "x.....x...x..x..", S: "....x..o.o..x..o", H: "x.x.x.x.x.x.x.x." }],
    ["Funk", "Bounce funk", { K: "x..x.x..", S: "..x..ox.", H: "xxxxxxxx", O: "...x...." }],
    ["Reggae", "One drop", { K: "....x...", S: "....x...", H: "xoxoxoxo", L: ".......o" }],
    ["Reggae", "Island step", { K: "x...x...", C: "....x...", H: ".x.x.x.x" }],
    ["Latin", "Clave groove", { K: "x...x..x....x...", T: "x..x...x..x.x...", L: "......x.......x.", H: "x.x.x.x.x.x.x.x." }],
    ["Latin", "Samba steps", { K: "x..xx..x", S: "o.x.o.xo", H: "xxxxxxxx" }],
    ["Lo-fi", "Sleepy", { K: "x....x..", S: "..x...x.", H: "x.o.x.o." }],
    ["Lo-fi", "Slow rain", { K: "x......x..x.....", S: "....x.......x...", H: "o.o.o.o.o.o.o.o." }],
    ["Electronic", "Four on the floor", { K: "x.x.x.x.", C: "..x...x.", O: ".x.x.x.x" }],
    ["Electronic", "Laser run", { K: "x...x...x...x...", S: "....x.......x...", H: "xoxoxoxoxoxoxoxo", T: "..............xx" }],
    ["March", "Left right", { K: "x...x...", S: "o.x.o.x.", Y: "x......." }],
    ["March", "Parade", { K: "x.......x.......", S: "x.xx..x.x.xx..x.", L: "....x.......x..." }],
    ["Lullaby", "Cradle sway", { K: "o.....o.", H: "o.o.o.o." }],
    ["Lullaby", "Sleepy steps", { K: "o...o...", T: "..o...o.", H: "oooooooo" }],
    ["Spooky", "Creaky stairs", { K: "x..x....", L: "....x..x", S: "......x.", Y: "x......." }],
    ["Spooky", "Ghost knock", { K: "x.......x.x.....", T: "...x..x......x..", L: "....x.......x...", O: "..............x." }],
    ["Space", "Moon steps", { K: "x...x...", C: "..x...x.", T: ".x...x.." }],
    ["Space", "Star hop", { K: "x..x..x...x..x..", S: "....x.......x...", H: "x.xxx.xxx.xxx.xx", Y: "x..............." }],
  ];

  // ---- bass lines: 8 counts on eighths (16 squares) ------------------------------------------------------------
  const BASS = {
    "Pop": "0:C2:2 2:C3:1 3:C2:1 4:F1:2 6:F2:1 7:F1:1 8:A1:2 10:A2:1 11:A1:1 12:G1:2 14:G2:1 15:D2:1",
    "Hip hop": "0:A1:3 3:E2:1 4:D2:2 7:D2:1 8:F1:3 11:C2:1 12:E2:2 14:B1:1 15:E1:1",
    "Rock": "0:A1:1 1:A1:1 2:A1:1 3:A2:1 4:G1:1 5:G1:1 6:G1:1 7:G2:1 8:F1:1 9:F1:1 10:F1:1 11:F2:1 12:G1:1 13:G1:1 14:G1:1 15:B1:1",
    "Funk": "0:D2:1 2:D3:1 3:D2:1 4:E2:1 6:E3:1 7:G2:1 8:D2:1 9:D2:1 11:F2:1 12:G1:1 14:G2:1 15:B1:1",
    "Reggae": "1:C2:1 2:C2:2 5:F1:1 6:A1:2 9:C2:1 10:E2:2 13:G1:1 14:B1:1 15:D2:1",
    "Latin": "0:A1:2 3:E2:1 6:D2:2 8:G1:2 11:D2:1 14:C2:2",
    "Lo-fi": "0:F1:3 3:A1:1 4:E1:3 7:G1:1 8:D2:3 11:A1:1 12:C2:4",
    "Electronic": "1:A1:1 3:A2:1 5:F1:1 7:F2:1 9:C2:1 11:C3:1 13:G1:1 15:G2:1",
    "March": "0:C2:2 2:G1:2 4:F1:2 6:C2:2 8:G1:2 10:D2:2 12:C2:2 14:G1:2",
    "Lullaby": "0:C2:3 3:G1:1 4:E2:4 8:F1:3 11:C2:1 12:C2:4",
    "Spooky": "0:A1:2 2:A1:1 3:B1:1 4:F1:2 6:F1:1 7:E1:1 8:B1:2 10:D2:1 11:F2:1 12:E1:3 15:E2:1",
    "Space": "0:F1:4 4:G1:3 7:D2:1 8:E1:4 12:A1:2 14:E2:2",
  };

  // ---- tunes: two per style, 8 counts on eighths -----------------------------------------------------------------
  const MELODY = [
    ["Pop", "Lemonade stand", "0:E4:1 1:G4:1 2:C5:2 4:A4:1 5:C5:1 6:F4:2 8:E4:1 9:A4:1 10:C5:2 12:B4:1 13:D5:1 14:G4:2"],
    ["Pop", "Kite string", "0:G4:2 2:E4:1 3:G4:1 4:A4:3 7:C5:1 8:C5:1 9:B4:1 10:A4:2 12:G4:1 13:F4:1 14:D4:2"],
    ["Hip hop", "Corner store", "0:E5:1 2:C5:1 3:A4:2 6:D5:1 7:C5:1 8:A4:2 10:F4:1 11:A4:1 12:G4:2 14:B4:1 15:E4:1"],
    ["Hip hop", "Night bus", "0:A4:1 1:A4:1 2:G4:1 4:F4:2 6:A4:1 8:C5:3 11:A4:1 12:B4:1 13:G4:1 14:E4:2"],
    ["Rock", "Skate park", "0:A4:1 1:C5:1 2:E5:2 4:D5:1 5:B4:1 6:G4:2 8:A4:1 9:C5:1 10:F4:2 12:G4:1 13:B4:1 14:D5:2"],
    ["Rock", "Big amp", "0:E4:2 2:E4:1 3:G4:1 4:D4:2 6:B3:2 8:C4:2 10:A3:1 11:C4:1 12:D4:3 15:G4:1"],
    ["Funk", "Sneaker squeak", "0:D5:1 1:C5:1 3:A4:1 4:B4:1 5:G4:1 7:E4:1 8:F4:1 9:A4:1 10:C5:1 11:D5:1 12:B4:1 14:G4:1 15:D5:1"],
    ["Funk", "Groove robot", "1:F4:1 2:A4:1 3:C5:1 5:G4:1 6:B4:1 7:D5:2 9:A4:1 10:F4:1 12:D4:1 13:G4:1 14:B4:2"],
    ["Reggae", "Sunny dock", "0:G4:2 2:E4:2 4:F4:1 5:A4:1 6:C5:2 8:E4:3 11:G4:1 12:D4:2 14:B3:2"],
    ["Reggae", "Palm shade", "2:C5:1 3:C5:1 4:A4:2 6:F4:2 8:G4:1 9:E4:1 10:C4:2 12:D4:1 13:G4:1 14:B4:2"],
    ["Latin", "Fiesta lights", "0:A4:1 1:B4:1 2:C5:1 3:E5:2 5:D5:1 6:F4:1 7:A4:1 8:G4:1 9:B4:1 10:D5:2 12:C5:1 13:E5:1 14:C5:2"],
    ["Latin", "Sunset dance", "0:E5:1 2:C5:1 3:A4:1 5:F4:1 6:A4:1 7:D5:1 9:B4:1 10:G4:1 11:D4:1 12:E4:2 14:G4:1 15:C5:1"],
    ["Lo-fi", "Window drops", "0:E5:2 2:C5:1 3:A4:2 5:B4:1 6:G4:2 8:F4:1 9:A4:1 10:C5:2 12:B4:2 14:G4:2"],
    ["Lo-fi", "Homework hum", "0:A4:3 3:G4:1 4:E4:3 7:D4:1 8:F4:2 10:A4:1 11:C5:1 12:E4:4"],
    ["Electronic", "Pixel city", "0:A4:1 1:E5:1 2:A4:1 3:E5:1 4:F4:1 5:C5:1 6:F4:1 7:C5:1 8:G4:1 9:C5:1 10:E5:1 11:G5:1 12:D5:1 13:B4:1 14:G4:1 15:B4:1"],
    ["Electronic", "Neon steps", "0:C5:2 2:C5:1 3:E5:1 4:A4:2 6:A4:1 7:C5:1 8:G4:2 10:E4:1 11:G4:1 12:B4:2 14:D5:2"],
    ["March", "Brave band", "0:C5:1 1:C5:1 2:G4:2 4:A4:1 5:A4:1 6:F4:2 8:G4:1 9:B4:1 10:D5:2 12:E5:2 14:C5:2"],
    ["March", "Parade feet", "0:G4:1 1:G4:1 2:C5:1 3:G4:1 4:A4:2 6:C5:2 8:D5:1 9:B4:1 10:G4:2 12:C5:4"],
    ["Lullaby", "Little moon", "0:E4:2 2:G4:2 4:B4:3 7:G4:1 8:A4:2 10:F4:2 12:E4:4"],
    ["Lullaby", "Soft pillow", "0:C5:3 3:B4:1 4:G4:4 8:A4:2 10:C5:2 12:G4:3 15:E4:1"],
    ["Spooky", "Creaky door", "0:A4:1 1:C5:1 2:B4:1 3:A4:1 4:F4:2 6:A4:2 8:B4:1 9:D5:1 10:F5:2 12:E5:3 15:B4:1"],
    ["Spooky", "Haunted hall", "0:E5:2 2:D5:1 3:C5:1 4:C5:2 6:A4:2 8:D5:1 9:B4:1 10:F4:2 12:G4:1 13:B4:1 14:E4:2"],
    ["Space", "Orbit", "0:C5:2 2:E5:2 4:D5:2 6:B4:2 8:G4:2 10:B4:1 11:D5:1 12:E5:4"],
    ["Space", "Comet tail", "0:A5:1 1:E5:1 2:C5:2 4:D5:1 5:B4:1 6:G4:2 8:E5:1 9:B4:1 10:G4:2 12:A4:2 14:C5:2"],
  ];
  // the note each style comes home to (C major or A minor)
  const HOME = { "Pop": "C", "Hip hop": "A", "Rock": "A", "Funk": "A", "Reggae": "C", "Latin": "A", "Lo-fi": "C", "Electronic": "A", "March": "C", "Lullaby": "C", "Spooky": "A", "Space": "A" };

  // ---- chords: four chords, 2 counts each; "7" adds the seventh. Short hits: where the hits land in each chord.
  const CHORDS = {
    "Pop": [["C", "F", "A", "G"], [0, 3]],
    "Hip hop": [["A7", "D7", "F7", "E7"], [0, 2]],
    "Rock": [["A", "G", "F", "G"], [0, 2, 3]],
    "Funk": [["D7", "E7", "D7", "G"], [1, 3]],
    "Reggae": [["C", "F", "C", "G"], [1, 3]],
    "Latin": [["A", "D", "G", "C"], [0, 3]],
    "Lo-fi": [["F7", "E7", "D7", "C7"], [0, 3]],
    "Electronic": [["A", "F", "C", "G"], [1, 2, 3]],
    "March": [["C", "F", "G", "C"], [0, 2]],
    "Lullaby": [["C", "E", "F", "C"], [0]],
    "Spooky": [["A", "F", "B", "E"], [0, 1]],
    "Space": [["F7", "G", "E7", "A7"], [2]],
  };

  // ---- effects rhythms: 8 counts on eighths ------------------------------------------------------------------------
  const FX = [
    ["Pop", "Party pops", "x.......x..x...."],
    ["Hip hop", "Record scratches", "..x....x..x...x."],
    ["Rock", "Big hits", "x.....x.x.....x."],
    ["Funk", "Funky hits", ".x.x....x.x.x..."],
    ["Reggae", "Echo drops", "...x.......x..x."],
    ["Latin", "Fiesta hits", "x..x..x...x.x..."],
    ["Lo-fi", "Soft taps", "....x.......x.x."],
    ["Electronic", "Laser hits", "x.x.x...x.x.x.xx"],
    ["March", "Parade hits", "x...x...x...xxx."],
    ["Lullaby", "Night sparkles", "......x.......x."],
    ["Spooky", "Spooky knocks", ".x..x......x.x.x"],
    ["Space", "Space zaps", "x....x.x....x..."],
  ];

  // ---- growing the seeds ---------------------------------------------------------------------------------------
  const PATTERNS = [];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  function add(type, style, name, counts, grid, notes) {
    PATTERNS.push({ id: slug(type + " " + name), name, type, style, counts, grid, notes: tidy(notes, counts * grid) });
  }

  function drumBar(rows) {
    const out = [];
    Object.keys(rows).forEach((k) => {
      const s = rows[k];
      for (let i = 0; i < s.length; i++) if (s[i] !== ".") out.push(nt(i, SLOT[k], 1, s[i] === "o" ? 0.5 : 0.9));
    });
    return out;
  }
  function expandDrums(style, name, rows) {
    const g = rows.K.length / 4, B = 4 * g, bar = drumBar(rows);
    const label = name + " beat";
    add("drums", style, label, 4, g, bar);
    // long: four bars, a cymbal to start, a tom fill in the last count
    let long = [];
    for (let b = 0; b < 4; b++) long = long.concat(shift(bar, b * B));
    long.push(nt(0, SLOT.Y, 1, 0.8));
    long = long.filter((n) => n.step < 4 * B - g);
    const fillLast = g === 2 ? [[SLOT.T, 0.85], [SLOT.L, 0.95]] : [[SLOT.S, 0.6], [SLOT.S, 0.75], [SLOT.T, 0.85], [SLOT.L, 0.95]];
    fillLast.forEach((f, i) => long.push(nt(4 * B - g + i, f[0], 1, f[1])));
    add("drums", style, label + ", long", 16, g, long);
    // with a fill: two bars on sixteenths, the second ending in a quick snare and tom run
    const bar4 = g === 4 ? bar : finer(bar);
    let fill = bar4.concat(shift(bar4, 16).filter((n) => n.step < 28));
    [[SLOT.S, 0.6], [SLOT.S, 0.75], [SLOT.T, 0.85], [SLOT.L, 0.95]].forEach((f, i) => fill.push(nt(28 + i, f[0], 1, f[1])));
    fill.push(nt(16, SLOT.Y, 1, 0.75));
    add("drums", style, label + " with a fill", 8, 4, fill);
    // fast hats: closed hats on every sixteenth (not where an open hat rings)
    let fast = bar4.concat(shift(bar4, 16)).filter((n) => n.pitch !== SLOT.H);
    for (let s = 0; s < 32; s++) {
      if (fast.some((n) => n.step === s && n.pitch === SLOT.O)) continue;
      fast.push(nt(s, SLOT.H, 1, s % 4 === 0 ? 0.8 : s % 2 === 0 ? 0.6 : 0.4));
    }
    add("drums", style, label + ", fast hats", 8, 4, fast);
  }

  function expandBass(style, src) {
    const seed = line(src), label = style + " bass line";
    add("bass", style, label, 8, 2, seed);
    add("bass", style, label + ", short", 4, 2, seed.filter((n) => n.step < 8));
    add("bass", style, label + ", long", 16, 2, seed.concat(shift(seed, 16).map((n) => (n.step >= 28 ? nt(n.step, n.pitch + 12, n.len, n.vel) : n))));
    // busy: on sixteenths, long notes bounce up an octave and back, off-beat notes get a quick octave pop
    const busy = [];
    finer(seed).forEach((n) => {
      if (n.len >= 4) {
        busy.push(nt(n.step, n.pitch, 2, n.vel), nt(n.step + 2, n.pitch + 12, 1, 0.55), nt(n.step + 3, n.pitch, 1, 0.7));
      } else if (n.step % 4 === 2) {
        busy.push(nt(n.step, n.pitch, 1, n.vel), nt(n.step + 1, n.pitch + 12, 1, 0.5));
      } else busy.push(n);
    });
    add("bass", style, label + ", busy", 8, 4, busy);
  }

  function expandMelody(style, name, src) {
    const seed = sortN(line(src));
    add("melody", style, name, 8, 2, seed);
    add("melody", style, name + ", short", 4, 2, seed.filter((n) => n.step < 8));
    // long: the tune, then an answer that sits a little lower and comes home
    const answer = shift(seed, 16).map((n) => (n.step >= 24 ? nt(n.step, fromIdx(toIdx(n.pitch) - 2), n.len, n.vel) : n));
    const last = answer[answer.length - 1], home = LETTER[HOME[style]];
    let best = last.pitch;
    for (let d = 0; d <= 6; d++) {
      if (((last.pitch - d) % 12 + 12) % 12 === home) { best = last.pitch - d; break; }
      if (((last.pitch + d) % 12 + 12) % 12 === home) { best = last.pitch + d; break; }
    }
    last.pitch = best;
    add("melody", style, name + ", long", 16, 2, seed.concat(answer));
    // quick: on sixteenths, with passing notes leading into the next note
    const q = finer(seed), out = [];
    q.forEach((a, i) => {
      const b = q[i + 1];
      const gap = b ? b.step - a.step : 0;
      if (b && gap >= 4) {
        out.push(nt(a.step, a.pitch, Math.min(a.len, gap - 1), a.vel));
        const lead = b.pitch > a.pitch ? toIdx(b.pitch) - 1 : toIdx(b.pitch) + 1;
        out.push(nt(b.step - 1, fromIdx(lead), 1, 0.6));
      } else if (b && gap === 2 && i % 2 === 1) {
        out.push(nt(a.step, a.pitch, 1, a.vel), nt(a.step + 1, fromIdx(toIdx(a.pitch) + 1), 1, 0.6));
      } else out.push(a);
    });
    add("melody", style, name + ", quick", 8, 4, out);
  }

  function chordTones(sym) {
    let root = midi(sym[0] + "3");
    if (root < 55) root += 12;
    const i = toIdx(root), degs = sym.indexOf("7") > 0 ? [0, 2, 4, 6] : [0, 2, 4];
    return degs.map((d) => fromIdx(i + d));
  }
  function expandChords(style, prog, hits) {
    const label = style + " chords", ch = prog.map(chordTones);
    const block = [], stabs = [], slow = [], roll = [];
    ch.forEach((tones, i) => {
      tones.forEach((m) => {
        block.push(nt(i * 4, m, 4, 0.7));
        hits.forEach((h) => stabs.push(nt(i * 4 + h, m, 1, 0.75)));
        slow.push(nt(i * 8, m, 8, 0.65));
      });
      const up = tones.concat([tones[0] + 12]);
      const order = up.concat(up.slice(1, -1).reverse());
      for (let k = 0; k < 8; k++) roll.push(nt(i * 8 + k, order[k % order.length], 1, k === 0 ? 0.85 : 0.65));
    });
    add("chords", style, label, 8, 2, block);
    add("chords", style, label + ", short hits", 8, 2, stabs);
    add("chords", style, label + ", rolling", 8, 4, roll);
    add("chords", style, label + ", slow", 16, 2, slow);
  }

  function expandFx(style, name, rhythm) {
    const hits = [];
    for (let i = 0; i < rhythm.length; i++) if (rhythm[i] === "x") hits.push(nt(i, 0, 1, 0.85));
    add("fx", style, name, 8, 2, hits);
    add("fx", style, name + ", short", 4, 2, hits.filter((n) => n.step < 8));
    add("fx", style, name + ", fast", 8, 4, finer(hits).map((n) => nt(n.step, 0, 1, n.vel)).concat(finer(hits).map((n) => nt(n.step + 1, 0, 1, 0.5))));
  }

  STYLES.forEach((style) => {
    DRUMS.filter((d) => d[0] === style).forEach((d) => expandDrums(style, d[1], d[2]));
    expandBass(style, BASS[style]);
    MELODY.filter((m) => m[0] === style).forEach((m) => expandMelody(style, m[1], m[2]));
    expandChords(style, CHORDS[style][0], CHORDS[style][1]);
    FX.filter((f) => f[0] === style).forEach((f) => expandFx(style, f[1], f[2]));
  });

  const byIdMap = new Map(PATTERNS.map((x) => [x.id, x]));
  const byId = (id) => byIdMap.get(id);
  const byName = (name) => PATTERNS.find((x) => x.name === name);

  // ---- fitting a pattern to an instrument ---------------------------------------------------------------------------
  const KIT_FROM_RANK = [0, 1, 2, 4, 6, 5, 3, 7];
  const TONE_FROM_SLOT = [0, 7, 4, 12, 2, 9, 5, 11];
  function fitPattern(pattern, instrument) {
    const total = pattern.counts * pattern.grid;
    const notes = pattern.notes.map((n) => nt(n.step, n.pitch, n.len, n.vel));
    if (!instrument) return notes;
    if (instrument.kind === "fx") return tidy(notes.map((n) => nt(n.step, 0, 1, n.vel)), total);
    const hitsLike = pattern.type === "drums" || pattern.type === "fx";
    if (instrument.kind === "kit") {
      if (pattern.type === "drums") return tidy(notes.map((n) => nt(n.step, Math.max(0, Math.min(7, n.pitch)), n.len, n.vel)), total);
      const ranks = Array.from(new Set(notes.map((n) => n.pitch))).sort((a, b) => a - b);
      return tidy(notes.map((n) => nt(n.step, KIT_FROM_RANK[ranks.indexOf(n.pitch) % 8], 1, n.vel)), total);
    }
    const lo = instrument.range ? instrument.range[0] : 36, hi = instrument.range ? instrument.range[1] : 84;
    const mid = (lo + hi) / 2;
    let src = notes;
    if (hitsLike) {
      const base = 12 * Math.floor(mid / 12);
      src = notes.map((n) => nt(n.step, base + TONE_FROM_SLOT[n.pitch % 8], 1, n.vel));
    }
    const pLo = Math.min.apply(null, src.map((n) => n.pitch)), pHi = Math.max.apply(null, src.map((n) => n.pitch));
    // the octave shift that leaves the fewest notes outside the range, nearest the middle when tied
    let best = 0, bestOut = Infinity, bestDist = Infinity;
    for (let k = -6; k <= 6; k++) {
      const by = 12 * k;
      const out = src.filter((n) => n.pitch + by < lo || n.pitch + by > hi).length;
      const dist = Math.abs((pLo + pHi) / 2 + by - mid);
      if (out < bestOut || (out === bestOut && dist < bestDist)) { best = by; bestOut = out; bestDist = dist; }
    }
    return tidy(src.map((n) => {
      let m = n.pitch + best;
      while (m < lo) m += 12;
      while (m > hi) m -= 12;
      return nt(n.step, Math.max(lo, m), n.len, n.vel);
    }), total);
  }

  // which kinds of pattern suit an instrument ("For this track")
  function typesFor(instrument) {
    if (!instrument) return TYPES.slice();
    if (instrument.kind === "kit") return ["drums"];
    if (instrument.kind === "fx") return ["fx"];
    if (instrument.category === "bass") return ["bass"];
    const out = ["melody", "chords"];
    if (instrument.range && instrument.range[0] <= 40) out.push("bass");
    return out;
  }

  // ---- songs made from patterns: the starter (and, in lessons.js, the lessons' songs) ------------------------------
  function makeSong(title, opts, parts) {
    const M = SS.model, I = SS.instruments;
    const s = M.newSong({ title });
    s.counts = opts.counts || 8;
    s.tempo = opts.tempo || 100;
    s.grid = opts.grid || 2;
    if (opts.loop === false) s.loop = false;
    (parts || []).forEach((pt) => {
      const t = M.addTrack(s, pt.instrumentId);
      if (pt.volume !== undefined) t.volume = pt.volume;
      if (pt.pattern) {
        const pat = byName(pt.pattern);
        if (pat) M.applyPattern(t, fitPattern(pat, I.byId(pt.instrumentId)), pat.counts, s.counts, pat.grid, s.grid);
      }
      if (pt.notes) pt.notes.forEach((n) => t.notes.push(nt(n.step, n.pitch, n.len, n.vel)));
    });
    s.updatedMs = 0;
    return s;
  }

  const STARTERS = [
    {
      id: "hiphop-pop",
      name: "Hip hop/pop starter",
      song: makeSong("Hip hop/pop song", { counts: 8, tempo: 92 }, [
        { instrumentId: "hip-hop-kit", pattern: "Boom bap beat", volume: 0.85 },
        { instrumentId: "synth-bass", pattern: "Pop bass line", volume: 0.75 },
        { instrumentId: "grand-piano", pattern: "Pop chords, short hits", volume: 0.6 },
      ]),
    },
  ];

  SS.library = { STYLES, TYPES, TYPE_NAMES, PATTERNS, byId, byName, fitPattern, typesFor, STARTERS, makeSong };
})(typeof window !== "undefined" ? window : globalThis);
