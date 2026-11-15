(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  // Music lessons: each opens a ready-made song and walks a kid through 3-5 small steps, one music word each.
  // A step: { text, target: the id of the control its tip card sits beside, check(song, ui) => true once done }.
  // ui: { selectedTrackId, playing, recording, events } where events counts what the kid did since the step
  // began: record, keys (piano keys), pads (drum or effect pads), grid (taps on the grid), use (library Use).
  // Every "Press Play" step passes while the song is playing (played), so a kid whose song is already looping
  // is never stuck.

  const L = SS.library;
  const inst = (t) => SS.instruments.byId(t.instrumentId);
  const tracks = (song, test) => song.tracks.filter((t) => { const i = inst(t); return !!i && test(i); });
  const did = (ui, name) => (ui && ui.events && ui.events[name]) || 0;
  const played = (ui) => !!(ui && ui.playing);
  const sq = (song) => song.grid || 2;
  const hit = (t, step, pitch) => t.notes.some((n) => n.step === step && n.pitch === pitch);
  const isKit = (i) => i.kind === "kit";
  const isBass = (i) => i.category === "bass" && i.kind === "pitched";
  const isTune = (i) => i.kind === "pitched" && i.category !== "bass";
  const KICK = 0, CLAP = 4;
  // does any track that passes `test` have `fn(track)` true?
  const any = (song, test, fn) => tracks(song, test).some(fn);
  const onCounts = (t, song) => t.notes.filter((n) => n.step % sq(song) === 0).length;

  const LESSONS = [
    {
      id: "keep-the-beat",
      title: "Keep the beat",
      word: "beat",
      meaning: "The beat is the steady pulse of music: the part you clap or tap your foot to.",
      startSong: L.makeSong("Lesson 1: Keep the beat", { counts: 4, tempo: 90 }, [
        { instrumentId: "classic-kit", volume: 0.85, notes: [{ step: 0, pitch: KICK, len: 1, vel: 0.9 }] },
      ]),
      steps: [
        { text: "Press Play. You hear a kick drum on count 1, then quiet.", target: "#ss-play", check: (s, ui) => played(ui) },
        { text: "Tap the Kick row on counts 2, 3 and 4 too. Now the kick plays on every count. That steady pulse is the beat.", target: "#ss-grid",
          check: (s) => any(s, isKit, (t) => [0, 1, 2, 3].every((c) => hit(t, c * sq(s), KICK))) },
        { text: "Add a Clap on counts 2 and 4, then clap along with it.", target: "#ss-grid",
          check: (s) => any(s, isKit, (t) => hit(t, sq(s), CLAP) && hit(t, 3 * sq(s), CLAP)) },
        { text: "Play along on the drum pads. Tap the Kick pad (or the A key) 4 times, right on the beat.", target: "#ss-pads", check: (s, ui) => did(ui, "pads") >= 4 },
      ],
    },
    {
      id: "first-melody",
      title: "Your first melody",
      word: "melody",
      meaning: "A melody is a tune: notes played one after another that you could sing or hum.",
      startSong: L.makeSong("Lesson 2: Your first melody", { counts: 8, tempo: 96 }, [
        { instrumentId: "grand-piano", volume: 0.8 },
        { instrumentId: "classic-kit", pattern: "Bright pop beat", volume: 0.6 },
      ]),
      steps: [
        { text: "Play the piano keys at the bottom. Keys on the left sound low, keys on the right sound high.", target: "#ss-keys", check: (s, ui) => did(ui, "keys") >= 3 },
        { text: "Tap 4 or more notes into the grid. Put some up high and some down low.", target: "#ss-grid",
          check: (s) => any(s, isTune, (t) => t.notes.length >= 4 && Math.max.apply(null, t.notes.map((n) => n.pitch)) - Math.min.apply(null, t.notes.map((n) => n.pitch)) >= 5) },
        { text: "Make a note longer. Pick the half note here, then tap an empty square. You can also drag a note's right edge.", target: "#ss-note-len",
          check: (s) => any(s, isTune, (t) => t.notes.some((n) => n.len >= 2)) },
        { text: "Press Play to hear your tune. Notes played one after another make a melody.", target: "#ss-play", check: (s, ui) => played(ui) },
      ],
    },
    {
      id: "bass-line",
      title: "Add a bass line",
      word: "bass",
      meaning: "Bass is the low part of a song. It follows the beat and holds the music up.",
      startSong: L.makeSong("Lesson 3: Add a bass line", { counts: 8, tempo: 96 }, [
        { instrumentId: "classic-kit", pattern: "Sunny pop beat", volume: 0.75 },
        { instrumentId: "grand-piano", pattern: "Pop chords", volume: 0.55 },
      ]),
      steps: [
        { text: "Press Add a track. Open the Bass tab and pick a bass you like.", target: "#ss-add-track", check: (s) => tracks(s, isBass).length > 0 },
        { text: "Tap 4 low notes into the bass grid, right on the counts, where the kick drum plays.", target: "#ss-grid", check: (s) => any(s, isBass, (t) => onCounts(t, s) >= 4) },
        { text: "Press Play. The bass is the low part that holds the song up.", target: "#ss-play", check: (s, ui) => played(ui) && any(s, isBass, (t) => t.notes.length > 0) },
        { text: "Press S on the bass track to hear the bass on its own. Press S again to hear the whole song.", target: "#ss-tracks", check: (s) => any(s, isBass, (t) => t.solo) },
      ],
    },
    {
      id: "loops-and-counts",
      title: "Loops and counts",
      word: "loop",
      meaning: "A loop is a part of music that plays again and again.",
      startSong: L.makeSong("Lesson 4: Loops and counts", { counts: 4, tempo: 100 }, [
        { instrumentId: "marimba", pattern: "Kite string, short", volume: 0.75 },
        { instrumentId: "classic-kit", pattern: "Island step beat", volume: 0.7 },
      ]),
      steps: [
        { text: "Press Play. With Loop on, the song plays again and again. A part that repeats is a loop.", target: "#ss-play", check: (s, ui) => played(ui) },
        { text: "Change Counts to 8. The song gets twice as long, and your notes repeat to fill it.", target: "#ss-counts", check: (s) => s.counts === 8 },
        { text: "Now try 16 counts. The line that moves across takes longer to come back round.", target: "#ss-counts", check: (s) => s.counts === 16 },
        { text: "Turn Loop off, then press Play. Now the song plays once and stops.", target: "#ss-loop", check: (s, ui) => !s.loop && played(ui) },
      ],
    },
    {
      id: "record-what-you-play",
      title: "Record what you play",
      word: "tempo",
      meaning: "Tempo is how fast or slow the beat goes. Musicians count it in beats a minute.",
      startSong: L.makeSong("Lesson 5: Record what you play", { counts: 8, tempo: 116, countIn: false }, [
        { instrumentId: "electric-piano", volume: 0.8 },
        { instrumentId: "lo-fi-kit", pattern: "Sleepy beat", volume: 0.7 },
      ]),
      steps: [
        { text: "Make the Speed slower: 90 or less. Speed is also called tempo, how fast the beat goes.", target: "#ss-tempo", check: (s) => s.tempo <= 90 },
        { text: "Turn on Count-in. You will hear 1, 2, 3, 4 before recording starts.", target: "#ss-countin", check: (s) => !!s.countIn },
        { text: "Press Record, then play the piano keys along with the drums. Press Record again to stop.", target: "#ss-record",
          check: (s, ui) => !(ui && ui.recording) && any(s, isTune, (t) => t.notes.length >= 3) },
        { text: "Fix a note. Tap a note in the grid to take it away, or tap an empty square to add one.", target: "#ss-grid", check: (s, ui) => did(ui, "grid") > 0 },
      ],
    },
    {
      id: "whole-song",
      title: "Build a whole song",
      word: "harmony",
      meaning: "Harmony is different notes sounding together, like the notes in a chord, so they sound good as one.",
      startSong: L.makeSong("Lesson 6: Build a whole song", { counts: 8, tempo: 100 }, []),
      steps: [
        { text: "Add a drum track. Then find a drum beat in Beats and patterns and press Use.", target: "#ss-add-track", check: (s) => any(s, isKit, (t) => t.notes.length >= 4) },
        { text: "Add a bass track and give it a bass line. Use one from Beats and patterns, or tap your own.", target: "#ss-add-track", check: (s) => any(s, isBass, (t) => t.notes.length >= 3) },
        { text: "Add a piano and use a chords pattern. Notes played together make a chord.", target: "#ss-library",
          check: (s) => any(s, isTune, (t) => t.notes.some((n) => t.notes.some((m) => m !== n && m.step === n.step))) },
        { text: "Add a sound effect and tap it in once or twice, just for fun.", target: "#ss-add-track", check: (s) => any(s, (i) => i.kind === "fx", (t) => t.notes.length >= 1) },
        { text: "Press Play to hear it all together. Chords and a bass line under your song make harmony.", target: "#ss-play", check: (s, ui) => played(ui) },
      ],
    },
  ];

  SS.lessons = { LESSONS };
})(typeof window !== "undefined" ? window : globalThis);
