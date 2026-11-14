import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

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

  it("shows Home with Empty song, Hip hop/pop starter, Lullaby starter and Music lessons, and no other starters", () => {
    const home = section(/<main id="home"/, "</main>");
    expect(home.length).toBeGreaterThan(0);
    for (const label of ["Empty song", "Hip hop/pop starter", "Lullaby starter", "Music lessons", "Recent", "Open a file"]) {
      expect(home).toContain(label);
    }
    expect(html).not.toContain("March starter");
    expect(html).not.toContain("Space starter");
    expect([...home.matchAll(/data-start="/g)].length).toBe(4);
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
    // no centered, max-width frame around Home, the loading card or Sign in
    expect(css).not.toMatch(/\.home__inner\{[^}]*max-width/);
    expect(css).not.toMatch(/\.(splash|signin)\{[^}]*width:min\(/);
  });

  it("closes through the site and never uses the microphone", () => {
    expect(html).toMatch(/postMessage\(\{\s*ccsStudio:\s*"close"\s*\}/);
    for (const api of ["getUserMedia", "getDisplayMedia", "MediaRecorder", "createMediaStreamSource", "SpeechRecognition"]) {
      expect(html).not.toContain(api);
    }
  });
});
