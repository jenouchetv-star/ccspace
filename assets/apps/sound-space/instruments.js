(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  const CATEGORIES = [
    { id: "drums", name: "Drums and percussion", color: "#D946EF" },
    { id: "keys", name: "Keys and mallets", color: "#5B8CFF" },
    { id: "strings", name: "Strings", color: "#8B5CF6" },
    { id: "winds", name: "Brass and winds", color: "#F2C14E" },
    { id: "bass", name: "Bass", color: "#14B8A6" },
    { id: "fx", name: "Sound effects", color: "#FF5C8A" },
  ];

  // Slot ROLE order for every kit; a kit's own `slots` holds display names.
  const KIT_SLOTS = ["Kick", "Snare", "Closed hat", "Open hat", "Clap", "Low tom", "High tom", "Cymbal"];

  function idOf(name) {
    return name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // 4-6 sampled notes across the range, about every 5th semitone.
  function spread(lo, hi) {
    const n = Math.min(6, Math.max(4, Math.round((hi - lo) / 5) + 1));
    const out = [];
    for (let i = 0; i < n; i++) out.push(lo + Math.round((i * (hi - lo)) / (n - 1)));
    return out;
  }

  // The engine reads recipe settings straight off the recipe (fx also reads
  // recipe.params.effect), so each setting is kept in both places.
  function recipe(type, params) {
    return Object.assign({ type, params: Object.assign({}, params) }, params);
  }

  const LIST = [];
  function add(category, name, kind, source, extra) {
    LIST.push(Object.assign({ id: idOf(name), name, category, kind, source }, extra));
  }

  // Recorded pitched / kit / fx
  const recPitched = (cat, name, lo, hi) =>
    add(cat, name, "pitched", "recorded", { range: [lo, hi], samples: { notes: spread(lo, hi) } });
  const recKit = (cat, name, slots) =>
    add(cat, name, "kit", "recorded", {
      slots: slots || KIT_SLOTS.slice(),
      samples: { files: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i + ".wav") },
    });
  const recFx = (name) => add("fx", name, "fx", "recorded", { samples: { files: ["0.wav"] } });
  // Code
  const codePitched = (cat, name, lo, hi, type, params) =>
    add(cat, name, "pitched", "code", { range: [lo, hi], recipe: recipe(type, params) });
  const codeKit = (name, style) =>
    add("drums", name, "kit", "code", { slots: KIT_SLOTS.slice(), recipe: recipe("noiseDrum", { style }) });
  const codeFx = (name, effect) => add("fx", name, "fx", "code", { recipe: recipe("fx", { effect }) });

  // ---- Drums and percussion ------------------------------------------------
  recKit("drums", "Classic kit");
  recKit("drums", "Rock kit");
  recKit("drums", "Marching drums", ["Bass drum", "Snare", "Rim click", "Roll", "Clap", "Low tenor", "High tenor", "Crash"]);
  recKit("drums", "Hand drums", ["Bass conga", "Open conga", "Closed bongo", "Open bongo", "Slap", "Low darbuka", "High darbuka", "Darbuka roll"]);
  recKit("drums", "Cajón", ["Bass hit", "Slap", "Tap", "Ghost", "Knock", "Low tone", "High tone", "Snare buzz"]);
  recKit("drums", "Latin percussion", ["Cowbell", "Guiro scrape", "Claves", "Guiro short", "Agogo low", "Agogo high", "Maracas", "Cabasa"]);
  recKit("drums", "Tambourines and shakers", ["Tambourine hit", "Tambourine shake", "Egg shaker", "Long shake", "Tambourine tap", "Low shaker", "High shaker", "Sleigh bells"]);
  recKit("drums", "Woodblocks and claps", ["Low woodblock", "High woodblock", "Temple block", "Slapstick", "Hand clap", "Low clave", "High clave", "Clap roll"]);
  recPitched("drums", "Timpani", 40, 64);
  recKit("drums", "Gongs and cymbals", ["Low gong", "Mid gong", "High gong", "Gong swell", "Crash", "Ride", "Splash", "Cymbal roll"]);
  recPitched("drums", "Triangles and bells", 72, 108);
  recKit("drums", "Frame drum", ["Bass hit", "Edge", "Closed hit", "Open hit", "Slap", "Low tone", "High tone", "Finger roll"]);
  codeKit("Drum machine", "808");
  codeKit("Electronic kit", "electro");
  codeKit("Hip hop kit", "hiphop");
  codeKit("Lo-fi kit", "lofi");
  codeKit("Trap kit", "trap");
  codeKit("Dance kit", "dance");
  codeKit("Chip-tune drums", "chip");
  codeKit("Toy kit", "toy");

  // ---- Keys and mallets ----------------------------------------------------
  recPitched("keys", "Grand piano", 24, 108);
  recPitched("keys", "Upright piano", 28, 100);
  recPitched("keys", "Harpsichord", 41, 89);
  recPitched("keys", "Pipe organ", 24, 96);
  recPitched("keys", "Marimba", 45, 96);
  recPitched("keys", "Xylophone", 65, 108);
  recPitched("keys", "Vibraphone", 53, 89);
  recPitched("keys", "Glockenspiel", 79, 108);
  recPitched("keys", "Kalimba", 60, 91);
  recPitched("keys", "Tubular bells", 60, 77);
  codePitched("keys", "Electric piano", 36, 96, "fm", { ratio: 1, index: 1, ring: 0.9 });
  codePitched("keys", "Rock organ", 36, 96, "additive", { partials: [1, 0.9, 0.7, 0.5, 0.4, 0.3, 0.2, 0.15] });
  codePitched("keys", "Music box", 72, 108, "fm", { ratio: 4, index: 1.5, ring: 0.6 });
  codePitched("keys", "Toy piano", 60, 100, "fm", { ratio: 3.5, index: 2.5, ring: 0.35 });
  codePitched("keys", "Steel drum", 55, 96, "fm", { ratio: 1.5, index: 1.8, ring: 0.7 });
  codePitched("keys", "Bell", 60, 102, "fm", { ratio: 3.5, index: 3, ring: 2 });
  codePitched("keys", "Twinkle keys", 72, 108, "additive", { partials: [1, 0.2, 0.6, 0.1, 0.4] });
  codePitched("keys", "Synth lead", 48, 96, "subtractive", { wave: "sawtooth", cutoff: 2600, q: 4, sweep: 1.3, attack: 0.01 });
  codePitched("keys", "Synth pad", 36, 90, "subtractive", { wave: "sawtooth", cutoff: 1200, q: 1, sweep: 1.2, attack: 0.4, release: 0.5, detune: 12 });
  codePitched("keys", "Chip-tune", 48, 96, "chip", { duty: 0.25 });

  // ---- Strings -------------------------------------------------------------
  recPitched("strings", "Violin", 55, 100);
  recPitched("strings", "Viola", 48, 88);
  recPitched("strings", "Cello", 36, 76);
  recPitched("strings", "Violin section", 55, 96);
  recPitched("strings", "Cello section", 36, 72);
  recPitched("strings", "Concert harp", 24, 103);
  recPitched("strings", "Folk harp", 36, 91);
  recPitched("strings", "Psaltery", 48, 84);
  recPitched("strings", "Dan tranh", 50, 86);
  recPitched("strings", "Strumstick", 48, 79);
  codePitched("strings", "Plucked strings", 40, 88, "pluck", { damp: 0.996 });
  codePitched("strings", "Nylon pluck", 40, 84, "pluck", { damp: 0.99 });
  codePitched("strings", "Bright pluck", 48, 92, "pluck", { damp: 0.998 });
  codePitched("strings", "Twelve-string shimmer", 48, 92, "pluck", { damp: 0.997 });
  codePitched("strings", "Banjo-style pluck", 48, 84, "pluck", { damp: 0.985 });
  codePitched("strings", "Koto-style pluck", 48, 88, "pluck", { damp: 0.993 });
  codePitched("strings", "Synth strings", 36, 90, "subtractive", { wave: "sawtooth", cutoff: 2200, q: 1, sweep: 1.1, attack: 0.25, release: 0.3, detune: 14 });
  codePitched("strings", "Glass strings", 48, 96, "additive", { partials: [1, 0.1, 0.4, 0.05, 0.2] });
  codePitched("strings", "Space strings", 36, 90, "subtractive", { wave: "sawtooth", cutoff: 900, q: 2, sweep: 1.4, attack: 0.6, release: 0.6, detune: 20 });
  codePitched("strings", "Pizzicato pluck", 48, 88, "pluck", { damp: 0.98 });

  // ---- Brass and winds -----------------------------------------------------
  recPitched("winds", "Trumpet", 52, 88);
  recPitched("winds", "French horn", 34, 77);
  recPitched("winds", "Trombone", 40, 72);
  recPitched("winds", "Tuba", 28, 58);
  recPitched("winds", "Flute", 60, 96);
  recPitched("winds", "Piccolo", 74, 108);
  recPitched("winds", "Clarinet", 50, 94);
  recPitched("winds", "Oboe", 58, 91);
  recPitched("winds", "Bassoon", 34, 75);
  recPitched("winds", "Tenor saxophone", 44, 81);
  recPitched("winds", "Recorder", 72, 100);
  recPitched("winds", "Harmonica", 60, 96);
  recPitched("winds", "Ocarina", 69, 93);
  recPitched("winds", "Didgeridoo", 24, 48);
  codePitched("winds", "Synth brass", 40, 84, "subtractive", { wave: "sawtooth", cutoff: 1400, q: 2, sweep: 2.2, attack: 0.04 });
  codePitched("winds", "Soft synth flute", 60, 96, "additive", { partials: [1, 0.15, 0.05] });
  codePitched("winds", "Whistle lead", 72, 105, "additive", { partials: [1, 0.03] });
  codePitched("winds", "Pan pipe-style", 60, 96, "additive", { partials: [1, 0.25, 0.1, 0.05] });
  codePitched("winds", "Reed buzz", 48, 84, "subtractive", { wave: "square", cutoff: 1800, q: 3, sweep: 1 });
  codePitched("winds", "Chip-tune horn", 48, 90, "chip", { duty: 0.125 });

  // ---- Bass ----------------------------------------------------------------
  recPitched("bass", "Double bass", 28, 60);
  recPitched("bass", "Plucked double bass", 28, 60);
  recPitched("bass", "Tuba bass", 28, 52);
  recPitched("bass", "Bassoon bass", 34, 58);
  recPitched("bass", "Low marimba", 36, 60);
  recPitched("bass", "Timpani bass", 36, 55);
  codePitched("bass", "Soft bass", 28, 60, "additive", { partials: [1, 0.3, 0.1] });
  codePitched("bass", "Synth bass", 28, 64, "subtractive", { wave: "sawtooth", cutoff: 700, q: 3, sweep: 2.5 });
  codePitched("bass", "Sub bass", 24, 55, "additive", { partials: [1, 0.05] });
  codePitched("bass", "Wobble bass", 28, 60, "subtractive", { wave: "sawtooth", cutoff: 500, q: 8, sweep: 4, detune: 12 });
  codePitched("bass", "Square bass", 28, 64, "subtractive", { wave: "square", cutoff: 600, q: 1, sweep: 1.5 });
  codePitched("bass", "Plucked synth bass", 28, 64, "pluck", { damp: 0.99 });
  codePitched("bass", "Funky bass", 28, 64, "subtractive", { wave: "sawtooth", cutoff: 900, q: 6, sweep: 3.5, release: 0.03 });
  codePitched("bass", "Rubber bass", 28, 64, "fm", { ratio: 1, index: 3, ring: 0.3 });
  codePitched("bass", "Deep pad bass", 24, 60, "subtractive", { wave: "sawtooth", cutoff: 400, q: 1, sweep: 1.3, attack: 0.3, release: 0.4 });
  codePitched("bass", "Chip-tune bass", 28, 64, "chip", { duty: 0.5 });
  codePitched("bass", "Electric-style bass", 28, 64, "pluck", { damp: 0.994 });
  codePitched("bass", "Picked synth bass", 28, 64, "pluck", { damp: 0.975 });
  codePitched("bass", "Boom bass", 24, 52, "fm", { ratio: 1, index: 0.5, ring: 1 });
  codePitched("bass", "Hum bass", 28, 60, "additive", { partials: [1, 0.5, 0.2] });

  // ---- Sound effects (one sound each, one pad row) -------------------------
  recFx("Siren");
  recFx("Train whistle");
  recFx("Ratchet");
  recFx("Slapstick");
  recFx("Vibraslap");
  recFx("Thunder sheet-style gong scrape");
  recFx("Bell tree");
  // Nearest effect the engine supports: rise, bubble, boom, sparkle, laser.
  codeFx("Pop", "bubble");
  codeFx("Boing", "bubble");
  codeFx("Laser", "laser");
  codeFx("Zoom", "rise");
  codeFx("Whoosh", "rise");
  codeFx("Sparkle", "sparkle");
  codeFx("Splash", "bubble");
  codeFx("Chime", "sparkle");
  codeFx("Coin", "sparkle");
  codeFx("Jump", "rise");
  codeFx("Power-up", "rise");
  codeFx("Bubbles", "bubble");
  codeFx("Rocket", "boom");

  const byIdMap = new Map(LIST.map((x) => [x.id, x]));
  function byId(id) {
    return byIdMap.get(id);
  }

  SS.instruments = { CATEGORIES, LIST, byId, KIT_SLOTS };
})(typeof window !== "undefined" ? window : globalThis);
