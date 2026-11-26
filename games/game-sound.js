/* ============================================================
   Chike's Creative Space - shared game sounds
   One small sound kit every game can use, so they all sound like
   one family and share one on/off switch. Every sound is made in
   the browser with the Web Audio API: no audio files to load.

   Use it from a game:
     <script src="game-sound.js"></script>
     CCSSound.play("good");                 // a named sound (see SOUNDS)
     CCSSound.play("tick", { pitch: 1.5 }); // optional pitch (1 = normal) and volume (1 = normal)
     el.appendChild(CCSSound.button());     // the standard on/off button (a volume button appears beside it)
     CCSSound.volume("music"), CCSSound.onVolume(fn)  // the player's volume levels, for a game's own sounds

   Sound is ON unless the player turned it off. The choice is kept
   in localStorage under "ccs-sound" ("on" / "off") and is shared by
   every game that uses this kit. Browsers only allow sound after the
   player's first click, tap or key press; the kit waits for that.
   Two volume levels sit under the switch, music and game sounds, set
   with the volume button and remembered for every game (see VOLUME).
   ============================================================ */
(function(){
  "use strict";
  var KEY = "ccs-sound";
  var on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
  var ctx = null, master = null, unlocked = false;
  var sfxBus = null, musicBus = null, mixers = [], volFns = [], hasMusicFlag = false;
  var lastAt = {};                       /* name -> time it last played, so fast repeats stay gentle */
  var buttons = [];

  function audio(){
    if (!ctx){
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
      /* one master volume and a limiter, so sounds that pile up never clip */
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 8;
      master = ctx.createGain(); master.gain.value = 0.5;
      master.connect(comp); comp.connect(ctx.destination);
      /* the two volume levels: background music, and every other sound */
      sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = VOL.music; musicBus.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function unlock(){ unlocked = true; if (on){ audio(); decodeAll(); } }
  ["pointerdown", "keydown", "touchstart"].forEach(function(t){ window.addEventListener(t, unlock, { capture: true, passive: true }); });

  /* a single note: frequency, start (s from now), length (s), wave, volume, optional slide to another frequency */
  function tone(f, start, dur, type, vol, slideTo){
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.03);
  }
  /* a short burst of noise (pops, whooshes, thuds) */
  function noise(start, dur, vol, freq, type){
    var c = audio(); if (!c) return;
    var len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
    f.type = type || "highpass"; f.frequency.value = freq || 900; g.gain.value = vol || 0.3;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
  }
  var notes = function(list, gap, len, type, vol, p){ list.forEach(function(f, i){ tone(f * p, i * gap, len, type, vol); }); };

  /* the sound set: short, bright and friendly. p = pitch multiplier, v = volume multiplier */
  var SOUNDS = {
    click:  function(p, v){ tone(1200 * p, 0, 0.04, "square", 0.05 * v); },
    tick:   function(p, v){ tone(1800 * p, 0, 0.03, "triangle", 0.06 * v); },
    pop:    function(p, v){ noise(0, 0.08, 0.35 * v); tone(700 * p, 0, 0.12, "triangle", 0.13 * v, 180 * p); },
    flip:   function(p, v){ noise(0, 0.06, 0.18 * v, 2200); tone(520 * p, 0, 0.06, "triangle", 0.06 * v, 760 * p); },
    place:  function(p, v){ tone(330 * p, 0, 0.09, "triangle", 0.14 * v); noise(0, 0.05, 0.12 * v, 400, "lowpass"); },
    thud:   function(p, v){ tone(140 * p, 0, 0.16, "sine", 0.22 * v, 70 * p); noise(0, 0.07, 0.15 * v, 300, "lowpass"); },
    bounce: function(p, v){ tone(300 * p, 0, 0.14, "sine", 0.14 * v, 620 * p); },
    whoosh: function(p, v){ noise(0, 0.28, 0.22 * v, 700, "bandpass"); },
    laser:  function(p, v){ tone(1400 * p, 0, 0.16, "square", 0.05 * v, 300 * p); },
    boom:   function(p, v){ noise(0, 0.45, 0.4 * v, 500, "lowpass"); tone(90 * p, 0, 0.4, "sine", 0.22 * v, 40 * p); },
    coin:   function(p, v){ tone(988 * p, 0, 0.08, "square", 0.07 * v); tone(1319 * p, 0.07, 0.22, "square", 0.07 * v); },
    good:   function(p, v){ notes([784, 988, 1319], 0.08, 0.16, "triangle", 0.15 * v, p); },
    match:  function(p, v){ notes([659, 880, 1109, 1319], 0.06, 0.16, "triangle", 0.13 * v, p); },
    bad:    function(p, v){ tone(240 * p, 0, 0.24, "sine", 0.14 * v, 150 * p); },
    level:  function(p, v){ notes([523, 659, 784, 1047, 1319], 0.07, 0.18, "square", 0.06 * v, p); },
    win:    function(p, v){ notes([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 0.22, "triangle", 0.15 * v, p); },
    lose:   function(p, v){ notes([392, 349, 311, 262], 0.18, 0.3, "sine", 0.13 * v, p); },
    start:  function(p, v){ notes([440, 660, 880], 0.09, 0.14, "square", 0.06 * v, p); }
  };
  /* the least time between two plays of the same sound, so a burst (pegs, bounces, ticks) never turns into a buzz */
  var GAP = { tick: 35, click: 30, bounce: 45, place: 40, flip: 40, thud: 50, laser: 40, pop: 30 };

  /* ---------- real recordings (owner, 2026-11-16) ----------
     A game can hand the kit recordings (free CC0 sounds from Freesound):
       CCSSound.samples({ laser: { src: "/assets/games/x/laser.mp3", start: 0.1, end: 0.9, volume: 0.5 } });
     start/end trim the recording (seconds), volume is 0 to 1, vary (e.g. 0.05) nudges the speed
     a little each time so repeats don't sound copy-pasted, loop: true makes it a loop for loop().
     play(name) uses the recording once it has loaded, and the made-in-code sound of the same
     name (if there is one) until then. loop(name) returns { set(volume, speed), stop() } for a
     sound that keeps going, like a motor whose volume and speed follow the game every frame.
     music: true marks a recording as background music, so it follows the music volume. */
  var SAMPLES = {};
  function decodeAll(){
    var c = ctx; if (!c) return;
    Object.keys(SAMPLES).forEach(function(n){
      var s = SAMPLES[n];
      if (s.buf || s.decoding || !s.bytes) return;
      s.decoding = true;
      s.bytes.then(function(b){ return b ? c.decodeAudioData(b.slice(0)) : null; })
        .then(function(buf){ if (buf) s.buf = buf; })
        .catch(function(){});
    });
  }
  function samples(map){
    Object.keys(map || {}).forEach(function(n){
      var o = map[n] || {};
      var s = SAMPLES[n] = { src: o.src, start: o.start || 0, end: o.end, volume: o.volume == null ? 1 : o.volume, loop: !!o.loop, music: !!o.music, vary: o.vary || 0, buf: null, decoding: false, bytes: null };
      if (s.music) hasMusic(true);
      try { s.bytes = window.fetch(o.src).then(function(r){ return r.ok ? r.arrayBuffer() : null; }).catch(function(){ return null; }); } catch (e) {}
    });
    if (ctx && on) decodeAll();
  }
  function clipEnd(s){ return s.end != null ? Math.min(s.end, s.buf.duration) : s.buf.duration; }
  function playSample(s, p, v){
    var c = audio(); if (!c) return;
    var src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    var rate = p * (s.vary ? 1 + (Math.random() * 2 - 1) * s.vary : 1);
    var len = Math.max(0.01, clipEnd(s) - s.start), real = len / rate, fade = Math.min(0.08, real / 4), vol = s.volume * v;
    src.buffer = s.buf; src.playbackRate.value = rate;
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + real - fade);
    g.gain.linearRampToValueAtTime(0, t + real);            /* a quick fade, so a trimmed clip never ends in a click */
    src.connect(g); g.connect(sfxBus);
    src.start(t, s.start, len); src.stop(t + real + 0.05);
  }
  function loop(name){
    var h = { src: null, g: null };
    h.set = function(vol, rate){
      try {
        var s = SAMPLES[name]; if (!s) return;
        var want = on && unlocked ? Math.max(0, vol || 0) * s.volume : 0;
        if (!h.src){
          if (want <= 0.0001 || !s.buf) return;
          var c = audio(); if (!c) return;
          var src = c.createBufferSource(), g = c.createGain();
          src.buffer = s.buf; src.loop = true; src.loopStart = s.start; src.loopEnd = clipEnd(s);
          g.gain.value = 0;
          src.connect(g); g.connect(s.music ? musicBus : sfxBus);
          src.start(c.currentTime, s.start);
          h.src = src; h.g = g;
        }
        h.g.gain.setTargetAtTime(want, ctx.currentTime, 0.06);      /* glide, never jump */
        if (rate) h.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.1);
      } catch (e) {}
    };
    h.stop = function(){
      if (!h.src) return;
      try { h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); h.src.stop(ctx.currentTime + 0.3); } catch (e) {}
      h.src = null; h.g = null;
    };
    return h;
  }

  function play(name, opts){
    var s = SAMPLES[name], ready = !!(s && s.buf);
    if (!on || !unlocked || (!ready && !SOUNDS[name])) return;
    var now = (window.performance && performance.now()) || Date.now();
    if (GAP[name] && lastAt[name] && now - lastAt[name] < GAP[name]) return;
    lastAt[name] = now;
    opts = opts || {};
    try {
      if (ready) playSample(s, opts.pitch || 1, opts.volume == null ? 1 : opts.volume);
      else SOUNDS[name](opts.pitch || 1, opts.volume == null ? 1 : opts.volume);
    } catch (e) {}
  }

  /* ---------- the standard on/off button ---------- */
  var ICON_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
  function paint(b){
    b.innerHTML = (on ? ICON_ON : ICON_OFF) + (b.dataset.compact ? "" : "<span>" + (on ? "Sound on" : "Sound off") + "</span>");
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", "Sound");
    b.title = on ? "Turn sound off" : "Turn sound on";
  }
  function setOn(v){
    on = !!v;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
    if (!on && master && ctx){ master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); setTimeout(function(){ if (!on && master) master.gain.value = 0.5; }, 300); }
    buttons.forEach(paint); mixers.forEach(paintMixer); paintSwitch();
    if (on){ unlock(); play("click"); }
  }
  /* opts.compact: icon only (for tight top bars). The button carries an inline background so the shared skin's
     pill rule does not restyle it; style it further with the class "ccs-sound-btn". */
  function button(opts){
    opts = opts || {};
    /* ONE Sound button for every game (owner, 2026-11-26: "place this in a single menu or settings button"): its
       speaker shows whether sound is on, and a tap opens one panel with the on/off switch and the volume sliders.
       opts.mixer === false keeps the old plain on/off button. */
    if (opts.mixer !== false) return mixer({ background: opts.background, className: opts.className, compact: !!opts.compact });
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ccs-sound-btn" + (opts.className ? " " + opts.className : "");
    if (opts.compact) b.dataset.compact = "1";
    b.style.background = opts.background || "#FFFBF3";
    b.addEventListener("click", function(){ setOn(!on); });
    buttons.push(b); paint(b);
    return b;
  }

  /* ---------- VOLUME (owner, 2026-11-17: "Add volume control to the music and remember the users preference", then
     "Do this for all games with background music or sound"; draft docs/mockups/music-volume-draft.html) ----------
     Two levels from 0 to 1: music (background music) and sfx (every other sound, voices too). It's one setting for
     every game on this device, kept in localStorage under "ccs-game-save:volume". A private game runs sealed off in the
     site's locked frame, where storage can't be reached, so it asks the site page, which keeps the very same key. */
  var VKEY = "ccs-game-save:volume", VOL = { music: 1, sfx: 1 }, sealed = false, saveT = null;
  function clampVol(v){ v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; }
  function takeVol(d){
    if (!d || typeof d !== "object") return;
    if ("music" in d) VOL.music = clampVol(d.music);
    if ("sfx" in d) VOL.sfx = clampVol(d.sfx);
    applyVol();
  }
  function applyVol(){
    if (ctx && sfxBus){ sfxBus.gain.setTargetAtTime(VOL.sfx, ctx.currentTime, 0.04); musicBus.gain.setTargetAtTime(VOL.music, ctx.currentTime, 0.04); }
    volFns.forEach(function(f){ try { f({ music: VOL.music, sfx: VOL.sfx }); } catch (e) {} });
    if (panel) Array.prototype.forEach.call(panel.querySelectorAll("input"), function(inp){ var k = inp.getAttribute("data-kind"); if (document.activeElement !== inp){ inp.value = Math.round(VOL[k] * 100); } inp.parentNode.querySelector("b").textContent = Math.round(VOL[k] * 100) + "%"; });
  }
  function saveVol(){
    clearTimeout(saveT);
    saveT = setTimeout(function(){
      var data = { music: VOL.music, sfx: VOL.sfx };
      if (!sealed){ try { localStorage.setItem(VKEY, JSON.stringify(data)); return; } catch (e) { sealed = true; } }
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ ccsSave: "set", game: "volume", data: data }, "*"); } catch (e) {}
    }, 250);
  }
  function setVolume(kind, v){ if (kind !== "music" && kind !== "sfx") return; VOL[kind] = clampVol(v); applyVol(); saveVol(); }
  function volume(kind){ return kind === "music" ? VOL.music : VOL.sfx; }
  function onVolume(fn){ if (typeof fn === "function"){ volFns.push(fn); try { fn({ music: VOL.music, sfx: VOL.sfx }); } catch (e) {} } }
  /* a game with background music says so (recordings marked music: true do it for themselves), and the panel adds a Music slider */
  function hasMusic(v){ hasMusicFlag = v !== false; mixers.forEach(paintMixer); }
  var raw = null;
  try { raw = localStorage.getItem(VKEY); } catch (e) { sealed = true; }
  try { takeVol(JSON.parse(raw || "null")); } catch (e) {}
  if (sealed && window.parent && window.parent !== window){
    window.addEventListener("message", function(e){ var d = e.data; if (d && d.ccsSave === "data" && d.game === "volume") takeVol(d.data); });
    try { window.parent.postMessage({ ccsSave: "get", game: "volume" }, "*"); } catch (e) {}
  }

  /* the Sound button and its one panel: on/off switch, then the volume sliders. A game that keeps its own on/off
     setting passes opts.toggle = { isOn(), set(v) } and the switch drives that instead of the kit's. */
  function isOnFor(b){ return b && b._toggle ? !!b._toggle.isOn() : on; }
  function setFor(b, v){ if (b && b._toggle){ b._toggle.set(!!v); } else { setOn(!!v); } mixers.forEach(paintMixer); paintSwitch(); }
  function paintMixer(b){
    var o = isOnFor(b);
    b.innerHTML = (o ? ICON_ON : ICON_OFF) + (b.dataset.compact ? "" : "<span>" + (o ? "Sound on" : "Sound off") + "</span>");
    b.setAttribute("aria-label", "Sound settings, sound " + (o ? "on" : "off")); b.title = "Sound settings";
  }
  function paintSwitch(){
    if (!panel) return;
    var o = isOnFor(panelFor), sw = panel.querySelector(".ccs-mix-switch button");
    if (sw){ sw.setAttribute("aria-checked", o ? "true" : "false"); sw.querySelector("span").textContent = o ? "On" : "Off"; }
    panel.classList.toggle("is-off", !o);
  }
  var panel = null, panelFor = null;
  function stop(e){ e.stopPropagation(); }
  function mixer(opts){
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ccs-sound-btn ccs-mix-btn" + (opts.className ? " " + opts.className : "");
    if (opts.compact !== false) b.dataset.compact = "1";
    if (opts.toggle && typeof opts.toggle.isOn === "function" && typeof opts.toggle.set === "function") b._toggle = opts.toggle;
    b.style.background = opts.background || "#FFFBF3";
    b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function(e){ e.stopPropagation(); togglePanel(b); });
    ["pointerdown", "mousedown", "touchstart"].forEach(function(t){ b.addEventListener(t, stop); });
    mixers.push(b); paintMixer(b);
    return b;
  }
  function closePanel(){
    if (!panel) return;
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
    if (panelFor) panelFor.setAttribute("aria-expanded", "false");
    panelFor = null;
    document.removeEventListener("pointerdown", outside, true);
    window.removeEventListener("keydown", onKey, true);
  }
  function outside(e){ if (panel && !panel.contains(e.target) && !(panelFor && panelFor.contains(e.target))) closePanel(); }
  /* the panel's keys belong to the panel: arrows move a slider, never the game behind it */
  function onKey(e){
    if (!panel) return;
    if (e.key === "Escape"){ var f = panelFor; closePanel(); if (f) f.focus(); e.stopPropagation(); return; }
    if (panel.contains(document.activeElement)) e.stopPropagation();
  }
  function togglePanel(b){
    if (panel && panelFor === b){ closePanel(); return; }
    closePanel();
    panel = document.createElement("div");
    panel.className = "ccs-mix";
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Sound settings");
    ["pointerdown", "mousedown", "touchstart", "click", "wheel"].forEach(function(t){ panel.addEventListener(t, stop); });
    var sw = document.createElement("div");
    sw.className = "ccs-mix-switch";
    sw.innerHTML = '<span>Sound</span><button type="button" role="switch" aria-label="Sound"><i aria-hidden="true"></i><span></span></button>';
    sw.querySelector("button").addEventListener("click", function(){ setFor(b, !isOnFor(b)); });
    panel.appendChild(sw);
    var rows = (hasMusicFlag ? [["music", "Music"]] : []).concat([["sfx", hasMusicFlag ? "Game sounds" : "Sound volume"]]);
    rows.forEach(function(r){
      var w = document.createElement("label");
      w.className = "ccs-mix-row";
      w.innerHTML = '<span class="ccs-mix-top"><span>' + r[1] + '</span><b></b></span><input type="range" min="0" max="100" step="5" data-kind="' + r[0] + '"><span class="ccs-mix-ends"><span>Off</span><span>Loud</span></span>';
      var inp = w.querySelector("input");
      inp.value = Math.round(VOL[r[0]] * 100);
      inp.setAttribute("aria-label", r[1]);
      w.querySelector("b").textContent = inp.value + "%";
      inp.addEventListener("input", function(){ if (!isOnFor(b)) setFor(b, true); setVolume(r[0], inp.value / 100); if (r[0] === "sfx") play("tick"); });
      panel.appendChild(w);
    });
    var note = document.createElement("small");
    note.textContent = "Remembered for every game on this device.";
    panel.appendChild(note);
    (document.body || document.documentElement).appendChild(panel);
    var rc = b.getBoundingClientRect(), pw = panel.offsetWidth, ph = panel.offsetHeight;
    var left = Math.min(window.innerWidth - pw - 8, Math.max(8, rc.right - pw)), top = rc.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rc.top - ph - 8);
    panel.style.left = left + "px"; panel.style.top = top + "px";
    panelFor = b; b.setAttribute("aria-expanded", "true"); paintSwitch();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", onKey, true);
    var first = panel.querySelector(".ccs-mix-switch button"); if (first) first.focus();
  }

  /* another tab of the site switching sound, or changing the volume, keeps this one in step */
  window.addEventListener("storage", function(e){
    if (e.key === KEY){ on = e.newValue !== "off"; buttons.forEach(paint); mixers.forEach(paintMixer); paintSwitch(); }
    if (e.key === VKEY){ try { takeVol(JSON.parse(e.newValue || "null")); } catch (x) {} }
  });

  /* a plain look for the button. :where() gives it no weight at all, so any rule a game writes for .ccs-sound-btn wins */
  var css = document.createElement("style");
  css.textContent = ":where(.ccs-sound-btn){display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:800;font-size:.9rem;color:#1E2226;"
    + "border:3px solid #1E2226;border-radius:999px;box-shadow:3px 3px 0 #1E2226;padding:6px 14px;min-height:40px;cursor:pointer;line-height:1}"
    + ":where(.ccs-sound-btn[data-compact]){padding:6px;min-width:40px;justify-content:center}"
    + ":where(.ccs-sound-btn[aria-pressed=false]){opacity:.85}"
    + ".ccs-mix{position:fixed;z-index:2147483000;width:250px;box-sizing:border-box;background:#FFFBF3;color:#1E2226;border:3px solid #1E2226;border-radius:16px;"
    + "box-shadow:5px 5px 0 #1E2226;padding:12px 14px;font-family:Nunito,system-ui,sans-serif;text-align:left}"
    + ".ccs-mix-row{display:block;margin:0 0 10px;cursor:default}"
    + ".ccs-mix-top{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:15px;margin-bottom:4px}"
    + ".ccs-mix-top b{font-size:17px;color:#7A4A86}"
    + ".ccs-mix input[type=range]{display:block;width:100%;margin:0;height:28px;accent-color:#E8A800;cursor:pointer;background:transparent}"
    + ".ccs-mix input[type=range]:focus-visible{outline:3px solid #7A4A86;outline-offset:2px;border-radius:8px}"
    + ".ccs-mix-ends{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#55606e}"
    + ".ccs-mix small{display:block;font-size:12px;font-weight:700;color:#55606e;line-height:1.35}"
    + ".ccs-mix-switch{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:15px;margin:0 0 10px;padding-bottom:10px;border-bottom:2px dashed #E3D9C2}"
    + ".ccs-mix-switch button{display:inline-flex;align-items:center;gap:8px;border:0;background:none;font:inherit;font-weight:900;font-size:14px;color:#1E2226;cursor:pointer;padding:2px;border-radius:999px}"
    + ".ccs-mix-switch button:focus-visible{outline:3px solid #7A4A86;outline-offset:2px}"
    + ".ccs-mix-switch i{position:relative;display:block;width:46px;height:26px;box-sizing:border-box;border:3px solid #1E2226;border-radius:999px;background:#E8A800;transition:background .15s ease-out}"
    + ".ccs-mix-switch i::after{content:'';position:absolute;top:2px;left:21px;width:16px;height:16px;box-sizing:border-box;border:2px solid #1E2226;border-radius:50%;background:#fff;transition:left .15s ease-out}"
    + ".ccs-mix-switch button[aria-checked=false] i{background:#D5D9DE}.ccs-mix-switch button[aria-checked=false] i::after{left:2px}"
    + ".ccs-mix.is-off .ccs-mix-row{opacity:.5}"
    + "@media (prefers-reduced-motion:reduce){.ccs-mix-switch i,.ccs-mix-switch i::after{transition:none}}";
  (document.head || document.documentElement).appendChild(css);

  window.CCSSound = { play: play, isOn: function(){ return on; }, setOn: setOn, button: button, names: Object.keys(SOUNDS),
    samples: samples, loop: loop, ready: function(name){ return !!(SAMPLES[name] && SAMPLES[name].buf); },
    volume: volume, setVolume: setVolume, onVolume: onVolume, hasMusic: hasMusic, mixer: mixer };
})();
