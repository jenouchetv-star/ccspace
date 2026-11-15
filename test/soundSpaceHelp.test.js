import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Owner: "Turn the help side panel into a modal instead. its hard to read. Make it more visual."
   Sound Space's Help is the same centred modal as Art Space's, in Sound Space's own colors and icons. */
const html = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");

const START = "/* ---- Help: the parts the tests run on their own";
const END = "/* ---- end of Help parts ---- */";
const block = html.includes(START) ? html.split(START)[1].split(END)[0] : "";
const escLine = (html.match(/const esc = s => .*\n/) || [""])[0];
const api = block
  ? new Function(escLine + block.slice(block.indexOf("*/") + 2)
    + "; return { HELP, HELP_ICON, HELP_GROUP_ICON, HELP_SVG, helpIcon, helpGroups, helpFind, helpSummary, helpKbd, helpView, helpPick, helpSearch, helpOpen, helpBackTo, helpEsc, helpAt };")()
  : {};
const { HELP = [], HELP_ICON = [], HELP_GROUP_ICON = {}, HELP_SVG = {} } = api;
const at = (title) => HELP.findIndex((t) => t[1] === title);
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const fnBody = (name) => { const i = html.indexOf("function " + name + "("); return i < 0 ? "" : html.slice(i, html.indexOf("\n}\n", i) + 2); };

describe("Sound Space: Help opens as a visual modal", () => {
  it("the Help button opens a centred dialog, labelled, with focus in the search", () => {
    expect(html).toMatch(/<div id="help" class="help" hidden>\s*<div class="help__box" role="dialog" aria-modal="true" aria-labelledby="help-title">/);
    expect(html).toMatch(/<h2 id="help-title"[^>]*>[\s\S]*?Help<\/h2>/);
    expect(html).toContain('if (act === "help") return openHelp(b.dataset.topic);');
    const open = fnBody("openHelp");
    expect(open).toContain('$("#help").hidden = false');
    expect(open).toContain('$("#help-q").focus()');
    expect(fnBody("closeHelp")).toMatch(/helpBack\.focus\(\)/);
    // Help still counts as an open dialog, so the music keys wait
    expect(html).toMatch(/const dialogOpen = \(\) => [^\n]*!\$\("#help"\)\.hidden/);
  });

  it("keeps every topic, its words and keywords; the search uses Sound Space's own words; no shortcut footer", () => {
    expect(HELP.length).toBe(13);
    expect(api.helpGroups()).toEqual(["Start", "Playing", "Recording", "The grid", "Saving"]);
    expect(HELP[at("Tracks")][2]).toContain("reverb sustain room hall pedal");
    expect(HELP[at("Tracks")][3]).toContain("Main sets how loud the whole song plays.");
    expect(html).toContain('placeholder="Search, like record or reverb"');
    expect(html).not.toContain("for every shortcut");
  });

  it("lists the categories, each with its icon and topic count, the current one highlighted", () => {
    const v = api.helpView({ group: "Playing", q: "", topic: -1 });
    for (const g of api.helpGroups()) {
      const n = HELP.filter((t) => t[0] === g).length;
      expect(v.cats).toContain('data-hg="' + g + '" aria-current="' + (g === "Playing") + '">' + api.helpIcon(HELP_GROUP_ICON[g]) + "<span>" + g + '</span><span class="help__n">' + n + "</span>");
    }
    expect(v.cats).toContain('data-hg="Start" aria-current="false">');
    expect(v.cats).toContain('<span class="help__n">5</span>');
  });

  it("picking a category shows that group's cards, in the order of the topics", () => {
    const st = api.helpPick({ group: "Playing", q: "loop", topic: 1 }, "Start");
    expect(st).toEqual({ group: "Start", q: "", topic: -1 });
    const v = api.helpView(st);
    expect(v.title).toBe("Start");
    const shown = [...v.list.matchAll(/class="help__card" data-ht="(\d+)"/g)].map((m) => +m[1]);
    expect(shown).toEqual([at("Make a song"), at("Tracks"), at("Beats and patterns"), at("Music lessons"), at("Show and hide parts")]);
    expect(html).toMatch(/closest\("\[data-hg\]"\)[\s\S]{0,200}helpPick\(helpState, \w+\.dataset\.hg\)[\s\S]{0,120}\$\("#help-q"\)\.value = ""/);
  });

  it("each card has an icon tile, the title, a plain one-line summary and the first shortcut", () => {
    const i = at("Piano keys");
    expect(api.helpSummary(HELP[i][3])).toBe("Tap the keys, or use your computer keys.");
    expect(api.helpKbd(HELP[i][3])).toBe("<kbd>A</kbd>");
    const v = api.helpView({ group: "Playing", q: "", topic: -1 });
    expect(v.list).toContain('<button type="button" class="help__card" data-ht="' + i + '"><span class="help__tile">' + api.helpIcon(HELP_ICON[i]) + '</span><span class="help__text"><b>Piano keys</b><span class="help__sum">Tap the keys, or use your computer keys.</span><span class="help__key"><kbd>A</kbd></span></span></button>');
    expect(api.helpSummary(HELP[at("Make a song")][3])).toBe("Press Add your first track (or Add track at the top of the Tracks panel) and pick an instrument.");
  });

  it("searching 'reverb' shows the matching cards, with the same rule as before", () => {
    const st = api.helpSearch({ group: "Saving", q: "", topic: -1 }, "reverb");
    const v = api.helpView(st);
    expect(v.title).toBe('Results for "reverb"');
    expect(v.list).toContain("<b>Tracks</b>");
    expect(v.list).not.toContain("<b>Light or dark</b>");
    expect(v.cats).not.toContain('aria-current="true"');
    const rule = (q) => { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return HELP.map((t, i) => i).filter((i) => w.every((x) => (HELP[i][1] + " " + HELP[i][2] + " " + HELP[i][3].replace(/<[^>]+>/g, " ").toLowerCase()).toLowerCase().includes(x))); };
    for (const q of ["reverb", "record loop", "Keys", "ctrl", "main volume", "eq"]) expect(api.helpFind(q), q).toEqual(rule(q));
    expect(api.helpView(api.helpSearch(st, "zzzz")).list).toContain("Nothing found. Try a word like keys, loop or record.");
  });

  it("opening a card shows its detail: hero, the topic's own HTML, More in the group, and Back", () => {
    const i = at("Tracks");
    const v = api.helpView(api.helpOpen({ group: "Start", q: "", topic: -1 }, i));
    expect(v.showing).toBe(true);
    expect(v.list).toContain('<div class="help__hero"><span class="help__tile help__tile--big">' + api.helpIcon(HELP_ICON[i]) + "</span>");
    expect(v.list).toContain("<small>Start</small>");
    expect(v.list).toContain(">Tracks</h3>");
    expect(v.list).toContain('<div class="help__body">' + HELP[i][3] + "</div>");
    expect(v.list).toContain("More in Start");
    const chips = [...v.list.matchAll(/class="help__chip" data-ht="(\d+)"/g)].map((m) => +m[1]);
    expect(chips).toEqual([at("Make a song"), at("Beats and patterns"), at("Music lessons"), at("Show and hide parts")]);
    // a group of one topic has no More in row
    expect(api.helpView(api.helpOpen({ group: "Recording", q: "", topic: -1 }, at("Record what you play"))).list).not.toContain("More in");
  });

  it("Back returns to the cards with the same group and search", () => {
    const st = api.helpOpen(api.helpSearch({ group: "Saving", q: "", topic: -1 }, "reverb"), at("Tracks"));
    expect(api.helpBackTo(st)).toEqual({ group: "Saving", q: "reverb", topic: -1 });
    expect(html).toContain('if (e.target.closest("[data-hback]")) return helpGoBack();');
    expect(fnBody("helpGoBack")).toContain("helpState = helpBackTo(helpState);");
  });

  it("Escape goes back first, then closes; Tab stays inside; a click on the scrim closes", () => {
    const open = api.helpOpen({ group: "Playing", q: "", topic: -1 }, at("Drum pads"));
    expect(api.helpEsc(open)).toEqual({ group: "Playing", q: "", topic: -1 });
    expect(api.helpEsc(api.helpEsc(open))).toBe(null);
    const key = fnBody("helpKeyDown");
    expect(key).toContain('if ($("#help").hidden) return false;');
    expect(key).toMatch(/const next = helpEsc\(helpState\);[\s\S]{0,80}if \(next\)[\s\S]{0,80}else closeHelp\(\)/);
    expect(key).toContain('if (e.key === "Tab") helpTrap(e);');
    expect(fnBody("helpTrap")).toContain("last.focus()");
    expect(html).toContain("if (sheetKey(e)) return;\n  if (helpKeyDown(e)) return;");
    expect(html).toMatch(/if \(e\.target\.id === "help"\) return closeHelp\(\);/);
  });

  it("every topic and every category has an icon from Sound Space's own inline set", () => {
    expect(HELP_ICON.length).toBe(HELP.length);
    for (const n of HELP_ICON.concat(Object.values(HELP_GROUP_ICON))) expect(HELP_SVG[n], n).toMatch(/^<(path|rect|circle|ellipse)/);
    for (const g of api.helpGroups()) expect(HELP_GROUP_ICON[g], g).toBeTruthy();
    expect(api.helpIcon("piano")).toBe('<svg class="hi" viewBox="0 0 24 24" aria-hidden="true">' + HELP_SVG.piano + "</svg>");
    const want = { "Piano keys": "piano", "Drum pads": "drum", "Record what you play": "record", "Light or dark": "moon" };
    for (const [t, n] of Object.entries(want)) expect(HELP_ICON[at(t)], t).toBe(n);
  });

  it("opening Help at a topic goes straight to that topic's detail", () => {
    const i = at("Counts and speed");
    expect(api.helpAt("Counts and speed")).toEqual({ group: "The grid", q: "", topic: i });
    expect(api.helpAt(i)).toEqual({ group: "The grid", q: "", topic: i });
    expect(api.helpAt()).toEqual({ group: "Start", q: "", topic: -1 });
    expect(fnBody("openHelp")).toContain("helpState = helpAt(topic)");
  });

  it("looks like the draft in Sound Space's tokens: no orange or green, phones full screen, still for reduced motion", () => {
    expect(css).toMatch(/\.help__box\{[^}]*width:min\(940px,100%\); height:min\(640px, calc\(100vh - 48px\)\);[^}]*border-radius:14px/);
    expect(css).toMatch(/\.help\{[^}]*position:fixed; inset:0;[^}]*place-items:center[^}]*background:var\(--overlay\)/);
    expect(css).toMatch(/\.help__cards\{[^}]*grid-template-columns:repeat\(2, minmax\(0,1fr\)\)/);
    expect(css).toMatch(/\.help__card:hover\{[^}]*transform:translateY\(-1px\)/);
    // the new phone rules come last, so the first @media block (and the last 640px block) stay as they were
    const tail = css.slice(css.lastIndexOf("@media (max-width:720px){"));
    expect(tail).toMatch(/\.help__box\{[^}]*width:100%; height:100%;[^}]*border-radius:0;[^}]*grid-template-columns:minmax\(0,1fr\);/);
    expect(tail).toMatch(/\.help__cats\{[^}]*flex-direction:row; overflow-x:auto/);
    expect(tail).toMatch(/\.help__cards\{ grid-template-columns:1fr; \}/);
    expect(css.indexOf("@media")).toBe(css.indexOf("@media (max-width:1279px){ #ss-sheet"));
    const rm = css.slice(css.lastIndexOf("@media (prefers-reduced-motion:reduce){"));
    expect(rm.slice(0, rm.indexOf("\n}"))).toContain(".help__card, .help__cat{ transition:none; } .help__card:hover{ transform:none; }");
    // every help rule uses the theme's tokens; the only raw colors allowed are white and black
    const rules = [...css.matchAll(/(?:^|\n)\s*\.help[^{]*\{[^}]*\}/g)].map((m) => m[0]).join("\n");
    expect(rules.length).toBeGreaterThan(500);
    for (const hex of rules.match(/#[0-9a-fA-F]{3,8}\b/g) || []) expect(["#fff", "#ffffff", "#000", "#000000"], hex).toContain(hex.toLowerCase());
    expect(rules).not.toMatch(/--(go|bass|winds)\b/);   // teal, yellow: not for Help
    expect(block).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
