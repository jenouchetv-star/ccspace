import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSS } from "./helpers/soundSpace.js";

/* Task 10: export to WAV, project files, and the safety checks for the whole app. */
const root = fileURLToPath(new URL("../assets/apps/", import.meta.url));
const html = readFileSync(join(root, "sound-space.html"), "utf8");

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}
const appFiles = [join(root, "sound-space.html"), ...jsFiles(join(root, "sound-space"))];
const sources = appFiles.map((p) => [p, readFileSync(p, "utf8")]);

const START = "/* ---- Export: the parts the tests run on their own";
const END = "/* ---- end of Export parts ---- */";
const block = html.includes(START) ? html.split(START)[1].split(END)[0] : "";
const api = block ? new Function(block.slice(block.indexOf("*/") + 2) + "; return { cleanTitle, EXPORT_TIMES, lengthText };")() : {};
const fnBody = (name) => { const i = html.search(new RegExp("\\n(?:async )?function " + name + "\\(")); return i < 0 ? "" : html.slice(i, html.indexOf("\n}\n", i) + 2); };
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

describe("Sound Space safety", () => {
  it("nothing in Sound Space can use the microphone, camera or speech", () => {
    expect(sources.length).toBeGreaterThan(5);
    for (const [p, src] of sources) {
      for (const bad of ["getUserMedia", "getDisplayMedia", "MediaRecorder", "SpeechRecognition", "webkitSpeechRecognition", "createMediaStreamSource"]) {
        expect(src.includes(bad), p + " uses " + bad).toBe(false);
      }
    }
  });

  it("nothing is fetched from outside our site at run time", () => {
    // Google Fonts would be the only outside address allowed; the SVG namespace is a name, never fetched
    const allowed = (u) => u === "http://www.w3.org/2000/svg" || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
    for (const [p, src] of sources) {
      for (const m of src.matchAll(/https?:\/\/[^\s"'`)<>%]*/gi)) expect(allowed(m[0]), p + ": " + m[0]).toBe(true);
      // and no address that leaves out the https: part
      expect(src, p).not.toMatch(/["'(]\/\/[a-z0-9-]+\.[a-z]/i);
    }
    // the page's own scripts, styles and pictures are all same-site paths
    for (const m of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) expect(m[1], m[0]).not.toMatch(/^(?:[a-z]+:)?\/\/|^http/i);
    expect(html).toContain('const ABCJS_SRC = "../vendor/abcjs/abcjs-basic-min.js"');
    expect(html).toContain('const SAMPLE_BASE = "sound-space/samples";');
  });
});

describe("Sound Space export", () => {
  it("export offers 1, 2 or 4 times through, starting at 2", () => {
    const m = html.match(/<div id="export" class="modal" hidden>[\s\S]*?\n<\/div>\n/);
    expect(m, "the export dialog").toBeTruthy();
    const box = m[0];
    expect(box).toMatch(/role="dialog" aria-modal="true" aria-labelledby="export-title"/);
    expect(box).toMatch(/<span id="export-times-lbl">How many times through\?<\/span>/);
    const group = box.match(/<div class="well export__times" id="export-times" role="radiogroup" aria-labelledby="export-times-lbl">([\s\S]*?)<\/div>/);
    expect(group).toBeTruthy();
    const radios = [...group[1].matchAll(/<button type="button" role="radio" data-times="(\d)" aria-checked="(true|false)">\1<\/button>/g)].map((x) => [+x[1], x[2]]);
    expect(radios).toEqual([[1, "false"], [2, "true"], [4, "false"]]);
    expect(api.EXPORT_TIMES).toEqual([1, 2, 4]);
    expect(html).toMatch(/let exportTimes = 2;/);
    // one clear blue Download WAV button, and Save project file beside the sound file
    expect(box).toMatch(/<button type="button" class="btn btn--primary export__go" id="export-go" data-exp="wav">[\s\S]*?Download WAV<\/span><\/button>/);
    expect(box).toMatch(/<button type="button" class="btn" id="export-proj" data-exp="project">[\s\S]*?Save project file<\/button>/);
    // the top bar's Export button opens it
    expect(html).toContain('if (act === "export") return openExport();');
    expect(fnBody("openExport")).toContain('$("#export").hidden = false');
  });

  it("file names are cleaned", () => {
    expect(api.cleanTitle("My Song!! / 2")).toBe("My-Song-2");
    expect(api.cleanTitle("")).toBe("my-song");
    expect(api.cleanTitle("!!!")).toBe("my-song");
    expect(api.cleanTitle(undefined)).toBe("my-song");
    expect(api.cleanTitle("Café Beat")).toBe("Cafe-Beat");
    const long = api.cleanTitle("a".repeat(30) + " " + "b".repeat(30));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).toMatch(/^[A-Za-z0-9-]+$/);
    expect(long.endsWith("-")).toBe(false);
    expect(api.cleanTitle("x".repeat(39) + " y")).toBe("x".repeat(39));
  });

  it("says how long the sound file will be, in words a kid can read", () => {
    expect(api.lengthText(1)).toBe("About 1 second long");
    expect(api.lengthText(9.6)).toBe("About 10 seconds long");
    expect(api.lengthText(60)).toBe("About 1 minute long");
    expect(api.lengthText(125)).toBe("About 2 minutes 5 seconds long");
  });

  it("renders the song offline, downloads <clean-title>.wav and counts song_exported", () => {
    const run = fnBody("exportWav");
    expect(run).toMatch(/E\.renderOffline\(/);
    expect(run).toMatch(/SS\.wav\.encodeWav\(/);
    expect(run).toContain('cleanTitle(song.title) + ".wav"');
    expect(run).toContain('count("song_exported")');
    expect(run).toContain("Making your song…");
    // the button waits while it works, and silent instruments are named
    expect(run).toMatch(/go\.disabled = true/);
    expect(run).toMatch(/failed/);
    expect(html).toMatch(/didn’t load, so they’re silent in your sound file: /);
  });

  it("Save project file downloads <clean-title>.soundspace.json", () => {
    const save = fnBody("saveProjectFile");
    expect(save).toContain('cleanTitle(song.title) + ".soundspace.json"');
    expect(save).toContain("JSON.stringify(");
    expect(html).toContain('if (a === "project") return saveProjectFile();');
  });

  it("a saved project file opens again as the same song", () => {
    const SS = loadSS("model.js", "instruments.js", "icons.js", "library.js");
    const ids = new Set(SS.instruments.LIST.map((x) => x.id));
    const song = JSON.parse(JSON.stringify(SS.library.STARTERS.find((s) => s.id === "hiphop-pop").song));
    const file = JSON.stringify(song, null, 2);   // what Save project file writes
    const v = SS.model.validateSong(JSON.parse(file), ids);
    expect(v.ok).toBe(true);
    expect(v.missing).toEqual([]);
    expect(v.song.tracks.map((t) => [t.instrumentId, t.notes.length])).toEqual(song.tracks.map((t) => [t.instrumentId, t.notes.length]));
    // an instrument Sound Space doesn't have is named, and the song still opens
    const odd = JSON.parse(file); odd.tracks[0].instrumentId = "kazoo-9000";
    const w = SS.model.validateSong(odd, ids);
    expect(w.ok).toBe(true);
    expect(w.missing).toEqual(["kazoo-9000"]);
    // something that isn't a song is refused
    expect(SS.model.validateSong({ hello: "world" }, ids).ok).toBe(false);
  });

  it("Open a file takes .json only, checks the song, and names missing instruments", () => {
    expect(html).toContain('<input type="file" id="file-in" accept=".json,application/json"');
    const open = html.slice(html.indexOf('$("#file-in").addEventListener("change"'), html.indexOf("Buttons with data-act"));
    expect(open).toMatch(/\/\\\.json\$\/i\.test\(f\.name\)/);
    expect(open).toContain("M.validateSong(obj, CATALOG_IDS)");
    expect(open).toContain("toast(\"That file isn’t a Sound Space song.\")");
    expect(open).toContain("missing:v.missing");
    expect(fnBody("openSong")).toMatch(/opts\.missing\.length\) toast\("Some instruments in this song aren’t in Sound Space: "/);
  });

  it("is a real dialog: Escape closes, Tab stays inside, the editor's keys wait", () => {
    expect(html).toMatch(/const dialogOpen = \(\) => [^\n]*!\$\("#export"\)\.hidden/);
    expect(html).toContain("if (helpKeyDown(e)) return;\n  if (exportKey(e)) return;");
    const key = fnBody("exportKey");
    expect(key).toContain('if ($("#export").hidden) return false;');
    expect(key).toMatch(/Escape[\s\S]*closeExport\(\)/);
    expect(key).toContain('if (e.key === "Tab") exportTrap(e);');
    expect(fnBody("closeExport")).toMatch(/exportBack\.focus\(\)/);
  });

  it("looks like the app: blue button, no orange or green, still for reduced motion", () => {
    const rules = [...css.matchAll(/(?:^|\n)\s*\.export[^{]*\{[^}]*\}/g)].map((m) => m[0]).join("\n");
    expect(rules.length).toBeGreaterThan(200);
    for (const hex of rules.match(/#[0-9a-fA-F]{3,8}\b/g) || []) expect(["#fff", "#ffffff", "#000", "#000000"], hex).toContain(hex.toLowerCase());
    expect(rules).not.toMatch(/--(go|bass|winds)\b/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^\n]*\.export__bar i\{ transition:none; \}/);
    expect(block).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
