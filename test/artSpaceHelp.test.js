import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Owner: "Turn the help side panel into a modal instead. its hard to read. Make it more visual."
   Help is a centred modal: categories on the left, topic cards on the right, a detail view per topic. */
const html = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
const lucide = readFileSync(new URL("../assets/vendor/lucide.js", import.meta.url), "utf8");

const START = "/* ---- Help: the parts the tests run on their own";
const END = "/* ---- end of Help parts ---- */";
const block = html.includes(START) ? html.split(START)[1].split(END)[0] : "";
const escLine = (html.match(/const esc = s => .*\n/) || [""])[0];
const api = block
  ? new Function("navigator", escLine + block.slice(block.indexOf("*/") + 2)
    + "; return { HELP, HELP_ICON, HELP_GROUP_ICON, helpGroups, helpFind, helpSummary, helpKbd, helpView, helpPick, helpSearch, helpOpen, helpBackTo, helpEsc, helpAt };")({ platform: "Win32", userAgent: "" })
  : {};
const { HELP = [], HELP_ICON = [], HELP_GROUP_ICON = {} } = api;
const at = (title) => HELP.findIndex((t) => t[1] === title);
const pascal = (n) => n.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const cssBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const fnBody = (name) => { const i = html.indexOf("function " + name + "("); return i < 0 ? "" : html.slice(i, html.indexOf("\n}\n", i) + 2); };

describe("Art Space: Help opens as a visual modal", () => {
  it("the Help button opens a centred dialog, labelled, with focus in the search", () => {
    expect(html).toMatch(/<div id="help" class="help" hidden>\s*<div class="help__box" role="dialog" aria-modal="true" aria-labelledby="help-title">/);
    expect(html).toMatch(/<h2 id="help-title"[^>]*>[\s\S]*?Help<\/h2>/);
    expect(html).toContain('if (act === "help") return openHelp(b.dataset.topic);');
    const open = fnBody("openHelp");
    expect(open).toContain('$("#help").hidden = false');
    expect(open).toContain('$("#help-q").focus()');
    expect(fnBody("closeHelp")).toMatch(/helpBack\.focus\(\)/);
  });

  it("keeps every topic, its words and keywords; the search and footer read as the draft", () => {
    expect(HELP.length).toBe(26);
    expect(api.helpGroups()).toEqual(["Getting started", "Drawing", "Shapes and words", "Layers", "Tools", "Pixel Art", "Sharing and saving"]);
    expect(HELP[at("Using layers")][2]).toBe("layers layer new add duplicate order up down");
    expect(html).toContain('placeholder="Search, like layers or eraser"');
    expect(html).toContain("Press <kbd>?</kbd> for every shortcut");
  });

  it("lists the categories, each with its icon and topic count, the current one highlighted", () => {
    const v = api.helpView({ group: "Drawing", q: "", topic: -1 });
    for (const g of api.helpGroups()) {
      const n = HELP.filter((t) => t[0] === g).length;
      expect(v.cats).toMatch(new RegExp('data-hg="' + g + '" aria-current="' + (g === "Drawing") + '"><i data-lucide="' + HELP_GROUP_ICON[g] + '"></i><span>' + g + '</span><span class="help__n">' + n + "</span>"));
    }
  });

  it("picking a category shows that group's cards", () => {
    const st = api.helpPick({ group: "Drawing", q: "eraser", topic: 3 }, "Layers");
    expect(st).toEqual({ group: "Layers", q: "", topic: -1 });
    const v = api.helpView(st);
    expect(v.title).toBe("Layers");
    expect(v.showing).toBe(false);
    const shown = [...v.list.matchAll(/class="help__card" data-ht="(\d+)"/g)].map((m) => +m[1]);
    expect(shown).toEqual(HELP.map((t, i) => (t[0] === "Layers" ? i : -1)).filter((i) => i >= 0));
    // the page wires a category click to helpPick and empties the search
    expect(html).toMatch(/closest\("\[data-hg\]"\)[\s\S]{0,200}helpPick\(helpState, \w+\.dataset\.hg\)[\s\S]{0,120}\$\("#help-q"\)\.value = ""/);
  });

  it("each card has an icon tile, the title, a plain one-line summary and the first shortcut", () => {
    const i = at("Brushes");
    const v = api.helpView({ group: "Drawing", q: "", topic: -1 });
    expect(api.helpSummary(HELP[i][3])).toBe("Choose the Brush tool (B), then a brush.");
    expect(api.helpKbd(HELP[i][3])).toBe("<kbd>B</kbd>");
    expect(v.list).toContain('<button type="button" class="help__card" data-ht="' + i + '"><span class="help__tile"><i data-lucide="brush"></i></span><span class="help__text"><b>Brushes</b><span class="help__sum">Choose the Brush tool (B), then a brush.</span><span class="help__key"><kbd>B</kbd></span></span></button>');
    // no shortcut in the topic, no chip
    const s = at("Smoother curves");
    expect(api.helpKbd(HELP[s][3])).toBe("");
    expect(v.list).toMatch(new RegExp('data-ht="' + s + '">(?:(?!</button>).)*help__sum">Raise Smoothing to steady your lines\\.</span></span></button>'));
  });

  it("searching 'layer' shows the matching cards from every group, with the same rule as before", () => {
    const st = api.helpSearch({ group: "Drawing", q: "", topic: 2 }, "  layer ");
    expect(st).toEqual({ group: "Drawing", q: "layer", topic: -1 });
    const v = api.helpView(st);
    expect(v.title).toBe('Results for "layer"');
    expect(v.list).toContain("<b>Using layers</b>");
    expect(v.list).toContain("<b>Hide, lock, rename and fade a layer</b>");
    expect(v.cats).not.toContain('aria-current="true"');
    // every word in the title, keywords or plain text
    const rule = (q) => { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return HELP.map((t, i) => i).filter((i) => w.every((x) => (HELP[i][1] + " " + HELP[i][2] + " " + HELP[i][3].replace(/<[^>]+>/g, " ").toLowerCase()).toLowerCase().includes(x))); };
    for (const q of ["layer", "layer hide", "Brush", "ctrl", "save file", "symmetry"]) expect(api.helpFind(q), q).toEqual(rule(q));
    const none = api.helpView(api.helpSearch(st, "zzzz"));
    expect(none.list).toContain("Nothing found. Try a word like brush, layer or save.");
  });

  it("opening a card shows its detail: hero, the topic's own HTML, More in the group, and Back", () => {
    const i = at("Brushes");
    const st = api.helpOpen({ group: "Drawing", q: "", topic: -1 }, i);
    const v = api.helpView(st);
    expect(v.showing).toBe(true);
    expect(v.title).toBe("");
    expect(v.list).toContain('<div class="help__hero"><span class="help__tile help__tile--big"><i data-lucide="brush"></i></span>');
    expect(v.list).toContain("<small>Drawing</small>");
    expect(v.list).toContain(">Brushes</h3>");
    expect(v.list).toContain('<div class="help__body">' + HELP[i][3] + "</div>");
    expect(v.list).toContain("More in Drawing");
    const chips = [...v.list.matchAll(/class="help__chip" data-ht="(\d+)"/g)].map((m) => +m[1]);
    expect(chips.length).toBe(4);
    expect(chips).not.toContain(i);
    for (const k of chips) expect(HELP[k][0]).toBe("Drawing");
    // the Show all shortcuts button inside a topic still opens the shortcut sheet
    expect(HELP[0][3]).toContain('data-act="keys"');
    expect(html).toContain('if (act === "keys"){ if (!$("#help").hidden) closeHelp(); return openKeys(); }');
  });

  it("Back returns to the cards with the same group and search", () => {
    const st = api.helpOpen(api.helpSearch({ group: "Tools", q: "", topic: -1 }, "layer"), at("Using layers"));
    expect(api.helpBackTo(st)).toEqual({ group: "Tools", q: "layer", topic: -1 });
    expect(api.helpView(api.helpBackTo(st)).title).toBe('Results for "layer"');
    expect(html).toContain('if (e.target.closest("[data-hback]")) return helpGoBack();');
    expect(fnBody("helpGoBack")).toContain("helpState = helpBackTo(helpState);");
  });

  it("Escape goes back first, then closes; Tab stays inside; a click on the scrim closes", () => {
    const open = api.helpOpen({ group: "Drawing", q: "", topic: -1 }, at("Colors"));
    expect(api.helpEsc(open)).toEqual({ group: "Drawing", q: "", topic: -1 });
    expect(api.helpEsc(api.helpEsc(open))).toBe(null);
    const keys = html.slice(html.indexOf('document.addEventListener("keydown", e => {\n  if ($("#help").hidden) return;'));
    expect(keys).toMatch(/^[\s\S]{0,400}const next = helpEsc\(helpState\);[\s\S]{0,80}if \(next\)[\s\S]{0,80}else closeHelp\(\)/);
    expect(keys.slice(0, 600)).toContain('if (e.key === "Tab") helpTrap(e);');
    expect(fnBody("helpTrap")).toContain("last.focus()");
    expect(html).toMatch(/if \(e\.target\.id === "help"\) return closeHelp\(\);/);
  });

  it("every topic and every category has a lucide icon that exists, following the draft's mapping", () => {
    expect(HELP_ICON.length).toBe(HELP.length);
    for (const n of HELP_ICON.concat(Object.values(HELP_GROUP_ICON))) expect(lucide, n).toMatch(new RegExp("const " + pascal(n) + " = "));
    for (const g of api.helpGroups()) expect(HELP_GROUP_ICON[g], g).toBeTruthy();
    const want = { "Keyboard shortcuts and the quick menu": "keyboard", "Brushes": "brush", "Colors": "palette", "Eraser and fill": "eraser", "Shapes": "shapes", "Text": "type", "Using layers": "layers", "Crop": "crop", "Undo and redo": "undo-2", "Light or dark": "moon" };
    for (const [t, n] of Object.entries(want)) expect(HELP_ICON[at(t)], t).toBe(n);
  });

  it("opening Help at a topic goes straight to that topic's detail", () => {
    const i = at("Crop");
    expect(api.helpAt("Crop")).toEqual({ group: "Tools", q: "", topic: i });
    expect(api.helpAt(i)).toEqual({ group: "Tools", q: "", topic: i });
    expect(api.helpAt(undefined)).toEqual({ group: "Getting started", q: "", topic: -1 });
    expect(api.helpAt("no such topic")).toEqual({ group: "Getting started", q: "", topic: -1 });
    expect(fnBody("openHelp")).toContain("helpState = helpAt(topic)");
  });

  it("looks like the draft: 940 by 640, 14px corners, full screen on phones, still for reduced motion, no emojis", () => {
    expect(cssBlocks).toMatch(/\.help__box\{[^}]*width:min\(940px,100%\); height:min\(640px, calc\(100vh - 48px\)\);[^}]*border-radius:14px/);
    expect(cssBlocks).toMatch(/\.help\{[^}]*position:fixed; inset:0;[^}]*place-items:center/);
    expect(cssBlocks).toMatch(/@media \(max-width:720px\)\{[^@]*\.help__box\{[^}]*width:100%; height:100%;[^}]*border-radius:0;/);
    // one column that can't grow wider than the phone (the category strip scrolls inside it)
    expect(cssBlocks).toMatch(/@media \(max-width:720px\)\{[^@]*\.help__box\{[^}]*grid-template-columns:minmax\(0,1fr\);/);
    expect(cssBlocks).toMatch(/@media \(max-width:720px\)\{[^@]*\.help__cats\{[^}]*flex-direction:row; overflow-x:auto/);
    expect(cssBlocks).toMatch(/@media \(max-width:720px\)\{[^@]*\.help__cards\{ grid-template-columns:1fr; \}/);
    expect(cssBlocks).toMatch(/\.help__cards\{[^}]*grid-template-columns:repeat\(2, minmax\(0,1fr\)\)/);
    expect(cssBlocks).toMatch(/\.help__card:hover\{[^}]*transform:translateY\(-1px\)/);
    expect(cssBlocks).toMatch(/@media \(prefers-reduced-motion:reduce\)\{ \.help__card, \.help__cat\{ transition:none; \} \.help__card:hover\{ transform:none; \} \}/);
    expect(cssBlocks).toMatch(/\.help__body li::before\{[^}]*background:var\(--accent\)/);
    expect(block).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
