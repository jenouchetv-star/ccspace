(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  // Music lessons: each opens a ready-made song and walks a kid through 3-5 small steps, one music word each, and by
  // the end the kid has built a real song.
  // A step: { text, target: the id of the control its tip card sits beside, check(song, ui) => true once done }.
  // ui: { selectedTrackId, playing, recording, events } where events counts what the kid did since the step
  // began: record, keys (piano keys), pads (drum or effect pads), grid (taps on the grid), use (library Use).
  // Every "Press Play" step passes while the song is playing (played), so a kid whose song is already looping
  // is never stuck.
  // A step may also have:
  //   guide: { track: a test on the instrument (isKit, isBass, isTune), notes: [{ step, pitch, len }] on eighths,
  //            exactLen: true when each note's length must match too } - the page outlines these notes on the grid,
  //            and the step is done once every one is on a track that passes the test (guideDone);
  //   litKeys: [pitch, ...] - the page lights the next key to play, and moves on when the kid plays it (nextLit).

  const L = SS.library;
  const inst = (t) => SS.instruments.byId(t.instrumentId);
  const tracks = (song, test) => song.tracks.filter((t) => { const i = inst(t); return !!i && test(i); });
  const did = (ui, name) => (ui && ui.events && ui.events[name]) || 0;
  const played = (ui) => !!(ui && ui.playing);
  const sq = (song) => song.grid || 2;
  const isKit = (i) => i.kind === "kit";
  const isBass = (i) => i.category === "bass" && i.kind === "pitched";
  const isTune = (i) => i.kind === "pitched" && i.category !== "bass";
  const KICK = 0, HAT = 2, CLAP = 4;
  // does any track that passes `test` have `fn(track)` true?
  const any = (song, test, fn) => tracks(song, test).some(fn);

  // ---- the songs -------------------------------------------------------------------------------------------------
  // Each melody is [pitch, length in eighths] in order; null is a rest, and a list of pitches is a chord. Melodies
  // only, never the words. The famous songs are all public domain; the two pop recipes are building blocks found
  // under lots of songs (a drum beat, four chords), not any one song's tune.
  const SONGS = {
    // the pop beat (a pop recipe): eighth-note steps in one bar of 4 counts - kick on 1 and 3, clap on 2 and 4,
    // closed hi-hat on every eighth
    popBeat: { kick: [0, 4], clap: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
    // Twinkle Twinkle Little Star: traditional (the French tune "Ah! vous dirai-je, maman"), public domain
    twinkle: [[60, 2], [60, 2], [67, 2], [67, 2], [69, 2], [69, 2], [67, 4], [65, 2], [65, 2], [64, 2], [64, 2], [62, 2], [62, 2], [60, 4]],
    // Jingle Bells: James Lord Pierpont, 1857, public domain (its first four bars)
    jingleBells: [[64, 2], [64, 2], [64, 4], [64, 2], [64, 2], [64, 4], [64, 2], [67, 2], [60, 3], [62, 1], [64, 8]],
    // In the Hall of the Mountain King: Edvard Grieg, 1875, public domain
    mountainKing: [[45, 1], [47, 1], [48, 1], [50, 1], [52, 1], [48, 1], [52, 2], [51, 1], [47, 1], [51, 2], [50, 1], [46, 1], [50, 2],
      [45, 1], [47, 1], [48, 1], [50, 1], [52, 1], [48, 1], [52, 1], [57, 1], [55, 1], [52, 1], [48, 1], [52, 1], [55, 4]],
    // Canon in D: Johann Pachelbel, public domain - its bass line, and the chord over each bass note
    canonBass: [[50, 4], [45, 4], [47, 4], [42, 4], [43, 4], [38, 4], [43, 4], [45, 4]],
    canonChords: [[[62, 66, 69], 4], [[61, 64, 69], 4], [[62, 66, 71], 4], [[61, 66, 69], 4], [[62, 67, 71], 4], [[62, 66, 69], 4], [[62, 67, 71], 4], [[61, 64, 69], 4]],
    // Ode to Joy: Ludwig van Beethoven, 1824, public domain
    odeToJoy: [[64, 2], [64, 2], [65, 2], [67, 2], [67, 2], [65, 2], [64, 2], [62, 2], [60, 2], [60, 2], [62, 2], [64, 2], [64, 3], [62, 1], [62, 4],
      [64, 2], [64, 2], [65, 2], [67, 2], [67, 2], [65, 2], [64, 2], [62, 2], [60, 2], [60, 2], [62, 2], [64, 2], [62, 3], [60, 1], [60, 4]],
    // Für Elise: Ludwig van Beethoven, 1810, public domain
    furElise: [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 2], [null, 1], [60, 1], [64, 1], [69, 1], [71, 2], [null, 1],
      [64, 1], [68, 1], [71, 1], [72, 2], [null, 1], [64, 1], [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1]],
    // the four-chord song (a pop recipe): C, G, A minor and F, two bars each, with their roots in the bass
    fourChordBass: [[48, 8], [43, 8], [45, 8], [41, 8]],
    fourChords: [[[60, 64, 67], 8], [[59, 62, 67], 8], [[57, 60, 64], 8], [[57, 60, 65], 8]],
  };

  // [pitch or chord, eighths] -> notes on the eighth grid: [{ step, pitch, len }]
  function notesOf(seq) {
    const out = [];
    let s = 0;
    seq.forEach(([p, len]) => {
      if (p !== null) [].concat(p).forEach((pitch) => out.push({ step: s, pitch, len }));
      s += len;
    });
    return out;
  }
  // the notes from eighth `from` up to (not including) eighth `to`: one line of a song
  const part = (seq, from, to) => notesOf(seq).filter((n) => n.step >= from && n.step < to);
  const hits = (steps, pitch) => steps.map((step) => ({ step, pitch, len: 1 }));

  // A guide's notes on a song's grid: the guide is on eighths (2 squares a count), so sixteenths double it.
  function guideNotes(guide, grid) {
    const f = (grid || 2) / 2;
    return guide.notes.map((n) => ({ step: n.step * f, pitch: n.pitch, len: n.len * f }));
  }
  // every outlined note is on a track that passes the guide's test: same square and pitch (and length, when exactLen);
  // extra notes never matter
  function guideDone(song, guide) {
    const ts = tracks(song, guide.track);
    return guideNotes(guide, sq(song)).every((g) => ts.some((t) => t.notes.some((n) =>
      n.step === g.step && n.pitch === g.pitch && (!guide.exactLen || n.len === g.len))));
  }
  // the next lit key: on only when the kid plays the one that is lit, and round to the first again after the last
  function nextLit(keys, i, pitch) {
    if (!keys || !keys.length || keys[i] !== pitch) return i;
    return (i + 1) % keys.length;
  }

  // a step that outlines notes on the grid and is done once they are all filled in
  function fill(text, track, notes, opts) {
    const guide = { track, notes, exactLen: !!(opts && opts.exactLen) };
    return { text, target: (opts && opts.target) || "#ss-grid", guide, check: (s) => guideDone(s, guide) };
  }
  // a lesson's song: makeSong, then each part's notes (written on eighths) put on the song's grid
  function start(title, opts, parts) {
    const s = L.makeSong(title, opts, parts);
    const f = s.grid / 2;
    parts.forEach((pt, i) => {
      if (pt.eighths) pt.eighths.forEach((n) => s.tracks[i].notes.push({ step: n.step * f, pitch: n.pitch, len: n.len * f, vel: 0.75 }));
    });
    return s;
  }

  const PLAY = "#ss-play";
  const LESSONS = [
    {
      id: "keep-the-beat",
      title: "Keep the beat",
      song: "The pop beat",
      recipe: true,
      word: "beat",
      meaning: "The beat is the steady pulse of music: the part you clap or tap your foot to.",
      startSong: L.makeSong("Lesson 1: The pop beat", { counts: 4, tempo: 100 }, [
        { instrumentId: "classic-kit", volume: 0.85, notes: [{ step: 0, pitch: KICK, len: 1, vel: 0.9 }] },
      ]),
      steps: [
        { text: "Press Play. You hear one kick drum, then quiet. Let's build the beat that lots of pop songs use.", target: PLAY, check: (s, ui) => played(ui) },
        fill("Tap the outlined squares in the Kick row. Now the kick plays on counts 1 and 3.", isKit, hits(SONGS.popBeat.kick, KICK)),
        fill("Tap the outlined squares in the Clap row. The clap plays on counts 2 and 4.", isKit, hits(SONGS.popBeat.clap, CLAP)),
        fill("Tap every outlined square in the Closed hat row. The hi-hat ticks in between. That's the pop beat!", isKit, hits(SONGS.popBeat.hat, HAT)),
        { text: "Play along on the drum pads. Tap the Kick pad (or the A key) 4 times, right on the beat.", target: "#ss-pads", check: (s, ui) => did(ui, "pads") >= 4 },
      ],
    },
    {
      id: "first-melody",
      title: "Your first melody",
      song: "Twinkle Twinkle Little Star",
      word: "melody",
      meaning: "A melody is a tune: notes played one after another that you could sing or hum.",
      startSong: L.makeSong("Lesson 2: Twinkle Twinkle Little Star", { counts: 16, tempo: 100 }, [
        { instrumentId: "grand-piano", volume: 0.8 },
        { instrumentId: "classic-kit", pattern: "Cradle sway beat", volume: 0.55 },
      ]),
      steps: [
        fill("Tap the outlined squares to fill in the first line. Long outlines are long notes.", isTune, part(SONGS.twinkle, 0, 16)),
        fill("Now fill in the next line of outlines. It ends on a long note.", isTune, part(SONGS.twinkle, 16, 32)),
        { text: "Press Play to hear Twinkle Twinkle Little Star. Notes played one after another make a melody.", target: PLAY, check: (s, ui) => played(ui) },
      ],
    },
    {
      id: "long-and-short",
      title: "Long and short notes",
      song: "Jingle Bells",
      word: "rhythm",
      meaning: "Rhythm is the pattern of long and short notes in a song.",
      startSong: L.makeSong("Lesson 3: Jingle Bells", { counts: 16, tempo: 110 }, [
        { instrumentId: "flute", volume: 0.8 },
        { instrumentId: "classic-kit", pattern: "Sunny pop beat", volume: 0.5 },
      ]),
      steps: [
        fill("Fill in the first line. Make each note as long as its outline: pick the quarter note for short ones and the half note for long ones.",
          isTune, part(SONGS.jingleBells, 0, 16), { exactLen: true }),
        fill("Now the next line. Pick a note length at the top, or drag a note's right edge until it fills its outline.",
          isTune, part(SONGS.jingleBells, 16, 32), { exactLen: true }),
        { text: "Press Play. The pattern of long and short notes is the rhythm.", target: PLAY, check: (s, ui) => played(ui) },
      ],
    },
    {
      id: "bass-line",
      title: "A tune down low",
      song: "In the Hall of the Mountain King",
      word: "bass",
      meaning: "Bass is the low part of a song. It follows the beat and holds the music up.",
      startSong: L.makeSong("Lesson 4: In the Hall of the Mountain King", { counts: 16, tempo: 96 }, [
        { instrumentId: "synth-bass", volume: 0.85 },
        { instrumentId: "classic-kit", pattern: "Creaky stairs beat", volume: 0.5 },
      ]),
      steps: [
        fill("This sneaky tune lives down low, on a bass. Tap the outlined squares to fill in the first line.", isBass, part(SONGS.mountainKing, 0, 16)),
        fill("Now fill in the next line of outlines. It climbs up and ends on a long note.", isBass, part(SONGS.mountainKing, 16, 32)),
        { text: "Press S on the bass track to hear the bass on its own.", target: "#ss-tracks", check: (s) => any(s, isBass, (t) => t.solo) },
        { text: "Press Play. The bass is the low part of the song. Press S again to hear everything.", target: PLAY, check: (s, ui) => played(ui) },
      ],
    },
    {
      id: "loops-and-counts",
      title: "Chords that go round",
      song: "Canon in D",
      word: "loop",
      meaning: "A loop is a part of music that plays again and again.",
      startSong: start("Lesson 5: Canon in D", { counts: 16, tempo: 84 }, [
        { instrumentId: "violin-section", volume: 0.6, eighths: notesOf(SONGS.canonChords) },
        { instrumentId: "plucked-double-bass", volume: 0.85 },
      ]),
      steps: [
        { text: "Press Play. With Loop on, these eight chords play again and again. A part that repeats is a loop.", target: PLAY, check: (s, ui) => played(ui) },
        fill("Give the chords a bass. Tap the outlined squares to fill in the first four bass notes.", isBass, part(SONGS.canonBass, 0, 16)),
        fill("Now fill in the last four outlined bass notes. They go round with the chords.", isBass, part(SONGS.canonBass, 16, 32)),
        { text: "Turn Loop off, then press Play. Now the song plays once and stops.", target: "#ss-loop", check: (s, ui) => !s.loop && played(ui) },
      ],
    },
    {
      id: "record-what-you-play",
      title: "Play it and record it",
      song: "Ode to Joy",
      word: "tempo",
      meaning: "Tempo is how fast or slow the beat goes. Musicians count it in beats a minute.",
      // Count-in is on for new songs; this lesson starts with it off so its Count-in step still teaches it
      startSong: L.makeSong("Lesson 6: Ode to Joy", { counts: 16, tempo: 96, countIn: false }, [
        { instrumentId: "electric-piano", volume: 0.8 },
        { instrumentId: "lo-fi-kit", pattern: "Sleepy beat", volume: 0.6 },
      ]),
      steps: [
        { text: "Make the Speed 80 or slower. Speed is also called tempo: how fast the beat goes.", target: "#ss-tempo", check: (s) => s.tempo <= 80 },
        { text: "Turn on Count-in. You will hear 1, 2, 3, 4 before recording starts.", target: "#ss-countin", check: (s) => !!s.countIn },
        { text: "Press Record. Then play the key that glows, again and again, to play Ode to Joy. Press Record again to stop.", target: "#ss-record",
          litKeys: SONGS.odeToJoy.map((x) => x[0]),
          check: (s, ui) => !(ui && ui.recording) && any(s, isTune, (t) => t.notes.length >= 8) },
        { text: "Make the Speed 100 or faster, then press Play. It's your same song, at a faster tempo!", target: "#ss-tempo",
          check: (s, ui) => s.tempo >= 100 && played(ui) },
      ],
    },
    {
      id: "quiet-spaces",
      title: "Quiet spaces",
      song: "Für Elise",
      word: "rest",
      meaning: "A rest is a little silence in music, a space where no note plays.",
      startSong: L.makeSong("Lesson 7: Für Elise", { counts: 16, tempo: 84 }, [
        { instrumentId: "grand-piano", volume: 0.8 },
      ]),
      steps: [
        fill("Tap the outlined squares to fill in the first line. Leave the empty squares empty: those are rests.", isTune, part(SONGS.furElise, 0, 16)),
        fill("Now fill in the next line of outlines. Keep the little gaps between them empty.", isTune, part(SONGS.furElise, 16, 32)),
        { text: "Press Play and listen for the quiet spaces between the notes. Each one is a rest.", target: PLAY, check: (s, ui) => played(ui) },
      ],
    },
    {
      id: "whole-song",
      title: "Build a pop song",
      song: "The four-chord song",
      recipe: true,
      word: "harmony",
      meaning: "Harmony is different notes sounding together, like the notes in a chord, so they sound good as one.",
      startSong: L.makeSong("Lesson 8: The four-chord song", { counts: 16, tempo: 104 }, []),
      steps: [
        fill("Add a drum track. Tap the outlined squares for the pop beat, or use Sunny pop beat from Beats and patterns.", isKit,
          [].concat(hits(SONGS.popBeat.kick, KICK), hits(SONGS.popBeat.clap, CLAP), hits(SONGS.popBeat.hat, HAT)), { target: "#ss-add-track" }),
        fill("Add a bass track. Fill in the four long outlined notes. They are the four chords' bass notes.", isBass,
          notesOf(SONGS.fourChordBass), { target: "#ss-add-track" }),
        fill("Add a piano and fill in the outlined chords. Notes played together make a chord.", isTune,
          notesOf(SONGS.fourChords), { target: "#ss-add-track" }),
        { text: "Add one more track, like a flute, and tap 4 or more notes of your own tune on top.", target: "#ss-add-track",
          check: (s) => {
            const chords = tracks(s, isTune).find((t) => guideDone({ tracks: [t], grid: s.grid }, { track: isTune, notes: notesOf(SONGS.fourChords) }));
            return any(s, isTune, (t) => t !== chords && t.notes.length >= 4);
          } },
        { text: "Press Play to hear your pop song. Chords and a bass under your tune make harmony.", target: PLAY, check: (s, ui) => played(ui) },
      ],
    },
  ];

  SS.lessons = { LESSONS, SONGS, notesOf, guideNotes, guideDone, nextLit, isKit, isBass, isTune };
})(typeof window !== "undefined" ? window : globalThis);
