(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  function stepSeconds(tempo, grid) {
    return 60 / tempo / (grid || 2);
  }

  // Events for notes with fromStep <= step < toStep, honoring mute/solo.
  function compileEvents(song, fromStep, toStep) {
    const anySolo = song.tracks.some((t) => t.solo);
    const out = [];
    for (const t of song.tracks) {
      if (t.mute) continue;
      if (anySolo && !t.solo) continue;
      for (const n of t.notes) {
        if (n.step < fromStep || n.step >= toStep) continue;
        out.push({
          step: n.step,
          trackId: t.id,
          instrumentId: t.instrumentId,
          pitch: n.pitch,
          len: n.len,
          vel: n.vel,
          gain: t.volume * song.volume * n.vel,
        });
      }
    }
    out.sort((a, b) => a.step - b.step);
    return out;
  }

  // Steps due at nextStepTime + k*stepDur. Those more than one step in the
  // past are skipped; the rest, up to now + horizon, are counted.
  function stepsToSchedule(nextStepTime, now, horizon, stepDur) {
    let skipped = 0;
    let steps = 0;
    const eps = 1e-9;
    for (let k = 0; ; k++) {
      const t = nextStepTime + k * stepDur;
      if (t >= now + horizon - eps) break;
      if (t < now - stepDur - eps) skipped++;
      else steps++;
    }
    return { steps, skipped };
  }

  function exportFrames(song, times, sampleRate, tailSec) {
    const rate = sampleRate || 44100;
    const tail = tailSec === undefined ? 2 : tailSec;
    const total = SS.model.totalSteps(song);
    const seconds = total * stepSeconds(song.tempo, song.grid) * times + tail;
    return Math.round(seconds * rate);
  }

  // ---- Sound making (Web Audio) -------------------------------------------
  // Output only: no microphone, capture, recorder or speech APIs.

  const ATTACK = 0.005;
  const RELEASE = 0.005;
  const LOOKAHEAD = 0.12;
  const TIMER_MS = 25;

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Sustained voice envelope: 5 ms attack, hold, 5 ms release.
  // Ringing voices (ring) fall exponentially across the note, then fade out.
  function envelope(ctx, dest, when, dur, peak, opts) {
    const o = opts || {};
    const g = ctx.createGain();
    const d = Math.max(dur, 0.02);
    // Attack never outlasts the note, so every voice ends at 0 before it stops.
    const att = Math.min(Math.max(o.attack || ATTACK, ATTACK), d * 0.8);
    const p = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p, when + att);
    let end;
    if (o.ring) {
      g.gain.exponentialRampToValueAtTime(p * 0.02, when + d);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d + o.ring);
      g.gain.linearRampToValueAtTime(0, when + d + o.ring + RELEASE);
      end = when + d + o.ring + RELEASE;
    } else {
      const rel = Math.max(o.release || RELEASE, RELEASE);
      g.gain.setValueAtTime(p, when + d);
      g.gain.linearRampToValueAtTime(0, when + d + rel);
      end = when + d + rel;
    }
    g.connect(dest);
    return { gain: g, end: end + 0.02 };
  }

  // One-shot percussive envelope: 5 ms attack, exponential decay, fade to 0.
  function hit(ctx, dest, when, peak, decay) {
    const g = ctx.createGain();
    const p = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p, when + ATTACK);
    g.gain.exponentialRampToValueAtTime(0.0001, when + ATTACK + decay);
    g.gain.linearRampToValueAtTime(0, when + ATTACK + decay + RELEASE);
    g.connect(dest);
    return { gain: g, end: when + ATTACK + decay + RELEASE + 0.02 };
  }

  const noiseCache = new WeakMap();
  function noiseBuffer(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) {
      const len = Math.round(ctx.sampleRate * 1.5);
      b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
      noiseCache.set(ctx, b);
    }
    return b;
  }

  function osc(ctx, type, freq, when, end) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start(when);
    o.stop(end);
    return o;
  }

  function noiseSource(ctx, when, end) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    s.loop = true;
    s.start(when);
    s.stop(end);
    return s;
  }

  function filterNode(ctx, type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  // Recipes: (ctx, dest, freq, when, dur, vel, params) => sources[]
  const RECIPES = {
    fm(ctx, dest, freq, when, dur, vel, p) {
      const e = envelope(ctx, dest, when, dur, vel * 0.5, { ring: p.ring || 0.5 });
      const car = osc(ctx, "sine", freq, when, e.end);
      const mod = osc(ctx, "sine", freq * (p.ratio || 2), when, e.end);
      const mg = ctx.createGain();
      const depth = freq * (p.index === undefined ? 2 : p.index);
      mg.gain.setValueAtTime(depth, when);
      mg.gain.exponentialRampToValueAtTime(Math.max(depth * 0.05, 0.01), when + Math.max(dur, 0.3) + 0.5);
      mod.connect(mg);
      mg.connect(car.frequency);
      car.connect(e.gain);
      return [car, mod];
    },

    // Karplus-Strong: a noise burst circulating through an averaging delay.
    // brightness (0..1) softens the burst, pick (0..0.5) combs it for a pick
    // position, tail sets the ring length, ring the fade, bend (semitones)
    // starts the note sharp and settles, layer (semitones) adds a second
    // voice at layerGain.
    pluck(ctx, dest, freq, when, dur, vel, p) {
      const sr = ctx.sampleRate;
      const tail = p.tail === undefined ? 0.5 : p.tail;
      const ring = Math.min(Math.max(dur, 0.1) + tail, 2.5);
      const len = Math.max(Math.round(sr * ring), 64);
      const period = Math.max(2, Math.round(sr / freq));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const damp = p.damp === undefined ? 0.996 : p.damp;
      const bright = p.brightness === undefined ? 1 : p.brightness;
      let seed = 777;
      const burst = Math.min(period, len);
      for (let i = 0; i < burst; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const raw = (seed / 4294967296) * 2 - 1;
        d[i] = bright < 1 && i > 0 ? bright * raw + (1 - bright) * d[i - 1] : raw;
      }
      // The pick-position comb goes on the burst, before the loop runs, so
      // every later period carries the notch.
      if (p.pick > 0) {
        const k = Math.max(1, Math.round(period * p.pick));
        for (let i = burst - 1; i >= k; i--) d[i] -= d[i - k];
      }
      for (let i = period; i < len; i++) d[i] = damp * 0.5 * (d[i - period] + d[i - period + 1]);
      // Averaging makes the loop P - 0.5 samples long; retune so pitch is exact.
      const rate = (freq * (period - 0.5)) / sr;
      const e = envelope(ctx, dest, when, Math.max(dur, 0.1), vel * 0.6, { ring: p.ring || 0.4 });
      const voice = (r, g) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = r;
        if (p.bend) {
          src.playbackRate.setValueAtTime(r * Math.pow(2, p.bend / 12), when);
          src.playbackRate.exponentialRampToValueAtTime(r, when + 0.18);
        }
        src.start(when);
        src.stop(e.end);
        if (g === 1) {
          src.connect(e.gain);
        } else {
          const lg = ctx.createGain();
          lg.gain.value = g;
          src.connect(lg);
          lg.connect(e.gain);
        }
        return src;
      };
      const out = [voice(rate, 1)];
      if (p.layer) out.push(voice(rate * Math.pow(2, p.layer / 12), p.layerGain || 0.5));
      return out;
    },

    additive(ctx, dest, freq, when, dur, vel, p) {
      const partials = p.partials || [1, 0.5, 0.33, 0.25];
      const sum = partials.reduce((a, b) => a + b, 0) || 1;
      const e = envelope(ctx, dest, when, dur, vel * 0.5, { release: 0.03 });
      const out = [];
      partials.forEach((amp, i) => {
        if (freq * (i + 1) > 12000) return;
        const o = osc(ctx, "sine", freq * (i + 1), when, e.end);
        const g = ctx.createGain();
        g.gain.value = amp / sum;
        o.connect(g);
        g.connect(e.gain);
        out.push(o);
      });
      return out;
    },

    subtractive(ctx, dest, freq, when, dur, vel, p) {
      const e = envelope(ctx, dest, when, dur, vel * 0.4, {
        attack: p.attack,
        release: p.release || 0.04,
      });
      const cutoff = p.cutoff || 1800;
      const f = filterNode(ctx, p.filter || "lowpass", cutoff, p.q || 1);
      const sweep = p.sweep === undefined ? 1.5 : p.sweep;
      f.frequency.setValueAtTime(cutoff * sweep, when);
      f.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.7, 40), when + Math.max(dur, 0.1));
      f.connect(e.gain);
      const o1 = osc(ctx, p.wave || "sawtooth", freq, when, e.end);
      const o2 = osc(ctx, p.wave || "sawtooth", freq, when, e.end);
      o2.detune.value = p.detune === undefined ? 7 : p.detune;
      o1.connect(f);
      o2.connect(f);
      const out = [o1, o2];
      if (p.lfo) {
        // A slow wobble on the filter cutoff.
        const l = osc(ctx, "sine", p.lfo, when, e.end);
        const lg = ctx.createGain();
        // Never swing the cutoff below ~60 Hz.
        lg.gain.value = Math.min(p.lfoDepth || cutoff * 0.8, Math.max(cutoff * 0.7 - 60, 0));
        l.connect(lg);
        lg.connect(f.frequency);
        out.push(l);
      }
      return out;
    },

    chip(ctx, dest, freq, when, dur, vel, p) {
      const e = envelope(ctx, dest, when, dur, vel * 0.3, { release: 0.01 });
      const o = osc(ctx, "square", freq, when, e.end);
      const duty = p.duty === undefined ? 0.5 : p.duty;
      if (duty !== 0.5 && ctx.createPeriodicWave) {
        const n = 32;
        const real = new Float32Array(n + 1);
        const imag = new Float32Array(n + 1);
        for (let k = 1; k <= n; k++) {
          real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
          imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(k * Math.PI * duty));
        }
        o.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      }
      o.connect(e.gain);
      return [o];
    },

    // Code kits: slot 0..7 = Kick, Snare, Closed hat, Open hat, Clap,
    // Low tom, High tom, Cymbal. params.style picks a row of DRUM_STYLES.
    noiseDrum(ctx, dest, freq, when, dur, vel, p) {
      const slot = (p.slot | 0) & 7;
      const st = Object.assign({}, DRUM_STYLES.classic, DRUM_STYLES[p.style]);
      const v = vel * 0.7;
      const tone = (f0, f1, decay, gain) => {
        const e = hit(ctx, dest, when, v * gain, decay);
        const o = osc(ctx, st.wave, f0, when, e.end);
        o.frequency.setValueAtTime(f0, when);
        o.frequency.exponentialRampToValueAtTime(f1, when + Math.min(0.12, decay));
        o.connect(e.gain);
        return o;
      };
      const noise = (type, cutoff, decay, gain, q) => {
        const e = hit(ctx, dest, when, v * gain, decay);
        const n = noiseSource(ctx, when, e.end);
        const f = filterNode(ctx, type, cutoff, q);
        n.connect(f);
        f.connect(e.gain);
        return n;
      };
      switch (slot) {
        case 0:
          return [tone.apply(null, st.kick)];
        case 1:
          return [noise.apply(null, st.snareNoise), tone.apply(null, st.snareTone)];
        case 2:
          return [noise("highpass", st.hat[0], st.hat[1], st.hat[2])];
        case 3:
          return [noise("highpass", st.openHat[0], st.openHat[1], st.openHat[2])];
        case 4: {
          const [cut, q, sp, len] = st.clap;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, when);
          for (let i = 0; i < 3; i++) {
            const t = when + i * sp;
            e.gain.linearRampToValueAtTime(v * 0.8, t + ATTACK);
            e.gain.linearRampToValueAtTime(v * 0.1, t + sp * 0.9);
          }
          e.gain.linearRampToValueAtTime(v * 0.8, when + 3 * sp + ATTACK);
          e.gain.exponentialRampToValueAtTime(0.0001, when + len);
          e.gain.linearRampToValueAtTime(0, when + len + RELEASE);
          e.connect(dest);
          const n = noiseSource(ctx, when, when + len + 0.03);
          const f = filterNode(ctx, "bandpass", cut, q);
          n.connect(f);
          f.connect(e);
          return [n];
        }
        case 5:
          return [tone.apply(null, st.lowTom)];
        case 6:
          return [tone.apply(null, st.highTom)];
        default:
          return [noise.apply(null, st.cymbal)];
      }
    },

    // One-shot effects; params.effect picks which. Each name has its own sound.
    fx(ctx, dest, freq, when, dur, vel, p) {
      const kind = (p.params && p.params.effect) || p.effect || "laser";
      const v = vel * 0.5;
      // A tone gliding f0 to f1, starting `at` seconds in.
      const tone = (type, f0, f1, decay, at, gain) => {
        const t = when + (at || 0);
        const e = hit(ctx, dest, t, v * (gain === undefined ? 1 : gain), decay);
        const o = osc(ctx, type, f0, t, e.end);
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + decay);
        o.connect(e.gain);
        return o;
      };
      // Filtered noise with the cutoff gliding c0 to c1.
      const hiss = (type, c0, c1, decay, q, gain) => {
        const e = hit(ctx, dest, when, v * (gain === undefined ? 1 : gain), decay);
        const n = noiseSource(ctx, when, e.end);
        const f = filterNode(ctx, type, c0, q);
        f.frequency.setValueAtTime(c0, when);
        f.frequency.exponentialRampToValueAtTime(c1, when + decay);
        n.connect(f);
        f.connect(e.gain);
        return n;
      };
      switch (kind) {
        case "rise":
          return [tone("triangle", 200, 1600, 0.6)];
        case "bubble":
          return [tone("sine", 300, 900, 0.15)];
        case "boom":
          return [hiss("lowpass", 400, 400, 1.0, 1, 1.2), tone("sine", 90, 35, 0.8)];
        case "pop":
          return [tone("sine", 700, 120, 0.07)];
        case "boing":
          return [tone("triangle", 160, 560, 0.12), tone("triangle", 560, 200, 0.4, 0.12)];
        case "zoom":
          return [tone("sawtooth", 120, 1400, 0.5), tone("square", 60, 700, 0.5, 0, 0.4)];
        case "whoosh":
          return [hiss("bandpass", 300, 3000, 0.7, 1.5)];
        case "sparkle":
          return [tone("sine", 2400, 3600, 0.4), tone("sine", 3000, 4500, 0.3, 0.1)];
        case "splash":
          return [hiss("highpass", 2500, 2500, 0.5, 0.7), tone("sine", 400, 1000, 0.15)];
        case "chime":
          return [
            tone("sine", 880, 880, 1.2),
            tone("sine", 1319, 1319, 0.9, 0, 0.6),
            tone("sine", 1760, 1760, 0.7, 0, 0.4),
          ];
        case "coin":
          return [tone("square", 988, 988, 0.08, 0, 0.6), tone("square", 1319, 1319, 0.4, 0.08, 0.6)];
        case "jump":
          return [tone("square", 250, 750, 0.22, 0, 0.6)];
        case "powerup":
          return [262, 330, 392, 523, 659].map((f, i) => tone("square", f, f, 0.1, i * 0.07, 0.5));
        case "bubbles":
          return [tone("sine", 300, 800, 0.12), tone("sine", 450, 1100, 0.1, 0.13), tone("sine", 250, 650, 0.14, 0.26)];
        case "rocket":
          return [hiss("lowpass", 700, 700, 1.3, 1, 1), tone("sawtooth", 70, 180, 1.2, 0, 0.5)];
        default:
          return [tone("sawtooth", 1800, 160, 0.3)];
      }
    },
  };

  // Tones are [f0, f1, decay, gain]. Snare noise and cymbal are [filter,
  // cutoff, decay, gain, q]. Hats are [cutoff, decay, gain]. Clap is
  // [cutoff, q, spread seconds, length seconds].
  const DRUM_STYLES = {
    classic: {
      wave: "sine",
      kick: [150, 45, 0.35, 1],
      snareNoise: ["highpass", 1200, 0.18, 0.8],
      snareTone: [220, 150, 0.1, 0.5],
      hat: [7000, 0.05, 0.5],
      openHat: [7000, 0.35, 0.5],
      clap: [1500, 1.2, 0.012, 0.2],
      lowTom: [120, 70, 0.3, 0.9],
      highTom: [200, 120, 0.25, 0.9],
      cymbal: ["highpass", 5000, 1.2, 0.4],
    },
    "808": {
      kick: [120, 40, 0.5, 1],
      snareNoise: ["highpass", 1500, 0.22, 0.8],
      snareTone: [200, 140, 0.12, 0.5],
      hat: [8000, 0.04, 0.45],
      openHat: [8000, 0.3, 0.45],
      clap: [1400, 1.2, 0.013, 0.22],
      lowTom: [100, 60, 0.35, 0.9],
      highTom: [160, 90, 0.3, 0.9],
      cymbal: ["highpass", 6000, 1.0, 0.4],
    },
    electro: {
      wave: "triangle",
      kick: [180, 50, 0.25, 1],
      snareNoise: ["highpass", 2000, 0.14, 0.8],
      snareTone: [260, 180, 0.08, 0.5],
      hat: [9000, 0.03, 0.45],
      openHat: [9000, 0.2, 0.45],
      clap: [2000, 1.5, 0.01, 0.16],
      lowTom: [140, 90, 0.22, 0.9],
      highTom: [240, 150, 0.18, 0.9],
      cymbal: ["highpass", 8000, 0.8, 0.4],
    },
    hiphop: {
      kick: [100, 50, 0.4, 1],
      snareNoise: ["highpass", 900, 0.22, 0.8],
      snareTone: [180, 120, 0.12, 0.5],
      hat: [6000, 0.06, 0.5],
      openHat: [6000, 0.3, 0.5],
      clap: [1100, 1, 0.015, 0.24],
      lowTom: [90, 55, 0.32, 0.9],
      highTom: [140, 85, 0.28, 0.9],
      cymbal: ["highpass", 4500, 1.0, 0.4],
    },
    lofi: {
      kick: [90, 45, 0.3, 0.8],
      snareNoise: ["bandpass", 700, 0.2, 0.5, 0.8],
      snareTone: [160, 110, 0.14, 0.4],
      hat: [3500, 0.07, 0.3],
      openHat: [3500, 0.28, 0.3],
      clap: [900, 0.8, 0.016, 0.3],
      lowTom: [80, 50, 0.28, 0.7],
      highTom: [120, 75, 0.24, 0.7],
      cymbal: ["bandpass", 3000, 0.9, 0.25, 0.5],
    },
    trap: {
      kick: [90, 30, 0.9, 1.1],
      snareNoise: ["highpass", 1800, 0.15, 0.8],
      snareTone: [240, 160, 0.09, 0.5],
      hat: [10000, 0.025, 0.5],
      openHat: [10000, 0.2, 0.5],
      clap: [1700, 1.3, 0.009, 0.18],
      lowTom: [110, 45, 0.5, 0.9],
      highTom: [170, 70, 0.4, 0.9],
      cymbal: ["highpass", 7000, 0.8, 0.4],
    },
    dance: {
      kick: [160, 55, 0.3, 1],
      snareNoise: ["highpass", 2200, 0.2, 0.8],
      snareTone: [250, 170, 0.1, 0.5],
      hat: [8500, 0.04, 0.5],
      openHat: [8500, 0.25, 0.5],
      clap: [1600, 1.1, 0.011, 0.21],
      lowTom: [130, 80, 0.26, 0.9],
      highTom: [210, 130, 0.22, 0.9],
      cymbal: ["highpass", 7500, 1.1, 0.4],
    },
    chip: {
      wave: "square",
      kick: [200, 40, 0.15, 0.6],
      snareNoise: ["bandpass", 3000, 0.1, 0.7, 0.5],
      snareTone: [300, 200, 0.06, 0.3],
      hat: [9500, 0.03, 0.4],
      openHat: [9500, 0.15, 0.4],
      clap: [3200, 0.6, 0.008, 0.12],
      lowTom: [150, 100, 0.12, 0.5],
      highTom: [250, 170, 0.1, 0.5],
      cymbal: ["highpass", 6500, 0.25, 0.3],
    },
    toy: {
      kick: [300, 120, 0.12, 0.8],
      snareNoise: ["bandpass", 2500, 0.08, 0.6, 3],
      snareTone: [500, 350, 0.05, 0.4],
      hat: [11000, 0.04, 0.3],
      openHat: [11000, 0.12, 0.3],
      clap: [2500, 3, 0.014, 0.1],
      lowTom: [400, 300, 0.12, 0.7],
      highTom: [600, 450, 0.1, 0.7],
      cymbal: ["bandpass", 8000, 0.3, 0.3, 4],
    },
  };

  const FX_EFFECTS = [
    "rise", "bubble", "boom", "laser", "pop", "boing", "zoom", "whoosh", "sparkle",
    "splash", "chime", "coin", "jump", "powerup", "bubbles", "rocket",
  ];

  // The settings each recipe type reads (slot is supplied by the player).
  const RECIPE_PARAMS = {
    fm: ["ratio", "index", "ring"],
    pluck: ["damp", "brightness", "pick", "tail", "ring", "bend", "layer", "layerGain"],
    additive: ["partials"],
    subtractive: ["wave", "cutoff", "q", "sweep", "attack", "release", "detune", "lfo", "lfoDepth"],
    chip: ["duty"],
    noiseDrum: ["style"],
    fx: ["effect"],
  };

  function fetchArrayBufferDefault(url) {
    return root.fetch(url).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    });
  }

  // Recorded instruments that fail to load stay silent: they are never
  // swapped for a code sound.
  function createVoices(ctx, catalog, sampleBase, opts) {
    const o = opts || {};
    const fetchAB = o.fetchArrayBuffer || fetchArrayBufferDefault;
    const decode = o.decode || ((ab) => ctx.decodeAudioData(ab));
    const loaded = new Map(); // id -> { notes: Map(midi -> buf) } | { slots: buf[] }
    const pending = new Map();

    function urlsFor(rec) {
      if (rec.kind === "pitched") {
        return ((rec.samples && rec.samples.notes) || []).map((m) => ({
          key: m,
          url: `${sampleBase}/${rec.id}/${m}.wav`,
        }));
      }
      const files = (rec.samples && rec.samples.files) || [];
      return files.map((f, i) => ({ key: i, url: `${sampleBase}/${rec.id}/${i}.wav` }));
    }

    function load(id) {
      const rec = catalog.byId(id);
      if (!rec) return Promise.resolve({ ok: false });
      if (rec.source !== "recorded") return Promise.resolve({ ok: true });
      if (loaded.has(id)) return Promise.resolve({ ok: true });
      if (pending.has(id)) return pending.get(id);
      const items = urlsFor(rec);
      const p = Promise.all(
        items.map((it) =>
          Promise.resolve()
            .then(() => fetchAB(it.url))
            .then((ab) => decode(ab))
            .then((buf) => ({ key: it.key, buf }))
        )
      )
        .then((got) => {
          if (!got.length) return { ok: false };
          if (rec.kind === "pitched") {
            const notes = new Map();
            got.forEach((g) => notes.set(g.key, g.buf));
            loaded.set(id, { notes });
          } else {
            const slots = [];
            got.forEach((g) => (slots[g.key] = g.buf));
            loaded.set(id, { slots });
          }
          return { ok: true };
        })
        .catch(() => ({ ok: false }))
        .then((res) => {
          pending.delete(id);
          return res;
        });
      pending.set(id, p);
      return p;
    }

    function playSample(rec, ev, when, dur, dest) {
      const data = loaded.get(rec.id);
      if (!data) return [];
      let buf;
      let rate = 1;
      let oneShot = false;
      if (data.notes) {
        let nearest = null;
        data.notes.forEach((b, m) => {
          if (nearest === null || Math.abs(m - ev.pitch) < Math.abs(nearest - ev.pitch)) nearest = m;
        });
        if (nearest === null) return [];
        buf = data.notes.get(nearest);
        rate = Math.pow(2, (ev.pitch - nearest) / 12);
      } else {
        buf = data.slots[rec.kind === "fx" ? 0 : ev.pitch];
        oneShot = true;
      }
      if (!buf) return [];
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const peak = ev.gain * 0.6;
      const length = buf.duration / rate;
      const e = oneShot
        ? envelope(ctx, dest, when, Math.max(length - RELEASE, 0.02), peak, {})
        : envelope(ctx, dest, when, Math.min(Math.max(dur, 0.05), length), peak, { release: 0.25 });
      src.connect(e.gain);
      src.start(when);
      src.stop(Math.min(e.end, when + length + 0.05));
      return [src];
    }

    function play(ev, when, dest) {
      const rec = catalog.byId(ev.instrumentId);
      if (!rec) return [];
      const dur = ev.dur !== undefined ? ev.dur : ev.len * 0.25;
      if (rec.source === "recorded") return playSample(rec, ev, when, dur, dest);
      const recipe = rec.recipe;
      const fn = recipe && RECIPES[recipe.type];
      if (!fn) return [];
      const params = Object.assign({}, recipe, { slot: ev.pitch });
      const freq = rec.kind === "pitched" ? midiToFreq(ev.pitch) : 0;
      return fn(ctx, dest, freq, when, dur, ev.gain, params);
    }

    return { play, load };
  }

  // Master chain: bus -> limiter -> destination.
  function makeMaster(ctx) {
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.1;
    bus.connect(comp);
    comp.connect(ctx.destination);
    return { bus, comp };
  }

  // onStep(cb) reports the step being heard; cb(-1) when the playhead clears.
  function createPlayer(ctx, voices, timers) {
    const t = timers || {};
    const setTimer = t.setInterval || ((fn, ms) => root.setInterval(fn, ms));
    const clearTimer = t.clearInterval || ((h) => root.clearInterval(h));
    const spc = () => song.grid || SS.model.CONST.STEPS_PER_COUNT;

    let song = null;
    let master = null;
    let handle = null;
    let step = 0;
    let nextTime = 0;
    let stepDur = 0.25;
    let ended = false;
    let queue = [];
    let live = [];
    let cb = null;
    let lastReported = null;

    function total() {
      return SS.model.totalSteps(song);
    }

    function advance() {
      nextTime += stepDur;
      step++;
      if (step >= total()) {
        if (song.loop) step = 0;
        else ended = true;
      }
      // Tempo changes apply from the next count.
      if (!ended && step % spc() === 0) stepDur = stepSeconds(song.tempo, song.grid);
    }

    function tick() {
      if (handle === null) return;
      const now = ctx.currentTime;
      if (!ended) {
        const due = stepsToSchedule(nextTime, now, LOOKAHEAD, stepDur);
        for (let i = 0; i < due.skipped && !ended; i++) advance();
        for (let i = 0; i < due.steps && !ended; i++) {
          if (step >= total()) step = 0;
          const evs = compileEvents(song, step, step + 1);
          for (const ev of evs) {
            const made = voices.play(Object.assign({}, ev, { dur: ev.len * stepDur }), nextTime, master.bus);
            for (const s of made || []) live.push({ src: s, when: nextTime });
          }
          queue.push({ time: nextTime, step });
          advance();
        }
      }
      let heard = null;
      while (queue.length && queue[0].time <= now + 1e-9) heard = queue.shift();
      if (heard && heard.step !== lastReported) {
        lastReported = heard.step;
        if (cb) cb(heard.step);
      }
      live = live.filter((l) => l.when > now - 6);
      if (ended && !queue.length && now >= nextTime + 1.2) api.stop();
    }

    function start(s, opts) {
      if (handle !== null) api.stop();
      song = s;
      master = makeMaster(ctx);
      step = ((opts && opts.fromStep) || 0) % total();
      stepDur = stepSeconds(song.tempo, song.grid);
      nextTime = ctx.currentTime + 0.06;
      ended = false;
      queue = [];
      live = [];
      lastReported = null;
      handle = setTimer(tick, TIMER_MS);
      api.playing = true;
      tick();
    }

    function stop() {
      if (handle === null) return;
      clearTimer(handle);
      handle = null;
      api.playing = false;
      const now = ctx.currentTime;
      for (const l of live) {
        try { l.src.stop(now); } catch (e) { /* not started */ }
        try { l.src.disconnect(); } catch (e) { /* already gone */ }
      }
      live = [];
      queue = [];
      try { master.bus.gain.setValueAtTime(0, now); } catch (e) { /* ignore */ }
      try { master.bus.disconnect(); } catch (e) { /* ignore */ }
      try { master.comp.disconnect(); } catch (e) { /* ignore */ }
      lastReported = null;
      if (cb) cb(-1);
    }

    const api = {
      start,
      stop,
      update(s) {
        song = s;
      },
      onStep(fn) {
        cb = fn;
      },
      playing: false,
    };
    return api;
  }

  // voicesFactory(ctx) => voices (or a promise). Recorded instruments are
  // loaded here; resolves to { buffer, failed: [instrumentIds that did not
  // load, which render silent] } so the caller can warn.
  function renderOffline(song, times, voicesFactory, opts) {
    const Ctor =
      (opts && opts.OfflineAudioContext) ||
      root.OfflineAudioContext ||
      root.webkitOfflineAudioContext;
    const ctx = new Ctor(2, exportFrames(song, times), 44100);
    return Promise.resolve(voicesFactory(ctx)).then(async (voices) => {
      const ids = [];
      for (const t of song.tracks) if (ids.indexOf(t.instrumentId) < 0) ids.push(t.instrumentId);
      const failed = [];
      if (voices.load) {
        const results = await Promise.all(ids.map((id) => voices.load(id)));
        results.forEach((r, i) => {
          if (!r || !r.ok) failed.push(ids[i]);
        });
      }
      const master = makeMaster(ctx);
      const total = SS.model.totalSteps(song);
      const dur = stepSeconds(song.tempo, song.grid);
      const evs = compileEvents(song, 0, total);
      for (let r = 0; r < times; r++) {
        for (const ev of evs) {
          voices.play(
            Object.assign({}, ev, { dur: ev.len * dur }),
            (r * total + ev.step) * dur,
            master.bus
          );
        }
      }
      const buffer = await ctx.startRendering();
      return { buffer, failed };
    });
  }

  SS.engine = Object.assign(SS.engine || {}, {
    stepSeconds,
    compileEvents,
    stepsToSchedule,
    exportFrames,
    createVoices,
    createPlayer,
    DRUM_STYLES,
    FX_EFFECTS,
    RECIPE_PARAMS,
    renderOffline,
  });
})(typeof window !== "undefined" ? window : globalThis);
