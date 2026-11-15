import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

/* Sound Space on phones (up to 640px): the More menu in the top bar, the one-row play controls and the Song sheet.
   Tablets and computers keep everything as it was. */
const html = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");

/** a block that starts at `start` (its opening brace included), up to its matching closing brace */
function block(src, start) {
  const i = src.indexOf(start);
  if (i < 0) return "";
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  return "";
}
/** the full source of one top-level function in the page (string- and comment-aware) */
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
const PHONE = "@media only screen and (max-width:640px){";
const phone = block(css, PHONE);
const notPhone = css.replace(phone, "");
const selectorsOf = (rule) => rule.slice(0, rule.indexOf("{")).split(",").map((s) => s.trim());
/** every selector the given CSS hides with display:none */
const hiddenBy = (src) => [...src.matchAll(/(?:^|[;}\n])\s*([^{};@]+)\{\s*display:none;?\s*\}/g)].flatMap((m) => selectorsOf(m[1] + "{"));
const parts = (() => {
  const b = html.split("/* ---- phone parts the tests run on their own")[1].split("/* ---- end of phone parts")[0];
  const src = b.slice(b.indexOf("\n") + 1);
  return new Function(src + "\nreturn { SONG_SHEET_TARGETS, songSheetFor, menuMove };")();
})();

const editorBar = (() => { const i = html.indexOf('<section id="editor"'); return html.slice(html.indexOf('<header class="appbar">', i), html.indexOf("</header>", i)); })();
const menuHtml = (() => { const i = html.indexOf('<div id="more-menu"'); return i < 0 ? "" : html.slice(i, html.indexOf("<!-- /more-menu -->", i)); })();
const sheetHtml = (() => { const i = html.indexOf('<div id="songsheet"'); return i < 0 ? "" : html.slice(i, html.indexOf("<!-- /songsheet -->", i)); })();
const transport = html.slice(html.indexOf('<div class="transport"'), html.indexOf('<div class="main">'));

describe("Sound Space on phones: the top bar", () => {
  it("adds a More button to the editor's bar, with a menu popup it says is open or shut", () => {
    const btn = (editorBar.match(/<button[^>]*id="more-btn"[^>]*>/) || [""])[0];
    expect(btn).toContain('aria-label="More"');
    expect(btn).toContain('aria-haspopup="menu"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-controls="more-menu"');
    expect(btn).toContain('class="btn icon morebtn"');
    // More comes last in the bar, after Export
    expect(editorBar.indexOf('id="more-btn"')).toBeGreaterThan(editorBar.indexOf('id="ss-export"'));
  });

  it("at 640px and under, hides the mark, Tracks, Undo, Redo, Focus, Help, Light or dark, Sheet music and Export, and shows More", () => {
    expect(phone).not.toBe("");
    const hidden = hiddenBy(phone);
    for (const s of ["#editor .appbar .appmark--editor", "#tg-tracks", "#undo-btn", "#redo-btn", "#tg-lib", "#tg-focus",
      '#editor .appbar [data-act="help"]', '#editor .appbar [data-act="theme"]', "#ss-sheet", "#ss-export", "#editor .appbar .sep", "#editor .appbar .grow"]) {
      expect(hidden, s).toContain(s);
    }
    expect(phone).toMatch(/\.morebtn\{[^}]*display:inline-flex/);
    // Back to Chike's Creative Space and My songs stay
    for (const s of hidden) expect(s).not.toMatch(/backsite|data-act="home"|data-act="close-app"|\.title/);
    // the song's name takes the room the buttons used
    expect(phone).toMatch(/#editor \.title\{[^}]*flex:1 1 auto; min-width:0/);
  });

  it("the More menu lists Undo, Redo, Tracks panel, Full screen, Light or dark, Help, Sheet music and Export, each with the real button's data-act", () => {
    expect(menuHtml).toMatch(/^<div id="more-menu" class="moremenu" role="menu" aria-label="More" hidden>/);
    const items = [...menuHtml.matchAll(/<button type="button" role="menuitem"[^>]*data-act="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)]
      .map((m) => [m[1], m[2].replace(/<span class="mi__k"[^>]*>[^<]*<\/span>/, "").replace(/<[^>]+>/g, "").trim()]);
    expect(items).toEqual([
      ["undo", "Undo"], ["redo", "Redo"], ["toggle-tracks", "Tracks panel"], ["focus", "Full screen"],
      ["theme", "Light or dark"], ["help", "Help"], ["sheet", "Sheet music"], ["export", "Export"],
    ]);
    // every item runs the same action as the real button in the bar (no logic of its own)
    for (const [act] of items) expect(editorBar, act).toContain('data-act="' + act + '"');
    // Undo and Redo sit side by side; Export is the blue call to action; every item is reached with the arrows
    expect(menuHtml).toMatch(/<div class="moremenu__row" role="none">\s*<button[^>]*data-act="undo"[\s\S]*?data-act="redo"[\s\S]*?<\/div>/);
    expect(menuHtml).toMatch(/class="mi mi--cta"[^>]*data-act="export"/);
    expect((menuHtml.match(/role="menuitem"/g) || []).length).toBe(8);
    expect((menuHtml.match(/role="menuitem" tabindex="-1"/g) || []).length).toBe(8);
    expect(menuHtml).toContain('<span class="mi__k" id="mi-tracks-k">Shown</span>');
    expect(menuHtml).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
  });

  it("the menu sits over the play controls and the lesson tip, opens with a short decelerating fade, and holds still for reduced motion", () => {
    const menu = (notPhone.match(/\n\.moremenu\{[^}]*\}/) || [""])[0];
    expect(menu).toMatch(/position:fixed/);
    const z = +(/z-index:(\d+)/.exec(menu) || [0, 0])[1];
    const tipZ = +(/\.tip\{[^}]*z-index:(\d+)/.exec(css) || [0, 0])[1];
    expect(tipZ).toBe(40);
    expect(z).toBeGreaterThan(tipZ);
    expect(z).toBeLessThan(44);   // under the library sheet's dimmer and every dialog
    expect(menu).toMatch(/animation:more-in \.16s var\(--ease\)/);
    expect(css).toMatch(/@keyframes more-in\{ from\{ opacity:0; transform:translateY\(-4px\) scale\(\.98\); \} \}/);
    const rm = block(css, "@media (prefers-reduced-motion:reduce){\n  .launch");
    expect(rm).toContain(".moremenu, .songsheet{ animation:none; }");
    expect(css).toMatch(/\.mi--cta, \.mi--cta:hover\{[^}]*color:#fff; background:linear-gradient\(var\(--accent-a\),var\(--accent-b\)\)/);
  });

  it("the menu moves with the arrows, Home and End, past the items that can't be used, round the ends", () => {
    const { menuMove } = parts;
    const on = [false, true, true, true];   // Undo can't be used
    expect(menuMove(on, -1, "ArrowDown")).toBe(1);
    expect(menuMove(on, 1, "ArrowDown")).toBe(2);
    expect(menuMove(on, 3, "ArrowDown")).toBe(1);   // round to the start, past Undo
    expect(menuMove(on, 1, "ArrowUp")).toBe(3);
    expect(menuMove(on, 2, "ArrowLeft")).toBe(1);
    expect(menuMove(on, 1, "ArrowRight")).toBe(2);
    expect(menuMove(on, 3, "Home")).toBe(1);
    expect(menuMove(on, 1, "End")).toBe(3);
    expect(menuMove(on, 2, "a")).toBe(2);
    expect(menuMove([false, false], 0, "ArrowDown")).toBe(-1);
  });

  describe("opening and closing", () => {
    function setup() {
      const doc = { activeElement: null };
      const els = {};
      function el(name, o) {
        const attrs = {};
        const e = Object.assign({
          name, hidden: false, disabled: false, textContent: "", style: {}, dataset: {},
          setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
          focus() { doc.activeElement = e; }, contains(x) { return x === e; }, closest: () => null,
          getBoundingClientRect: () => ({ left: 330, right: 366, top: 9, bottom: 43, width: 36, height: 34 }),
        }, o);
        return e;
      }
      const ids = ["undo", "redo", "toggle-tracks", "focus", "theme", "help", "sheet", "export"];
      const items = ids.map((a) => el("mi-" + a, { dataset: { act: a } }));
      els["#more-menu"] = el("#more-menu", { hidden: true, contains: (x) => x === els["#more-menu"] || items.includes(x) });
      els["#more-btn"] = el("#more-btn");
      els["#more-btn"].setAttribute("aria-expanded", "false");
      els["#undo-btn"] = el("#undo-btn", { disabled: true });
      els["#redo-btn"] = el("#redo-btn", { disabled: false });
      els["#tg-tracks"] = el("#tg-tracks"); els["#tg-tracks"].setAttribute("aria-pressed", "false");
      els["#tg-focus"] = el("#tg-focus"); els["#tg-focus"].setAttribute("aria-pressed", "true");
      ["#mi-undo", "#mi-redo"].forEach((s, i) => { els[s] = items[i]; });
      els["#mi-tracks-k"] = el("#mi-tracks-k"); els["#mi-focus-label"] = el("#mi-focus-label");
      const $ = (s) => els[s] || (els[s] = el(s));
      const $$ = (s) => (s === '#more-menu [role="menuitem"]' ? items : []);
      const win = { innerWidth: 375 };
      const FNS = ["syncMore", "openMore", "closeMore", "moreKey", "moreClick", "moreOutside"];
      const api = new Function("$", "$$", "document", "window", "menuMove", FNS.map(pageFn).join("\n") + "\nreturn { " + FNS.join(", ") + " };")(
        $, $$, doc, win, parts.menuMove);
      return { api, $, doc, items };
    }
    const key = (k) => { const e = { key: k, prevented: 0, preventDefault() { this.prevented++; } }; return e; };

    it("More opens the menu under itself at the right, mirrors Undo, Redo, Tracks and Full screen, and focuses the first item that works", () => {
      const { api, $, doc, items } = setup();
      api.openMore();
      expect($("#more-menu").hidden).toBe(false);
      expect($("#more-btn").getAttribute("aria-expanded")).toBe("true");
      expect($("#more-menu").style.top).toBe("47px");
      expect($("#more-menu").style.right).toBe("9px");
      expect(items[0].disabled).toBe(true);    // Undo can't be used, as the real button
      expect(items[1].disabled).toBe(false);
      expect($("#mi-tracks-k").textContent).toBe("Hidden");
      expect($("#mi-focus-label").textContent).toBe("Leave full screen");
      expect(doc.activeElement).toBe(items[1]);
    });

    it("Escape closes it and puts the focus back on More; the arrows move between the items", () => {
      const { api, $, doc, items } = setup();
      expect(api.moreKey(key("Escape"))).toBe(false);   // shut: the page's keys go on as before
      api.openMore();
      const down = key("ArrowDown");
      expect(api.moreKey(down)).toBe(true);
      expect(down.prevented).toBe(1);
      expect(doc.activeElement).toBe(items[2]);
      api.moreKey(key("End"));
      expect(doc.activeElement).toBe(items[7]);
      const esc = key("Escape");
      expect(api.moreKey(esc)).toBe(true);
      expect(esc.prevented).toBe(1);
      expect($("#more-menu").hidden).toBe(true);
      expect($("#more-btn").getAttribute("aria-expanded")).toBe("false");
      expect(doc.activeElement).toBe($("#more-btn"));
    });

    it("a tap outside closes it; a tap inside or on More doesn't", () => {
      const { api, $, doc } = setup();
      api.openMore();
      api.moreOutside({ target: { closest: () => $("#more-menu") } });
      expect($("#more-menu").hidden).toBe(false);
      api.moreOutside({ target: { closest: () => null } });
      expect($("#more-menu").hidden).toBe(true);
      expect($("#more-btn").getAttribute("aria-expanded")).toBe("false");
      expect(doc.activeElement).toBe($("#more-btn"));
    });

    it("picking an item closes the menu first, with the focus on More, so the window it opens comes back to More", () => {
      const { api, $, doc, items } = setup();
      api.openMore();
      api.moreClick({ target: { closest: () => items[5] } });   // Help
      expect($("#more-menu").hidden).toBe(true);
      expect(doc.activeElement).toBe($("#more-btn"));
      // the page's own data-act handler then runs the action: More's menu has no handler of its own
      expect(pageFn("moreClick")).not.toMatch(/openHelp|openExport|openSheet|undo\(|redo\(|toggleTracks|toggleFocus|applyTheme/);
    });

    it("the page wires More, the menu, outside taps and the keys", () => {
      expect(html).toContain('$("#more-btn").addEventListener("click", () => { if ($("#more-menu").hidden) openMore(); else closeMore(true); });');
      expect(html).toContain('$("#more-menu").addEventListener("click", moreClick);');
      expect(html).toContain('document.addEventListener("pointerdown", moreOutside, true);');
      expect(html).toMatch(/if \(exportKey\(e\)\) return;\n  if \(moreKey\(e\)\) return;\n  if \(songSheetKey\(e\)\) return;/);
    });
  });
});

describe("Sound Space on phones: the play controls and the Song sheet", () => {
  it("adds a Song button at the end of the play controls that opens a dialog", () => {
    const btn = (transport.match(/<button[^>]*id="ss-song"[^>]*>[\s\S]*?<\/button>/) || [""])[0];
    expect(btn).toContain('class="btn songbtn"');
    expect(btn).toContain('aria-haspopup="dialog"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-controls="songsheet"');
    expect(btn).toContain('<i data-lucide="sliders-horizontal"></i>Song</button>');
    expect(transport.indexOf('id="ss-song"')).toBeGreaterThan(transport.indexOf('id="ss-tempo"'));
    // Loop and Count-in keep their ids, their words (their names) and their tooltips
    expect(transport).toMatch(/<button type="button" class="toggle" id="ss-loop"[^>]*title="Loop: [^"]*">[\s\S]*?Loop<\/button>/);
    expect(transport).toMatch(/<button type="button" class="toggle" id="ss-countin"[^>]*title="Count-in: [^"]*">[\s\S]*?Count-in<\/button>/);
  });

  it("the Song sheet is a labelled dialog with a close button and a place for the real controls", () => {
    expect(sheetHtml).toMatch(/^<div id="songsheet" class="songsheet" role="dialog" aria-modal="true" aria-label="Song settings" tabindex="-1" hidden>/);
    expect(sheetHtml).toContain('<button type="button" class="btn icon" id="songsheet-close" aria-label="Close" title="Close"><i data-lucide="x"></i></button>');
    expect(sheetHtml).toContain('<div class="songsheet__rows" id="songsheet-rows"></div>');
    expect(html).toContain('<div id="songsheet-scrim" class="songsheet__scrim" hidden></div>');
    // no copies: the real controls exist once, in the play controls, and move into the sheet on phones
    for (const id of ["ss-tempo", "ss-counts", "ss-grid-res", "ss-volume", "ss-volnum"]) expect((html.match(new RegExp('id="' + id + '"', "g")) || []).length, id).toBe(1);
  });

  it("the sheet rises from the bottom with 14px top corners over 200ms, decelerating, under the lesson tip", () => {
    const sh = (notPhone.match(/\n\.songsheet\{[^}]*\}/) || [""])[0];
    expect(sh).toMatch(/position:fixed; left:0; right:0; bottom:0/);
    expect(sh).toMatch(/border-radius:14px 14px 0 0/);
    expect(sh).toMatch(/animation:songsheet-up \.2s var\(--ease\)/);
    const z = +(/z-index:(\d+)/.exec(sh) || [0, 0])[1];
    expect(z).toBeLessThan(40);   // the lesson tip stays on top, so a lesson can point at Speed in the sheet
    const scrim = (notPhone.match(/\n\.songsheet__scrim\{[^}]*\}/) || [""])[0];
    expect(+(/z-index:(\d+)/.exec(scrim) || [0, 99])[1]).toBeLessThan(z);
  });

  it("at 640px and under, the controls make one row: Play, Record, Stop, the beat, Loop and Count-in as small switches, then Song", () => {
    expect(phone).toMatch(/\.transport\{[^}]*flex-wrap:nowrap/);
    expect(phone).toMatch(/\.transport \.round, \.transport \.stop\{ width:42px; height:42px; \}/);
    expect(phone).toMatch(/\.transport \.toggle\{[^}]*width:38px; height:34px;[^}]*font-size:0/);
    expect(phone).toMatch(/\.transport \.toggle \.led\{[^}]*position:absolute; top:4px; right:4px/);
    expect(phone).toMatch(/\.songbtn\{[^}]*display:inline-flex; margin-left:auto/);
    // above 640px More and Song never show
    expect(notPhone).toMatch(/\n\.morebtn, \.songbtn\{ display:none; \}/);
    for (const s of hiddenBy(notPhone)) expect(s).not.toMatch(/^(#undo-btn|#redo-btn|#tg-focus|#tg-lib|#ss-export|#ss-sheet|\.appmark--editor)$/);
  });

  it("phone rules stay in their own block at the end; the first @media and both old 640px blocks are where they were", () => {
    expect(css.indexOf("@media")).toBe(css.indexOf("@media (max-width:1279px){ #ss-sheet"));
    expect(css.indexOf("@media (max-width:640px)")).toBe(css.indexOf("@media (max-width:640px){\n  .sheet{"));
    expect(css.slice(css.lastIndexOf("@media (max-width:640px){"))).toContain(".track__head{ display:contents; }");
    expect(css.indexOf(PHONE)).toBeGreaterThan(css.lastIndexOf("@media (max-width:720px){"));
    // the new selectors appear outside the phone block only to stay hidden or to style the menu and the sheet
    const outside = [...notPhone.matchAll(/(?:^|\n)([^{}\n@]*(?:morebtn|songbtn|moremenu|songsheet|\.mi\b|mi__|mi--)[^{}\n]*)\{/g)].map((m) => m[1].trim());
    for (const s of outside) expect(s).toMatch(/^(\.morebtn, \.songbtn|\.moremenu|\.mi|\.songsheet|@keyframes)/);
  });

  describe("the real controls move into the sheet on phones and back on wider screens", () => {
    function setup(matches) {
      const doc = { activeElement: null, createComment: (t) => ({ t, parent: null, replaceWith(x) { x.parent = this.parent; this.parent = null; } }) };
      const field = (n) => ({ n, parent: "transport", before(m) { m.parent = this.parent; } });
      const f = { "#ss-tempo": field("speed"), "#ss-counts": field("counts"), "#ss-grid-res": field("grid"), "#ss-volume": field("main") };
      const rows = { kids: [], appendChild(x) { this.kids.push(x.n); x.parent = "sheet"; } };
      const closed = [];
      const $ = (s) => (s === "#songsheet-rows" ? rows : { closest: () => f[s] });
      const narrowMq = { matches };
      const body = "let songFieldsHome = null;\n" + ["songFields", "placeSongFields"].map(pageFn).join("\n") + "\nreturn { placeSongFields, home: () => songFieldsHome };";
      const api = new Function("$", "document", "narrowMq", "closeSongSheet", body)($, doc, narrowMq, (h) => closed.push(h));
      return { api, f, rows, narrowMq, closed };
    }

    it("Speed, Counts, Grid and Main go into the sheet in that order, and come back to their places", () => {
      const { api, f, rows, narrowMq, closed } = setup(true);
      api.placeSongFields();
      expect(rows.kids).toEqual(["speed", "counts", "grid", "main"]);
      expect(Object.values(f).every((x) => x.parent === "sheet")).toBe(true);
      api.placeSongFields();   // again: nothing moves twice
      expect(rows.kids.length).toBe(4);
      narrowMq.matches = false;
      api.placeSongFields();
      expect(closed.length).toBe(1);   // the sheet closes first
      expect(Object.values(f).every((x) => x.parent === "transport")).toBe(true);
      expect(api.home()).toBe(null);
    });

    it("on a wide screen nothing moves", () => {
      const { api, f, rows } = setup(false);
      api.placeSongFields();
      expect(rows.kids).toEqual([]);
      expect(Object.values(f).every((x) => x.parent === "transport")).toBe(true);
    });

    it("the page places them at the start and whenever the width crosses 640px", () => {
      expect(html).toContain('narrowMq.addEventListener("change", () => { closeMore(false); placeSongFields(); });');
      expect(html).toMatch(/\nplaceSongFields\(\);\n/);
    });
  });

  describe("opening and closing the sheet", () => {
    function setup() {
      const doc = { activeElement: null, body: { name: "body" } };
      doc.activeElement = doc.body;
      const els = {};
      const inSheet = new Set();
      function el(name, o) {
        const attrs = {};
        const e = Object.assign({
          name, hidden: false, disabled: false, tabIndex: 0, setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
          focus() { doc.activeElement = e; }, contains: () => false, closest: () => null,
        }, o);
        return e;
      }
      els["#songsheet"] = el("#songsheet", { hidden: true, contains: (x) => inSheet.has(x) });
      els["#songsheet-scrim"] = el("#songsheet-scrim", { hidden: true });
      els["#tip"] = el("#tip", { hidden: true });
      const tempo = el("tempo"), close = el("close");
      inSheet.add(els["#songsheet"]); inSheet.add(tempo); inSheet.add(close);
      const $ = (s) => els[s] || (els[s] = el(s));
      const $$ = (s) => (s.startsWith("#songsheet") ? [close, tempo] : []);
      const calls = { more: [], tip: 0 };
      const FNS = ["openSongSheet", "closeSongSheet", "songSheetKey", "songSheetTrap"];
      const body = "let sheetShutByHand = false, lesson = null;\n" + FNS.map(pageFn).join("\n")
        + "\nreturn { " + FNS.join(", ") + ", shut: () => sheetShutByHand, setLesson: (l) => { lesson = l; } };";
      const api = new Function("$", "$$", "document", "closeMore", "placeTip", body)($, $$, doc, (b) => calls.more.push(b), () => calls.tip++);
      return { api, $, doc, calls, tempo, close };
    }
    const key = (k, shift) => ({ key: k, shiftKey: !!shift, prevented: 0, preventDefault() { this.prevented++; } });

    it("Song opens it: the menu shuts, the dimmer shows, Song says it is open and the focus goes into the sheet", () => {
      const { api, $, doc, calls } = setup();
      api.openSongSheet();
      expect($("#songsheet").hidden).toBe(false);
      expect($("#songsheet-scrim").hidden).toBe(false);
      expect($("#ss-song").getAttribute("aria-expanded")).toBe("true");
      expect(calls.more).toEqual([false]);
      expect(doc.activeElement).toBe($("#songsheet"));   // the sheet itself, so a phone's keyboard doesn't pop up
    });

    it("Escape closes it and the focus goes back to Song; Tab stays inside", () => {
      const { api, $, doc, tempo, close } = setup();
      expect(api.songSheetKey(key("Escape"))).toBe(false);   // shut: the page's keys go on
      api.openSongSheet();
      tempo.focus();
      const tab = key("Tab");
      expect(api.songSheetKey(tab)).toBe(true);
      expect(tab.prevented).toBe(1);
      expect(doc.activeElement).toBe(close);   // round from the last to the first
      const back = key("Tab", true);
      api.songSheetKey(back);
      expect(doc.activeElement).toBe(tempo);
      const esc = key("Escape");
      expect(api.songSheetKey(esc)).toBe(true);
      expect($("#songsheet").hidden).toBe(true);
      expect($("#songsheet-scrim").hidden).toBe(true);
      expect($("#ss-song").getAttribute("aria-expanded")).toBe("false");
      expect(doc.activeElement).toBe($("#ss-song"));
    });

    it("closing by hand during a lesson keeps it shut until the next step; a lesson step closing it leaves the focus where it is", () => {
      const { api, doc, calls } = setup();
      api.setLesson({ step: 0 });
      api.openSongSheet();
      expect(calls.tip).toBe(1);   // the tip moves to the control in the sheet
      api.closeSongSheet(true);
      expect(api.shut()).toBe(true);
      api.openSongSheet();
      const next = { name: "next" }; doc.activeElement = next;
      api.closeSongSheet(false);
      expect(doc.activeElement).toBe(next);
    });

    it("going Home closes the menu and the sheet", () => {
      expect(pageFn("showHome")).toMatch(/endLesson\(\);\n  closeMore\(false\); closeSongSheet\(false\);/);
    });

    it("the page wires Song, the close button and a tap outside", () => {
      expect(html).toContain('$("#ss-song").addEventListener("click", () => { if ($("#songsheet").hidden) openSongSheet(); else closeSongSheet(true); });');
      expect(html).toContain('$("#songsheet-close").addEventListener("click", () => closeSongSheet(true));');
      expect(html).toContain('$("#songsheet-scrim").addEventListener("click", () => closeSongSheet(true));');
    });
  });

  describe("lessons", () => {
    const SS = loadSS("model.js", "engine.js", "instruments.js", "icons.js", "library.js", "lessons.js");
    const targets = [...new Set(SS.lessons.LESSONS.flatMap((l) => l.steps.map((s) => s.target)))];

    it("knows which lesson targets sit in the Song sheet: Speed (and Counts, Grid, Main), never Loop or Count-in", () => {
      const { songSheetFor, SONG_SHEET_TARGETS } = parts;
      expect(SONG_SHEET_TARGETS).toEqual(["#ss-tempo", "#ss-counts", "#ss-grid-res", "#ss-volume", "#ss-volnum"]);
      expect(targets).toContain("#ss-tempo");
      for (const t of targets) expect(songSheetFor(t), t).toBe(SONG_SHEET_TARGETS.includes(t));
      for (const t of ["#ss-loop", "#ss-countin", "#ss-play", "#ss-record", "#ss-grid", "#ss-tracks"]) expect(songSheetFor(t), t).toBe(false);
      // every lesson target is a real control in the page
      for (const t of targets) expect(html, t).toContain('id="' + t.slice(1) + '"');
    });

    function reveal(phoneNow, sheetOpen) {
      const calls = { open: 0, close: [] };
      const sheet = { hidden: !sheetOpen };
      const $ = (s) => (s === "#songsheet" ? sheet : { closest: () => null });
      const body = "let sheetShutByHand = true;\n" + pageFn("revealLessonTarget") + "\nreturn { revealLessonTarget, shut: () => sheetShutByHand };";
      const api = new Function("lessonTargetFor", "$", "song", "trackById", "renderAll", "lessonPanel", "layout", "setLayout", "narrowLib", "document",
        "renderLibrary", "applyLayout", "narrowMq", "songSheetFor", "openSongSheet", "closeSongSheet", body)(
        (t) => t, $, { tracks: [1] }, () => null, () => {}, () => null, { tracks: true, library: true, keys: true }, () => {}, { matches: phoneNow },
        { body: { classList: { contains: () => true, add() {} } } }, () => {}, () => {}, { matches: phoneNow }, parts.songSheetFor,
        () => { calls.open++; sheet.hidden = false; }, (h) => { calls.close.push(h); sheet.hidden = true; });
      return { api, calls };
    }

    it("on a phone, a step that points at Speed opens the Song sheet; one that points elsewhere closes it", () => {
      let r = reveal(true, false);
      r.api.revealLessonTarget("#ss-tempo");
      expect(r.calls.open).toBe(1);
      expect(r.api.shut()).toBe(false);   // a new step: the sheet may open again
      r = reveal(true, true);
      r.api.revealLessonTarget("#ss-countin");
      expect(r.calls.open).toBe(0);
      expect(r.calls.close).toEqual([false]);
    });

    it("on a wider screen the sheet never opens", () => {
      const r = reveal(false, false);
      r.api.revealLessonTarget("#ss-tempo");
      expect(r.calls.open).toBe(0);
    });

    it("placeTip opens the sheet when its step's control is in it, unless the kid shut it during this step", () => {
      const fn = pageFn("placeTip");
      expect(fn).toMatch(/if \(st && narrowMq\.matches && songSheetFor\(st\.target\) && \$\("#songsheet"\)\.hidden && !sheetShutByHand\) openSongSheet\(\);/);
      expect(fn.indexOf("openSongSheet()")).toBeLessThan(fn.indexOf("getBoundingClientRect"));
    });
  });

  it("a long press on Loop or Count-in shows its name in a notice, and that press doesn't switch it", () => {
    expect(html).toContain('["#ss-loop", "#ss-countin"].forEach(s => longPressName($(s)));');
    const fn = pageFn("longPressName");
    expect(fn).toContain('e.pointerType === "mouse"');
    expect(fn).toContain("toast(b.title)");
    expect(fn).toMatch(/contextmenu/);
    expect(html).toMatch(/document\.addEventListener\("click", e => \{ if \(lpDone[^\n]*e\.stopImmediatePropagation\(\);[^\n]*\}, true\);/);
  });
});

describe("Sound Space small fixes folded into the phone change", () => {
  it("light theme: a lit pattern note is dark, so it stands out on the light well; dark theme keeps white", () => {
    const light = block(css, ":root{");
    const dark = block(css, ':root[data-theme="dark"]{');
    expect(light).toMatch(/--pv-lit:#1C1C21;/);
    expect(dark).toMatch(/--pv-lit:#FFFFFF;/);
    expect(css).toMatch(/\.pat__pv rect\.lit\{ fill:var\(--pv-lit\); \}/);
  });

  it("drum pads lift on hover only where there is a real hover, so a tapped pad on a touch screen doesn't stay lifted", () => {
    const hov = block(css, "@media (hover:hover){");
    expect(hov).toMatch(/\.pad:hover\{[^}]*translateY\(-1px\)/);
    expect(css.replace(hov, "")).not.toMatch(/\.pad:hover\{/);
  });

  it("the corners note no longer names drum pads 6px, and the unused --r-drum token is gone", () => {
    expect(html).not.toContain("--r-drum");
    expect(html).not.toContain("drum pads 6px");
    expect(css).toMatch(/--r:10px; --r-sm:7px; --r-pad:3px; --r-key:4px;/);
  });

  it("the pattern card's play button is a rounded square, not a circle, and keeps its size, teal and pressed look", () => {
    const pl = (css.match(/\n\.pl\{[^}]*\}/) || [""])[0];
    expect(pl).toMatch(/border-radius:var\(--r-sm\)/);
    expect(pl).not.toMatch(/50%;/);
    expect(pl).toMatch(/width:28px; height:28px/);
    expect(pl).toMatch(/#14B8A6/);
    expect(css).toMatch(/\.pl\[aria-pressed="true"\]\{ box-shadow:inset 0 2px 4px rgba\(0,0,0,\.3\),0 0 0 3px rgba\(94,230,216,\.4\); \}/);
  });
});
