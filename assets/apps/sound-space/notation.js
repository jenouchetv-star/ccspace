/* Sound Space: the song as sheet music.
   toAbc(song, opts) writes the song in ABC notation, the plain-text music format abcjs draws. Pure functions, no DOM:
   the same song always gives the same string.

   How the song maps onto the page:
   - one grid square (a step) is one ABC unit: L:1/16 on sixteenths (grid 4), L:1/8 on eighths (grid 2, or no grid);
   - counts are beats in 4/4, so a bar is 4 counts (a 4-count song is 1 bar, 16 counts is 4 bars);
   - one voice per track, in track order, each on its own staff; a track muted in the song is left out. */
(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  const NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  /* note lengths a single note can show (plain or dotted), in units, longest first */
  const SHOWABLE = [16, 12, 8, 6, 4, 3, 2, 1];
  /* a song longer than 2 bars is drawn 2 bars to a line */
  const BARS_PER_LINE = 2;

  /* drum kit slot role (instruments.js KIT_SLOTS) -> its place on the drum staff:
     0 kick F, 1 snare c, 2 closed hat ^g, 3 open hat ^a, 4 clap c, 5 low tom A, 6 high tom e, 7 cymbal ^b */
  const KIT_PLACES = ["F", "c", "^g", "^a", "c", "A", "e", "^b"];
  const PLACE_ORDER = { F: 0, A: 1, c: 2, e: 3, "^g": 4, "^a": 5, "^b": 6 };
  /* the hats and the cymbal get x noteheads (accidentals are never printed on a drum staff) */
  const PERCMAP = ["%%percmap ^g closed-hi-hat x", "%%percmap ^a open-hi-hat x", "%%percmap ^b crash-cymbal-1 x"];

  const pc = (m) => ((m % 12) + 12) % 12;

  /* a MIDI pitch as ABC: its sharp (if any), its letter with the octave's case, and the octave marks.
     60 is C, 72 is c, 48 is C, , 84 is c' and 61 is ^C. */
  function pitchParts(m) {
    const name = NAMES[pc(m)], oct = Math.floor(m / 12) - 1;
    const acc = name[0] === "^" ? "^" : "";
    let letter = name.slice(acc.length), marks = "";
    if (oct >= 5) { letter = letter.toLowerCase(); marks = "'".repeat(oct - 5); }
    else marks = ",".repeat(4 - oct);
    return { acc, place: letter + marks };
  }
  function pitchToAbc(m) {
    const p = pitchParts(m);
    return p.acc + p.place;
  }

  const gridOf = (song) => (song.grid === 4 ? 4 : 2);
  const totalOf = (song) => (song.counts || 8) * gridOf(song);
  const instOf = (t) => (SS.instruments && SS.instruments.byId ? SS.instruments.byId(t.instrumentId) : null) || null;
  const kindOf = (t) => { const i = instOf(t); return i ? i.kind : "pitched"; };
  /* the notes that sound inside the song: whole steps from 0 to the end, a length of at least 1 */
  function liveNotes(t, total) {
    return (t.notes || []).filter((n) => n && Number.isInteger(n.step) && n.step >= 0 && n.step < total && n.len >= 1 && Number.isFinite(n.pitch));
  }
  function shownTracks(song, which) {
    const all = song.tracks || [];
    if (which && which !== "all") return all.filter((t) => t.id === which);
    return all.filter((t) => !t.mute);
  }

  /* ---- events: what sounds when, before it is cut to fit bars ---- */

  /* Pitched: notes starting at the same step are a chord. A chord lasts as long as its shortest note; the longer notes
     tie on into the next stretch on their own (so [C-E]4 C4 for a long C under a short E). Splitting them into extra
     voices would be more exact, but one line of chords and ties keeps the right lengths and is easier to read.
     A note that starts later cuts the earlier ones short (one line at a time). */
  function pitchedEvents(notes, total) {
    const byStep = new Map();
    notes.forEach((n) => {
      const g = byStep.get(n.step) || new Map();
      g.set(n.pitch, Math.max(g.get(n.pitch) || 0, Math.round(n.len)));
      byStep.set(n.step, g);
    });
    const starts = Array.from(byStep.keys()).sort((a, b) => a - b);
    const out = [];
    let t = 0;
    starts.forEach((s, i) => {
      if (s > t) out.push({ start: t, end: s, rest: true });
      const stop = i + 1 < starts.length ? starts[i + 1] : total;
      const ends = new Map();
      byStep.get(s).forEach((len, p) => ends.set(p, Math.min(s + len, stop)));
      const cuts = Array.from(new Set(ends.values())).sort((a, b) => a - b);
      let a = s;
      cuts.forEach((b) => {
        const pitches = Array.from(ends.keys()).filter((p) => ends.get(p) > a).sort((x, y) => x - y);
        out.push({ start: a, end: b, pitches, ties: pitches.filter((p) => ends.get(p) > b), fresh: a === s });
        a = b;
      });
      if (a < stop) out.push({ start: a, end: stop, rest: true });
      t = stop;
    });
    if (t < total) out.push({ start: t, end: total, rest: true });
    return out;
  }

  /* Drums: every hit at a step is one chord of staff places, lasting until the next hit (drum parts are written that
     way: how long a drum pad is held changes nothing). fx: each hit is a short note at c, as long as the hit, then a rest. */
  function hitEvents(notes, total, placesOf, ownLength) {
    const byStep = new Map();
    notes.forEach((n) => {
      const g = byStep.get(n.step) || { places: new Set(), len: 0 };
      placesOf(n).forEach((p) => g.places.add(p));
      g.len = Math.max(g.len, Math.round(n.len));
      byStep.set(n.step, g);
    });
    const starts = Array.from(byStep.keys()).filter((s) => byStep.get(s).places.size).sort((a, b) => a - b);
    const out = [];
    let t = 0;
    starts.forEach((s, i) => {
      if (s > t) out.push({ start: t, end: s, rest: true });
      const stop = i + 1 < starts.length ? starts[i + 1] : total;
      const g = byStep.get(s);
      const end = ownLength ? Math.min(stop, s + g.len) : stop;
      const places = Array.from(g.places).sort((a, b) => PLACE_ORDER[a] - PLACE_ORDER[b]);
      out.push({ start: s, end, places, single: true });
      if (end < stop) out.push({ start: end, end: stop, rest: true });
      t = stop;
    });
    if (t < total) out.push({ start: t, end: total, rest: true });
    return out;
  }

  /* ---- cutting events to fit: bar lines, the middle of the bar, and lengths a note can show ---- */

  function showable(d) {
    for (let i = 0; i < SHOWABLE.length; i++) if (SHOWABLE[i] <= d) return SHOWABLE[i];
    return 1;
  }
  /* rests: up to the next beat first, then a whole bar, a half bar or a beat at a time */
  function restParts(a, b, bar, beat) {
    const out = [];
    let x = a;
    while (x < b) {
      const bs = Math.floor(x / bar) * bar, off = x - bs, left = Math.min(b, bs + bar) - x;
      let d;
      if (off % beat) d = Math.min(left, beat - (off % beat));
      else if (off === 0 && left >= bar) d = bar;
      else if (off % (bar / 2) === 0 && left >= bar / 2) d = bar / 2;
      else d = Math.min(left, beat);
      d = showable(d);
      out.push({ start: x, dur: d, rest: true });
      x += d;
    }
    return out;
  }
  /* notes: split at bar lines (tied), at the middle of the bar when a note crosses it from an off-beat, then into
     lengths a note can show (5 is 4 tied to 1) */
  function noteSpans(a, b, bar, beat) {
    const spans = [];
    let x = a;
    while (x < b) {
      const bs = Math.floor(x / bar) * bar, off = x - bs;
      let y = Math.min(b, bs + bar);
      if (off % beat && off < bar / 2 && y - bs > bar / 2) y = bs + bar / 2;
      while (x < y) { const d = showable(Math.min(y - x, bar)); spans.push([x, d]); x += d; }
    }
    return spans;
  }

  /* ---- writing the voice ---- */

  function lengthText(d) { return d === 1 ? "" : String(d); }

  function writeVoice(events, total, grid, pitched, names) {
    const bar = 4 * grid, beat = grid;
    const pieces = [];
    events.forEach((ev) => {
      if (ev.rest) { pieces.push(...restParts(ev.start, ev.end, bar, beat)); return; }
      const spans = noteSpans(ev.start, ev.end, bar, beat);
      if (ev.single) {
        /* a drum or effect hit is written once; anything after its first piece is rest */
        pieces.push({ start: spans[0][0], dur: spans[0][1], places: ev.places });
        const after = spans[0][0] + spans[0][1];
        if (after < ev.end) pieces.push(...restParts(after, ev.end, bar, beat));
        return;
      }
      spans.forEach(([s, d], k) => {
        const last = k === spans.length - 1;
        pieces.push({ start: s, dur: d, pitches: ev.pitches, ties: last ? ev.ties : ev.pitches, fresh: ev.fresh && k === 0 });
      });
    });

    const bars = [];
    const words = [];   /* the letters, bar by bar */
    let accs = null, curBar = -1, groups = null, curBeat = -1, barWords = null;
    pieces.forEach((p) => {
      const b = Math.floor(p.start / bar);
      if (b !== curBar) { curBar = b; accs = new Map(); groups = []; bars.push(groups); curBeat = -1; barWords = []; words.push(barWords); }
      const bt = Math.floor((p.start - b * bar) / beat);
      if (bt !== curBeat) { curBeat = bt; groups.push(""); }
      let tok;
      if (p.rest) {
        tok = "z" + lengthText(p.dur);
        if (pitched) barWords.push("*");
      } else if (p.places) {
        tok = (p.places.length > 1 ? "[" + p.places.join("") + "]" : p.places[0]) + lengthText(p.dur);
      } else {
        const heads = p.pitches.map((m) => {
          const q = pitchParts(m), was = accs.get(q.place) || "";
          let acc = "";
          if (q.acc === "^" && was !== "^") acc = "^";
          else if (q.acc === "" && was === "^") acc = "=";
          accs.set(q.place, q.acc);
          return acc + q.place + (p.ties.indexOf(m) >= 0 ? "-" : "");
        });
        tok = heads.length > 1 ? "[" + heads.join("") + "]" + lengthText(p.dur)
          : heads[0].replace(/-$/, "") + lengthText(p.dur) + (/-$/.test(heads[0]) ? "-" : "");
        if (pitched) barWords.push(p.fresh ? LETTERS[pc(p.pitches[0])] : "*");
      }
      groups[groups.length - 1] += tok;
    });
    return { bars: bars.map((g) => g.join(" ") + " |"), words: names && pitched ? words : null };
  }

  function median(xs) {
    const s = xs.slice().sort((a, b) => a - b), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  const clean = (s) => String(s).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

  /* opts.tracks: "all" (every track not muted) or one track's id; opts.names: letter names under the notes */
  function toAbc(song, opts) {
    opts = opts || {};
    const grid = gridOf(song), total = totalOf(song);
    const tracks = shownTracks(song, opts.tracks || "all");
    const voices = [];
    let drums = false;
    tracks.forEach((t, i) => {
      const inst = instOf(t), kind = kindOf(t), notes = liveNotes(t, total);
      const name = clean(inst ? inst.name : "Track").replace(/"/g, "");
      const id = "T" + (i + 1);
      let head, events, pitched = false;
      if (kind === "kit") {
        drums = true;
        head = "clef=perc";
        events = hitEvents(notes, total, (n) => { const p = KIT_PLACES[n.pitch]; return p ? [p] : []; }, false);
      } else if (kind === "fx") {
        head = "clef=perc stafflines=1";
        events = hitEvents(notes, total, () => ["c"], true);
      } else {
        pitched = true;
        head = "clef=" + (notes.length && median(notes.map((n) => n.pitch)) < 60 ? "bass" : "treble");
        events = pitchedEvents(notes, total);
      }
      const v = writeVoice(events, total, grid, pitched, !!opts.names);
      voices.push({ id, head: "V:" + id + " " + head + ' name="' + name + '"', bars: v.bars, words: v.words });
    });

    const out = [
      "X:1",
      /* abcjs reads % as a comment (even written \%) and \ as the start of an accent, so a title shows ％ and / instead */
      "T:" + clean(song.title || "My song").replace(/\\/g, "/").replace(/%/g, "％"),
      "M:4/4",
      "L:" + (grid === 4 ? "1/16" : "1/8"),
      "Q:1/4=" + (Math.round(song.tempo) || 120),
      "%%stretchlast 1",
    ];
    if (voices.length > 1) out.push("%%score " + voices.map((v) => "(" + v.id + ")").join(" "));
    if (drums) out.push(...PERCMAP);
    out.push("K:C");
    /* 16 counts (4 bars) is two lines of two bars, so a busy song stays readable; shorter songs are one line. Each line
       names every voice again (V:T1, V:T2 ...) with its bars and, under them, its own w: letters; ties carry across. */
    const nBars = voices.length ? voices[0].bars.length : 0;
    const perLine = nBars > BARS_PER_LINE ? BARS_PER_LINE : nBars;
    for (let from = 0; from < nBars; from += perLine) {
      voices.forEach((v) => {
        out.push(from === 0 ? v.head : "V:" + v.id, v.bars.slice(from, from + perLine).join(" "));
        if (v.words) out.push("w: " + [].concat(...v.words.slice(from, from + perLine)).join(" "));
      });
    }
    return out.join("\n") + "\n";
  }

  /* is there anything to draw: a note inside the song on a track that is shown */
  function hasNotes(song, which) {
    const total = totalOf(song);
    return shownTracks(song, which || "all").some((t) => liveNotes(t, total).length > 0);
  }

  SS.notation = { toAbc, hasNotes, pitchToAbc, KIT_PLACES };
})(typeof window !== "undefined" ? window : globalThis);
