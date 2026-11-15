import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const pageUrl = new URL("../assets/apps/sound-space.html", import.meta.url);
const html = existsSync(pageUrl) ? readFileSync(pageUrl, "utf8") : "";

const LOGO = /studio\/sound-space-icon\.svg/;

function section(startRe, endTag) {
  const m = startRe.exec(html);
  if (!m) return "";
  const end = html.indexOf(endTag, m.index);
  return html.slice(m.index, end < 0 ? undefined : end);
}

function cssText() {
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const inline = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
  return blocks.concat(inline).join("\n");
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function hsl([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = 60 * (((G - B) / d) % 6);
  else if (max === G) h = 60 * ((B - R) / d + 2);
  else h = 60 * ((R - G) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

// Pre-flight ruling: the orange band is hue 15-40 degrees, so the approved
// gold #F2C14E (~42 degrees) and the site yellow #FFD23F pass.
const TEAL_FAMILY = ["#14B8A6", "#5EE6D8", "#0B8378", "#075E57", "#05312D"];
function badColor(rgb) {
  const { h, s } = hsl(rgb);
  if (h >= 15 && h <= 40 && s > 0.5) return "orange";
  if (h >= 75 && h <= 160 && s > 0.4) return "green";
  return null;
}

describe("Sound Space app page", () => {
  it("exists", () => {
    expect(html.length).toBeGreaterThan(1000);
  });

  it("uses the Sound Space logo everywhere Art Space shows its own", () => {
    expect(html).toMatch(/<link rel="icon" href="[^"]*studio\/sound-space-icon\.svg"/);
    const marks = [...html.matchAll(/<span class="appmark(?: [^"]*)?"[^>]*>\s*<img[^>]*src="([^"]*)"/g)];
    expect(marks.length).toBeGreaterThanOrEqual(2);
    marks.forEach((m) => expect(m[1]).toMatch(LOGO));
    expect(html).toMatch(/class="splash__brand">\s*<img[^>]*src="[^"]*studio\/sound-space-icon\.svg"/);
    expect(html).toMatch(/class="signin__bar"><b><img[^>]*src="[^"]*studio\/sound-space-icon\.svg"/);
    expect(html).not.toMatch(/art-studio-icon\.svg/);
  });

  it("shows Home with exactly Empty song, Hip hop/pop starter and Music lessons, and no other starters", () => {
    const home = section(/<main id="home"/, "</main>");
    expect(home.length).toBeGreaterThan(0);
    for (const label of ["Empty song", "Hip hop/pop starter", "Music lessons", "Recent", "Open a file"]) {
      expect(home).toContain(label);
    }
    expect([...home.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1])).toEqual(["Empty song", "Hip hop/pop starter", "Music lessons"]);
    expect([...home.matchAll(/data-start="([^"]+)"/g)].map((m) => m[1])).toEqual(["empty", "hiphop-pop", "lessons"]);
    for (const gone of ["Lullaby starter", "March starter", "Space starter"]) expect(html).not.toContain(gone);
    expect(html).not.toMatch(/data-pv="lullaby"|lullaby:/);
  });

  it("pictures Music lessons as a lesson in progress: the tip card over a tune, drawn from the real lesson 2", () => {
    expect(html).toContain("lessons: lessonPreview()");
    const fn = html.split("function lessonPreview(")[1].split("\nfunction ")[0];
    expect(fn).toContain("SS.lessons.LESSONS[1]");                 // the title, word and step count come from the lesson itself
    expect(fn).toContain('"STEP 2 OF " + ');
    expect(fn).toContain("CAT.strings.color");                    // the lessons' purple
    expect(fn).not.toMatch(/orange|green/i);
    expect(html).not.toContain('<path d="M54 22L94 14"');          // the old beamed-notes picture is gone
  });

  it("has every control the design names", () => {
    const ids = [
      "ss-add-track", "ss-play", "ss-record", "ss-stop", "ss-loop", "ss-counts", "ss-tempo", "ss-countin",
      "ss-tracks", "ss-overview", "ss-grid", "ss-keys", "ss-pads", "ss-library", "ss-export",
    ];
    for (const id of ids) {
      const n = [...html.matchAll(new RegExp(`id="${id}"`, "g"))].length;
      expect(n, id).toBe(1);
    }
    const counts = section(/id="ss-counts"/, "</div>");
    const values = [...counts.matchAll(/data-counts="(\d+)"/g)].map((m) => Number(m[1]));
    expect(values).toEqual([4, 8, 16]);
    const tempo = section(/id="ss-tempo"/, ">");
    expect(tempo).toMatch(/min="60"/);
    expect(tempo).toMatch(/max="160"/);
    expect(tempo).toMatch(/value="100"/);
    expect(html).toMatch(/id="title-in"[^>]*maxlength="60"/);
  });

  it("has the Grid control and the five note symbols, each named with its beats", () => {
    expect(html.match(/id="ss-grid-res"/g) || []).toHaveLength(1);
    expect(html.match(/id="ss-note-len"/g) || []).toHaveLength(1);
    const res = section(/id="ss-grid-res"/, "</div>");
    expect([...res.matchAll(/data-grid="(\d)"/g)].map((m) => Number(m[1]))).toEqual([2, 4]);
    expect(res).toMatch(/Eighths/);
    expect(res).toMatch(/Sixteenths/);
    const picker = section(/id="ss-note-len"/, "</div>");
    expect([...picker.matchAll(/data-note="(\w+)"/g)].map((m) => m[1])).toEqual(["whole", "half", "quarter", "eighth", "sixteenth"]);
    for (const l of ["Whole note, 4 beats", "Half note, 2 beats", "Quarter note, 1 beat", "Eighth note, 1/2 beat", "Sixteenth note, 1/4 beat"]) {
      expect(picker).toContain(`aria-label="${l}"`);
    }
    expect(picker).toMatch(/<svg/);
  });

  it("recording uses the song clock for a soft click, and Help says so", () => {
    expect(html).toMatch(/player\.start\(song, \{ fromStep:0, click:true \}\)/);
    expect(html).toMatch(/soft click on every beat/);
  });

  it("going back to eighths drops a sixteenth pick", () => {
    const fn = section(/function setGridTo\(/, "}\nfunction");
    expect(fn).toMatch(/noteSquares\(pickedNote, g\) === null\) pickedNote = "eighth"/);
  });

  it("recording lengths use recordedLength, not rounding", () => {
    const fn = section(/function recordUp\(/, "function onStep");
    expect(fn).toContain("M.recordedLength(");
    expect(fn).not.toContain("Math.round");
  });

  it("the note-length picker is for pitched and drum tracks, not effects", () => {
    expect(html).toContain('if (kind === "pitched" || kind === "kit"){ $("#edhead").insertBefore(nl');
    const fn = section(/function toggleAt\(/, "function lengthen");
    expect(fn).toMatch(/kindOf\(t\) !== "fx"/);
    expect(fn).not.toMatch(/kindOf\(t\) === "pitched"\)\{\s*const want/);
    const len = section(/function lengthen\(/, "const gridEl");
    expect(len).not.toContain("drum) return");
    expect(len).toContain("rows[r].fx");
    expect(html).not.toMatch(/row\.drum \? "" : '<i class="grip">/);
  });

  it("live notes start at once, on a compressor-free bus, and Help words the drum lengths plainly", () => {
    const audio = section(/function audio\(/, "/* touch screens");
    expect(audio).not.toContain("createDynamicsCompressor");
    expect(audio).toContain("E.createLiveBus(ctx)");
    const on = section(/function noteOn\(/, "function noteOff");
    expect(on).toContain("voices.play(ev, c.currentTime, g)");
    expect(on).not.toContain("0.005");
    expect(html).toContain("On drums, a longer hit just draws a longer bar. The drum sounds the same.");
    expect(html).not.toContain("how long until the next beat");
  });

  it("loads the built modules", () => {
    for (const f of ["model.js", "engine.js", "wav.js", "instruments.js"]) {
      expect(html).toContain(`<script src="sound-space/${f}"></script>`);
    }
  });

  it("uses only the approved colors", () => {
    const css = cssText();
    const found = [];
    for (const m of css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) found.push(m[0]);
    // Colors written in the script (for example pad lighting) count too.
    for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) found.push(m[0]);
    const rgbs = [...html.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)].map((m) => [+m[1], +m[2], +m[3]]);
    expect(found.length).toBeGreaterThan(20);
    const bad = [];
    for (const hex of found) {
      if (TEAL_FAMILY.includes(hex.toUpperCase())) continue;
      const why = badColor(hexToRgb(hex));
      if (why) bad.push(`${hex} (${why})`);
    }
    for (const rgb of rgbs) {
      const why = badColor(rgb);
      if (why) bad.push(`rgb(${rgb.join(",")}) (${why})`);
    }
    expect(bad).toEqual([]);
    // The category colors are exactly the approved ones.
    for (const c of ["#D946EF", "#5B8CFF", "#8B5CF6", "#F2C14E", "#14B8A6", "#FF5C8A", "#FF4D5A"]) {
      expect(css.toUpperCase()).toContain(c);
    }
  });

  it("has no emojis", () => {
    expect(html.length).toBeGreaterThan(0);
    const hits = html.match(/\p{Extended_Pictographic}/gu) || [];
    expect(hits).toEqual([]);
  });

  it("plays the piano keys from the computer keys the design names", () => {
    for (const code of ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"]) {
      expect(html).toContain(`"${code}"`);
    }
    for (const code of ["KeyW", "KeyE", "KeyT", "KeyY", "KeyU", "KeyO", "KeyP"]) {
      expect(html).toContain(`"${code}"`);
    }
  });

  it("fills the whole window on every screen", () => {
    const css = cssText();
    expect(css).toMatch(/#home, #editor\{[^}]*width:100vw;[^}]*height:100dvh;/);
    expect(css).toMatch(/\.launch\{[^}]*width:100vw;[^}]*height:100dvh;/);
    // Home's content sits in Art Space's centered column (owner); the editor stays edge to edge
    expect(css).toMatch(/\.home__inner\{ max-width:1080px; margin:0 auto; \}/);
    expect(css).toMatch(/\.starts\{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\); gap:14px; \}/);
    expect(css).toMatch(/\.gallery\{ display:grid; grid-template-columns:repeat\(auto-fill,minmax\(180px,1fr\)\); gap:14px; \}/);
  });

  it("the loading card and Sign in follow Art Space's design, with a real Sound Space picture", () => {
    const art = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
    const launchOf = (src) => src.slice(src.indexOf('<div id="launch" class="launch">'), src.indexOf("</div>\n\n", src.indexOf('<div id="launch" class="launch">')));
    const classes = (src) => new Set([...launchOf(src).matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
    const ours = classes(html);
    for (const c of classes(art)) expect(ours.has(c), c).toBe(true);
    expect(existsSync(new URL("../assets/studio/sound-space-splash.jpg", import.meta.url))).toBe(true);
    const css = cssText();
    expect(css).toMatch(/\.splash__left::before\{[^}]*studio\/sound-space-splash\.jpg/);
    expect(css).toMatch(/\.splash__art\{[^}]*studio\/sound-space-splash\.jpg/);
    expect(html).toContain("<b>Song: My Space Beat, made in Sound Space</b>");
    expect(html).toMatch(/class="signin__bg"><img src="[^"]*studio\/sound-space-splash\.jpg"/);
    // the dimmed layer still fills the whole window
    expect(css).toMatch(/\.launch\{[^}]*height:100dvh;[^}]*place-items:center/);
  });

  it("Home follows Art Space's Home: pixel field, account space, New, tiles, Recent cards", () => {
    const home = section(/<main id="home"/, "</main>");
    expect(home).toContain('<div id="home-fx" class="home__fx" aria-hidden="true"></div>');
    expect(home).toContain('<div id="space" class="space" role="status" aria-live="polite" hidden></div>');
    expect(home).toMatch(/<h1 id="home-title">New<\/h1>\s*<p class="home__lede" id="home-lede">/);
    expect(home).toMatch(/<h2>Recent <button type="button" class="btn" data-act="open-file">/);
    expect(html).toContain('<script src="../lib/pixelblast.js"></script>');
    for (const c of ["art__open", "art__body", "art__name", "art__when"]) expect(html).toContain(`class="${c}"`);
    expect(html).toContain('<p class="empty">');
  });

  describe("page helpers", () => {
    const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
    const { scheduleCountIn, setTrackInstrument, sizeText, fileSize, loadLayout, saveLayout, LAYOUT_KEY, statusFor, lessonPanel } = new Function(block.slice(block.indexOf("*/") + 2) + "; return { scheduleCountIn, setTrackInstrument, sizeText, fileSize, loadLayout, saveLayout, LAYOUT_KEY, statusFor, lessonPanel };")();

    function fakeAudio() {
      const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
      const ac = {
        currentTime: 1,
        oscs: [],
        createOscillator() {
          const o = { type: "", frequency: { value: 0 }, stops: [], connected: true, connect() {}, disconnect() { this.connected = false; }, start(t) { this.startAt = t; }, stop(t) { this.stops.push(t); } };
          ac.oscs.push(o);
          return o;
        },
        createGain() { return { gain: param(), connected: true, connect() {}, disconnect() { this.connected = false; } }; },
      };
      return ac;
    }

    it("knows which hideable part of the editor holds each lesson target", () => {
      const span = (re, endTag) => { const m = re.exec(html); return [m.index, html.indexOf(endTag, m.index)]; };
      const parts = {
        tracks: span(/<aside class="panel left" id="ss-tracks"/, "</aside>"),
        library: span(/<aside class="panel right" id="ss-library"/, "</aside>"),
        keys: span(/<div class="kbd" id="kbd">/, "</section>"),
      };
      const SS = loadSS("model.js", "instruments.js", "icons.js", "library.js", "lessons.js");
      const targets = [...new Set(SS.lessons.LESSONS.flatMap((l) => l.steps.map((s) => s.target)))];
      for (const t of targets) {
        const at = html.indexOf(`id="${t.slice(1)}"`);
        const inside = Object.keys(parts).find((k) => at >= parts[k][0] && at < parts[k][1]) || null;
        expect(lessonPanel(t), t).toBe(inside);
      }
      expect(lessonPanel("#ss-tracks")).toBe("tracks");
      expect(lessonPanel("#ss-library")).toBe("library");
      expect(lessonPanel("#ss-pads")).toBe("keys");
      expect(lessonPanel("#ss-play")).toBe(null);
    });

    it("shows a song's size the way Art Space does", () => {
      expect(sizeText(999)).toBe("1 KB");
      expect(sizeText(48_200)).toBe("48 KB");
      expect(sizeText(1_250_000)).toBe("1.3 MB");
      expect(sizeText(0)).toBe("");
      expect(fileSize({ title: "x".repeat(2400) })).toBe("2 KB");
      expect(html).toMatch(/\[when\(s\.updatedMs\), fileSize\(s\)\]\.filter\(Boolean\)\.join\(" · "\)/);
    });

    it("remembers the editor layout through the storage helper, and copes when storage is blocked", () => {
      const all = { tracks: true, library: true, overview: true, keys: true, focus: null };
      const mem = new Map();
      const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
      expect(LAYOUT_KEY).toBe("ss-layout");
      expect(loadLayout(storage)).toEqual(all);
      const focused = { tracks: false, library: false, overview: false, keys: true, focus: { tracks: true, library: false, overview: true } };
      expect(saveLayout(storage, focused)).toBe(true);
      expect(loadLayout(storage)).toEqual(focused);
      const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } };
      expect(loadLayout(blocked)).toEqual(all);
      expect(saveLayout(blocked, focused)).toBe(false);
      expect(loadLayout(null)).toEqual(all);
      mem.set("ss-layout", "{not json");
      expect(loadLayout(storage)).toEqual(all);
      mem.set("ss-layout", JSON.stringify({ tracks: "no", keys: false }));
      expect(loadLayout(storage)).toEqual({ ...all, keys: false });
    });

    it("never claims a song is saved when this browser blocks saving", () => {
      expect(statusFor(true)).toEqual({ text: "Saved on this device", bad: false });
      expect(statusFor(false)).toEqual({ text: "Not saved: this browser blocked saving", bad: true });
      // the markup starts neutral, and every song that opens gets the honest status straight away
      expect(html).toContain('<small id="status" role="status"></small>');
      const open = html.slice(html.indexOf("function openSong("), html.indexOf("async function showHome("));
      expect(open).toMatch(/song = s;[^]*?freshStatus\(\);/);
      expect(html).toMatch(/function freshStatus\(\)\{ const st = statusFor\(dbOk\); setStatus\(st\.text, st\.bad\); \}/);
      // the "can't keep songs" toast shows once a session, not on every Home repaint
      expect(html).toMatch(/if \(!dbOk && !blockedToastShown\)\{ blockedToastShown = true; toast\(/);
    });

    it("Stop during the count-in silences the clicks still to come", () => {
      const ac = fakeAudio();
      const c = scheduleCountIn(ac, {}, 60, 1.1);
      expect(ac.oscs.map((o) => o.startAt)).toEqual([1.1, 2.1, 3.1, 4.1]);
      ac.currentTime = 1.5;
      c.cancel();
      for (const o of ac.oscs) {
        expect(Math.min(...o.stops)).toBeLessThanOrEqual(1.5);
        expect(o.connected).toBe(false);
      }
    });

    it("changing to an instrument that plays a different way forgets the notes Counts was hiding", async () => {
      const { loadSS } = await import("./helpers/soundSpace.js");
      const SS = loadSS("model.js", "engine.js", "instruments.js");
      const M = SS.model, byId = SS.instruments.byId;
      let song = M.newSong();
      const t = M.addTrack(song, "grand-piano");
      [0, 9, 12, 15].forEach((step) => M.toggleNote(t, step, 60 + step));
      let r = M.resizeSong(song, 4, {});
      song = r.song;
      let stash = r.stash;
      const track = song.tracks[0];
      expect(stash[track.id].length).toBe(3);
      expect(setTrackInstrument(stash, track, "hip-hop-kit", byId)).toEqual({ cleared: true });
      expect(stash[track.id]).toBeUndefined();
      r = M.resizeSong(song, 8, stash);
      expect(r.song.tracks[0].notes).toEqual([]);

      // with no visible notes left, the hidden ones are still forgotten
      let s2 = M.newSong();
      const t2 = M.addTrack(s2, "drum-machine");
      M.toggleNote(t2, 12, 0);
      r = M.resizeSong(s2, 4, {});
      s2 = r.song;
      expect(s2.tracks[0].notes).toEqual([]);
      expect(setTrackInstrument(r.stash, s2.tracks[0], "violin", byId)).toEqual({ cleared: false });
      expect(r.stash[s2.tracks[0].id]).toBeUndefined();

      // the same kind of instrument keeps its notes and what Counts is keeping
      let s3 = M.newSong();
      const t3 = M.addTrack(s3, "grand-piano");
      M.toggleNote(t3, 0, 60); M.toggleNote(t3, 12, 64);
      r = M.resizeSong(s3, 4, {});
      expect(setTrackInstrument(r.stash, r.song.tracks[0], "synth-lead", byId)).toEqual({ cleared: false });
      expect(r.song.tracks[0].notes.length).toBe(1);
      expect(r.stash[r.song.tracks[0].id].length).toBe(1);
    });
  });

  it("a lesson step shows the hidden panel that holds its control", () => {
    const fn = section(/function revealLessonTarget\(/, "\nfunction ");
    expect(fn).toContain("lessonPanel(");
    expect(fn).toContain("setLayout({ tracks:true })");
    expect(fn).toContain("setLayout({ library:true })");
    expect(fn).toContain("setLayout({ keys:true })");
    expect(fn).toMatch(/narrowLib\.matches[\s\S]*classList\.add\("lib-open"\)/);
    expect(section(/function startLesson\(/, "\nfunction ")).toContain("revealLessonTarget(");
    expect(section(/function nextLessonStep\(/, "\nfunction ")).toContain("revealLessonTarget(");
  });

  it("phones keep each track's M and S buttons, which lesson 3 uses", () => {
    const phone = html.slice(html.indexOf("@media (max-width:640px)"), html.indexOf("@media (prefers-reduced-motion:reduce)", html.indexOf("@media (max-width:640px)")));
    expect(phone).toContain(".track__vol{ display:none; }");
    expect(phone).not.toMatch(/\.msb[^{]*\{[^}]*display:none/);
    expect(phone).not.toMatch(/\.ms\{[^}]*display:none/);
  });

  it("Play counts for a lesson even when the song is already playing", () => {
    const fn = section(/function play\(/, "\nfunction ");
    expect(fn).not.toContain('lessonEvent("play")');   // the lesson checks ui.playing instead, one rule for every Play step
    expect(html).toContain("playing:!!(player && player.playing)");
  });

  it("has labelled toggles to show, hide and fold parts of the editor", () => {
    const btn = (id) => (html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`)) || [""])[0];
    for (const [id, act, label] of [["tg-tracks", "toggle-tracks", "Tracks panel"], ["tg-lib", "toggle-lib", "Beats and patterns panel"], ["tg-focus", "focus", "Focus"]]) {
      const b = btn(id);
      expect(b, id).toContain(`data-act="${act}"`);
      expect(b).toMatch(/aria-pressed="(true|false)"/);
      expect(b).toContain(`aria-label="${label}"`);
      expect(b).toMatch(/title="[^"]+"/);
    }
    for (const [id, act, ctl] of [["ov-toggle", "toggle-overview", "ss-overview"], ["kbd-toggle", "toggle-keys", "kbd"]]) {
      const b = btn(id);
      expect(b, id).toContain(`data-act="${act}"`);
      expect(b).toContain('aria-expanded="true"');
      expect(b).toContain(`aria-controls="${ctl}"`);
    }
    // each side panel has its own hide button in its header
    expect(html).toMatch(/<div class="panel__head"><h3>Tracks<\/h3><button[^>]*data-act="toggle-tracks"[^>]*aria-label="Hide tracks"/);
    expect(html).toMatch(/<h3>Beats and patterns<\/h3><button[^>]*data-act="toggle-lib"[^>]*aria-label="Hide beats and patterns"/);
    // hiding a panel from its own header hands keyboard focus to the app bar toggle
    expect(html).toContain('if (act === "toggle-tracks"){ const inside = !!b.closest(".panel"); toggleTracks(); if (inside) $("#tg-tracks").focus(); return; }');
    expect(html).toContain('if (act === "toggle-lib"){ const inside = !!b.closest(".panel"); toggleLib(); if (inside) $("#tg-lib").focus(); return; }');
    // the shortcuts are in help
    expect(html).toContain('"Show and hide parts"');
  });

  describe("reverb and sustain on each track's card", () => {
    const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
    let got = {};
    try { got = new Function(block.slice(block.indexOf("*/") + 2) + "; return { REVERB_NAMES, trackFxRows, setTrackReverb, toggleTrackSustain };")(); } catch (e) { /* each test below fails on its own */ }
    const { REVERB_NAMES, trackFxRows, setTrackReverb, toggleTrackSustain } = got;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
    const piano = () => ({ id: "t1", instrumentId: "grand-piano", volume: 0.8, mute: false, solo: false, notes: [], reverb: 0, sustain: false });
    const tag = (h, re) => (h.match(re) || [""])[0];

    it("a pitched track's card has the Reverb range and the Sustain button, as in the draft", () => {
      expect(REVERB_NAMES).toEqual(["Off", "Room", "Hall", "Big hall"]);
      const h = trackFxRows(piano(), "Keys", true, esc);
      const range = tag(h, /<input[^>]*type="range"[^>]*>/);
      for (const a of ['min="0"', 'max="3"', 'step="1"', 'value="0"', 'aria-label="Keys reverb"', 'aria-valuetext="Off"', 'data-id="t1"']) expect(range).toContain(a);
      expect(h).toContain(">Reverb<");
      expect(h).toMatch(/class="track__fxval"[^>]*>Off</);
      expect(h).toMatch(/<svg[^>]*>[\s\S]*?<path d="M2 6c3 0 3 2 6 2s3-2 6-2 3 2 6 2/);   // the draft's wave icon
      const btn = tag(h, /<button[^>]*data-act="sustain"[^>]*>[\s\S]*?<\/button>/);
      expect(btn).toContain('type="button"');
      expect(btn).toContain('aria-pressed="false"');
      expect(btn).toContain('class="track__led"');
      expect(btn).toMatch(/>Off<\/button>$/);
      expect(h).toContain(">Sustain<");
      expect(h).toContain("notes ring on");
    });

    it("a drum or effects track shows Reverb only", () => {
      const t = Object.assign(piano(), { instrumentId: "hip-hop-kit", sustain: true });
      const h = trackFxRows(t, "Drums", false, esc);
      expect(h).toContain('aria-label="Drums reverb"');
      expect(h).not.toContain("Sustain");
      expect(h).not.toContain('data-act="sustain"');
    });

    it("moving the range to 2 makes the track a Hall and says so", () => {
      const t = piano();
      expect(setTrackReverb(t, "2")).toBe("Hall");
      expect(t.reverb).toBe(2);
      const h = trackFxRows(t, "Keys", true, esc);
      expect(tag(h, /<input[^>]*type="range"[^>]*>/)).toContain('aria-valuetext="Hall"');
      expect(h).toMatch(/class="track__fxval"[^>]*>Hall</);
      expect(setTrackReverb(t, 9)).toBe("Big hall");
      expect(t.reverb).toBe(3);
      expect(setTrackReverb(t, -2)).toBe("Off");
      expect(t.reverb).toBe(0);
    });

    it("pressing Sustain turns it on and lights the button", () => {
      const t = piano();
      expect(toggleTrackSustain(t)).toBe(true);
      expect(t.sustain).toBe(true);
      const btn = tag(trackFxRows(t, "Keys", true, esc), /<button[^>]*data-act="sustain"[^>]*>[\s\S]*?<\/button>/);
      expect(btn).toContain('aria-pressed="true"');
      expect(btn).toMatch(/>On<\/button>$/);
      expect(toggleTrackSustain(t)).toBe(false);
    });

    it("the card uses them, and a change goes the way a volume change goes", () => {
      const rt = section(/function renderTracks\(/, "\nfunction ");
      expect(rt).toMatch(/trackFxRows\(t, label, kindOf\(t\) === "pitched", esc\)/);
      expect(rt.indexOf("trackFxRows(")).toBeGreaterThan(rt.indexOf("track__vol"));
      // input: the song and label change in place; change: one commit, like the volume slider
      expect(html).toMatch(/const r = e\.target\.closest\("\.trev"\);[^\n]*setTrackReverb\(/);
      expect(html).toContain('$("#track-list").addEventListener("change", e => { if (e.target.closest(".tvol, .trev")) commit(); });');
      expect(html).toMatch(/if \(act === "sustain"\)\{ const t = trackById\(id\); if \(!t\) return; toggleTrackSustain\(t\); commit\(\); renderTracks\(\); return; \}/);
    });

    it("phones hide the Reverb row with the volume, and keep Sustain", () => {
      const phone = html.slice(html.indexOf("@media (max-width:640px)"), html.indexOf("@media (prefers-reduced-motion:reduce)", html.indexOf("@media (max-width:640px)")));
      expect(phone).toContain(".track__vol{ display:none; }");
      expect(phone).toContain(".track__fx--reverb{ display:none; }");
      expect(phone).not.toMatch(/\.track__fx--sus\{[^}]*display:none/);
      expect(cssText()).toMatch(/\.track__led\{[^}]*\}/);
      expect(cssText()).toMatch(/\[aria-pressed="true"\] \.track__led\{[^}]*#14B8A6/);
    });

    it("live notes use the track's reverb and sustain without slowing the dry sound", () => {
      const audio = section(/function audio\(/, "/* touch screens");
      expect(audio).toContain("liveFx = E.createReverb(ctx, liveBus)");
      const on = section(/function noteOn\(/, "function noteOff");
      expect(on).toContain("g.connect(liveBus)");
      expect(on).toContain("const wet = liveFx.wet(track.reverb || 0); if (wet) g.connect(wet);");
      expect(on).toContain("sustain:!!track.sustain");
      const off = section(/function noteOff\(/, "function releaseAll");
      expect(off).toContain("E.SUSTAIN_TAIL");
    });

    it("Help names both controls in plain words", () => {
      expect(html).toContain("Reverb makes a track sound like it's played in a bigger room.");
      expect(html).toContain("Sustain lets notes ring on after they end, like a piano pedal.");
    });
  });

  it("closes through the site and never uses the microphone", () => {
    expect(html).toMatch(/postMessage\(\{\s*ccsStudio:\s*"close"\s*\}/);
    for (const api of ["getUserMedia", "getDisplayMedia", "MediaRecorder", "createMediaStreamSource", "SpeechRecognition"]) {
      expect(html).not.toContain(api);
    }
  });
});
