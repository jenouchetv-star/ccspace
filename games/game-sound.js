/* ============================================================
   Chike's Creative Space — shared game sounds
   One small sound kit every game can use, so they all sound like
   one family and share one on/off switch. Every sound is made in
   the browser with the Web Audio API: no audio files to load.

   Use it from a game:
     <script src="game-sound.js"></script>
     CCSSound.play("good");                 // a named sound (see SOUNDS)
     CCSSound.play("tick", { pitch: 1.5 }); // optional pitch (1 = normal) and volume (1 = normal)
     el.appendChild(CCSSound.button());     // the standard on/off button

   Sound is ON unless the player turned it off. The choice is kept
   in localStorage under "ccs-sound" ("on" / "off") and is shared by
   every game that uses this kit. Browsers only allow sound after the
   player's first click, tap or key press; the kit waits for that.
   ============================================================ */
(function(){
  "use strict";
  var KEY = "ccs-sound";
  var on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
  var ctx = null, master = null, unlocked = false;
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
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function unlock(){ unlocked = true; if (on) audio(); }
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
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  /* a short burst of noise (pops, whooshes, thuds) */
  function noise(start, dur, vol, freq, type){
    var c = audio(); if (!c) return;
    var len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
    f.type = type || "highpass"; f.frequency.value = freq || 900; g.gain.value = vol || 0.3;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(t);
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

  function play(name, opts){
    if (!on || !unlocked || !SOUNDS[name]) return;
    var now = (window.performance && performance.now()) || Date.now();
    if (GAP[name] && lastAt[name] && now - lastAt[name] < GAP[name]) return;
    lastAt[name] = now;
    opts = opts || {};
    try { SOUNDS[name](opts.pitch || 1, opts.volume == null ? 1 : opts.volume); } catch (e) {}
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
    buttons.forEach(paint);
    if (on){ unlock(); play("click"); }
  }
  /* opts.compact: icon only (for tight top bars). The button carries an inline background so the shared skin's
     pill rule does not restyle it; style it further with the class "ccs-sound-btn". */
  function button(opts){
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ccs-sound-btn" + (opts.className ? " " + opts.className : "");
    if (opts.compact) b.dataset.compact = "1";
    b.style.background = opts.background || "#FFFBF3";
    b.addEventListener("click", function(){ setOn(!on); });
    buttons.push(b); paint(b);
    return b;
  }
  /* another tab of the site switching sound keeps this one in step */
  window.addEventListener("storage", function(e){ if (e.key === KEY){ on = e.newValue !== "off"; buttons.forEach(paint); } });

  /* a plain look for the button. :where() gives it no weight at all, so any rule a game writes for .ccs-sound-btn wins */
  var css = document.createElement("style");
  css.textContent = ":where(.ccs-sound-btn){display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:800;font-size:.9rem;color:#1E2226;"
    + "border:3px solid #1E2226;border-radius:999px;box-shadow:3px 3px 0 #1E2226;padding:6px 14px;min-height:40px;cursor:pointer;line-height:1}"
    + ":where(.ccs-sound-btn[data-compact]){padding:6px;min-width:40px;justify-content:center}"
    + ":where(.ccs-sound-btn[aria-pressed=false]){opacity:.85}";
  (document.head || document.documentElement).appendChild(css);

  window.CCSSound = { play: play, isOn: function(){ return on; }, setOn: setOn, button: button, names: Object.keys(SOUNDS) };
})();
