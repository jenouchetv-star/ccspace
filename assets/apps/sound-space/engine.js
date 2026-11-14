(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  function stepSeconds(tempo) {
    return 60 / tempo / 2;
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
    const total = song.counts * SS.model.CONST.STEPS_PER_COUNT;
    const seconds = total * stepSeconds(song.tempo) * times + tail;
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
    const att = Math.max(o.attack || ATTACK, ATTACK);
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
    pluck(ctx, dest, freq, when, dur, vel, p) {
      const sr = ctx.sampleRate;
      const ring = Math.min(Math.max(dur, 0.1) + 0.5, 2.5);
      const len = Math.max(Math.round(sr * ring), 64);
      const period = Math.max(2, Math.round(sr / freq));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const damp = p.damp === undefined ? 0.996 : p.damp;
      let seed = 777;
      for (let i = 0; i < len; i++) {
        if (i < period) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          d[i] = (seed / 4294967296) * 2 - 1;
        } else {
          d[i] = damp * 0.5 * (d[i - period] + d[i - period + 1]);
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const e = envelope(ctx, dest, when, Math.max(dur, 0.1), vel * 0.6, { ring: 0.4 });
      src.start(when);
      src.stop(e.end);
      src.connect(e.gain);
      return [src];
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
      return [o1, o2];
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
    // Low tom, High tom, Cymbal.
    noiseDrum(ctx, dest, freq, when, dur, vel, p) {
      const slot = (p.slot | 0) & 7;
      const v = vel * 0.7;
      const tone = (f0, f1, decay, gain) => {
        const e = hit(ctx, dest, when, v * gain, decay);
        const o = osc(ctx, "sine", f0, when, e.end);
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
          return [tone(150, 45, 0.35, 1)];
        case 1:
          return [noise("highpass", 1200, 0.18, 0.8), tone(220, 150, 0.1, 0.5)];
        case 2:
          return [noise("highpass", 7000, 0.05, 0.5)];
        case 3:
          return [noise("highpass", 7000, 0.35, 0.5)];
        case 4: {
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, when);
          for (let i = 0; i < 3; i++) {
            const t = when + i * 0.012;
            e.gain.linearRampToValueAtTime(v * 0.8, t + ATTACK);
            e.gain.linearRampToValueAtTime(v * 0.1, t + 0.011);
          }
          e.gain.linearRampToValueAtTime(v * 0.8, when + 0.036 + ATTACK);
          e.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
          e.gain.linearRampToValueAtTime(0, when + 0.2 + RELEASE);
          e.connect(dest);
          const n = noiseSource(ctx, when, when + 0.23);
          const f = filterNode(ctx, "bandpass", 1500, 1.2);
          n.connect(f);
          f.connect(e);
          return [n];
        }
        case 5:
          return [tone(120, 70, 0.3, 0.9)];
        case 6:
          return [tone(200, 120, 0.25, 0.9)];
        default:
          return [noise("highpass", 5000, 1.2, 0.4)];
      }
    },

    // One-shot effects; params.effect picks which.
    fx(ctx, dest, freq, when, dur, vel, p) {
      const kind = (p.params && p.params.effect) || p.effect || "laser";
      const v = vel * 0.5;
      const sweepTone = (type, f0, f1, decay) => {
        const e = hit(ctx, dest, when, v, decay);
        const o = osc(ctx, type, f0, when, e.end);
        o.frequency.setValueAtTime(f0, when);
        o.frequency.exponentialRampToValueAtTime(f1, when + decay);
        o.connect(e.gain);
        return [o];
      };
      switch (kind) {
        case "rise":
          return sweepTone("triangle", 200, 1600, 0.6);
        case "bubble":
          return sweepTone("sine", 300, 900, 0.15);
        case "boom": {
          const e = hit(ctx, dest, when, v * 1.2, 1.0);
          const n = noiseSource(ctx, when, e.end);
          const f = filterNode(ctx, "lowpass", 400, 1);
          n.connect(f);
          f.connect(e.gain);
          return [n].concat(sweepTone("sine", 90, 35, 0.8));
        }
        case "sparkle":
          return sweepTone("sine", 2400, 3600, 0.4);
        default:
          return sweepTone("sawtooth", 1800, 160, 0.3);
      }
    },
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
    const SPC = SS.model.CONST.STEPS_PER_COUNT;

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
      return song.counts * SPC;
    }

    function advance() {
      nextTime += stepDur;
      step++;
      if (step >= total()) {
        if (song.loop) step = 0;
        else ended = true;
      }
      // Tempo changes apply from the next count.
      if (!ended && step % SPC === 0) stepDur = stepSeconds(song.tempo);
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
      stepDur = stepSeconds(song.tempo);
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

  // voicesFactory(ctx) => voices (or a promise of them), already loaded.
  function renderOffline(song, times, voicesFactory, opts) {
    const Ctor =
      (opts && opts.OfflineAudioContext) ||
      root.OfflineAudioContext ||
      root.webkitOfflineAudioContext;
    const ctx = new Ctor(2, exportFrames(song, times), 44100);
    return Promise.resolve(voicesFactory(ctx)).then((voices) => {
      const master = makeMaster(ctx);
      const total = song.counts * SS.model.CONST.STEPS_PER_COUNT;
      const dur = stepSeconds(song.tempo);
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
      return ctx.startRendering();
    });
  }

  SS.engine = Object.assign(SS.engine || {}, {
    stepSeconds,
    compileEvents,
    stepsToSchedule,
    exportFrames,
    createVoices,
    createPlayer,
    renderOffline,
  });
})(typeof window !== "undefined" ? window : globalThis);
