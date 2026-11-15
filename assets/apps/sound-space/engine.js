(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  function stepSeconds(tempo, grid) {
    return 60 / tempo / (grid || 2);
  }

  // The soft tick used for the count-in and for the beat while recording.
  // Returns the oscillator so the caller can silence it early.
  function makeClick(ctx, dest, when, accent) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = accent ? 1568 : 1046;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    g.gain.linearRampToValueAtTime(0, when + 0.075);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + 0.09);
    return o;
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
          reverb: t.reverb || 0,
          sustain: !!t.sustain,
          chorus: t.chorus,
          dyn: t.dyn,
          eq: t.eq,
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

  // How long a song keeps sounding after its last note: 2 s, or longer when a
  // track with notes rings on (sustain, pitched instruments) into a reverb, or
  // through a flanger's feedback.
  function songTail(song) {
    const byId = SS.instruments && SS.instruments.byId;
    let rev = 0;
    let sus = 0;
    let fb = 0;
    for (const t of song.tracks || []) {
      if (!t.notes || !t.notes.length) continue;
      const lv = REVERB_LEVELS[t.reverb];
      if (lv && lv.sec > rev) rev = lv.sec;
      if (t.sustain) {
        const rec = byId ? byId(t.instrumentId) : null;
        if (!rec || rec.kind === "pitched") sus = SUSTAIN_TAIL;
      }
      if (t.chorus && t.chorus.kind === "flanger") fb = FLANGER_TAIL;
    }
    return Math.max(2, sus + rev + fb + 0.5);
  }

  function exportFrames(song, times, sampleRate, tailSec) {
    const rate = sampleRate || 44100;
    const tail = tailSec === undefined ? songTail(song) : tailSec;
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

  // Sustain: a pitched note rings on after it ends and fades out over this long.
  const SUSTAIN_TAIL = 1.5;
  // Reverb levels (index = track.reverb): impulse length and wet send level.
  // The convolver normalizes its impulse, and a shorter impulse comes out
  // quieter: measured with noise in Chrome, wet gains of 0.22/0.30/0.38 left
  // the wet sound 26/19/15 dB under the dry one, so Room was barely there.
  // These put it about 18/14/11 dB under. Stadium, the biggest, is a little
  // wetter again, so each size sounds bigger than the one before.
  const REVERB_LEVELS = [
    null,
    { name: "Room", sec: 0.8, wet: 0.5 },
    { name: "Hall", sec: 1.8, wet: 0.55 },
    { name: "Big hall", sec: 3.2, wet: 0.6 },
    { name: "Stadium", sec: 5.0, wet: 0.65 },
  ];

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Sustained voice envelope: 5 ms attack, hold, 5 ms release.
  // Ringing voices (ring) fall exponentially across the note, then fade out.
  // With `sustain` (seconds) the note rings on past its end instead: a held
  // voice fades out over the tail, and a ringing voice keeps falling as if the
  // key were still down, reaching silence at the end of the tail.
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
    if (o.sustain > 0) {
      if (!o.ring) g.gain.setValueAtTime(p, when + d);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d + o.sustain);
      g.gain.linearRampToValueAtTime(0, when + d + o.sustain + RELEASE);
      end = when + d + o.sustain + RELEASE;
    } else if (o.ring) {
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
      const e = envelope(ctx, dest, when, dur, vel * 0.5, { ring: p.ring || 0.5, sustain: p.sustain });
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
      const ring = Math.min(Math.max(dur, 0.1) + tail + (p.sustain || 0), 2.5 + (p.sustain || 0));
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
      const e = envelope(ctx, dest, when, Math.max(dur, 0.1), vel * 0.6, { ring: p.ring || 0.4, sustain: p.sustain });
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
      const e = envelope(ctx, dest, when, dur, vel * 0.5, { release: 0.03, sustain: p.sustain });
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
        sustain: p.sustain,
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
      const e = envelope(ctx, dest, when, dur, vel * 0.3, { release: 0.01, sustain: p.sustain });
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

    function playSample(rec, ev, when, dur, dest, sustain) {
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
        : envelope(ctx, dest, when, Math.min(Math.max(dur, 0.05), length), peak, { release: 0.25, sustain });
      src.connect(e.gain);
      src.start(when);
      // A recorded note never rings past the end of its own recording.
      src.stop(Math.min(e.end, when + length + 0.05));
      return [src];
    }

    function play(ev, when, dest) {
      const rec = catalog.byId(ev.instrumentId);
      if (!rec) return [];
      const dur = ev.dur !== undefined ? ev.dur : ev.len * 0.25;
      // Sustain is for instruments that play notes; drums and effects ignore it.
      const sustain = ev.sustain && rec.kind === "pitched" ? SUSTAIN_TAIL : 0;
      if (rec.source === "recorded") return playSample(rec, ev, when, dur, dest, sustain);
      const recipe = rec.recipe;
      const fn = recipe && RECIPES[recipe.type];
      if (!fn) return [];
      const params = Object.assign({}, recipe, { slot: ev.pitch, sustain });
      const freq = rec.kind === "pitched" ? midiToFreq(ev.pitch) : 0;
      return fn(ctx, dest, freq, when, dur, ev.gain, params);
    }

    return { play, load };
  }

  // Master chain: bus -> limiter -> destination.
  // The shaper sees the signal at half level (SHAPER_PRE) so it has headroom up
  // to +-2 before it runs out of curve. Inside the curve, `u` is the real
  // level: straight through up to 0.7, then a smooth tanh shoulder, so loud
  // chords round off instead of clipping hard. Output stays inside +-1.
  const SHAPER_PRE = 0.5;
  function softClipCurve(n) {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = ((i / (n - 1)) * 2 - 1) / SHAPER_PRE;
      const a = Math.abs(u);
      const y = a <= 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3);
      c[i] = u < 0 ? -y : y;
    }
    return c;
  }

  // The path for notes played live: a volume gain, a half-level step, then a
  // soft clipper. No look-ahead (a compressor adds a few ms of delay, which is
  // felt when playing). Returns the volume gain.
  function createLiveBus(ctx) {
    const bus = ctx.createGain();
    const pre = ctx.createGain();
    pre.gain.value = SHAPER_PRE;
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(2049);
    shaper.oversample = "none";
    bus.connect(pre);
    pre.connect(shaper);
    shaper.connect(ctx.destination);
    return bus;
  }

  // ---- Reverb ---------------------------------------------------------------
  // A level's impulse: stereo noise falling away exponentially (60 dB over its
  // length), from a seeded generator so it is the same every time. The samples
  // are worked out once per sample rate and level, then copied into each
  // context's buffer.
  const impulseCache = new Map();
  function impulseData(rate, level) {
    const key = rate + ":" + level;
    let data = impulseCache.get(key);
    if (!data) {
      const len = Math.round(REVERB_LEVELS[level].sec * rate);
      data = [0, 1].map((ch) => {
        const d = new Float32Array(len);
        let seed = 90001 + ch * 7919 + level * 104729;
        for (let i = 0; i < len; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const x = i / len;
          // the last 2% eases to exactly 0, so the tail never ends on a step
          d[i] = ((seed / 4294967296) * 2 - 1) * Math.exp(-6.9 * x) * Math.min(1, (1 - x) * 50);
        }
        return d;
      });
      impulseCache.set(key, data);
    }
    return data;
  }

  function reverbImpulse(ctx, level) {
    const data = impulseData(ctx.sampleRate, level);
    const buf = ctx.createBuffer(2, data[0].length, ctx.sampleRate);
    buf.getChannelData(0).set(data[0]);
    buf.getChannelData(1).set(data[1]);
    return buf;
  }

  // Reverb sends into `dest`. Nothing is built until a level is first used,
  // and each level is built once (one convolver per level, per dest).
  //  - wet(level): the convolver for that level (convolver -> wet gain -> dest),
  //    or null for 0. Connect a voice to it beside its own dry connection.
  //  - input(level): a node to play voices into. For 0 it is `dest` itself;
  //    otherwise a gain that feeds `dest` at full level (dry) and the convolver.
  //  - disconnect(): takes every node it built out of the graph.
  function createReverb(ctx, dest) {
    const wets = [];
    const inputs = [];
    const made = [];
    const valid = (level) => Number.isInteger(level) && level > 0 && level < REVERB_LEVELS.length;
    function wet(level) {
      if (!valid(level)) return null;
      if (!wets[level]) {
        const conv = ctx.createConvolver();
        conv.buffer = reverbImpulse(ctx, level);
        const g = ctx.createGain();
        g.gain.value = REVERB_LEVELS[level].wet;
        conv.connect(g);
        g.connect(dest);
        made.push(conv, g);
        wets[level] = conv;
      }
      return wets[level];
    }
    function input(level) {
      if (!valid(level)) return dest;
      if (!inputs[level]) {
        const g = ctx.createGain();
        g.connect(dest);
        g.connect(wet(level));
        made.push(g);
        inputs[level] = g;
      }
      return inputs[level];
    }
    function disconnect() {
      for (const n of made) {
        try { n.disconnect(); } catch (e) { /* already gone */ }
      }
      made.length = 0;
      wets.length = 0;
      inputs.length = 0;
    }
    return { wet, input, disconnect };
  }

  // ---- Track effects: EQ, then Chorus, then Dynamics ----------------------
  // Each track's chain sits between its voices and its dry output plus reverb
  // send. An effect that is off builds nothing, and a track with every effect
  // off has no chain at all, so its sound takes exactly the path it always did.

  // A flanger's feedback never reaches this, so it always dies away (at most
  // about 70 ms of ringing at 5 ms a pass); FLANGER_TAIL covers it in exports.
  const FLANGER_FEEDBACK_MAX = 0.6;
  const FLANGER_TAIL = 0.25;
  // A note's peak level the Dynamics makeup is set for (a track note at full
  // volume peaks around here).
  const DYN_TYPICAL_DB = -12;
  // How long a chain stays connected after its last note ends: enough for
  // sustain, a voice's ring and its release.
  const CHAIN_HOLD = SUSTAIN_TAIL + 1.5;

  const amountOf = (o) => Math.max(0, Math.min(1, (o && +o.amount) / 100 || 0));
  // Which of a track's effects are on. EQ is on when a band is not 0 or Low cut is on.
  function trackFxOn(t) {
    const c = t && t.chorus, d = t && t.dyn, e = t && t.eq;
    const chorus = !!c && (c.kind === "chorus" || c.kind === "flanger" || c.kind === "phaser");
    const dyn = !!d && (d.kind === "compress" || d.kind === "limit");
    const eq = !!e && (!!e.low || !!e.mid || !!e.high || !!e.lowcut);
    return { chorus, dyn, eq, any: chorus || dyn || eq };
  }
  // Everything that decides how a track's chain is built; "" when every effect is off.
  function fxKey(t) {
    const on = trackFxOn(t);
    if (!on.any) return "";
    return [
      on.eq ? "e" + [t.eq.low | 0, t.eq.mid | 0, t.eq.high | 0, t.eq.lowcut ? 1 : 0].join(",") : "",
      on.chorus ? "c" + t.chorus.kind + amountOf(t.chorus) : "",
      on.dyn ? "d" + t.dyn.kind + amountOf(t.dyn) : "",
    ].join("|");
  }

  // Compress: the threshold falls (-10 to -34 dB) and the ratio rises (2 to 6) with amount. Limit: ratio 20, a 1 ms
  // attack, the threshold from -1 to -12 dB. The browser's compressor already lifts its output by
  // (1 / its gain at full level)^0.6 (the Web Audio spec), so makeupDb is what is left to bring a typical note back to
  // the level it had.
  function dynSettings(kind, amount) {
    const a = Math.max(0, Math.min(1, (+amount || 0) / 100));
    const s = kind === "limit"
      ? { threshold: -1 - 11 * a, ratio: 20, knee: 0, attack: 0.001, release: 0.1 }
      : { threshold: -10 - 24 * a, ratio: 2 + 4 * a, knee: 6, attack: 0.01, release: 0.2 };
    const out = (x) => (x <= s.threshold ? x : s.threshold + (x - s.threshold) / s.ratio);
    const auto = -0.6 * out(0);
    s.makeupDb = DYN_TYPICAL_DB - (out(DYN_TYPICAL_DB) + auto);
    return s;
  }

  // One track's chain: { input, output, dry, wet (the chorus's two sides, or null), lfos, disconnect() }, or null when
  // every effect is off. Nothing is connected to the outside yet.
  function buildTrackChain(ctx, t) {
    const on = trackFxOn(t);
    if (!on.any) return null;
    const nodes = [];
    const lfos = [];
    const add = (n) => (nodes.push(n), n);
    const gain = (v) => { const g = add(ctx.createGain()); g.gain.value = v; return g; };
    const lfo = (hz) => {
      const o = add(ctx.createOscillator());
      o.type = "sine";
      o.frequency.value = hz;
      o.start(ctx.currentTime);
      lfos.push(o);
      return o;
    };
    const input = gain(1);
    let cur = input;
    let dry = null;
    let wet = null;

    if (on.eq) {
      const e = t.eq;
      const band = (type, hz, q, db) => {
        const f = add(filterNode(ctx, type, hz, q));
        if (db !== undefined) f.gain.value = db;
        cur.connect(f);
        cur = f;
      };
      if (e.lowcut) band("highpass", 90, 0.7);
      if (e.low) band("lowshelf", 200, undefined, e.low);
      if (e.mid) band("peaking", 1000, 0.8, e.mid);
      if (e.high) band("highshelf", 4000, undefined, e.high);
    }

    if (on.chorus) {
      const kind = t.chorus.kind;
      const a = amountOf(t.chorus);
      const src = cur;
      const mix = gain(1);
      const delay = (base, max) => {
        const d = add(ctx.createDelay(max));
        d.delayTime.value = base;
        return d;
      };
      // an LFO swinging `param` by +-depth around where it sits
      const sweep = (osc, depth, param) => { const g = gain(depth); osc.connect(g); g.connect(param); };
      if (kind === "chorus") {
        // two voices a little behind the dry one, each wobbling its delay (and so its pitch) at its own slow rate
        dry = gain(1 - 0.25 * a);
        wet = gain(0.5 * a);
        [[0.015, 0.8], [0.022, 1.1]].forEach(([base, hz]) => {
          const d = delay(base, 0.05);
          sweep(lfo(hz), 0.004 * a, d.delayTime);
          src.connect(d);
          d.connect(wet);
        });
      } else if (kind === "flanger") {
        // one very short delay sweeping about 1-5 ms, faster than the chorus, fed back into itself for the jet sound
        dry = gain(1 - 0.3 * a);
        wet = gain(0.6 * a);
        const d = delay(0.003, 0.02);
        sweep(lfo(1.5), 0.0018 * a, d.delayTime);
        const fb = gain(Math.min(FLANGER_FEEDBACK_MAX, 0.2 + 0.4 * a));
        d.connect(fb);
        fb.connect(d);
        src.connect(d);
        d.connect(wet);
      } else {
        // phaser: 4 allpass filters whose frequencies swing together, mixed with the dry sound
        dry = gain(1 - 0.4 * a);
        wet = gain(0.6 * a);
        const osc = lfo(0.5);
        let p = src;
        [440, 880, 1760, 3520].forEach((hz) => {
          const f = add(filterNode(ctx, "allpass", hz, 0.6));
          sweep(osc, hz * 0.6 * a, f.frequency);
          p.connect(f);
          p = f;
        });
        p.connect(wet);
      }
      src.connect(dry);
      dry.connect(mix);
      wet.connect(mix);
      cur = mix;
    }

    if (on.dyn) {
      const s = dynSettings(t.dyn.kind, t.dyn.amount);
      const comp = add(ctx.createDynamicsCompressor());
      comp.threshold.value = s.threshold;
      comp.ratio.value = s.ratio;
      comp.knee.value = s.knee;
      comp.attack.value = s.attack;
      comp.release.value = s.release;
      const makeup = gain(Math.pow(10, s.makeupDb / 20));
      cur.connect(comp);
      comp.connect(makeup);
      cur = makeup;
    }

    return {
      input,
      output: cur,
      dry,
      wet,
      lfos,
      disconnect() {
        for (const o of lfos) {
          try { o.stop(); } catch (e) { /* already stopped */ }
        }
        for (const n of nodes) {
          try { n.disconnect(); } catch (e) { /* already gone */ }
        }
      },
    };
  }

  // Every track's chain for one player, one export or the live keys. input(t, dests, until) gives the node a voice of
  // track t (an event or a track: trackId or id) plays into: its chain, built the first time and reused for every note
  // after, its output feeding each of dests. It gives null when every effect is off, so the caller plays straight into
  // dests as before. A changed setting (or reverb send) builds a new chain for the notes that follow; the old one stays
  // until its notes have rung out (`until`, seconds on the audio clock), then sweep(now) takes it out of the graph.
  // disconnect() takes every chain out.
  function createTrackChains(ctx) {
    const byTrack = new Map();
    let retired = [];
    const same = (a, b) => a.length === b.length && a.every((d, i) => d === b[i]);
    return {
      input(t, dests, until) {
        const id = t.trackId !== undefined ? t.trackId : t.id;
        const key = fxKey(t);
        let e = byTrack.get(id);
        if (e && (e.key !== key || !same(e.dests, dests))) {
          retired.push(e);
          byTrack.delete(id);
          e = null;
        }
        if (!key) return null;
        if (!e) {
          const chain = buildTrackChain(ctx, t);
          dests.forEach((d) => chain.output.connect(d));
          e = { key, dests: dests.slice(), chain, until: 0 };
          byTrack.set(id, e);
        }
        if (until > e.until) e.until = until;
        return e.chain.input;
      },
      sweep(now) {
        if (!retired.length) return;
        retired = retired.filter((e) => {
          if (e.until > now) return true;
          e.chain.disconnect();
          return false;
        });
      },
      disconnect() {
        byTrack.forEach((e) => e.chain.disconnect());
        retired.forEach((e) => e.chain.disconnect());
        byTrack.clear();
        retired = [];
      },
    };
  }

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
    let fx = null;
    let chains = null;
    let handle = null;
    let step = 0;
    let nextTime = 0;
    let stepDur = 0.25;
    let ended = false;
    let queue = [];
    let live = [];
    let cb = null;
    let lastReported = null;
    let click = false;

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
          if (click && step % spc() === 0) {
            const o = makeClick(ctx, master.bus, nextTime, (step / spc()) % 4 === 0);
            live.push({ src: o, when: nextTime });
          }
          const evs = compileEvents(song, step, step + 1);
          for (const ev of evs) {
            const dest = fx.input(ev.reverb);
            const into = chains.input(ev, [dest], nextTime + ev.len * stepDur + CHAIN_HOLD) || dest;
            const made = voices.play(Object.assign({}, ev, { dur: ev.len * stepDur }), nextTime, into);
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
      chains.sweep(now);
      if (ended && !queue.length && now >= nextTime + Math.max(1.2, songTail(song))) api.stop();
    }

    function start(s, opts) {
      if (handle !== null) api.stop();
      song = s;
      click = !!(opts && opts.click);
      master = makeMaster(ctx);
      fx = createReverb(ctx, master.bus);
      chains = createTrackChains(ctx);
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
      fx.disconnect();
      chains.disconnect();
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
      const fx = createReverb(ctx, master.bus);
      const chains = createTrackChains(ctx);
      const total = SS.model.totalSteps(song);
      const dur = stepSeconds(song.tempo, song.grid);
      const evs = compileEvents(song, 0, total);
      for (let r = 0; r < times; r++) {
        for (const ev of evs) {
          const dest = fx.input(ev.reverb);
          voices.play(
            Object.assign({}, ev, { dur: ev.len * dur }),
            (r * total + ev.step) * dur,
            chains.input(ev, [dest], Infinity) || dest
          );
        }
      }
      const buffer = await ctx.startRendering();
      return { buffer, failed };
    });
  }

  SS.engine = Object.assign(SS.engine || {}, {
    stepSeconds,
    makeClick,
    softClipCurve,
    createLiveBus,
    createReverb,
    REVERB_LEVELS,
    trackFxOn,
    dynSettings,
    buildTrackChain,
    createTrackChains,
    FLANGER_FEEDBACK_MAX,
    DYN_TYPICAL_DB,
    SUSTAIN_TAIL,
    compileEvents,
    stepsToSchedule,
    exportFrames,
    songTail,
    createVoices,
    createPlayer,
    DRUM_STYLES,
    FX_EFFECTS,
    RECIPE_PARAMS,
    renderOffline,
  });
})(typeof window !== "undefined" ? window : globalThis);
