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
    expect(tempo).toMatch(/value="120"/);
    expect(html).toMatch(/id="title-in"[^>]*maxlength="60"/);
  });

  it("has no Grid choice and no note-length picker any more (owner, 2026-11-18: everything is on sixteenths)", () => {
    expect(html).not.toMatch(/id="ss-grid-res"/);
    expect(html).not.toMatch(/Switch to (Sixteenths|Eighths)/);
    expect(html).not.toMatch(/id="ss-note-len"/);
    expect(html).not.toMatch(/pickedNote/);
    expect(html).not.toMatch(/\.notelen/);
  });

  it("recording uses the song clock for a soft click, and Help says so", () => {
    expect(html).toMatch(/player\.start\(song, \{ fromStep:range\.from, click:true, range \}\)/);
    // recording stays inside the loop (owner, 2026-11-18): it starts at the loop and goes round it
    expect(html).toMatch(/const range = M\.loopSteps\(song\);/);
    expect(html).toMatch(/soft click on every beat/);
  });

  it("every song opens on sixteenths: a song saved on eighths is moved over when it opens, with nothing lost", () => {
    const open = section(/function openSong\(/, "async function showHome");
    expect(open).toMatch(/if \(\(s\.grid \|\| M\.CONST\.STEPS_PER_COUNT\) !== 4\) s = M\.setGrid\(s, 4\)\.song;/);
    const M = loadSS("model.js").model;
    const old = M.newSong(); delete old.grid; old.counts = 4;
    old.tracks = [{ id: "t1", notes: [{ step: 1, pitch: 60, len: 2, vel: 0.9 }, { step: 6, pitch: 62, len: 1, vel: 0.9 }] }];
    const r = M.setGrid(old, 4);
    expect(r.song.grid).toBe(4);
    expect(r.song.tracks[0].notes.map((n) => [n.step, n.len])).toEqual([[2, 4], [12, 2]]);
  });

  it("nothing asks to switch grids, and a pattern never needs a switch", () => {
    expect(html).not.toMatch(/function pickNote\(/);
    expect(html).not.toMatch(/function setGridTo\(/);
    const use = section(/async function usePattern\(/, "\n}\n");
    expect(use).not.toMatch(/setGrid/);
  });

  it("a new song shows Count-in on and Speed 120", () => {
    const m = loadSS("model.js").model.newSong();
    expect(m.countIn).toBe(true);
    expect(m.tempo).toBe(120);
    expect(html).toMatch(/aria-pressed", String\(!!song\.countIn\)\)/);
    expect(html).toMatch(/\$\("#ss-tempo"\)\.value = song\.tempo/);
  });

  it("Help says a count has 4 squares on the starting grid", () => {
    expect(html).not.toMatch(/Each count has 2 squares\./);
    expect(html).toMatch(/Each count has 4 squares/);
  });

  it("recording lengths use recordedLength, not rounding", () => {
    const fn = section(/function recordUp\(/, "function onStep");
    expect(fn).toContain("M.recordedLength(");
    expect(fn).not.toContain("Math.round");
  });

  it("a tap adds a sixteenth on pitched and drum tracks, and effects keep their own length", () => {
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
    for (const c of ["#D946EF", "#5B8CFF", "#8B5CF6", "#F2C14E", "#14B8A6", "#FF5C8A", "#8E2457"]) {
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
      expect(statusFor(false)).toEqual({ text: "Not saved: use Export, then Save project file", bad: true });
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
      let song = M.newSong(); song.grid = 2;
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
      let s2 = M.newSong(); s2.grid = 2;
      const t2 = M.addTrack(s2, "drum-machine");
      M.toggleNote(t2, 12, 0);
      r = M.resizeSong(s2, 4, {});
      s2 = r.song;
      expect(s2.tracks[0].notes).toEqual([]);
      expect(setTrackInstrument(r.stash, s2.tracks[0], "violin", byId)).toEqual({ cleared: false });
      expect(r.stash[s2.tracks[0].id]).toBeUndefined();

      // the same kind of instrument keeps its notes and what Counts is keeping
      let s3 = M.newSong(); s3.grid = 2;
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
    expect(html).toMatch(/<div class="panel__head"><h3>Tracks<\/h3>[^\n]*?<button[^>]*data-act="toggle-tracks"[^>]*aria-label="Hide tracks"/);
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
      expect(REVERB_NAMES).toEqual(["Off", "Room", "Hall", "Big hall", "Stadium"]);
      const h = trackFxRows(piano(), "Keys", true, esc);
      const range = tag(h, /<input[^>]*type="range"[^>]*>/);
      for (const a of ['min="0"', 'max="4"', 'step="1"', 'value="0"', 'aria-label="Keys reverb"', 'aria-valuetext="Off"', 'data-id="t1"']) expect(range).toContain(a);
      expect(h).toContain(">Reverb<");
      expect(h).toMatch(/<option value="0" selected>Off<\/option>/);
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
      expect(h).toMatch(/<option value="2" selected>Hall<\/option>/);
      expect(setTrackReverb(t, 9)).toBe("Stadium");
      expect(t.reverb).toBe(4);
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
      expect(rt).toMatch(/pitched:kindOf\(t\) === "pitched"/);
      const card = section(/function trackCard\(/, "\nfunction ");
      expect(card).toMatch(/trackFxRows\(t, o\.label, o\.pitched, esc\)/);
      expect(card.indexOf("trackFxRows(")).toBeGreaterThan(card.indexOf("trackVolRow("));
      // input: the song and label change in place; change: one commit, like the volume slider
      expect(html).toMatch(/const r = e\.target\.closest\("\.trev"\);[^\n]*setTrackReverb\(/);
      expect(html).toContain('$("#track-list").addEventListener("change", e => {\n  if (e.target.closest(".tvol, .trev")) return commit();');
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
      expect(on).toContain("const wet = liveFx.wet(track.reverb || 0);");
      expect(on).toContain("if (wet) g.connect(wet);");
      expect(on).toContain("sustain:!!track.sustain");
      const off = section(/function noteOff\(/, "function releaseAll");
      expect(off).toContain("E.SUSTAIN_TAIL");
      expect(off).toContain("E.SUSTAIN_TAIL / 7");
    });

    it("Help names both controls in plain words", () => {
      expect(html).toContain("Reverb makes a track sound like it's played in a bigger room.");
      expect(html).toContain("Sustain lets notes ring on after they end, like a piano pedal.");
      expect(html).toContain("Pick Off, Room, Hall, Big hall or Stadium.");
    });
  });

  /* Owner: the track volume as a number box (0-100%), the reverb size as a list, cards that open only when selected,
     and mixer-board faders (docs/mockups/sound-space-volume-readout-draft.html, sound-space-track-expand-draft.html). */
  describe("track cards: volume and reverb boxes, opening when selected, mixer faders", () => {
    const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
    let got = {};
    try { got = new Function(block.slice(block.indexOf("*/") + 2) + "; return { REVERB_NAMES, trackFxRows, setTrackReverb, volPercent, parseVolText, applyVolText, volBoxKey, trackVolRow, trackCard, expandStep };")(); } catch (e) { /* each test below fails on its own */ }
    const { setTrackReverb, volPercent, parseVolText, applyVolText, volBoxKey, trackVolRow, trackFxRows, trackCard, expandStep } = got;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
    const piano = (o) => Object.assign({ id: "t1", instrumentId: "grand-piano", volume: 0.8, mute: false, solo: false, notes: [], reverb: 3, sustain: false }, o);
    const tag = (h, re) => (h.match(re) || [""])[0];
    const card = (t, o) => trackCard(t, Object.assign({ label: "Keys", instName: "Grand piano", icon: '<span class="tile"></span>', sel: false, open: false, muted: false, pitched: true, note: "" }, o), esc);
    const css = cssText();
    const rule = (sel) => { const i = css.indexOf(sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i) + 1); };

    it("the volume line says Volume and has a number box with the track's volume times 100", () => {
      const h = trackVolRow(piano(), "Keys", esc);
      expect(h).toContain('class="track__fx track__vol"');
      expect(h).toContain('<span class="track__fxlab">Volume</span>');
      const num = tag(h, /<input[^>]*type="number"[^>]*>/);
      for (const a of ['class="tnum"', 'data-id="t1"', 'min="0"', 'max="100"', 'step="1"', 'inputmode="numeric"', 'aria-label="Keys volume, percent"', 'value="80"']) expect(num).toContain(a);
      expect(h).toMatch(/<span class="track__unit" aria-hidden="true">%<\/span>/);
      const range = tag(h, /<input[^>]*type="range"[^>]*>/);
      for (const a of ['class="slider slider--sm tvol"', 'min="0"', 'max="100"', 'value="80"', 'aria-label="Keys volume"']) expect(range).toContain(a);
      expect(trackVolRow(piano({ volume: 0.3 }), "Keys", esc)).toContain('value="30"');   // after an undo, the box shows the undone value
      expect(volPercent(0.655)).toBe(66);
    });

    it("typing 65 and Enter sets the volume to 0.65; 150 clamps to 100, -5 to 0; nonsense keeps the old value", () => {
      const t = piano();
      expect(applyVolText(t, "65")).toEqual({ value: 65, changed: true });
      expect(t.volume).toBe(0.65);
      expect(applyVolText(t, "65")).toEqual({ value: 65, changed: false });   // the same value again is no new undo step
      expect(applyVolText(t, "150").value).toBe(100);
      expect(t.volume).toBe(1);
      expect(applyVolText(t, "-5").value).toBe(0);
      expect(t.volume).toBe(0);
      expect(parseVolText("", 42)).toBe(42);
      expect(parseVolText("abc", 42)).toBe(42);
      expect(parseVolText("33.6", 42)).toBe(34);
      expect(volBoxKey("Enter", false, "65", 80)).toEqual({ set: 65, blur: true });
    });

    it("Escape restores the value from before typing; the arrows step by 1, or 10 with Shift", () => {
      expect(volBoxKey("Escape", false, "42", 80)).toEqual({ show: 80, blur: true });
      expect(volBoxKey("ArrowUp", false, "80", 80)).toEqual({ set: 81 });
      expect(volBoxKey("ArrowDown", true, "80", 80)).toEqual({ set: 70 });
      expect(volBoxKey("ArrowUp", true, "95", 95)).toEqual({ set: 100 });
      expect(volBoxKey("ArrowDown", false, "0", 0)).toEqual({ set: 0 });
      expect(volBoxKey("a", false, "80", 80)).toBe(null);
    });

    it("the box and the slider stay in step, through the same commit as a slider change", () => {
      // dragging: the input event on the range writes the number live
      expect(html).toMatch(/const s = e\.target\.closest\("\.tvol"\);[^\n]*\n[^\n]*t\.volume = clamp\(\+s\.value \/ 100, 0, 1\);[^\n]*\.tnum[^\n]*\.value = s\.value/);
      const typed = section(/function typedVolume\(/, "\nfunction ");
      expect(typed).toContain("applyVolText(t, text)");
      expect(typed).toMatch(/\.tvol"\);\s*if \(r\) r\.value = String\(res\.value\)/);
      expect(typed).toContain("if (res.changed) commit();");
      expect(html).toMatch(/const n = e\.target\.closest\("\.tnum"\); if \(n\) return typedVolume\(n, n\.value\);/);
      expect(html).toMatch(/\$\("#track-list"\)\.addEventListener\("keydown", e => \{[\s\S]*?volBoxKey\(e\.key, e\.shiftKey, n\.value, volPercent\(t\.volume\)\)/);
      expect(css).toMatch(/\.track__box input::-webkit-inner-spin-button, \.track__box input::-webkit-outer-spin-button\{ -webkit-appearance:none; margin:0; \}/);
      expect(rule(".track__box:focus-within")).toContain("#5B8CFF");
      expect(rule(".track__box")).toMatch(/height:28px/);
      expect(rule(".track__box")).toMatch(/border-radius:6px/);
      expect(rule(".track__box")).toMatch(/font-variant-numeric:tabular-nums/);
      expect(css).toMatch(/:root\{[\s\S]*?--box:/);
      expect(css).toMatch(/:root\[data-theme="dark"\]\{[^}]*--box:#26262C/);
    });

    it("the reverb box is a list of the five sizes, and picking one goes the slider's way", () => {
      const h = trackFxRows(piano(), "Keys", true, esc);
      const sel = tag(h, /<select[\s\S]*?<\/select>/);
      expect(sel).toContain('class="tpick"');
      expect(sel).toContain('aria-label="Keys reverb size"');
      expect([...sel.matchAll(/<option value="(\d)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]])).toEqual([["0", "Off"], ["1", "Room"], ["2", "Hall"], ["3", "Big hall"], ["4", "Stadium"]]);
      expect(sel).toContain('<option value="3" selected>Big hall</option>');
      const t = piano();
      expect(setTrackReverb(t, "2")).toBe("Hall");
      expect(t.reverb).toBe(2);
      expect(setTrackReverb(t, "4")).toBe("Stadium");
      expect(t.reverb).toBe(4);
      expect(trackFxRows(t, "Keys", true, esc)).toContain('<option value="4" selected>Stadium</option>');   // after undo, the render shows the level
      expect(html).toMatch(/const p = e\.target\.closest\("\.tpick"\); if \(p\)\{[^\n]*setTrackReverb\(t, p\.value\)[^\n]*\.trev[^\n]*commit\(\);/);
      expect(html).toMatch(/const r = e\.target\.closest\("\.trev"\);[^\n]*\.tpick[^\n]*\.value = String\(t\.reverb\)/);
      // the native arrow is hidden; the chevron sits 8px from the right edge, like the library's style list
      expect(css).toMatch(/\.track__pick select\{[^}]*appearance:none[^}]*background:var\(--chev\) right 8px center \/ 12px no-repeat/);
      expect(rule(".track__box")).toMatch(/width:var\(--boxw\)/);
    });

    it("only the selected card's lines are open; a closed card's lines are inert and its head says so", () => {
      const open = card(piano(), { sel: true, open: true });
      expect(open).toMatch(/^<div class="track sel open"/);
      expect(open).toContain('data-id="t1"');
      expect(tag(open, /<button[^>]*class="track__main"[^>]*>/)).toContain('aria-expanded="true"');
      expect(tag(open, /<div class="track__more"[^>]*>/)).not.toContain("inert");
      expect(open).toContain('aria-controls="tmore-t1"');
      expect(open).toContain('id="tmore-t1"');
      const closed = card(piano(), {});
      expect(closed).toMatch(/^<div class="track"/);
      expect(tag(closed, /<button[^>]*class="track__main"[^>]*>/)).toContain('aria-expanded="false"');
      expect(tag(closed, /<div class="track__more"[^>]*>/)).toContain(" inert");
      expect(closed).toContain('<span class="track__chev" aria-hidden="true">');
      // the head selects (M and S sit in it but are their own buttons), and the card is never built mid-animation
      expect(closed).toMatch(/<div class="track__head" data-head="t1">/);
      expect(open + closed).not.toContain("animating");
      expect(card(piano(), { note: '<div class="track__note">x</div>' })).toMatch(/<\/div><\/div><\/div><div class="track__note">x<\/div><\/div>$/);   // a sound note shows even when closed
    });

    it("selecting another card moves the open state; a re-render keeps the open card and never replays the animation", () => {
      const ids = ["a", "b", "c"];
      expect(expandStep("a", "b", ids, true)).toEqual({ build: "a", then: "b" });   // built as it was, then b opens while a closes
      expect(expandStep("b", "b", ids, true)).toEqual({ build: "b", then: null });  // a re-render: no animation
      expect(expandStep(null, "a", ids, true)).toEqual({ build: "a", then: null }); // the first build
      expect(expandStep("x", "a", ids, true)).toEqual({ build: "a", then: null });  // the old card was removed
      expect(expandStep("a", "b", ids, false)).toEqual({ build: "b", then: null }); // phones and reduced motion: at once
      const rt = section(/function renderTracks\(/, "\nfunction ");
      expect(rt).toMatch(/const plan = expandStep\(openTrack, sel, song\.tracks\.map\(t => t\.id\), motionOk\(\)\);/);
      expect(rt).toMatch(/open:t\.id === plan\.build/);
      expect(rt).toContain("openTrack = sel;");
      expect(rt).toContain("if (plan.then) animateOpen(plan.build, plan.then);");
      const an = section(/function animateOpen\(/, "\nfunction ");
      expect(an).toContain("void list.offsetHeight;");
      expect(an).toContain('classList.add("animating")');
      const co = section(/function cardOpen\(/, "\nfunction ");
      expect(co).toMatch(/toggleAttribute\("inert", !open\)/);
      expect(co).toMatch(/setAttribute\("aria-expanded", String\(open\)\)/);
    });

    /* Fix round 1: after Enter or Space on a card's head button the list is rebuilt, and keepFocus must find that
       same button again. querySelector returns the first match in document order, so the key must never match the
       head div (not focusable) before the button. This runs keepFocus's key on the real card markup and finds the
       first match in document order the way querySelector does. */
    it("keyboard selection: focus comes back to the selected track's head button after the rebuild", () => {
      const { focusKeyOf } = (() => { try { return new Function(block.slice(block.indexOf("*/") + 2) + "; return { focusKeyOf };")(); } catch (e) { return {}; } })();
      expect(focusKeyOf).toBeTypeOf("function");
      const tracks = ["a", "b", "c"].map((id) => piano({ id }));
      const list = tracks.map((t) => card(t, { sel: t.id === "b", open: t.id === "b" })).join("");
      // each opening tag in document order, with its tag name and attributes
      const tags = [...list.matchAll(/<([a-z]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*>/g)].map((m) => ({ tag: m[1], attrs: Object.fromEntries([...m[2].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map((x) => [x[1], x[2] === undefined ? "" : x[2]])) }));
      const querySelector = (sel) => {
        const m = /^([a-z]*)((?:\[[a-z-]+="[^"]*"\])+)$/.exec(sel);
        if (!m) throw new Error("unexpected key " + sel);
        const need = [...m[2].matchAll(/\[([a-z-]+)="([^"]*)"\]/g)].map((x) => [x[1], x[2]]);
        return tags.find((t) => (!m[1] || t.tag === m[1]) && need.every(([k, v]) => t.attrs[k] === v)) || null;
      };
      // the second track's head button had focus when Enter selected it
      const btn = { tagName: "BUTTON", dataset: { act: "select-track", id: "b" }, classList: { contains: () => false } };
      const found = querySelector(focusKeyOf(btn));
      expect(found && found.tag).toBe("button");
      expect(found.attrs.class).toBe("track__main");
      expect(found.attrs["data-id"]).toBe("b");
      expect(found.attrs["aria-expanded"]).toBe("true");   // announced as open
      // only the button carries the select-track pair; the head has its own marker
      expect(tags.filter((t) => t.attrs["data-act"] === "select-track" && t.attrs["data-id"] === "b").map((t) => t.tag)).toEqual(["button"]);
      // the other keys still come back too
      expect(focusKeyOf({ tagName: "INPUT", dataset: { id: "b" }, classList: { contains: (c) => c === "tnum" } })).toBe('.tnum[data-id="b"]');
      expect(focusKeyOf({ tagName: "BUTTON", dataset: { act: "mute", id: "b" }, classList: { contains: () => false } })).toBe('button[data-act="mute"][data-id="b"]');
      // keepFocus uses it, and a click anywhere else on the head is handed to that button
      expect(section(/function keepFocus\(/, "\nfunction ")).toContain("const key = a && a !== document.body ? focusKeyOf(a) : null;");
      expect(html).toMatch(/const h = e\.target\.closest\("\[data-head\]"\); if \(h && !e\.target\.closest\("\[data-act\]"\)\)\{ const b = h\.querySelector\("\.track__main"\); if \(b\) b\.click\(\); \}/);
    });

    it("opening or replacing a song never animates a card as it appears", () => {
      expect(section(/function openSong\(/, "\nfunction ")).toContain("openTrack = null;");
      expect(section(/function replaceSong\(/, "\nfunction ")).toContain("openTrack = null;");
    });

    it("M and S never change the selection or the open state", () => {
      const ms = html.match(/if \(act === "mute" \|\| act === "solo"\)\{[^\n]*/)[0];
      expect(ms).not.toMatch(/sel =|select/);
      const h = card(piano(), {});
      const head = tag(h, /<div class="track__head"[\s\S]*?<span class="track__chev"/);
      expect(head).toMatch(/<button type="button" class="msb msb--m" data-act="mute"/);   // its own data-act, found first by closest()
    });

    it("the card opens with the draft's grid-rows technique, decelerating, and its lines fade in staggered", () => {
      expect(css).toContain("--ease:cubic-bezier(.2,.8,.2,1)");
      expect(rule(".track__more")).toMatch(/display:grid; grid-template-rows:0fr; transition:grid-template-rows \.22s var\(--ease\)/);
      expect(rule(".track.open .track__more")).toContain("grid-template-rows:1fr");
      expect(rule(".track__rows > .track__fx")).toMatch(/opacity:0; transform:translateY\(-4px\)/);
      expect(css).toMatch(/\.track\.open \.track__rows > \.track__fx:nth-child\(2\)\{ transition-delay:\.08s; \}/);
      expect(rule(".track.open .track__chev")).toContain("rotate(180deg)");
      expect(rule(".track:hover")).toContain("translateY(-1px)");
      expect(rule(".track:hover .tile")).toContain("scale(1.04)");
      expect(rule(".msb:hover")).toContain("brightness");
      expect(rule(".msb:active")).toContain("translateY(1px)");
      expect(rule(".track__sus:active")).toContain("translateY(1px)");
      expect(rule(".track__box:hover")).toContain("border-color");
      expect(css).toMatch(/\.fader \.slider:hover::-webkit-slider-thumb\{[^}]*translateY\(-1px\)/);
      expect(css).toMatch(/\.fader \.slider:active::-webkit-slider-thumb\{[^}]*scale\(\.97\)/);
      expect(css).not.toMatch(/cubic-bezier\([^)]*,\s*1\.[0-9]/);   // never bouncy
    });

    it("the track cards wear the draft's subtle surface: thin edge, 7px corners, small shadows", () => {
      expect(css).toMatch(/:root\[data-theme="dark"\]\{[^}]*--tc-edge:#3A3A42/);
      expect(css).toMatch(/:root\[data-theme="dark"\]\{[^}]*--tc-a:#2E2E35; --tc-b:#26262C/);
      expect(css).toMatch(/:root\{[\s\S]*?--tc-edge:#[0-9A-F]{6}/);   // the light theme has its own subtle edge
      const tr = rule(".track");
      expect(tr).toContain("border:1px solid var(--tc-edge)");
      expect(tr).toContain("border-radius:7px");
      expect(tr).toContain("background:linear-gradient(var(--tc-a),var(--tc-b))");
      expect(tr).toContain("box-shadow:inset 0 1px 0 var(--tc-hi), 0 2px 0 var(--tc-drop)");
      expect(rule(".track:hover")).toContain("0 3px 0 var(--tc-drop), 0 6px 14px");
      const sel = rule(".track.sel");
      expect(sel).toContain("border-color:var(--tc)");
      expect(sel).toContain("0 0 0 2px color-mix(in srgb, var(--tc) 28%, transparent)");
      expect(sel).not.toMatch(/0 6px 16px/);   // the old heavy glow is gone
      expect(rule(".track .tile")).toContain("border-radius:5px");
      expect(rule(".msb")).toMatch(/width:24px; height:24px; border-radius:5px/);
      expect(rule(".track__sus")).toContain("border-radius:5px");
    });

    it("every slider is a mixer fader: the main volume (teal) and each card's Volume and Reverb", () => {
      expect(html).toMatch(/<span class="fader fader--main" style="--steps:10;--c:#14B8A6"><input type="range" class="slider" id="ss-volume" min="0" max="100" value="80" aria-label="Main volume"><\/span>/);
      expect(trackVolRow(piano(), "Keys", esc)).toMatch(/<span class="fader" style="--steps:10"><input type="range" class="slider slider--sm tvol"/);
      expect(trackFxRows(piano(), "Keys", true, esc)).toMatch(/<span class="fader" style="--steps:4"><input type="range" class="slider slider--sm trev"/);
      expect(rule(".fader")).toContain("--c:var(--tc)");
      expect(css).toMatch(/\.fader::before\{[^}]*var\(--steps\)/);
      expect(css).toMatch(/\.fader \.slider::-webkit-slider-thumb\{[^}]*width:14px; height:24px/);
      expect(css).toMatch(/\.fader \.slider::-moz-range-thumb\{[^}]*width:14px; height:24px/);
      expect(css).toMatch(/\.fader \.slider::-webkit-slider-thumb\{[^}]*var\(--c\)/);
      expect(css).toMatch(/:root\{[\s\S]*?--tick:rgba\(28,28,34/);   // dark ticks on the light theme
      // Firefox gets the groove and the grip lines too
      expect(css).toMatch(/\.fader \.slider::-moz-range-track\{[^}]*var\(--groove\)[^}]*center \/ 100% 2px no-repeat/);
      expect(css).toMatch(/\.fader \.slider::-moz-range-thumb\{[^}]*repeating-linear-gradient\(90deg, rgba\(0,0,0,\.28\) 0 1px, transparent 1px 3px\) 1px 3px \/ 4px 16px no-repeat,[^}]*7px 3px \/ 4px 16px no-repeat/);
      // a selector list with a -webkit- pseudo-element would drop the whole rule in Firefox
      expect(css).not.toMatch(/::-webkit-slider-thumb[^{]*::-moz-range-thumb|::-moz-range-thumb[^{]*::-webkit-slider-thumb/);
    });

    it("reduced motion turns every new transition off, and the account bar's fill too", () => {
      const rm = html.slice(html.lastIndexOf("@media (prefers-reduced-motion:reduce){"));
      const block = rm.slice(0, rm.indexOf("\n}"));
      for (const s of [".track", ".track .tile", ".track__chev", ".track__more", ".track__rows > .track__fx", ".track__box", ".track__sus", ".msb", ".space__bar i"]) expect(block, s).toContain(s);
      expect(block).toMatch(/\.fader \.slider::-webkit-slider-thumb\{ transition:none !important; \}/);
      expect(block).toMatch(/\.track:hover, \.track:hover \.tile\{ transform:none; \}/);
    });

    it("phones keep the compact row: only the open card shows its Sustain switch; no expand animation", () => {
      const last = html.slice(html.lastIndexOf("@media (max-width:640px){"), html.indexOf("</style>"));
      expect(last).toContain(".track__head{ display:contents; }");
      expect(last).toContain(".track__chev{ display:none; }");
      expect(last).toMatch(/\.track__more\{ display:none; \}/);
      expect(last).toMatch(/\.track\.open \.track__more\{ display:block; \}/);
      expect(last).toMatch(/\.fader--main\{ width:80px; \}/);
      expect(html.indexOf("@media (max-width:640px)")).toBeLessThan(html.indexOf("@media (max-width:640px){\n  .main{"));   // the sheet block stays first
    });

    it("a lesson step whose control is inside a closed card opens that card first", () => {
      const fn = section(/function revealLessonTarget\(/, "\nfunction ");
      expect(fn).toMatch(/closest\("\.track"\)/);
      expect(fn).toMatch(/!card\.classList\.contains\("open"\)/);
      expect(fn).toContain("sel = card.dataset.id;");
    });

    it("the library's style list draws its chevron 8px from the right", () => {
      const ls = rule(".lib__sel");
      expect(ls).toMatch(/appearance:none; -webkit-appearance:none/);
      expect(ls).toContain("background:var(--well) var(--chev) right 8px center / 12px no-repeat");
      expect(ls).toContain("padding-right:28px");
      expect(css).toMatch(/:root\{[\s\S]*?--chev:url\("data:image\/svg\+xml/);
      expect(css).toMatch(/:root\[data-theme="dark"\]\{[^}]*--chev:url\("data:image\/svg\+xml/);
    });

    it("library pattern cards: a thin 2px color line inside, no thick edge, the track cards' surface", () => {
      expect(css).not.toContain("inset 3px 0 0 var(--tc)");
      const pat = rule(".pat");
      expect(pat).toContain("position:relative");
      expect(pat).toContain("border:1px solid var(--tc-edge)");
      expect(pat).toContain("padding:9px 9px 9px 14px");
      expect(pat).toContain("var(--raise)");
      expect(rule(".pat::before")).toBe('.pat::before{ content:""; position:absolute; left:6px; top:10px; bottom:10px; width:2px; border-radius:1px; background:var(--tc); pointer-events:none; }');
    });

    it("an account-full save status is maroon; other errors stay red", () => {
      expect(rule(".title small.bad")).toContain("var(--danger)");
      expect(rule(".title small.bad.full")).toContain("#A0185A");
      expect(css).toMatch(/:root\[data-theme="dark"\] \.title small\.bad\.full\{ color:#E46A9E; \}/);
      expect(html).toMatch(/function setStatus\(t, bad, full\)\{[^\n]*classList\.toggle\("full", !!bad && !!full\)/);
      expect(html).toContain("setStatus(st.text, st.bad, st.full)");
    });
  });

  /* Owner: Chorus, Dynamics and EQ on each track behind "More sound", a compact Add track at the top of the Tracks
     panel (docs/mockups/sound-space-track-effects-draft.html), and the pattern card's Use at the top right. */
  describe("track effects, Add track at the top, and Use at the top right", () => {
    const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
    let got = {};
    try { got = new Function(block.slice(block.indexOf("*/") + 2) + "; return { trackCard, trackFxMore, fxLights, eqText, setTrackFx, addTrackState, tracksEmptyHtml, lessonTargetFor, lessonPanel, focusKeyOf, setTrackInstrument };")(); } catch (e) { /* each test below fails on its own */ }
    const { trackCard, trackFxMore, fxLights, eqText, setTrackFx, addTrackState, tracksEmptyHtml, lessonTargetFor, lessonPanel, focusKeyOf, setTrackInstrument } = got;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
    const OFF = () => ({ chorus: { kind: "off", amount: 45 }, dyn: { kind: "off", amount: 50 }, eq: { low: 0, mid: 0, high: 0, lowcut: false } });
    const piano = (o) => Object.assign({ id: "t1", instrumentId: "grand-piano", volume: 0.8, mute: false, solo: false, notes: [], reverb: 0, sustain: false }, OFF(), o);
    const tag = (h, re) => (h.match(re) || [""])[0];
    const card = (t, o) => trackCard(t, Object.assign({ label: "Keys", instName: "Grand piano", icon: '<span class="tile"></span>', sel: true, open: true, muted: false, pitched: true, kind: "pitched", fxOpen: false, note: "" }, o), esc);
    const css = cssText();
    const rule = (sel) => { const i = css.indexOf(sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i) + 1); };
    const moreBtn = (h) => tag(h, /<button[^>]*data-act="more-sound"[^>]*>[\s\S]*?<\/button>/);
    const lights = (h) => [...moreBtn(h).matchAll(/<i class="fxdot( on)?" data-fx="(\w+)"/g)].map((m) => [m[2], !!m[1]]);
    const group = (h, g) => tag(h, new RegExp('<div class="fxg fxg--' + g + '"[\\s\\S]*?<!--/fxg-->'));

    it("More sound sits under Sustain in the open card, with aria-expanded, aria-controls and a turning chevron", () => {
      const h = card(piano());
      const b = moreBtn(h);
      expect(b).toContain('type="button"');
      expect(b).toContain('aria-expanded="false"');
      expect(b).toContain('aria-controls="tfx-t1"');
      expect(b).toContain(">More sound<");
      expect(b).toContain('class="fxmore__chev"');
      expect(h.indexOf('data-act="more-sound"')).toBeGreaterThan(h.indexOf('data-act="sustain"'));
      expect(tag(h, /<div class="track__fxs[^"]*"[^>]*>/)).toBe('<div class="track__fxs" id="tfx-t1" inert>');
      const open = card(piano(), { fxOpen: true });
      expect(moreBtn(open)).toContain('aria-expanded="true"');
      expect(tag(open, /<div class="track__fxs[^"]*"[^>]*>/)).toBe('<div class="track__fxs open" id="tfx-t1">');
      // the same 220 ms grid-rows motion as the card, decelerating; the chevron turns
      expect(rule(".track__fxs")).toMatch(/display:grid; grid-template-rows:0fr; transition:grid-template-rows \.22s var\(--ease\)/);
      expect(rule(".track__fxs.open")).toContain("grid-template-rows:1fr");
      expect(rule(".track__fxs > div")).toMatch(/overflow:hidden; min-height:0/);
      expect(rule('.fxmore[aria-expanded="true"] .fxmore__chev')).toContain("rotate(180deg)");
      // toggling: remembered per track for this visit (not saved in the song), and no rebuild of the list
      const tg = section(/function toggleFx\(/, "\nfunction ");
      expect(tg).toMatch(/fxOpen\.(add|delete)\(/);
      expect(tg).toContain('classList.toggle("open", open)');
      expect(tg).toContain('toggleAttribute("inert", !open)');
      expect(tg).toContain('setAttribute("aria-expanded", String(open))');
      expect(tg).not.toContain("commit(");
      expect(tg).not.toContain("renderTracks(");
      expect(html).toMatch(/const fxOpen = new Set\(\);/);
      expect(html).toMatch(/if \(act === "more-sound"\) return toggleFx\(id\);/);
      expect(section(/function renderTracks\(/, "\nfunction ")).toContain("fxOpen:fxOpen.has(t.id)");
    });

    it("the three lights show which effects are on, in teal; EQ counts as on for any band or Low cut", () => {
      expect(lights(card(piano()))).toEqual([["chorus", false], ["dyn", false], ["eq", false]]);
      const t = piano({ chorus: { kind: "chorus", amount: 45 }, eq: { low: 0, mid: 0, high: 3, lowcut: false } });
      expect(lights(card(t))).toEqual([["chorus", true], ["dyn", false], ["eq", true]]);
      expect(fxLights(piano({ eq: { low: 0, mid: 0, high: 0, lowcut: true } }), "pitched")).toEqual({ chorus: false, dyn: false, eq: true });
      expect(fxLights(piano({ dyn: { kind: "limit", amount: 20 } }), "kit")).toEqual({ chorus: false, dyn: true, eq: false });
      expect(fxLights({}, "pitched")).toEqual({ chorus: false, dyn: false, eq: false });   // a song from before the effects
      // the button says it for a screen reader too
      expect(moreBtn(card(t))).toMatch(/<span class="sr-only">: Chorus on, Dynamics off, EQ on<\/span>/);
      expect(css).toMatch(/\.fxdot\.on\{[^}]*#14B8A6/);
      // a drag on an EQ fader or an Amount updates them at once
      expect(html).toMatch(/function paintFxLights\(/);
    });

    it("Chorus: Off, Chorus, Flanger, Phaser and an Amount fader with a % box, dimmed and disabled while Off", () => {
      const t = piano();
      const ch = group(trackFxMore(t, "Keys", "pitched", true, esc), "chorus");
      expect(ch).toContain(">Chorus</h4>");
      expect(ch).toContain("Makes one sound like a few playing together, with a gentle wobble.");
      const sel = tag(ch, /<select[\s\S]*?<\/select>/);
      expect(sel).toContain('class="tkind"');
      expect(sel).toContain('data-fx="chorus"');
      expect(sel).toContain('aria-label="Keys chorus kind"');
      expect([...sel.matchAll(/<option value="(\w+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]])).toEqual([["off", "Off"], ["chorus", "Chorus"], ["flanger", "Flanger"], ["phaser", "Phaser"]]);
      expect(sel).toContain('<option value="off" selected>Off</option>');
      const range = tag(ch, /<input[^>]*type="range"[^>]*>/);
      for (const a of ['class="slider slider--sm tamt"', 'data-fx="chorus"', 'min="0"', 'max="100"', 'value="45"', 'aria-label="Keys chorus amount"', " disabled"]) expect(range).toContain(a);
      const num = tag(ch, /<input[^>]*type="number"[^>]*>/);
      for (const a of ['class="tamtnum"', 'data-fx="chorus"', 'value="45"', " disabled"]) expect(num).toContain(a);
      expect(ch).toMatch(/<div class="fxg__row is-off">/);
      expect(ch).toContain('<span class="fader" style="--steps:10">');
      // picking a kind turns Amount on
      expect(setTrackFx(t, "chorus", "kind", "flanger")).toBe(true);
      expect(t.chorus).toEqual({ kind: "flanger", amount: 45 });
      const on = group(trackFxMore(t, "Keys", "pitched", true, esc), "chorus");
      expect(tag(on, /<input[^>]*type="range"[^>]*>/)).not.toContain("disabled");
      expect(tag(on, /<input[^>]*type="number"[^>]*>/)).not.toContain("disabled");
      expect(on).not.toContain("is-off");
      expect(on).toContain('<option value="flanger" selected>Flanger</option>');
      // bad values never get in
      expect(setTrackFx(t, "chorus", "kind", "wah")).toBe(false);
      expect(t.chorus.kind).toBe("flanger");
      expect(setTrackFx(t, "chorus", "amount", 150)).toBe(true);
      expect(t.chorus.amount).toBe(100);
      expect(setTrackFx(t, "chorus", "amount", "33.6")).toBe(true);
      expect(t.chorus.amount).toBe(34);
      expect(setTrackFx(t, "chorus", "amount", 34)).toBe(false);   // the same value is no new undo step
      // a song from before the effects gets the defaults the first time
      const old = { id: "x" };
      expect(setTrackFx(old, "dyn", "kind", "compress")).toBe(true);
      expect(old.dyn).toEqual({ kind: "compress", amount: 50 });
      expect(rule(".fxg__row.is-off")).toMatch(/opacity:\.45/);
    });

    it("Dynamics: Off, Compress, Limit and an Amount, dimmed while Off", () => {
      const t = piano({ dyn: { kind: "compress", amount: 60 } });
      const dy = group(trackFxMore(t, "Drums", "kit", true, esc), "dyn");
      expect(dy).toContain(">Dynamics</h4>");
      expect(dy).toContain("Evens out loud and quiet notes so the track sounds steady.");
      const sel = tag(dy, /<select[\s\S]*?<\/select>/);
      expect([...sel.matchAll(/<option value="(\w+)"[^>]*>([^<]+)</g)].map((m) => m[2])).toEqual(["Off", "Compress", "Limit"]);
      expect(sel).toContain('<option value="compress" selected>Compress</option>');
      expect(tag(dy, /<input[^>]*type="range"[^>]*>/)).toContain('value="60"');
      expect(tag(dy, /<input[^>]*type="range"[^>]*>/)).not.toContain("disabled");
      expect(group(trackFxMore(piano(), "Drums", "kit", true, esc), "dyn")).toContain("is-off");
      expect(html).not.toMatch(/>Gate</);   // no gate (the draft explains why)
    });

    it("EQ: three small upright faders from -12 to +12 with the signed value above, and a Low cut switch", () => {
      expect(eqText(3)).toBe("+3");
      expect(eqText(0)).toBe("0");
      expect(eqText(-5)).toBe("\u22125");
      const t = piano({ eq: { low: 3, mid: 0, high: -5, lowcut: true } });
      const eq = group(trackFxMore(t, "Keys", "pitched", true, esc), "eq");
      expect(eq).toContain(">EQ</h4>");
      expect(eq).toContain("Turn the low, middle and high sounds up or down. Low cut takes away deep rumble.");
      const faders = [...eq.matchAll(/<div class="vf"><b class="vf__val"[^>]*>([^<]*)<\/b><span class="vf__slot"><span class="fader fader--v" style="--steps:8"><input([^>]*)><\/span><\/span><span class="vf__lab">(\w+)<\/span><\/div>/g)];
      expect(faders.map((m) => [m[3], m[1]])).toEqual([["Low", "+3"], ["Mid", "0"], ["High", "\u22125"]]);
      const low = faders[0][2];
      for (const a of ['type="range"', 'class="slider teq"', 'data-band="low"', 'data-id="t1"', 'min="-12"', 'max="12"', 'step="1"', 'value="3"', 'aria-label="Keys low sounds"', 'aria-valuetext="+3"']) expect(low).toContain(a);
      expect(low).toMatch(/title="[^"]*[Dd]ouble-click[^"]*0[^"]*"/);
      const cut = tag(eq, /<button[^>]*data-act="lowcut"[^>]*>[\s\S]*?<\/button>/);
      expect(cut).toContain('aria-pressed="true"');
      expect(cut).toContain('class="track__led"');
      expect(cut).toContain("Low cut");
      // values are kept to whole steps from -12 to 12
      const u = piano();
      expect(setTrackFx(u, "eq", "low", -13)).toBe(true);
      expect(u.eq.low).toBe(-12);
      expect(setTrackFx(u, "eq", "high", "4.4")).toBe(true);
      expect(u.eq.high).toBe(4);
      expect(setTrackFx(u, "eq", "lowcut", true)).toBe(true);
      expect(u.eq.lowcut).toBe(true);
      expect(setTrackFx(u, "eq", "bass", 3)).toBe(false);
      // dragging shows the signed value live; a double-click puts it back to 0 in one undo step; a drag is one step
      expect(html).toMatch(/const q = e\.target\.closest\("\.teq"\);[^\n]*setTrackFx\(t, "eq", q\.dataset\.band, q\.value\)[^\n]*eqText\(/);
      expect(html).toMatch(/\$\("#track-list"\)\.addEventListener\("dblclick", e => \{[^\n]*\.teq[^\n]*setTrackFx\(t, "eq", q\.dataset\.band, 0\)[^\n]*commit\(\)/);
      expect(html).toMatch(/if \(e\.target\.closest\("\.tamt, \.teq"\)\)\{[^\n]*return commit\(\); \}/);
      expect(html).toMatch(/if \(act === "lowcut"\)\{[^\n]*setTrackFx\(t, "eq", "lowcut", !t\.eq\.lowcut\)[^\n]*commit\(\); renderTracks\(\);/);
      // the upright fader is the same mixer fader turned on its side, with a mark at 0
      expect(rule(".fader--v")).toContain("rotate(-90deg)");
      expect(css).toMatch(/\.vf__slot\{[^}]*height:/);
    });

    it("a kind change and a typed amount go through commit; the Amount box keys work like the volume box", () => {
      expect(html).toMatch(/const k = e\.target\.closest\("\.tkind"\); if \(k\)\{[^\n]*setTrackFx\(t, k\.dataset\.fx, "kind", k\.value\)[^\n]*commit\(\); renderTracks\(\);/);
      expect(html).toMatch(/const a = e\.target\.closest\("\.tamtnum"\); if \(a\) return typedAmount\(a, a\.value\);/);
      const ta = section(/function typedAmount\(/, "\nfunction ");
      expect(ta).toContain('setTrackFx(t, n.dataset.fx, "amount"');
      expect(ta).toContain("commit();");
      expect(html).toMatch(/volBoxKey\(e\.key, e\.shiftKey, a\.value, t\[a\.dataset\.fx\]\.amount\)/);
      // focus comes back to the same control after the card is rebuilt
      expect(focusKeyOf({ tagName: "SELECT", dataset: { id: "b", fx: "dyn" }, classList: { contains: (c) => c === "tkind" } })).toBe('.tkind[data-id="b"][data-fx="dyn"]');
      expect(focusKeyOf({ tagName: "INPUT", dataset: { id: "b", band: "mid" }, classList: { contains: (c) => c === "teq" } })).toBe('.teq[data-id="b"][data-band="mid"]');
      expect(focusKeyOf({ tagName: "INPUT", dataset: { id: "b" }, classList: { contains: (c) => c === "tnum" } })).toBe('.tnum[data-id="b"]');
    });

    it("drums get all three groups; effects tracks get EQ only", () => {
      const kit = trackFxMore(piano(), "Drums", "kit", true, esc);
      for (const g of ["chorus", "dyn", "eq"]) expect(group(kit, g), g).not.toBe("");
      const fx = trackFxMore(piano(), "Effects", "fx", true, esc);
      expect(group(fx, "chorus")).toBe("");
      expect(group(fx, "dyn")).toBe("");
      expect(group(fx, "eq")).not.toBe("");
      expect(lights(card(piano(), { kind: "fx", pitched: false })).map((l) => l[0])).toEqual(["eq"]);
      // changing a track to an effect turns its Chorus and Dynamics off, so nothing hidden keeps sounding
      const byId = (id) => ({ "grand-piano": { kind: "pitched" }, "zap": { kind: "fx" }, "kit": { kind: "kit" } })[id] || null;
      const t = piano({ chorus: { kind: "phaser", amount: 70 }, dyn: { kind: "limit", amount: 30 } });
      setTrackInstrument({}, t, "zap", byId);
      expect(t.chorus).toEqual({ kind: "off", amount: 70 });
      expect(t.dyn).toEqual({ kind: "off", amount: 30 });
      const k = piano({ dyn: { kind: "compress", amount: 30 } });
      setTrackInstrument({}, k, "kit", byId);
      expect(k.dyn.kind).toBe("compress");
      const card2 = section(/function trackCard\(/, "\nfunction ");
      expect(card2).toContain("trackFxMore(t, o.label, o.kind");
      expect(section(/function renderTracks\(/, "\nfunction ")).toContain("kind:kindOf(t)");
    });

    it("live notes go through the selected track's chain only when an effect is on; otherwise today's path", () => {
      const audio = section(/function audio\(/, "/* touch screens");
      expect(audio).toContain("liveChains = E.createTrackChains(ctx)");
      const on = section(/function noteOn\(/, "function noteOff");
      expect(on).toContain("const wet = liveFx.wet(track.reverb || 0);");
      expect(on).toMatch(/const fxIn = liveChains\.input\(track, wet \? \[liveBus, wet\] : \[liveBus\], [^)]+\);/);
      expect(on).toContain("if (fxIn) g.connect(fxIn); else { g.connect(liveBus); if (wet) g.connect(wet); }");
      expect(on).toContain("liveChains.sweep(c.currentTime);");
    });

    it("Add track: a small blue button in the Tracks panel head, with the count, keeping id ss-add-track", () => {
      const aside = section(/<aside class="panel left" id="ss-tracks"/, "</aside>");
      const head = section(/<div class="panel__head"><h3>Tracks<\/h3>/, "</div>");
      expect(head).toMatch(/<h3>Tracks<\/h3><span class="tracks__count" id="track-count"[^>]*><\/span><button type="button" class="addbtn" id="ss-add-track" data-act="add-track"[^>]*><i data-lucide="plus"><\/i>Add track<\/button><button[^>]*data-act="toggle-tracks"/);
      expect(aside).not.toContain('class="hint"');
      expect(aside).not.toContain('class="addtrack"');
      expect(aside.indexOf('id="ss-add-track"')).toBeLessThan(aside.indexOf('id="track-list"'));
      expect(addTrackState(3, 8)).toEqual({ count: "3 of 8", full: false, empty: false, title: "Add a track. Up to 8 tracks. M mutes a track, S plays it on its own." });
      expect(addTrackState(0, 8)).toMatchObject({ count: "0 of 8", empty: true, full: false });
      expect(addTrackState(8, 8)).toEqual({ count: "8 of 8", full: true, empty: false, title: "8 tracks is the most a song can have" });
      const rt = section(/function renderTracks\(/, "\nfunction ");
      expect(rt).toContain("const st = addTrackState(song.tracks.length, M.CONST.MAX_TRACKS);");
      expect(rt).toContain('$("#ss-add-track").disabled = st.full || busy();');
      expect(rt).toContain('$("#ss-add-track").title = st.title;');
      expect(rt).toContain('$("#ss-add-track").hidden = st.empty;');
      expect(rt).toContain('$("#track-count").textContent = st.count;');
      // blue is the call to action; it presses down, never bounces
      expect(rule(".addbtn")).toMatch(/background:linear-gradient\(var\(--accent-a\),var\(--accent-b\)\)/);
      expect(rule(".addbtn")).toContain("margin-left:auto");
      expect(rule(".addbtn:disabled")).toMatch(/opacity/);
      expect(rule(".tracks__count")).toContain("color:var(--faint)");
      // the old tip lives in Help now
      expect(html).toContain("<b>M</b> mutes a track and <b>S</b> plays only that track.");
    });

    it("an empty song shows a big Add your first track button in the list; it adds a track the same way", () => {
      const e = tracksEmptyHtml();
      expect(e).toMatch(/<button type="button" class="addtrack" id="ss-add-first" data-act="add-track"><i data-lucide="plus"><\/i>Add your first track<\/button>/);
      expect(e).toMatch(/role="listitem"/);
      const rt = section(/function renderTracks\(/, "\nfunction ");
      expect(rt).toMatch(/song\.tracks\.length \? song\.tracks\.map\([\s\S]*: tracksEmptyHtml\(\)/);
      expect(rule(".tracks__empty")).toMatch(/place-items:center|justify-content:center/);
    });

    it("lesson steps that add a track point at the head button, or at Add your first track when the song is empty", () => {
      expect(lessonTargetFor("#ss-add-track", 0)).toBe("#ss-add-first");
      expect(lessonTargetFor("#ss-add-track", 2)).toBe("#ss-add-track");
      expect(lessonTargetFor("#ss-grid", 0)).toBe("#ss-grid");
      expect(lessonPanel("#ss-add-first")).toBe("tracks");
      // every step that targets it: lesson 8 starts empty, so its first step points at the big button
      const SS = loadSS("model.js", "instruments.js", "icons.js", "library.js", "lessons.js");
      const steps = SS.lessons.LESSONS.flatMap((l) => l.steps.map((s, i) => ({ l, s, i }))).filter((x) => x.s.target === "#ss-add-track");
      expect(steps.length).toBeGreaterThan(0);
      const first = steps.find((x) => x.i === 0);
      expect(first.l.startSong.tracks.length).toBe(0);
      expect(lessonTargetFor(first.s.target, first.l.startSong.tracks.length)).toBe("#ss-add-first");
      expect(section(/function placeTip\(/, "\nfunction ")).toContain("lessonTargetFor(st.target, song ? song.tracks.length : 0)");
      expect(section(/function revealLessonTarget\(/, "\nfunction ")).toContain("lessonTargetFor(target, song ? song.tracks.length : 0)");
    });

    it("phones: More sound shows on the selected card and the groups open full width under the track row", () => {
      const last = html.slice(html.lastIndexOf("@media (max-width:640px){"), html.indexOf("</style>"));
      expect(last).toMatch(/\.left\{[^}]*position:relative[^}]*overflow:visible/);
      expect(last).toMatch(/\.tracklist\{[^}]*overflow-x:auto/);
      expect(last).toMatch(/\.track\{[^}]*position:static/);
      expect(last).toMatch(/\.track__fxs\{[^}]*position:absolute; left:0; right:0; top:100%/);
      expect(last).toMatch(/\.left \.panel__head\{[^}]*display:flex/);
      expect(last).toMatch(/\.vf__slot\{[^}]*height:(9[6-9]|1[0-9]{2})px/);   // a taller upright fader for fingers
      expect(html.indexOf("@media (max-width:640px)")).toBeLessThan(html.indexOf("@media (max-width:640px){\n  .main{"));   // the sheet block stays first
    });

    it("reduced motion: More sound opens at once and nothing on it moves", () => {
      const rm = html.slice(html.lastIndexOf("@media (prefers-reduced-motion:reduce){"));
      const blk = rm.slice(0, rm.indexOf("\n}"));
      for (const s of [".track__fxs", ".fxmore", ".fxmore__chev", ".fxdot", ".addbtn"]) expect(blk, s).toContain(s);
    });

    it("colors stay in the palette: the lit lines use the track's color, the lights teal, the group panels have a light theme", () => {
      expect(css).toMatch(/:root\{[\s\S]*?--fxg-a:/);
      expect(css).toMatch(/:root\[data-theme="dark"\]\{[^}]*--fxg-a:#1E1E23/);
      expect(rule(".fxg")).toMatch(/background:var\(--fxg-a\)/);
      expect(rule(".fader")).toContain("--c:var(--tc)");
    });

    it("Help explains More sound in plain words", () => {
      expect(html).toContain("<b>More sound</b>");
      expect(html).toMatch(/Chorus[^<]*sound like a few playing together/);
      expect(html).toMatch(/Dynamics[^<]*loud and quiet/);
      expect(html).toMatch(/EQ[^<]*low, middle and high/);
    });

    /* Fix round 1 */
    it("the live chains are all let go when a song opens or the editor closes, and swept on every live note", () => {
      expect(section(/function openSong\(/, "\nfunction ")).toContain("if (liveChains) liveChains.disconnect();");
      expect(section(/async function showHome\(/, "\nfunction ")).toContain("if (liveChains) liveChains.disconnect();");
      expect(section(/function noteOn\(/, "function noteOff")).toContain("liveChains.sweep(c.currentTime);");
    });

    it("upright EQ faders take a finger drag instead of scrolling the panel, and say they are vertical", () => {
      expect(rule(".fader--v")).toContain("touch-action:none");
      expect(rule(".fader--v .slider")).toContain("touch-action:none");
      const eq = group(trackFxMore(piano(), "Keys", "pitched", true, esc), "eq");
      const inputs = [...eq.matchAll(/<input[^>]*class="slider teq"[^>]*>/g)].map((m) => m[0]);
      expect(inputs.length).toBe(3);
      for (const i of inputs) expect(i).toContain('aria-orientation="vertical"');
    });

    it("a double-click reset is one undo step: the first click's jump is taken back inside the reset", () => {
      const { eqResetUndo } = (() => { try { return new Function(block.slice(block.indexOf("*/") + 2) + "; return { eqResetUndo };")(); } catch (e) { return {}; } })();
      expect(eqResetUndo).toBeTypeOf("function");
      const last = { id: "t1", band: "low", at: 1000 };
      expect(eqResetUndo(last, "t1", "low", 1300)).toBe(true);     // the jump just before the double-click
      expect(eqResetUndo(last, "t1", "mid", 1300)).toBe(false);    // another fader
      expect(eqResetUndo(last, "t2", "low", 1300)).toBe(false);    // another track
      expect(eqResetUndo(last, "t1", "low", 2000)).toBe(false);    // long ago: a change of its own
      expect(eqResetUndo(null, "t1", "low", 1300)).toBe(false);
      // a fader change notes itself; the double-click undoes that step, then makes the reset one commit
      expect(html).toMatch(/if \(e\.target\.closest\("\.tamt, \.teq"\)\)\{ const q = e\.target\.closest\("\.teq"\); lastEq = q \? \{ id:q\.dataset\.id, band:q\.dataset\.band, at:performance\.now\(\) \} : null; return commit\(\); \}/);
      const dbl = html.match(/\$\("#track-list"\)\.addEventListener\("dblclick"[^\n]*/)[0];
      expect(dbl).toContain("eqResetUndo(lastEq, q.dataset.id, q.dataset.band, performance.now())");
      expect(dbl).toMatch(/const s = hist\.undo\(\); if \(s\) replaceSong\(s\);/);
      expect(dbl).toContain('setTrackFx(t, "eq", q.dataset.band, 0)');
      expect(dbl).toContain("commit();");
      expect(dbl.indexOf("hist.undo()")).toBeLessThan(dbl.indexOf("commit();"));
    });

    it("an effects track's Chorus and Dynamics are switched off when a song opens and when it becomes an effect", () => {
      const { fxEqOnly } = (() => { try { return new Function(block.slice(block.indexOf("*/") + 2) + "; return { fxEqOnly };")(); } catch (e) { return {}; } })();
      expect(fxEqOnly).toBeTypeOf("function");
      const t = piano({ chorus: { kind: "phaser", amount: 70 }, dyn: { kind: "limit", amount: 30 } });
      fxEqOnly(t, "pitched");
      expect(t.chorus.kind).toBe("phaser");
      fxEqOnly(t, "fx");
      expect(t.chorus).toEqual({ kind: "off", amount: 70 });
      expect(t.dyn).toEqual({ kind: "off", amount: 30 });
      expect(section(/function openSong\(/, "\nfunction ")).toMatch(/M\.fillTrackDefaults\(s\);[^\n]*\n[^\n]*s\.tracks\.forEach\(t => fxEqOnly\(t, kindOf\(t\)\)\);/);
      expect(section(/function setTrackInstrument\(/, "\nfunction ")).toContain("fxEqOnly(track, kindAfter);");
    });

    it("the dead track-panel hint rule is gone (the picker and lessons headers still use .hint)", () => {
      expect(css).not.toContain(".left > .hint");
      expect(html).toContain('<span class="hint">Pick an instrument</span>');
    });

    it("phones: More sound is tight enough that the selected card fits its row", () => {
      const last = html.slice(html.lastIndexOf("@media (max-width:640px){"), html.indexOf("</style>"));
      expect(last).toMatch(/\.fxmore\{ margin:0; height:22px; padding:0 4px; gap:4px;/);
      expect(last).toMatch(/\.track\{ position:static; padding:5px 4px; gap:4px; \}/);
      expect(last).toMatch(/\.track__rows\{ display:flex; align-items:center; gap:4px; \}/);
      expect(last).toMatch(/\.fxmore__dots\{ gap:3px; \}/);
    });

    it("the pattern card's Use sits at the top right, beside the name; the preview and play stay below", () => {
      const lib = section(/function renderLibrary\(/, "\nfunction ");
      const m = lib.match(/'<div class="pat__nm">[^\n]*<\/div>'\s*\+ '<button type="button" class="btn" data-lib-use="/);
      expect(m).not.toBe(null);
      expect(lib.indexOf("data-lib-use")).toBeLessThan(lib.indexOf('class="pat__pv"'));
      expect(lib).toContain('aria-label="Use \' + esc(p.name) + \'" title="Put it on the selected track">Use</button>');
      const pat = rule(".pat");
      expect(pat).toContain('grid-template-areas:"nm use use" "pv pv pl"');
      expect(pat).toContain("grid-template-columns:minmax(0,1fr) auto 28px");
      expect(rule(".pat__nm small")).toMatch(/white-space:nowrap; overflow:hidden; text-overflow:ellipsis/);
      expect(rule(".pat::before")).toContain("width:2px");
    });
  });

  describe("a real music keyboard (Web MIDI)", () => {
    /** The full source of one top-level function in the page, found by its name (string- and comment-aware). */
    function fnSrc(name) {
      const m = new RegExp("\\n(?:async )?function " + name + "\\(").exec(html);
      if (!m) throw new Error("no function " + name);
      const open = html.indexOf("{", html.indexOf(")", m.index));
      let depth = 0;
      for (let j = open; j < html.length; j++) {
        const c = html[j];
        if (c === '"' || c === "'" || c === "`") { for (j++; j < html.length && html[j] !== c; j++) if (html[j] === "\\") j++; continue; }
        if (c === "/" && html[j + 1] === "*") { j = html.indexOf("*/", j) + 1; continue; }
        if (c === "/" && html[j + 1] === "/") { j = html.indexOf("\n", j); continue; }
        if (c === "{") depth++;
        else if (c === "}" && --depth === 0) return html.slice(m.index + 1, j + 1);
      }
      throw new Error("unclosed function " + name);
    }

    const LIVE = ["outLatency", "pressTime", "noteOn", "noteOff", "releaseAll", "liveKeyPressed", "lightKey",
      "recordDown", "insertRecorded", "recordUp", "midiEvent", "setPedal", "dampPedal", "showPitch"];

    /** The page's own live-note code (noteOn, noteOff, recording, the MIDI handler) run against a fake audio clock,
        fake voices and fake keys on screen: two octaves from the track's lowest C, black keys included. */
    function live(instrumentId = "grand-piano", opts = {}) {
      const SS = loadSS("model.js", "engine.js", "instruments.js", "midi.js");
      const M = SS.model;
      const song = M.newSong();
      const track = M.addTrack(song, instrumentId);
      const played = [], timers = [], events = {}, keyEls = new Map(), padEls = new Map();
      const env = { renders: 0, commits: 0, narrow: { matches: !!opts.narrow }, document: { hidden: false }, litPlayed: [] };
      /* an audio clock good enough for the real engine's code voices: every automation call and stop is kept */
      const param = (v = 0) => ({ value: v, calls: [], auto: [],
        setValueAtTime(...a) { this.auto.push(["set", ...a]); }, linearRampToValueAtTime(...a) { this.auto.push(["lin", ...a]); },
        exponentialRampToValueAtTime(...a) { this.auto.push(["exp", ...a]); }, cancelScheduledValues() {},
        setTargetAtTime(v, t, tc) { this.calls.push([v, t, tc]); } });
      const ctx = {
        currentTime: 10, sampleRate: 48000,
        createGain() { return { gain: param(1), connect() {}, disconnect() {} }; },
        createOscillator() { return { type: "", frequency: param(440), stops: [], start(t) { this.startAt = t; }, stop(t) { this.stops.push(t); }, connect() {}, disconnect() {} }; },
      };
      const engineVoices = opts.real ? SS.engine.createVoices(ctx, SS.instruments, "x") : null;
      const voices = {
        play(ev, when, dest) {
          if (engineVoices) { const srcs = engineVoices.play(ev, when, dest); played.push({ ev, when, dest, src: srcs[0], srcs }); return srcs; }
          const src = { stops: [], stop(t) { this.stops.push(t); } }; played.push({ ev, when, dest, src, srcs: [src] }); return [src];
        },
      };
      const el = (map, k) => { if (!map.has(k)) { const s = new Set(); map.set(k, { classList: { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) } }); } return map.get(k); };
      const body = `
        const SS = env.SS, M = SS.model, E = SS.engine, I = SS.instruments;
        const song = env.song; let sel = env.track.id; const ctx = env.ctx, voices = env.voices;
        const liveBus = {}, liveFx = { wet: () => null }, liveChains = { input: () => null, sweep() {}, hold: () => () => {} };
        let recording = false, countingIn = false, recTrackId = null, recStart = 0, recFrom = 0, recTotal = 16, recStepSec = 0.3, recTimers = [], recPending = [], recChanged = false;
        let pedalDown = false; const pedalRing = new Set();
        const held = new Map(), litKeys = new Map(), kbBase = new Map();
        const narrowMq = env.narrow, document = env.document;
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const audio = () => ctx, ensureLoaded = () => {}, renderMidi = () => {};
        const trackById = id => song.tracks.find(t => t.id === id) || null, selTrack = () => trackById(sel);
        const instOf = t => I.byId(t.instrumentId), kindOf = t => I.byId(t.instrumentId).kind;
        const baseFor = t => kbBase.has(t.id) ? kbBase.get(t.id) : 48;
        const renderPlayArea = () => { env.renders++; };
        const commit = () => { env.commits++; }, paintRow = () => {}, renderOverview = () => {};
        const lessonEvent = n => { env.events[n] = (env.events[n] || 0) + 1; };
        const litKeyPlayed = p => { env.litPlayed.push(p); };
        const setTimeout = (fn, ms) => { env.timers.push(fn); return env.timers.length; }, clearTimeout = () => {};
        const $ = s => {
          if (s === "#editor") return { hidden: false };
          let m = /^#ss-keys \\[data-key="(\\d+)"\\]$/.exec(s);
          if (m) { const p = +m[1], b = baseFor(selTrack()); return p >= b && p <= b + 24 ? env.key(p) : null; }
          m = /^#ss-pads \\[data-pad="(\\d+)"\\]$/.exec(s);
          return m ? env.pad(+m[1]) : null;
        };
        ${LIVE.map(fnSrc).join("\n")}
        return { held, litKeys, kbBase, midiEvent, noteOn, noteOff, releaseAll,
          record(start, stepSec){ recording = true; recTrackId = sel; recStart = start; recStepSec = stepSec; recTotal = M.totalSteps(song); },
          stopRec(){ recording = false; },
          get pedalDown(){ return pedalDown; } };`;
      Object.assign(env, { SS, song, track, ctx, voices, events, timers, key: (p) => el(keyEls, p), pad: (i) => el(padEls, i) });
      const h = new Function("env", "window", body)(env, {});
      const lit = (p) => keyEls.has(p) && keyEls.get(p).classList.contains("down");
      const flush = () => { while (timers.length) timers.shift()(); };
      return { h, SS, M, song, track, ctx, played, events, env, lit, padLit: (i) => padEls.has(i) && padEls.get(i).classList.contains("down"), flush };
    }

    it("loads midi.js with the other Sound Space modules", () => {
      expect(html).toMatch(/<script src="sound-space\/cloud\.js"><\/script>\r?\n<script src="sound-space\/midi\.js"><\/script>/);
    });

    it("a real note-on plays a live voice at once and lights its key, black keys included; chords hold together", () => {
      const { h, SS, track, ctx, played, events, lit } = live();
      h.midiEvent({ type: "on", pitch: 61, vel: 100, ts: 0 });
      expect(played.length).toBe(1);
      const v = SS.midi.velToVel(100);
      expect(played[0].ev).toMatchObject({ instrumentId: "grand-piano", pitch: 61, sustain: false });
      expect(played[0].ev.vel).toBeCloseTo(v, 6);
      expect(played[0].ev.gain).toBeCloseTo(track.volume * v, 6);   // velocity multiplied in
      expect(played[0].when).toBe(ctx.currentTime);                // same as an on-screen key: no added delay
      expect(lit(61)).toBe(true);
      expect(events.keys).toBe(1);                                 // a lesson hears it as a key press
      h.midiEvent({ type: "on", pitch: 64, vel: 30, ts: 0 });
      h.midiEvent({ type: "on", pitch: 67, vel: 127, ts: 0 });
      expect(played.map((p) => p.ev.pitch)).toEqual([61, 64, 67]);
      expect(played[1].ev.gain).toBeLessThan(played[2].ev.gain);   // softer key, softer note
      expect([61, 64, 67].every(lit)).toBe(true);
      expect(events.keys).toBe(3);
      ctx.currentTime = 11;
      h.midiEvent({ type: "off", pitch: 61, vel: 0, ts: 0 });
      expect(lit(61)).toBe(false);
      expect(lit(64) && lit(67)).toBe(true);
      expect(Math.max(...played[0].src.stops)).toBeLessThanOrEqual(11.3 + 1e-9);   // no Sustain, no pedal: a quick fade
      expect(played[1].src.stops).toEqual([]);
    });

    it("never takes a key the kid holds with the mouse", () => {
      const { h, track, played, lit } = live();
      h.noteOn("p1", track, 64, 0);
      h.midiEvent({ type: "on", pitch: 64, vel: 90, ts: 0 });
      h.midiEvent({ type: "off", pitch: 64, vel: 0, ts: 0 });
      expect(h.held.has("p1")).toBe(true);
      expect(played[0].src.stops).toEqual([]);   // the mouse's note still sounds
      expect(lit(64)).toBe(true);                // and its key stays down
    });

    it("a key outside the keys on screen moves them to show it, but not while the kid is touching a key", () => {
      const { h, track, env } = live();
      h.midiEvent({ type: "on", pitch: 30, vel: 90, ts: 0 });
      expect(h.kbBase.get(track.id)).toBe(24);
      expect(env.renders).toBe(1);
      h.midiEvent({ type: "on", pitch: 90, vel: 90, ts: 0 });
      expect(h.kbBase.get(track.id)).toBe(72);   // 90 now in view: 72 to 96
      expect(env.renders).toBe(2);
      h.noteOn("p7", track, 80, 0);
      h.midiEvent({ type: "on", pitch: 40, vel: 90, ts: 0 });
      expect(h.kbBase.get(track.id)).toBe(72);   // a finger is down: the keys stay put
      expect(env.renders).toBe(2);
    });

    it("while recording, a real note-on and note-off adds the note with its pitch and scaled velocity", () => {
      const { h, SS, M, song, track, ctx, flush } = live();
      h.record(10, 0.125);
      ctx.currentTime = 10.5;
      h.midiEvent({ type: "on", pitch: 64, vel: 50, ts: 0 });
      flush();
      ctx.currentTime = 11;
      h.midiEvent({ type: "off", pitch: 64, vel: 0, ts: 0 });
      const n = track.notes.find((x) => x.pitch === 64);
      expect(n).toBeTruthy();
      expect(n.step).toBe(4);
      expect(n.vel).toBeCloseTo(SS.midi.velToVel(50), 6);
      expect(n.len).toBe(M.recordedLength(0.5, 0.125));   // the same length rule as the on-screen keys
      expect(M.validateSong(JSON.parse(JSON.stringify(song)), new Set(SS.instruments.LIST.map((x) => x.id))).ok).toBe(true);
    });

    it("the sustain pedal holds released notes over the sustain tail, lets go on lift, and never changes Sustain", () => {
      const { h, SS, track, ctx, played } = live();
      const tail = SS.engine.SUSTAIN_TAIL;
      expect(tail).toBeGreaterThanOrEqual(1.5);
      h.midiEvent({ type: "pedal", down: true });
      expect(h.pedalDown).toBe(true);
      h.midiEvent({ type: "on", pitch: 60, vel: 90, ts: 0 });
      ctx.currentTime = 11;
      h.midiEvent({ type: "off", pitch: 60, vel: 0, ts: 0 });
      expect(Math.min(...played[0].src.stops)).toBeGreaterThanOrEqual(11 + 1.5);
      expect(track.sustain).toBe(false);
      ctx.currentTime = 11.4;
      h.midiEvent({ type: "pedal", down: false });
      expect(h.pedalDown).toBe(false);
      expect(played[0].src.stops[played[0].src.stops.length - 1]).toBeLessThanOrEqual(11.4 + 0.3 + 1e-9);
      expect(track.sustain).toBe(false);
      // with the pedal up again, a released note fades quickly
      h.midiEvent({ type: "on", pitch: 62, vel: 90, ts: 0 });
      ctx.currentTime = 12;
      h.midiEvent({ type: "off", pitch: 62, vel: 0, ts: 0 });
      expect(Math.max(...played[1].src.stops)).toBeLessThanOrEqual(12.3 + 1e-9);
    });

    it("a note held a while then let go on the pedal still rings the whole sustain tail (the real engine's voice)", () => {
      // rock-organ is a code voice that holds its level for the note's dur, then lets go: the case the pedal clipped
      const { h, SS, ctx, played, track } = live("rock-organ", { real: true });
      const tail = SS.engine.SUSTAIN_TAIL;
      h.midiEvent({ type: "pedal", down: true });
      h.midiEvent({ type: "on", pitch: 60, vel: 100, ts: 0 });   // pressed at 10 s
      ctx.currentTime = 13.5;
      h.midiEvent({ type: "off", pitch: 60, vel: 0, ts: 0 });     // let go at 13.5 s, the pedal still down
      expect(played.length).toBe(1);
      expect(played[0].srcs.length).toBeGreaterThan(0);
      for (const o of played[0].srcs) {
        const voiceEnd = o.stops[0] - 0.02;                        // where the voice's own envelope reaches silence
        const liveStop = o.stops[o.stops.length - 1];              // where the live release stops it
        expect(Math.min(voiceEnd, liveStop)).toBeGreaterThanOrEqual(13.5 + tail - 1e-9);
      }
      // it fades over the tail on the live gain, the same way an on-screen key with Sustain on does
      expect(played[0].dest.gain.calls).toContainEqual([0, 13.5, tail / 7]);
      expect(track.sustain).toBe(false);
      // the on-screen and computer keys keep their own note length
      h.noteOn("p1", track, 64, 0);
      expect(played[1].ev.dur).toBe(4);
      expect(played[0].ev.dur).toBeGreaterThanOrEqual(10);
    });

    it("a tab in the background never plays or records a real key, but still lets go of one", () => {
      const { h, track, ctx, played, env, flush } = live();
      h.midiEvent({ type: "on", pitch: 60, vel: 90, ts: 0 });
      env.document.hidden = true;
      h.record(10, 0.125);
      h.midiEvent({ type: "on", pitch: 64, vel: 90, ts: 0 });
      h.midiEvent({ type: "pedal", down: true });
      flush();
      expect(played.length).toBe(1);
      expect(track.notes).toEqual([]);
      expect(h.pedalDown).toBe(false);
      ctx.currentTime = 10.5;
      h.midiEvent({ type: "off", pitch: 60, vel: 0, ts: 0 });   // the note from before still ends
      expect(h.held.size).toBe(0);
      expect(Math.max(...played[0].src.stops)).toBeLessThanOrEqual(10.8 + 1e-9);
      env.document.hidden = false;
      h.midiEvent({ type: "on", pitch: 64, vel: 90, ts: 0 });
      expect(played.length).toBe(2);
    });

    it("a real key outside the instrument's notes neither plays nor records, and the keys never move past Lower and Higher", () => {
      const { h, track, played, flush } = live("grand-piano");   // 24 to 108
      h.record(10, 0.125);
      for (const p of [12, 23, 109, 120]) h.midiEvent({ type: "on", pitch: p, vel: 90, ts: 0 });
      flush();
      expect(played).toEqual([]);
      expect(track.notes).toEqual([]);
      h.midiEvent({ type: "on", pitch: 24, vel: 90, ts: 0 });
      expect(played.length).toBe(1);
      // every key an instrument plays, on a phone (one octave) and a computer (two): the view lands where Lower and
      // Higher could take it (the same limits as their buttons)
      const SS = loadSS("instruments.js");
      for (const narrow of [false, true]) {
        for (const inst of SS.instruments.LIST.filter((x) => x.kind === "pitched")) {
          const r = live(inst.id, { narrow });
          const octs = narrow ? 1 : 2;
          for (let p = inst.range[0]; p <= inst.range[1]; p++) {
            r.h.midiEvent({ type: "on", pitch: p, vel: 90, ts: 0 });
            r.h.midiEvent({ type: "off", pitch: p, vel: 0, ts: 0 });
            const nb = r.h.kbBase.has(r.track.id) ? r.h.kbBase.get(r.track.id) : 48;
            if (!r.h.kbBase.has(r.track.id)) continue;
            expect(nb % 12, inst.id).toBe(0);
            expect(nb <= inst.range[1] - 5 && nb + 12 * octs >= inst.range[0] + 5, `${inst.id} ${p} ${nb}`).toBe(true);
          }
        }
      }
      // toy piano (60 to 100) on a phone: its top key moves the keys only as far as Higher goes
      const toy = live("toy-piano", { narrow: true });
      toy.h.midiEvent({ type: "on", pitch: 100, vel: 90, ts: 0 });
      expect(toy.h.kbBase.get(toy.track.id)).toBe(84);
    });

    it("Home or a closing song lets go of every held note, pedal ones too", () => {
      const { h, ctx, played } = live();
      h.midiEvent({ type: "pedal", down: true });
      h.midiEvent({ type: "on", pitch: 60, vel: 90, ts: 0 });
      h.midiEvent({ type: "off", pitch: 60, vel: 0, ts: 0 });   // ringing on the pedal
      h.midiEvent({ type: "on", pitch: 64, vel: 90, ts: 0 });   // still held
      ctx.currentTime = 10.2;
      h.releaseAll();
      expect(h.held.size).toBe(0);
      for (const p of played) expect(p.src.stops[p.src.stops.length - 1]).toBeLessThanOrEqual(10.2 + 0.3 + 1e-9);
      for (const f of ["openSong", "showHome"]) expect(section(new RegExp("function " + f + "\\("), "\n}")).toContain("stopAll();");
      expect(section(/function stopAll\(/, "\n}")).toContain("releaseAll();");
    });

    it("on a drum kit, real keys from 36 play the pads (36 the kick, 37 the next pad), and other keys are ignored", () => {
      const { h, played, padLit, events } = live("classic-kit");
      for (const p of [36, 38, 43, 35, 44, 60]) h.midiEvent({ type: "on", pitch: p, vel: 100, ts: 0 });
      expect(played.map((p) => p.ev.pitch)).toEqual([0, 2, 7]);
      expect(padLit(0) && padLit(2) && padLit(7)).toBe(true);
      expect(events.pads).toBe(3);
      const fx = live("siren");
      for (const p of [36, 37]) fx.h.midiEvent({ type: "on", pitch: p, vel: 100, ts: 0 });
      expect(fx.played.map((p) => p.ev.pitch)).toEqual([0]);   // an effect has one pad
    });

    it("every live key goes through one liveKeyPressed hook, for lessons and their lit keys", () => {
      expect(section(/function noteOn\(/, "function noteOff")).toContain("liveKeyPressed(pitch, oneShot)");
      expect(fnSrc("liveKeyPressed")).toContain('lessonEvent(oneShot ? "pads" : "keys")');
      // a real key, an on-screen key and a computer key all reach the lit key with their pitch; a pad never does
      const { h, track, env } = live();
      h.midiEvent({ type: "on", pitch: 64, vel: 90, ts: 0 });
      h.noteOn("p1", track, 65, 0);
      h.noteOn("kKeyA", track, 67, 0);
      h.midiEvent({ type: "on", pitch: 12, vel: 90, ts: 0 });   // outside the piano: ignored
      expect(env.litPlayed).toEqual([64, 65, 67]);
      const kit = live("classic-kit");
      kit.h.midiEvent({ type: "on", pitch: 36, vel: 90, ts: 0 });
      kit.h.noteOn("p1", kit.track, 2, 0);
      expect(kit.env.litPlayed).toEqual([]);
    });

    describe("the keyboard controls in the keys' bar", () => {
      const bar = section(/<div class="secbar secbar--keys" id="kbd-bar">/, '<div class="kbd" id="kbd">');

      function ui(state, pedal = false) {
        const els = {};
        const get = (s) => { if (!els[s]) { const c = new Set(); els[s] = { hidden: false, textContent: "", disabled: false, classList: { toggle: (k, on) => (on ? c.add(k) : c.delete(k)), contains: (k) => c.has(k) } }; } return els[s]; };
        new Function("$", "midiState", "pedalDown", "midiBusy", fnSrc("renderMidi") + "; renderMidi();")(get, state, pedal, false);
        return get;
      }

      it("sit in the keys' bar, hidden until the page knows the browser can read a keyboard", () => {
        expect(bar).toMatch(/<div class="midi" id="midi"[^>]*hidden/);
        expect(bar).toMatch(/<button type="button" class="btn" id="midi-use" data-act="midi-connect"[^>]*><svg[^>]*>[\s\S]*?<\/svg>Use a music keyboard<\/button>/);
        expect(bar).toMatch(/id="midi-retry" data-act="midi-connect"[^>]*>Try again</);
        expect(html).toMatch(/let midiState = SS\.midi\.supported\(navigator\) \? "idle" : "unsupported"/);
        expect(ui("unsupported")("#midi").hidden).toBe(true);   // Safari, iPad, iPhone: nothing at all
      });

      it("shows the button before connecting", () => {
        const $ = ui("idle");
        expect($("#midi").hidden).toBe(false);
        expect($("#midi-use").hidden).toBe(false);
        expect($("#midi-chip").hidden).toBe(true);
        expect($("#midi-retry").hidden).toBe(true);
        expect($("#midi-msg").hidden).toBe(true);
      });

      it("shows a lit chip once connected, and Pedal down while the pedal is down", () => {
        let $ = ui("connected");
        expect($("#midi-use").hidden).toBe(true);
        expect($("#midi-chip").hidden).toBe(false);
        expect($("#midi-chip-text").textContent).toBe("Music keyboard connected");
        expect($("#midi-led").classList.contains("off")).toBe(false);
        expect($("#midi-pedal").hidden).toBe(true);
        $ = ui("connected", true);
        expect($("#midi-pedal").hidden).toBe(false);
        expect(bar).toMatch(/id="midi-pedal"[^>]*>Pedal down</);
        expect(cssText()).toMatch(/\.midi__led\{[^}]*#14B8A6/);
      });

      it("says what went wrong, with Try again and how to plug in", () => {
        let $ = ui("none");
        expect($("#midi-chip-text").textContent).toBe("No music keyboard found");
        expect($("#midi-led").classList.contains("off")).toBe(true);
        expect($("#midi-retry").hidden).toBe(false);
        expect($("#midi-msg").hidden).toBe(false);
        expect($("#midi-msg").textContent).toBe("Plug the music keyboard in with its USB cable and turn it on, then press Try again.");
        $ = ui("denied");
        expect($("#midi-chip-text").textContent).toBe("Music keyboard not allowed");
        expect($("#midi-retry").hidden).toBe(false);
        expect($("#midi-pedal").hidden).toBe(true);
      });

      it("tries the keyboard once on opening without a prompt, and lets it go when the page goes away", () => {
        expect(html).toContain("midiConnect(true)");
        expect(fnSrc("midiConnect")).toContain("SS.midi.autoConnect");
        expect(html).toMatch(/window\.addEventListener\("pagehide", \(\) => \{[^\n]*SS\.midi\.disconnect\(\)/);
        expect(html).not.toMatch(/requestMIDIAccess\(\{\s*sysex:\s*true/);
      });

      it("Help tells grown-ups how", () => {
        expect(html).toContain("Have a music keyboard? Plug it into the computer with USB and press <b>Use a music keyboard</b>.");
      });
    });
  });

  it("closes through the site and never uses the microphone", () => {
    expect(html).toMatch(/postMessage\(\{\s*ccsStudio:\s*"close"\s*\}/);
    for (const api of ["getUserMedia", "getDisplayMedia", "MediaRecorder", "createMediaStreamSource", "SpeechRecognition"]) {
      expect(html).not.toContain(api);
    }
  });
});

describe("Sound Space song lessons in the page", () => {
  /** The full source of one top-level function in the page, found by its name (string- and comment-aware). */
  function fnSource(name) {
    const m = new RegExp("\\n(?:async )?function " + name + "\\(").exec(html);
    if (!m) throw new Error("no function " + name);
    const open = html.indexOf("{", html.indexOf(")", m.index));
    let depth = 0;
    for (let j = open; j < html.length; j++) {
      const c = html[j];
      if (c === '"' || c === "'" || c === "`") { for (j++; j < html.length && html[j] !== c; j++) if (html[j] === "\\") j++; continue; }
      if (c === "/" && html[j + 1] === "*") { j = html.indexOf("*/", j) + 1; continue; }
      if (c === "/" && html[j + 1] === "/") { j = html.indexOf("\n", j); continue; }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return html.slice(m.index + 1, j + 1);
    }
    throw new Error("unclosed function " + name);
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = () => loadSS("model.js", "engine.js", "instruments.js", "icons.js", "library.js", "lessons.js");
  const copy = (o) => JSON.parse(JSON.stringify(o));

  it("the lessons list shows what each lesson builds, a Pop recipe badge on lessons 1 and 8, and about 5 minutes", () => {
    const SS = load();
    const els = {};
    const $ = (s) => (els[s] = els[s] || { innerHTML: "", hidden: true, focus() {} });
    new Function("$", "LS", "esc", "icons", "document", "lessonsBack", fnSource("openLessons") + "; openLessons();")($, SS.lessons, esc, () => {}, { activeElement: null }, null);
    const cards = els["#lessons-list"].innerHTML.split('<button type="button" class="lesson"').slice(1);
    expect(cards.length).toBe(8);
    cards.forEach((c, i) => {
      const l = SS.lessons.LESSONS[i];
      expect(c).toContain("You build: " + esc(l.song));
      expect(c).toContain("about 5 minutes");
      expect(c.includes('<span class="lesson__tag">Pop recipe</span>'), l.id).toBe(i === 0 || i === 7);
    });
    // the badge is black, with white letters, in either theme
    const css = cssText();
    const tag = (/\.lesson__tag\{([^}]*)\}/.exec(css) || [])[1] || "";
    const bg = /background:(#[0-9A-Fa-f]{3,6})/.exec(tag);
    expect(bg).toBeTruthy();
    expect(hsl(hexToRgb(bg[1])).l).toBeLessThan(0.1);
    expect(tag).toMatch(/color:#fff/i);
  });

  it("the Home tile's picture still comes from lesson 2, Your first melody", () => {
    const SS = load();
    const CAT = {}; SS.instruments.CATEGORIES.forEach((c) => { CAT[c.id] = c; });
    const svg = new Function("SS", "CAT", "esc", fnSource("lessonPreview") + "; return lessonPreview();")(SS, CAT, esc);
    expect(svg).toContain("Your first melody");
    expect(svg).toContain("STEP 2 OF 3");
    expect(svg).toContain(">melody<");
  });

  /* the grid's cells for one row, with the lesson state given */
  function gridRow(lesson, pitch, opts = {}) {
    const SS = load();
    const song = copy(opts.song || SS.lessons.LESSONS[1].startSong);
    if (opts.grid) Object.assign(song, SS.model.setGrid(song, opts.grid).song);
    const t = song.tracks[opts.track || 0];
    const rows = [{ pitch, label: "x" }];
    const body = fnSource("guideFor") + "\n" + fnSource("cellsHtml") + "; return cellsHtml(t, 0, M.totalSteps(song));";
    return new Function("song", "t", "lesson", "rows", "gridFocus", "spc", "esc", "noteSpoken", "M", "LS", "instOf", body)(
      song, t, lesson, rows, { r: -1, c: -1 }, () => song.grid || 2, esc, () => "C", SS.model, SS.lessons, (x) => SS.instruments.byId(x.instrumentId));
  }
  const outlines = (h) => [...h.matchAll(/<span class="guide"[^>]*style="grid-column:(\d+) \/ span (\d+)"/g)].map((m) => [+m[1] - 1, +m[2]]);

  it("outlines the guide notes of the step now on, on the selected track, scaled to the grid", () => {
    const SS = load();
    const l = SS.lessons.LESSONS[1];   // Twinkle Twinkle Little Star
    const now = { l, step: 0, finished: false };
    // C C on sixteenths: squares 0 and 4, each 4 long; the long G: square 24, 8 long
    expect(outlines(gridRow(now, 60))).toEqual([[0, 4], [4, 4]]);
    expect(outlines(gridRow(now, 67))).toEqual([[8, 4], [12, 4], [24, 8]]);
    expect(outlines(gridRow(now, 61))).toEqual([]);
    // on eighths they line up with the eighth squares
    expect(outlines(gridRow(now, 67, { grid: 2 }))).toEqual([[4, 2], [6, 2], [12, 4]]);
    // line 2 shows only line 2
    expect(outlines(gridRow({ l, step: 1, finished: false }, 60))).toEqual([[56, 8]]);
    // the drum track does not show the piano's outlines
    expect(outlines(gridRow(now, 60, { track: 1 }))).toEqual([]);
    // gone once the step has no guide, the lesson is done, or there is no lesson
    expect(outlines(gridRow({ l, step: 2, finished: false }, 60))).toEqual([]);
    expect(outlines(gridRow({ l, step: 0, finished: true }, 60))).toEqual([]);
    expect(outlines(gridRow(null, 60))).toEqual([]);
  });

  it("a filled note sits over its outline, and the outline never takes the tap", () => {
    const SS = load();
    const l = SS.lessons.LESSONS[1];
    const song = copy(l.startSong);
    song.tracks[0].notes.push({ step: 0, pitch: 60, len: 4, vel: 0.9 });
    const h = gridRow({ l, step: 0, finished: false }, 60, { song });
    expect(h.indexOf('class="guide"')).toBeGreaterThan(-1);
    expect(h.indexOf('class="guide"')).toBeLessThan(h.indexOf('class="note"'));
    const css = cssText();
    const g = (/\.guide\{([^}]*)\}/.exec(css) || [])[1] || "";
    expect(g).toContain("pointer-events:none");
    expect(g).toMatch(/box-shadow:inset 0 0 0 1\.5px #C4B5FD/i);
    expect(g).toMatch(/opacity:\.75/);
    expect(css).toMatch(/\.note\{[^}]*z-index:1/);
    expect(g).toMatch(/z-index:1/);
  });

  it("the outlines come and go with the step: a new step or the lesson's end redraws the grid", () => {
    expect(fnSource("nextLessonStep")).toContain("lessonStepBegins()");
    expect(fnSource("startLesson")).toContain("lessonStepBegins()");
    expect(fnSource("lessonStepBegins")).toContain("renderAll(");
    expect(fnSource("endLesson")).toMatch(/renderGrid\(\)/);
    expect(fnSource("endLesson")).toContain("paintLitKey()");
    // the grid scrolls to the outlines whenever it scrolls itself (a new step, a new track, a grid change)
    expect(fnSource("renderGrid")).toContain("scrollToGuide()");
    // a guide's pitches get rows even on an instrument whose keys don't reach them
    expect(fnSource("rowsFor")).toContain("guideFor(t)");
  });

  it("a guide step selects the first track that can play it", () => {
    const SS = load();
    const l = SS.lessons.LESSONS[4];   // Canon in D: the chords, then the bass
    const song = copy(l.startSong);
    const out = { sel: song.tracks[0].id, renders: [], layout: { keys: true } };
    const run = (step) => new Function("env", "LS", "instOf", "selTrack", "releaseAll", "renderAll", "setLayout", "paintLitKey",
      "let sel = env.sel, gridFocus = null; const song = env.song, lesson = env.lesson, layout = env.layout;\n" + fnSource("lessonStepBegins") + "; lessonStepBegins(); env.sel = sel;")(
      Object.assign(out, { song, lesson: { l, step, lit: 3 } }), SS.lessons, (t) => (t ? SS.instruments.byId(t.instrumentId) : null),
      () => song.tracks.find((t) => t.id === out.sel), () => {}, (s) => out.renders.push(s), () => {}, () => {});
    run(1);
    expect(out.sel).toBe(song.tracks[1].id);   // the bass
    expect(out.renders).toEqual([true]);
    out.sel = song.tracks[0].id;
    run(0);                                    // Play: no guide, the track stays, and the grid redraws where it is
    expect(out.sel).toBe(song.tracks[0].id);
    expect(out.renders).toEqual([true, false]);
  });

  it("a tap adds a sixteenth; a tap inside a lesson's outline fills that outline, in every lesson", () => {
    const SS = load(), M = SS.model;
    function tap(l, step, pitch, c) {
      const song = copy((l || SS.lessons.LESSONS[1]).startSong), t = song.tracks[0];
      const rows = [{ pitch }];
      new Function("song", "lesson", "rows", "M", "E", "LS", "spc", "selTrack", "instOf", "kindOf", "blip", "lessonEvent", "commit", "paintRow", "renderOverview", "scrollToGuide",
        fnSource("guideFor") + "\n" + fnSource("guideAt") + "\n" + fnSource("coverAt") + "\n" + fnSource("toggleAt") + "; toggleAt(0, " + c + ");")(
        song, l && { l, step, finished: false }, rows, M, { stepSeconds: () => 0.1 }, SS.lessons, () => song.grid, () => t,
        (x) => SS.instruments.byId(x.instrumentId), () => "pitched", () => {}, () => {}, () => {}, () => {}, () => {}, () => {});
      return t.notes.map((n) => [n.step, n.pitch, n.len]);
    }
    const twinkle = SS.lessons.LESSONS[1], jingle = SS.lessons.LESSONS[2];
    expect(tap(twinkle, 0, 67, 29)).toEqual([[24, 67, 8]]);     // the long G, tapped near its end
    expect(tap(twinkle, 0, 60, 2)).toEqual([[0, 60, 4]]);
    expect(tap(twinkle, 0, 61, 2)).toEqual([[2, 61, 1]]);       // no outline there: an ordinary tap
    expect(tap(twinkle, 2, 60, 2)).toEqual([[2, 60, 1]]);       // the Play step has no outlines
    expect(tap(null, 0, 60, 2)).toEqual([[2, 60, 1]]);
    expect(tap(jingle, 0, 64, 6)).toEqual([[4, 64, 4]]);              // the rhythm lesson too: the outline's start and length
    expect(tap(jingle, 1, 60, 41)).toEqual([[40, 60, 6]]);
  });

  it("the tip says so when Counts hides a whole guide line, and a drum step spreads its beat once it passes", () => {
    expect(fnSource("paintTip")).toContain("Set Counts back to 16 to see this line.");
    expect(fnSource("paintTip")).toContain("Your beat now plays all the way through the song.");
    const tick = fnSource("lessonTick");
    expect(tick).toContain(".after(");
    expect(tick).toContain("commit()");
    expect(tick).toContain("guideOffEnd(");
    expect(fnSource("undo")).toContain("lesson.spread = false");   // undo takes the copied beat back, so the tip line goes too
  });

  it("lights the next key of the record lesson, and moves on only when the kid plays it", () => {
    const SS = load();
    let painted = 0;
    const lesson = { l: { steps: [{ litKeys: [64, 64, 65] }] }, step: 0, lit: 0, finished: false };
    const play = new Function("lesson", "LS", "paintLitKey", fnSource("litKeyPlayed") + "; return litKeyPlayed;")(lesson, SS.lessons, () => painted++);
    play(60);
    expect([lesson.lit, painted]).toEqual([0, 0]);
    play(64);
    expect([lesson.lit, painted]).toEqual([1, 1]);
    play(62);
    expect(lesson.lit).toBe(1);
    play(64); play(65);
    expect([lesson.lit, painted]).toEqual([0, 3]);   // round again after the last
    lesson.finished = true;
    play(64);
    expect(lesson.lit).toBe(0);
    // every live key (on screen, computer keys, a real keyboard) reaches it through liveKeyPressed; pads don't
    expect(fnSource("liveKeyPressed")).toMatch(/if \(!oneShot\) litKeyPlayed\(pitch\)/);
  });

  it("paints the lit key in the lessons' purple, and only on a tune track's keys", () => {
    const SS = load();
    const keys = new Map(), on = (p) => keys.has(p) && keys.get(p).has("lit");
    const el = (p) => { if (!keys.has(p)) keys.set(p, new Set()); const c = keys.get(p); return { classList: { add: (k) => c.add(k), remove: (k) => c.delete(k) } }; };
    const l = SS.lessons.LESSONS[5];
    const song = copy(l.startSong);
    let sel = song.tracks[0].id;
    const shown = [];
    const paint = (lesson) => new Function("lesson", "selTrack", "kindOf", "showPitch", "$", "$$", fnSource("paintLitKey") + "; paintLitKey();")(
      lesson, () => song.tracks.find((t) => t.id === sel), (t) => SS.instruments.byId(t.instrumentId).kind, (t, p) => shown.push(p),
      (s) => { const m = /data-key="(\d+)"/.exec(s); return m ? el(+m[1]) : null; },
      () => [...keys.keys()].filter(on).map(el));
    const step = l.steps.findIndex((s) => s.litKeys);
    paint({ l, step, lit: 0, finished: false });
    expect(on(64)).toBe(true);
    expect(shown).toEqual([64]);
    paint({ l, step, lit: 2, finished: false });
    expect(on(64)).toBe(false);
    expect(on(65)).toBe(true);
    paint({ l, step: 0, lit: 2, finished: false });
    expect([...keys.keys()].some(on)).toBe(false);
    sel = song.tracks[1].id;   // the drums: no lit key
    paint({ l, step, lit: 0, finished: false });
    expect([...keys.keys()].some(on)).toBe(false);
    const css = cssText();
    expect(css).toMatch(/\.wk\.lit\{[^}]*#C4B5FD[^}]*\}/i);
    expect(css).toMatch(/\.wk\.lit\{[^}]*box-shadow:[^}]*rgba\(139,92,246/i);
  });
});

/* ---------------------------------------------------------------------------------------------------------------
   Sheet music: the song as real notation in a window, to print or save as PDF
   --------------------------------------------------------------------------------------------------------------- */
/** The full source of one top-level function in the page, found by its name (string- and comment-aware). */
function pageFn(name) {
  const m = new RegExp("\\n(?:async )?function " + name + "\\(").exec(html);
  if (!m) throw new Error("no function " + name);
  const open = html.indexOf("{", html.indexOf(")", m.index));
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    const c = html[j];
    if (c === '"' || c === "'" || c === "`") { for (j++; j < html.length && html[j] !== c; j++) if (html[j] === "\\") j++; continue; }
    if (c === "/" && html[j + 1] === "*") { j = html.indexOf("*/", j) + 1; continue; }
    if (c === "/" && html[j + 1] === "/") { j = html.indexOf("\n", j); continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return html.slice(m.index + 1, j + 1);
  }
  throw new Error("unclosed function " + name);
}

describe("Sound Space sheet music in the page", () => {
  const SS = loadSS("model.js", "engine.js", "instruments.js", "icons.js", "library.js", "lessons.js", "notation.js");
  const CAT = {}; SS.instruments.CATEGORIES.forEach((c) => { CAT[c.id] = c; });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FNS = ["loadAbcjs", "openSheet", "closeSheet", "paintSheet", "drawSheet", "sheetChips", "sheetClick", "sheetKey", "sheetTrap", "sheetChanged"];
  const tick = () => new Promise((r) => setTimeout(r, 0));

  function makeSong() {
    const s = SS.model.newSong({ title: "Space jam" });
    const piano = SS.model.addTrack(s, "grand-piano"), bass = SS.model.addTrack(s, "double-bass"), kit = SS.model.addTrack(s, "classic-kit");
    piano.notes.push({ step: 0, pitch: 60, len: 4, vel: 100 }, { step: 4, pitch: 62, len: 4, vel: 100 });
    bass.notes.push({ step: 0, pitch: 36, len: 8, vel: 100 });
    kit.notes.push({ step: 0, pitch: 0, len: 1, vel: 100 }, { step: 4, pitch: 1, len: 1, vel: 100 });
    return s;
  }

  /** the sheet functions run against fake elements; returns the fakes and the functions */
  function setup(song, opts = {}) {
    const doc = { activeElement: null, body: null, head: { added: [], appendChild(x) { this.added.push(x); } }, createElement: (tag) => ({ tag, remove() {} }) };
    const els = {};
    function el(name) {
      const attrs = {}, cls = new Set();
      return {
        name, hidden: true, textContent: "", innerHTML: "", disabled: false, dataset: {},
        setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
        classList: { add: (k) => cls.add(k), remove: (k) => cls.delete(k), contains: (k) => cls.has(k), toggle: (k, on) => ((on === undefined ? !cls.has(k) : on) ? cls.add(k) : cls.delete(k)) },
        focus() { doc.activeElement = this; }, closest: () => null, contains: (x) => !!(x && x.inSheet),
      };
    }
    const $ = (s) => (els[s] = els[s] || el(s));
    doc.body = el("body");
    const focusables = opts.focusables || [];
    const $$ = () => focusables;
    const drawn = [];
    const A = { renderAbc: (target, abc, o) => drawn.push({ target, abc, o }) };
    const win = opts.noAbcjs ? {} : { ABCJS: A };
    const store = new Map(opts.stored || []);
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    const printed = [];
    win.print = () => printed.push(1);
    const narrowMq = { matches: !!opts.narrow };
    const opener = el("opener");
    doc.activeElement = opener;
    const trackById = (id) => song.tracks.find((t) => t.id === id) || null;
    const instOf = (t) => SS.instruments.byId(t.instrumentId);
    const timers = [];
    const setTimeout_ = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    const consts = ["ABCJS_SRC", "SHEET_EMPTY"].map((n) => (new RegExp("\\nconst " + n + " = [^\\n]*\\n").exec(html) || [""])[0]).join("");
    const body = consts
      + "let sheetBack = null, sheetWhich = \"all\", sheetNames = " + (opts.names === false ? "false" : "true") + ", abcjsLoading = null, sheetTimer = 0;\n"
      + FNS.map(pageFn).join("\n")
      + "\nreturn { " + FNS.join(", ") + ", state: () => ({ sheetWhich, sheetNames }) };";
    const api = new Function("$", "$$", "song", "SS", "CAT", "esc", "trackById", "instOf", "narrowMq", "document", "window", "safeStorage", "setTimeout", "clearTimeout", body)(
      $, $$, song, SS, CAT, esc, trackById, instOf, narrowMq, doc, win, () => storage, setTimeout_, () => {});
    return { api, $, doc, drawn, store, printed, opener, timers, win };
  }
  const chip = (id) => ({ dataset: { sheet: "track", id }, disabled: false });
  const click = (env, target) => env.api.sheetClick({ target: { closest: () => target }, currentTarget: env.$("#sheet") });

  it("puts a Sheet music button next to Export, and a dialog with Print, Save as PDF and Close", () => {
    const bar = section(/<section id="editor"/, "</header>");
    expect(bar).toMatch(/<button type="button" class="btn" id="ss-sheet" data-act="sheet"[^>]*>[\s\S]*?<span class="label-wide">Sheet music<\/span><\/button>\s*<button type="button" class="btn btn--primary" id="ss-export"/);
    expect(html).toContain('if (act === "sheet") return openSheet();');
    const dlg = section(/<div id="sheet" class="modal sheet" hidden>/, '<div id="toast"');
    expect(dlg).toMatch(/role="dialog" aria-modal="true" aria-labelledby="sheet-title"/);
    expect(dlg).toMatch(/<button type="button" class="btn" id="sheet-print" data-sheet="print"[^>]*>[\s\S]*?Print<\/button>/);
    expect(dlg).toMatch(/<button type="button" class="btn btn--primary" id="sheet-pdf" data-sheet="print"[^>]*>[\s\S]*?Save as PDF<\/button>/);
    expect(dlg).toMatch(/<button type="button" class="btn icon" id="sheet-close" data-sheet="close" aria-label="Close"/);
    expect(dlg).toMatch(/<button type="button" class="toggle" id="sheet-names" data-sheet="names" aria-pressed="true"><span class="led" aria-hidden="true"><\/span>Note names<\/button>/);
    expect(dlg).toContain("Add some notes, then come back to see them as sheet music.");
    // the bar keeps clear of the centered song name: the word "Sheet music" only on wide screens
    expect(cssText()).toMatch(/@media \(max-width:1279px\)\{ #ss-sheet \.label-wide\{ display:none; \}/);
    // abcjs draws into an inner box, so the white page keeps its margins
    expect(dlg).toContain('<div class="sheet__paper" id="sheet-page"><div id="sheet-paper"></div></div>');
  });

  it("the Sheet music button opens the dialog with the song's name, and draws the whole song", async () => {
    const s = makeSong();
    const env = setup(s);
    env.api.openSheet();
    expect(env.$("#sheet").hidden).toBe(false);
    expect(env.doc.body.classList.contains("sheet-open")).toBe(true);
    expect(env.$("#sheet-title").textContent).toBe("Sheet music: Space jam");
    expect(env.doc.activeElement).toBe(env.$("#sheet-close"));
    expect(env.$("#sheet-foot").textContent).toBe("Made from your song: 4 beats in a bar, Speed 120. Change a note in the editor and the sheet music changes too.");
    await tick();
    expect(env.drawn.length).toBe(1);
    expect(env.drawn[0].target).toBe(env.$("#sheet-paper"));
    expect(env.drawn[0].abc).toBe(SS.notation.toAbc(s, { tracks: "all", names: true }));
    expect(env.drawn[0].o.responsive).toBe("resize");
    expect(env.$("#sheet-page").hidden).toBe(false);
    expect(env.$("#sheet-empty").hidden).toBe(true);
  });

  it("on a phone the page keeps its size and scrolls sideways instead of shrinking", async () => {
    const env = setup(makeSong(), { narrow: true });
    env.api.openSheet();
    await tick();
    expect(env.drawn[0].o.responsive).toBeUndefined();
    expect(env.drawn[0].o.staffwidth).toBeGreaterThanOrEqual(560);
    const css = cssText();
    expect(css).toMatch(/\.sheet__scroll\{[^}]*overflow:auto/);
    expect(css).toMatch(/@media \(max-width:640px\)\{[\s\S]*?\.sheet__box\{[^}]*height:100%/);
  });

  it("the chips show All tracks, then each track with its color, and switch which track is drawn", async () => {
    const s = makeSong();
    const env = setup(s);
    env.api.openSheet();
    const chips = env.$("#sheet-chips").innerHTML;
    const labels = [...chips.matchAll(/<button type="button" class="chip"[^>]*data-sheet="track" data-id="([^"]*)" aria-pressed="(true|false)">(?:<i style="background:([^"]+)"[^>]*><\/i>)?([^<]+)<\/button>/g)];
    expect(labels.map((m) => m[4])).toEqual(["All tracks", "Grand piano", "Double bass", "Classic kit"]);
    expect(labels.map((m) => m[2])).toEqual(["true", "false", "false", "false"]);
    expect(labels.slice(1).map((m) => m[3])).toEqual([CAT.keys.color, CAT.bass.color, CAT.drums.color]);
    click(env, chip(s.tracks[1].id));
    expect(env.api.state().sheetWhich).toBe(s.tracks[1].id);
    expect(env.$("#sheet-chips").innerHTML).toMatch(new RegExp('data-id="' + s.tracks[1].id + '" aria-pressed="true"'));
    await tick();
    const last = env.drawn[env.drawn.length - 1].abc;
    expect(last).toBe(SS.notation.toAbc(s, { tracks: s.tracks[1].id, names: true }));
    expect(last.match(/\nV:/g).length).toBe(1);
    click(env, chip("all"));
    expect(env.api.state().sheetWhich).toBe("all");
  });

  it("the Note names switch turns the letter lines off and on, and is remembered", async () => {
    const s = makeSong();
    const env = setup(s);
    env.api.openSheet();
    await tick();
    expect(env.drawn[0].abc).toMatch(/\nw: /);
    expect(env.$("#sheet-names").getAttribute("aria-pressed")).toBe("true");
    click(env, { dataset: { sheet: "names" }, disabled: false });
    await tick();
    expect(env.api.state().sheetNames).toBe(false);
    expect(env.$("#sheet-names").getAttribute("aria-pressed")).toBe("false");
    expect(env.drawn[env.drawn.length - 1].abc).not.toMatch(/\nw: /);
    expect(env.store.get("ccs-sound-space-sheet-names")).toBe("0");
    click(env, { dataset: { sheet: "names" }, disabled: false });
    await tick();
    expect(env.drawn[env.drawn.length - 1].abc).toMatch(/\nw: /);
    expect(env.store.get("ccs-sound-space-sheet-names")).toBe("1");
    // on by default; the saved choice is read in a try/catch
    expect(pageFn("loadSheetNames")).toMatch(/try \{[^}]*getItem\(SHEET_NAMES_KEY\) !== "0"[^}]*\} catch\(e\)\{ return true; \}/);
  });

  it("Escape closes it and gives focus back to the button; Tab stays inside", () => {
    let env = null;
    const first = { inSheet: true, disabled: false, focus() { env.doc.activeElement = this; }, closest: () => null };
    const last = { inSheet: true, disabled: false, focus() { env.doc.activeElement = this; }, closest: () => null };
    env = setup(makeSong(), { focusables: [first, last] });
    env.api.openSheet();
    let prevented = 0;
    const key = (k, shift) => env.api.sheetKey({ key: k, shiftKey: !!shift, preventDefault: () => prevented++ });
    env.doc.activeElement = last;
    expect(key("Tab")).toBe(true);
    expect(env.doc.activeElement).toBe(first);
    expect(key("Tab", true)).toBe(true);
    expect(env.doc.activeElement).toBe(last);
    expect(key("Escape")).toBe(true);
    expect(prevented).toBe(3);
    expect(env.$("#sheet").hidden).toBe(true);
    expect(env.doc.body.classList.contains("sheet-open")).toBe(false);
    expect(env.doc.activeElement).toBe(env.opener);
    expect(key("Escape")).toBe(false);   // closed: other keys work again
    // the page's key handler asks the sheet first, and the other shortcuts stay off while it is open
    expect(html).toMatch(/document\.addEventListener\("keydown", e => \{\n  if \(sheetKey\(e\)\) return;/);
    expect(html).toMatch(/const dialogOpen = \(\) => [^\n]*!\$\("#sheet"\)\.hidden/);
  });

  it("the dimmed area and Close shut it; Print and Save as PDF open the print window", () => {
    const env = setup(makeSong());
    env.api.openSheet();
    click(env, { dataset: { sheet: "print" }, disabled: false });
    expect(env.printed.length).toBe(1);
    env.api.sheetClick({ target: env.$("#sheet"), currentTarget: env.$("#sheet") });
    expect(env.$("#sheet").hidden).toBe(true);
    env.api.openSheet();
    click(env, { dataset: { sheet: "close" }, disabled: false });
    expect(env.$("#sheet").hidden).toBe(true);
    expect(html).toContain('$("#sheet").addEventListener("click", sheetClick);');
  });

  it("an empty song shows the friendly line instead of the page, and nothing to print", async () => {
    const s = SS.model.newSong({ title: "Nothing yet" });
    SS.model.addTrack(s, "grand-piano");
    const env = setup(s);
    env.api.openSheet();
    await tick();
    expect(env.$("#sheet-empty").hidden).toBe(false);
    expect(env.$("#sheet-empty").textContent).toBe("Add some notes, then come back to see them as sheet music.");
    expect(env.$("#sheet-page").hidden).toBe(true);
    expect(env.drawn.length).toBe(0);
    expect(env.$("#sheet-print").disabled).toBe(true);
    expect(env.$("#sheet-pdf").disabled).toBe(true);
  });

  it("changes to the song while it is open draw it again, a moment later", () => {
    expect(pageFn("commit")).toContain("sheetChanged();");
    expect(pageFn("replaceSong")).toContain("sheetChanged();");
    expect(html).toContain("\nconst busy = () => recording || countingIn;\n");   // the line after replaceSong, as it was
    const env = setup(makeSong());
    env.api.sheetChanged();
    expect(env.timers.length).toBe(0);           // closed: nothing to do
    env.api.openSheet();
    env.api.sheetChanged();
    expect(env.timers.length).toBe(1);
    expect(env.timers[0].ms).toBeGreaterThanOrEqual(80);
  });

  it("loads abcjs from the vendor folder the first time, never from a CDN", async () => {
    const env = setup(makeSong(), { noAbcjs: true });
    const p = env.api.loadAbcjs();
    expect(env.api.loadAbcjs()).toBe(p);         // one script tag, however often it is asked
    expect(env.doc.head.added.length).toBe(1);
    const tag = env.doc.head.added[0];
    expect(tag.tag).toBe("script");
    expect(tag.src).toBe("../vendor/abcjs/abcjs-basic-min.js");
    env.win.ABCJS = { renderAbc() {} };
    tag.onload();
    await expect(p).resolves.toBe(env.win.ABCJS);
    expect(html).toContain('const ABCJS_SRC = "../vendor/abcjs/abcjs-basic-min.js"');
    expect(html).not.toMatch(/<script[^>]*abcjs/);                         // not loaded with the page
    expect(html).not.toMatch(/jsdelivr|unpkg|cdnjs/i);
    const vendored = readFileSync(new URL("../assets/vendor/abcjs/abcjs-basic-min.js", import.meta.url), "utf8");
    expect(vendored.slice(0, 120)).toContain("abcjs_basic v6.4.4");
    expect(existsSync(new URL("../assets/vendor/abcjs/LICENSE", import.meta.url))).toBe(true);
    expect(html).toMatch(/<script src="sound-space\/notation\.js"><\/script>/);
  });

  it("if abcjs cannot load, it says so and tries again next time", async () => {
    const env = setup(makeSong(), { noAbcjs: true });
    env.api.openSheet();
    const tag = env.doc.head.added[0];
    tag.onerror();
    await tick(); await tick();
    expect(env.$("#sheet-empty").hidden).toBe(false);
    expect(env.$("#sheet-empty").textContent).toMatch(/couldn’t load/);
    env.api.loadAbcjs();
    expect(env.doc.head.added.length).toBe(2);
  });

  it("prints only the page, in black on white, with no app around it", () => {
    const css = cssText();
    const print = (/@media print\{([\s\S]*?)\n\}/.exec(css) || [])[1] || "";
    expect(print).toMatch(/body\.sheet-open > \*:not\(#sheet\)\{[^}]*display:none/);
    expect(print).toMatch(/\.sheet__head, \.sheet__tools, \.sheet__foot[^{]*\{[^}]*display:none/);
    expect(print).toMatch(/\.sheet__paper\{[^}]*background:#fff[^}]*color:#000/);
    expect(css).toMatch(/\.sheet__paper\{[^}]*background:#fff/);
  });
});

/* Owner: the Main volume is labelled, has a % box like the track volumes, and sits beside the play controls. */
describe("Sound Space: Main volume beside the play controls", () => {
  const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
  let got = {};
  try { got = new Function(block.slice(block.indexOf("*/") + 2) + "; return { applyVolText, volBoxKey, volPercent };")(); } catch (e) { /* each test fails on its own */ }
  const { applyVolText, volBoxKey, volPercent } = got;
  const css = cssText();
  const transport = section(/<div class="transport"/, '<div class="main">');
  const order = (...ids) => ids.map((id) => transport.indexOf(id));

  it("comes right after the beat counter, before Loop, keeping its id", () => {
    const [beat, live, vol, loop, countin] = order('id="ss-beat"', 'id="rec-live"', 'id="ss-volume"', 'id="ss-loop"', 'id="ss-countin"');
    expect(beat).toBeGreaterThan(0);
    expect(vol).toBeGreaterThan(live);
    expect(vol).toBeLessThan(loop);
    expect(vol).toBeLessThan(countin);
    expect(transport).toMatch(/<span class="fader fader--main" style="--steps:10;--c:#14B8A6"><input type="range" class="slider" id="ss-volume" min="0" max="100" value="80" aria-label="Main volume"><\/span>/);
  });

  it("is labelled Main, with a speaker icon first and a % box last", () => {
    const grp = section(/<div class="field vol"/, "</div>");
    expect(grp).toMatch(/<i data-lucide="volume-2"><\/i><span class="vol__lab">Main<\/span><span class="fader fader--main"/);
    expect(grp).toMatch(/<input type="number" class="mnum" id="ss-volnum" min="0" max="100" step="1" inputmode="numeric" value="80" aria-label="Main volume, percent">/);
    expect(grp).toMatch(/<span class="track__unit" aria-hidden="true">%<\/span>/);
    expect(grp.indexOf('id="ss-volume"')).toBeLessThan(grp.indexOf('id="ss-volnum"'));
  });

  it("the box mirrors the slider, and the slider and the box go through one setter", () => {
    expect(html).toMatch(/function setMainVolume\(/);
    const set = section(/function setMainVolume\(/, "\n}");
    expect(set).toContain('$("#ss-volume").value = String(p);');
    expect(set).toContain('$("#ss-volnum").value = String(p);');
    expect(set).toContain("liveBus.gain.value = song.volume");
    expect(html).toMatch(/\$\("#ss-volume"\)\.addEventListener\("input", e => \{ if \(!song\) return; setMainVolume\(e\.target\.value\);/);
    // on a song open and an undo the box follows the song
    const sync = section(/\$\("#ss-volume"\)\.value = Math\.round\(song\.volume \* 100\);/, "renderUndo();");
    expect(sync).toContain('$("#ss-volnum").value');
  });

  it("typing 50 sets the song volume to 0.5 in one undo step; Escape restores; clamps to 0-100", () => {
    const song = { volume: 0.8 };
    expect(applyVolText(song, "50")).toEqual({ value: 50, changed: true });
    expect(song.volume).toBe(0.5);
    expect(applyVolText(song, "50").changed).toBe(false);   // no second undo step for the same number
    expect(applyVolText(song, "150").value).toBe(100);
    expect(song.volume).toBe(1);
    expect(applyVolText(song, "-3").value).toBe(0);
    expect(song.volume).toBe(0);
    expect(applyVolText(song, "abc")).toEqual({ value: 0, changed: false });
    expect(volBoxKey("Escape", false, "42", 80)).toEqual({ show: 80, blur: true });
    expect(volBoxKey("ArrowUp", true, "95", 95)).toEqual({ set: 100 });
    expect(volBoxKey("ArrowDown", false, "0", 0)).toEqual({ set: 0 });
    expect(volPercent(0.5)).toBe(50);
    const typed = section(/function typedMainVolume\(/, "\n}");
    expect(typed).toContain("applyVolText(song, text)");
    expect(typed).toContain("if (res.changed) commit();");
    expect(html).toMatch(/\$\("#ss-volnum"\)\.addEventListener\("change", e => typedMainVolume\(e\.target\.value\)\)/);
    expect(html).toMatch(/\$\("#ss-volnum"\)\.addEventListener\("keydown", e => \{[\s\S]*?volBoxKey\(e\.key, e\.shiftKey, n\.value, volPercent\(song\.volume\)\)/);
  });

  it("fits the bar: narrower fader, then no % below 1100px; the Main label stays above 640px; phones keep the box", () => {
    expect(css).toMatch(/\.vol\{ margin-left:0; \}/);
    expect(css).toMatch(/\.vol__lab\{[^}]*color:var\(--mute\)/);
    expect(css).toMatch(/@media \(max-width:1439px\) and \(min-width:641px\)\{[^\n]*\.fader--main\{ width:80px; \}/);
    expect(css).toMatch(/@media \(max-width:1100px\) and \(min-width:641px\)\{[^}]*\.vol__box \.track__unit\{ display:none; \}/);
    expect(css).not.toMatch(/\.vol__lab\{ display:none/);
    // the first @media block in the stylesheet is untouched
    expect(css.indexOf("@media")).toBe(css.indexOf("@media (max-width:1279px){ #ss-sheet"));
  });

  it("the transport bar is a little darker than the keys bar, with its own tokens", () => {
    expect(css).toMatch(/\.transport\{[^}]*background:linear-gradient\(var\(--trans-a\),var\(--trans-b\)\); border-bottom:1px solid var\(--line\)/);
  });

  it("Counts and Speed keep plain tooltips for when their words are hidden; Main's group has no duplicate name", () => {
    expect(transport).toContain('id="ss-counts" role="radiogroup" aria-labelledby="counts-lbl" title="Counts: how long the loop is. Recording stays inside it."');
    expect(transport).toContain('<span class="num" title="Length: how long the whole song is, in bars of 4 counts (up to 64)">');
    expect(transport).toContain('<span class="num" title="Speed: how fast the beat goes">');
    expect(transport).toMatch(/<div class="field vol" role="group" title=/);
    expect(transport).not.toMatch(/class="field vol"[^>]*aria-label/);
    expect((css.match(/\.vol\{ margin-left:0; \}/g) || []).length).toBe(1);
  });

  it("Help says what Main does", () => {
    expect(html).toContain("Main sets how loud the whole song plays. Each track's Volume is in its card.");
  });

  it("live: a held key pins its track's chain until it is let go, then the chain lives to the release end plus the hold", () => {
    const on = section(/function noteOn\(/, "function noteOff");
    expect(on).toMatch(/release:liveChains\.hold\(track\)/);
    const off = section(/function noteOff\(/, "function releaseAll");
    expect(off).toMatch(/if \(h\.release\) h\.release\(/);
    expect(off).toContain("E.CHAIN_HOLD");
  });

  it("Record is a soft maroon: --rec is #8E2457 and .rec never uses the old red", () => {
    expect(css).toMatch(/--rec:#8E2457;/);
    const rules = css.split("\n").filter((l) => /^\.rec\b|^@keyframes recglow|^\.lcd\.cue/.test(l)).join("\n");
    expect(rules).toContain("#8E2457");
    // owner: "tone down the color just a bit" - the same hue, softer; the account-space maroon stays as it was
    expect(rules).toContain(".rec{ background:radial-gradient(circle at 50% 30%, #C0638F, #8E2457 55%, #651A3E);");
    expect(rules).toContain("0 3px 0 #4A1430,0 6px 14px rgba(142,36,87,.3)");
    expect(rules).toMatch(/\.rec\.on\{[^}]*rgba\(214,120,160,\.4\),0 0 18px rgba\(142,36,87,\.55\); animation:recglow/);
    expect(rules).toContain(".lcd.cue{ color:#D678A0; text-shadow:0 0 8px rgba(142,36,87,.55); }");
    expect(rules).not.toMatch(/#A0185A|160,24,90|228,106,158/);
    expect(rules).not.toMatch(/#FF4D5A|255,77,90|#FF8C95|#C22633|#8E1824/i);
    expect(css).toMatch(/\.rec svg\{ fill:#fff; \}/);
  });
});

/* ---------------------------------------------------------------------------------------------------------------
   Final fix wave: transport buttons, Export while a sound file is made, the pattern preview's playhead and outline,
   Count-in beside Loop, darker drum pads, small tile corners and the picker's outline Hear button
   --------------------------------------------------------------------------------------------------------------- */
describe("Sound Space final fix wave", () => {
  const css = cssText();
  const rule = (sel) => { const i = css.indexOf("\n" + sel + "{"); return i < 0 ? "" : css.slice(i + 1, css.indexOf("}", i) + 1); };

  it("Play, Record and Stop are rounded squares, not circles, with Record's maroon and its pulse kept", () => {
    const round = rule(".round");
    expect(round).toBeTruthy();
    expect(round).not.toMatch(/border-radius:50%/);
    expect(round).toMatch(/border-radius:var\(--r-sm\)/);
    expect(round).toMatch(/width:46px; height:46px/);
    expect(rule(".rec")).toMatch(/#8E2457/);
    expect(rule(".rec.on")).toMatch(/animation:recglow/);
    expect(rule(".stop")).not.toMatch(/border-radius:50%/);
  });

  describe("Export while a sound file is being made", () => {
    function exportUi() {
      const el = (o) => Object.assign({ hidden: false, disabled: false, focused: 0, focus() { this.focused++; }, contains: () => true, textContent: "", style: {} }, o);
      const els = { "#export": el({ hidden: true }), "#export-bar": el({ hidden: true }), "#export-go": el(), "#export-close": el(), "#export .export__box": el(), "#export-msg": el(), "#export-fill": el(), "#export-len": el() };
      const $ = (s) => els[s] || null;
      const calls = { stopAll: 0, said: [], downloads: [] };
      const env = {
        $, $$: () => [], song: { title: "My song", tracks: [{ notes: [{ step: 0 }] }] },
        stopAll: () => { calls.stopAll++; }, exportSay: (t) => calls.said.push(t), paintExport: () => {}, exportBar: () => {},
        clamp: (v, a, b) => Math.max(a, Math.min(b, v)), document: { activeElement: null }, EXPORT_TIMES: [1, 2, 4],
        exportTrap: () => {}, cleanTitle: (t) => t, clone: (o) => JSON.parse(JSON.stringify(o)), count: () => {}, wait: () => Promise.resolve(),
        downloadFile: (b, n) => calls.downloads.push(n), SAMPLE_BASE: "", I: { byId: () => null },
        SS: { wav: { encodeWav: () => new Uint8Array(4) } }, Blob: class { constructor(p) { this.p = p; } },
        setInterval: () => 0, clearInterval: () => {},
        window: { OfflineAudioContext: class {} }, E: { exportFrames: () => 44100, createVoices: () => ({}), renderOffline: null }
      };
      const names = Object.keys(env);
      const body = "let exportTimes = 2, exportBack = null, exportRun = 0, exportBusy = false;\nconst songHasNotes = () => true;\n"
        + ["openExport", "closeExport", "exportKey", "exportClick", "exportWav", "setExportTimes"].map(pageFn).join("\n")
        + "\nreturn { openExport, closeExport, exportKey, exportClick, exportWav, get busy(){ return exportBusy; } };";
      const api = new Function(...names, body)(...names.map((k) => env[k]));
      return { api, els, env, calls };
    }

    it("opening Export stops the song playing", () => {
      const { api, els, calls } = exportUi();
      api.openExport();
      expect(els["#export"].hidden).toBe(false);
      expect(calls.stopAll).toBe(1);
    });

    it("a tap on the dimmed area or Escape does nothing while the WAV is being made, and closes it otherwise", async () => {
      const { api, els, env } = exportUi();
      let finish;
      env.E.renderOffline = () => new Promise((r) => { finish = r; });
      api.openExport();
      const making = api.exportWav();
      expect(api.busy).toBe(true);
      const scrim = els["#export"];
      api.exportClick({ target: scrim, currentTarget: scrim });
      expect(scrim.hidden).toBe(false);
      let prevented = false;
      expect(api.exportKey({ key: "Escape", preventDefault() { prevented = true; } })).toBe(true);
      expect(prevented).toBe(true);
      expect(scrim.hidden).toBe(false);
      finish({ buffer: { numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(4) }, failed: [] });
      await making;
      expect(api.busy).toBe(false);
      api.exportClick({ target: scrim, currentTarget: scrim });
      expect(scrim.hidden).toBe(true);
      api.openExport();
      api.exportKey({ key: "Escape", preventDefault() {} });
      expect(scrim.hidden).toBe(true);
    });

    it("a finished WAV with no list of silent instruments still says Done", async () => {
      const { api, env, calls } = exportUi();
      env.E.renderOffline = async () => ({ buffer: { numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(4) } });
      api.openExport();
      await api.exportWav();
      expect(calls.downloads).toEqual(["My song.wav"]);
      expect(calls.said[calls.said.length - 1]).toMatch(/^Done! Your sound file is in your downloads: My song\.wav/);
    });
  });

  describe("the playing pattern card", () => {
    const block = html.split("/* ---- helpers the tests run on their own")[1].split("/* ---- end of helpers")[0];
    const { previewHeadAt } = (() => { try { return new Function(block.slice(block.indexOf("*/") + 2) + "; return { previewHeadAt };")(); } catch (e) { return {}; } })();

    it("the line moves across the preview at the pattern's speed and length, and goes when it ends", () => {
      expect(typeof previewHeadAt).toBe("function");
      // 16 squares of a quarter second each: 4 seconds across
      expect(previewHeadAt(-0.1, 0.25, 16, false)).toBe(null);           // not started yet
      expect(previewHeadAt(0, 0.25, 16, false)).toEqual({ x: 0, at: 0 });
      expect(previewHeadAt(1, 0.25, 16, false)).toEqual({ x: 0.25, at: 4 });
      expect(previewHeadAt(1.1, 0.25, 16, false).x).toBeCloseTo(0.275, 6); // a smooth glide between squares
      expect(previewHeadAt(4, 0.25, 16, false)).toBe(null);               // played through: the line goes
      // with reduced motion it jumps square by square
      expect(previewHeadAt(1.1, 0.25, 16, true)).toEqual({ x: 0.25, at: 4 });
      expect(previewHeadAt(1.24, 0.25, 16, true)).toEqual({ x: 0.25, at: 4 });
      expect(previewHeadAt(1.25, 0.25, 16, true)).toEqual({ x: 0.3125, at: 5 });
    });

    it("each note in the picture knows where it starts and ends, so it lights as the line passes", () => {
      const CAT = { drums: { color: "#D946EF" }, keys: { color: "#5B8CFF" } };
      const TYPE_TC = { drums: "drums", melody: "keys" };
      const patPicture = new Function("CAT", "TYPE_TC", pageFn("patPicture") + "; return patPicture;")(CAT, TYPE_TC);
      const svg = patPicture({ type: "melody", counts: 4, grid: 2, notes: [{ step: 0, len: 2, pitch: 60 }, { step: 4, len: 1, pitch: 62 }] });
      expect(svg).toMatch(/<rect data-s="0" data-e="2" /);
      expect(svg).toMatch(/<rect data-s="4" data-e="5" /);
      expect(css).toMatch(/\.pat__pv rect\.lit\{[^}]*\}/);
    });

    it("the playing card gets its category color outline, and loses it when it stops", () => {
      const card = (id) => { const c = { cls: new Set(), classList: { toggle(n, on) { if (on) c.cls.add(n); else c.cls.delete(n); } } }; return { btn: { dataset: { libPlay: id }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, closest: () => c }, c }; };
      const a = card("p1"), b = card("p2");
      let pv = { id: "p1" };
      const mark = new Function("$$", "getPv", pageFn("markPreview").replace(/\bpv\b/g, "getPv()") + "; return markPreview;")(() => [a.btn, b.btn], () => pv);
      mark();
      expect(a.c.cls.has("pat--on")).toBe(true);
      expect(b.c.cls.has("pat--on")).toBe(false);
      expect(a.btn.attrs["aria-pressed"]).toBe("true");
      pv = null; mark();
      expect(a.c.cls.has("pat--on")).toBe(false);
      const on = rule(".pat.pat--on");
      expect(on).toMatch(/border-color:var\(--tc\)/);
      expect(on).toMatch(/0 0 0 2px color-mix\(in srgb,var\(--tc\) 30%,transparent\)/);
      expect(rule(".pat__head")).toMatch(/width:2px/);
      expect(html).toContain(`'<div class="pat' + (pv && pv.id === p.id ? " pat--on" : "") + '"`);   // a re-drawn list keeps it
    });
  });

  it("Count-in sits right after Loop, before the line and Counts, Grid and Speed", () => {
    const bar = section(/<div class="transport"/, "\n  </div>");
    const at = (s) => bar.indexOf(s);
    expect(at('id="ss-loop"')).toBeGreaterThan(0);
    expect(at('id="ss-countin"')).toBeGreaterThan(at('id="ss-loop"'));
    expect(at('id="ss-countin"')).toBeLessThan(at('class="sep"'));
    expect(at('class="sep"')).toBeLessThan(at('id="ss-counts"'));
    const between = bar.slice(at('id="ss-loop"'), bar.lastIndexOf("<button", at('id="ss-countin"')));
    expect(between.match(/<button|<div|<span class="sep"/g)).toBe(null);   // nothing between Loop and Count-in
  });

  it("drum and effect pads are dark cards with a 2px line in their color across the top, lit only when hit", () => {
    const pad = rule(".pad");
    expect(pad).toBeTruthy();
    expect(pad).not.toMatch(/linear-gradient\(color-mix\(in srgb,var\(--tc\)/);      // no bright full-color gradient at rest
    expect(pad).toMatch(/background:linear-gradient\(var\(--tc-a\),var\(--tc-b\)\)/);
    expect(pad).toMatch(/border:1px solid var\(--tc-edge\)/);
    expect(pad).toMatch(/color:var\(--text\)/);
    const top = rule(".pad::before");
    expect(top).toMatch(/top:0/);
    expect(top).toMatch(/height:2px/);
    expect(top).toMatch(/left:8px; right:8px/);
    expect(top).toMatch(/background:var\(--tc\)/);
    expect(top).toMatch(/border-radius:0 0 2px 2px/);
    expect(css).toMatch(/\.pad:active, \.pad\.down\{[^}]*background:color-mix\(in srgb,var\(--tc\) 35%,var\(--tc-b\)\)/);
    expect(css).toMatch(/\.pad:hover\{[^}]*translateY\(-1px\)/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce){\n  .launch"));
    expect(reduced.slice(0, reduced.indexOf("\n}\n"))).toContain(".pad:hover, .pad:active, .pad.down{ transform:none; }");
  });

  it("the small and medium instrument tiles have 4px corners, the picker's big picture 8px; the others keep theirs", () => {
    expect(rule(".tile--sm")).toMatch(/border-radius:4px/);
    expect(rule(".tile--md")).toMatch(/border-radius:4px/);
    expect(rule(".tile--art")).toMatch(/border-radius:8px/);
    expect(rule(".tile")).toMatch(/border-radius:var\(--r\)/);
  });

  it("the picker's Hear button is a plain outline: no teal or color fill, a border, 4px corners", () => {
    const pl = rule(".ins__pl");
    expect(pl).toBeTruthy();
    expect(pl).not.toMatch(/#14B8A6|#5EE6D8|#0B8378|var\(--go\)|var\(--tc\)|radial-gradient/);
    // a neutral dark outline and icon on a faint white wash, so it shows on every (light) instrument picture
    expect(pl).toMatch(/border:1\.5px solid rgba\(20,20,26,\.72\)/);
    expect(pl).toMatch(/color:rgba\(20,20,26,\.82\)/);
    expect(pl).toMatch(/background:rgba\(255,255,255,\.35\)/);
    expect(pl).toMatch(/border-radius:4px/);
    expect(pl).toMatch(/width:28px; height:28px/);
    expect(rule(".ins__pl svg")).not.toMatch(/#05312D/);
    expect(css).toMatch(/\.ins__pl:hover[^{]*\{ background:rgba\(255,255,255,\.6\); border-color:rgba\(20,20,26,\.9\); \}/);
    expect(css).not.toMatch(/\.ins__pl\{ --pl-line:rgba\(255,255,255/);   // never a white outline
  });
});

describe("Sound Space beats and patterns filters stay fixed", () => {
  const css = cssText();
  const aside = section(/<aside class="panel right" id="ss-library"/, "</aside>");
  const rule = (sel) => { const i = css.indexOf("\n" + sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i)); };
  it("only the pattern list scrolls; the heading, filters and count sit outside it", () => {
    const scroll = aside.indexOf('id="lib-scroll"');
    expect(scroll).toBeGreaterThan(0);
    expect(aside.indexOf('class="lib__filters"')).toBeLessThan(scroll);
    expect(aside.indexOf('id="lib-count"')).toBeLessThan(scroll);
    expect(aside.indexOf('id="lib-list"')).toBeGreaterThan(scroll);
    expect(aside.indexOf('id="lib-more"')).toBeGreaterThan(scroll);
    expect(rule(".right")).toMatch(/display:flex/);
    expect(rule(".right")).toMatch(/overflow:hidden/);
    expect(rule("#lib-body")).toMatch(/min-height:0/);
    expect(rule(".lib__scroll")).toMatch(/overflow-y:auto/);
    expect(rule(".lib__scroll")).toMatch(/min-height:0/);
  });
  it("the opened library sheet on narrow screens keeps the column layout", () => {
    expect(css).toMatch(/body\.lib-open \.right\{ display:flex; \}/);
    expect(css).not.toMatch(/body\.lib-open \.right\{ display:block; \}/);
  });
  it("changing the track scrolls the list back to the top, not the whole panel", () => {
    expect(html).toContain('$("#lib-scroll").scrollTop = 0');
    expect(html).not.toContain('$("#ss-library").scrollTop = 0');
  });
});

describe("Sound Space side panels", () => {
  const css = cssText();
  it("Tracks and Beats and patterns share a darker side background than the cards inside them", () => {
    const i = css.indexOf("\n.panel{");
    expect(css.slice(i, css.indexOf("}", i))).toContain("background:linear-gradient(var(--side-a),var(--side-b))");
    expect(html).toMatch(/<aside class="panel left" id="ss-tracks"/);
    expect(html).toMatch(/<aside class="panel right" id="ss-library"/);
    const light = css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{")));
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]{'), css.indexOf("}", css.indexOf(':root[data-theme="dark"]{')));
    const tok = (block, name) => (block.match(new RegExp("--" + name + ":(#[0-9A-Fa-f]{6})")) || [])[1];
    expect([tok(light, "side-a"), tok(light, "side-b")]).toEqual(["#E6E6EC", "#DEDEE6"]);
    expect([tok(dark, "side-a"), tok(dark, "side-b")]).toEqual(["#1B1B1F", "#161619"]);
    for (const block of [light, dark]) {
      for (const card of ["tc-a", "tc-b", "card-a", "card-b"]) {
        expect(tok(block, card)).toBeTruthy();
        expect(tok(block, "side-a")).not.toBe(tok(block, card));
        expect(tok(block, "side-b")).not.toBe(tok(block, card));
      }
    }
  });
});
