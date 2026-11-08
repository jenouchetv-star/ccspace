// The site's motion system (index.html, "MOTION"): one set of timings in CSS tokens, and the small rules the
// count-up numbers follow, so a number never loses its look while it moves and a date or a phone number never moves.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pure = index.split("/* BEGIN motion-pure */")[1].split("/* END motion-pure */")[0];
const M = new Function(pure + "; return { motionParseCount, motionFormatCount, motionCountMs, motionEase, motionSubMove };")();
const css = index.split("<style>")[1].split("</style>")[0];

describe("count-up numbers keep their look", () => {
  it("reads the words, commas, decimals and leading zeros around a number", () => {
    expect(M.motionParseCount("1,234")).toMatchObject({ prefix: "", value: 1234, suffix: "", grouped: true, decimals: 0 });
    expect(M.motionParseCount("$4.5 billion")).toMatchObject({ prefix: "$", value: 4.5, decimals: 1, suffix: " billion" });
    expect(M.motionParseCount("67%")).toMatchObject({ value: 67, suffix: "%" });
    expect(M.motionParseCount("05")).toMatchObject({ value: 5, pad: 2 });
    expect(M.motionParseCount("312ms")).toMatchObject({ value: 312, suffix: "ms" });
  });
  it("shows a number part way through in the same format", () => {
    expect(M.motionFormatCount(M.motionParseCount("1,234"), 617.4)).toBe("617");
    expect(M.motionFormatCount(M.motionParseCount("12,500"), 1000)).toBe("1,000");
    expect(M.motionFormatCount(M.motionParseCount("$4.5 billion"), 2)).toBe("$2.0 billion");
    expect(M.motionFormatCount(M.motionParseCount("05"), 3)).toBe("03");
    expect(M.motionFormatCount(M.motionParseCount("8.25%"), 0)).toBe("0.00%");
  });
  it("lands exactly on the text it started from", () => {
    for (const t of ["1,234", "$4.5 billion", "67%", "05", "0", "1,000,000", "3.14", "+12%", "About 40 kids"]){
      const s = M.motionParseCount(t);
      expect(s, t).not.toBeNull();
      expect(M.motionFormatCount(s, s.value)).toBe(t);
    }
  });
  it("never moves dates, years, times, phone numbers, ids or text with two numbers", () => {
    for (const t of ["1 in 4", "2024", "2026-11-08", "11/08/2026", "555-0142", "12:30", "#1042", "ID-77", "", "Soon", "v2.1.3"]){
      expect(M.motionParseCount(t), t).toBeNull();
    }
  });
});

describe("pages on a phone", () => {
  it("never slide left or right (by request): a phone changes page the way a computer does", () => {
    for (const gone of ["mo-ghost", "mo-push-in", "mo-pop-in", "mo-tab-in", "mo-slide-in", "mo-slide-out", "mo-drift-left"]) expect(index, gone).not.toContain(gone);
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    expect(render).not.toContain("Motion.capture()");
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    expect(js).not.toContain("capture(){");
    expect(js).not.toContain("native(){");
    expect(index).not.toContain("motionNavKind");
    expect(index).toContain('history.pushState({}, "", url);');
  });
  it("still lets a bottom sheet close by sliding down, and follow a finger", () => {
    const block = css.split("/* ---- reduced motion: no movement")[1].split("}\n}")[0];
    expect(block).toContain(".sheet-scrim.is-leaving");
    expect(index).toContain("dragSheet(sheet){");
  });
});

describe("motion timing", () => {
  it("counts for 400 to 800 ms, longer for bigger jumps, and not at all when nothing changed", () => {
    expect(M.motionCountMs(5, 5)).toBe(0);
    const small = M.motionCountMs(0, 3), big = M.motionCountMs(0, 250000);
    expect(small).toBeGreaterThanOrEqual(400);
    expect(big).toBeLessThanOrEqual(800);
    expect(big).toBeGreaterThan(small);
  });
  it("eases out: starts quickly, lands softly, ends exactly", () => {
    expect(M.motionEase(0)).toBe(0);
    expect(M.motionEase(1)).toBe(1);
    expect(M.motionEase(0.5)).toBeGreaterThan(0.5);
  });
});

describe("the motion system in the page", () => {
  it("keeps every timing and curve in one set of tokens", () => {
    for (const t of ["--mo-dur-press", "--mo-dur-state", "--mo-dur-reveal", "--mo-dur-page", "--mo-dur-enter", "--mo-rise", "--mo-ease-out", "--mo-ease-state"]){
      expect(css, t).toContain(t + ":");
    }
  });
  it("lets a redraw of the same page carry on its entrance instead of starting it over (no flicker on load)", () => {
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    const swap = render.indexOf('$("#app").innerHTML');
    expect(render.indexOf("moSame")).toBeGreaterThan(-1);
    expect(render.indexOf("moSame")).toBeLessThan(swap);
    expect(render.slice(swap)).toContain('classList.toggle("mo-resume", moSame)');
    expect(render.slice(swap)).toContain('"--mo-elapsed"');
    for (const d of ["", ".d1", ".d2", ".d3", ".d4", ".d5", ".d6"]) expect(css).toContain("#app.mo-resume .rise" + d + "{ animation-delay:calc(");
    // the typing word keeps the word it is on when the page redraws
    const rot = index.split("function rotateHeroWord(){")[1].split("\n}\n")[0];
    expect(rot).toContain("HERO_WORD_AT");
  });
  it("runs after every render", () => {
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    expect(render).toContain("Motion.afterRender()");
  });
  it("turns off movement, count-ups and shimmer for reduced motion", () => {
    const block = css.split("/* ---- reduced motion: no movement")[1].split("}\n}")[0];
    for (const sel of [".mo-page-in", ".mo-arrive", ".mo-grow", ".mo-sub-down", ".mo-sub-up", ".mo-ind"]) expect(block).toContain(sel);
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    expect(js).toContain("reduced()");
  });
  it("marks the current page in every nav; only a section's yellow tab slides to the new tab, the blue highlights stay put", () => {
    const fn = name => index.split("function " + name + "(")[1].split("\n}\n")[0];
    for (const name of ["navBar", "subNavBar", "bottomNav"]) expect(fn(name), name).toContain('aria-current="');
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    const navs = js.split("NAVS: [")[1].split("],")[0];
    expect(navs).toContain(".subnav__link[aria-current]");
    expect(navs).not.toContain(".nav__link");          // the header's blue highlight: no slide
    expect(navs).not.toContain(".bottom-nav__item");   // the phone bar's blue pill: no slide
    expect(js.split("afterRender(){")[1].split("\n  },\n")[0]).toContain("this.indicators(false)");
    expect(css).toMatch(/\.mo-ind\{[^}]*transition:transform var\(--mo-dur-state\) var\(--mo-ease-out\)/);   // slows to a stop, no bounce
    expect(css).toContain(".mo-ind--sub{");
    expect(css).toContain('.nav__link[aria-current="page"]{ --hl:#8FE3F0; background-size:100% 1.3em; }');
    expect(css).toContain('.subnav__link[aria-current="page"], .subnav__link[aria-current="location"]{');
    expect(css).toContain(".bottom-nav__item.is-active{ color:var(--cyan-deep); background:rgba(18,115,176,.13); }");
  });
  it("keeps the header and the tab bars still on a new page (the link under the pointer doesn't wipe in again)", () => {
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    expect(render.slice(render.indexOf('$("#app").innerHTML'))).toContain('classList.add("mo-settle")');
    // ...except the yellow tab, whose slide to the new tab is the one move the tab bar makes
    expect(css).toContain("#app.mo-settle :is(.nav, .subnav, .ctxbar, .bottom-nav), #app.mo-settle :is(.nav, .subnav, .ctxbar, .bottom-nav) *:not(.mo-ind){ transition:none !important; }");
  });
  it("never animates the cards (by request): a row of cards is simply there with the page", () => {
    expect(index).not.toContain("mo-stagger");
    expect(index).not.toContain("stagger(area");
    expect(index).not.toContain("motionStaggerDelay");
  });
  it("moves without bounce (by request): fast, then slowing to a soft stop", () => {
    expect(index).not.toContain("--mo-ease-bounce");
    expect(index).not.toContain("--mo-dur-bounce");
    expect(index).not.toContain("--mo-ease-spring");                         // the sheet settles without overshoot too
    expect(css).toContain("--mo-ease-press: cubic-bezier(.2,.9,.3,1);");    // and the buttons' lift (it went to 1.2)
    expect(css).toContain("--mo-ease-out:   cubic-bezier(.22,1,.36,1);");   // fast, then slowing to a soft stop
    expect(css).toContain(".mo-arrive{ animation:mo-pop var(--mo-dur-enter) var(--mo-ease-out) both; }");
    const pop = css.split("@keyframes mo-pop{")[1].split("}\n")[0];
    expect(pop).toContain("scale:");
    expect(pop).toContain("opacity:0");
  });
  it("doesn't bring content in as it is scrolled to (by request): what is further down is simply there", () => {
    expect(index).not.toContain("revealBelow");
    expect(index).not.toContain("mo-reveal");
  });
  it("cascades the finder's materials in (fade-grow) when the step shows, not when one is ticked", () => {
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    expect(js).toContain("finderGrow(root, slot, fresh){");
    expect(js.split("afterRender(){")[1].split("\n  },\n")[0]).toContain('this.finderGrow(main, "app")');
    expect(index.split("function reopenFinderModal(){")[1].split("\n}\n")[0]).toContain('Motion.finderGrow($("#modal-root"), "sheet")');
    expect(index).toMatch(/"finder-modal-open": \(\) => \{\s*openModal\(finderModalHTML\(\), null, "modal--sheet finder-modal"\);\s*Motion\.finderGrow\(\$\("#modal-root"\), "sheet", true\);/);
    expect(css).toMatch(/\.mo-grow > \*\{\s*animation:mo-grow var\(--mo-dur-enter\) var\(--mo-ease-out\) both;/);
  });
  it("slides the section tab bar down onto a page with tabs, and up off it when leaving; between two pages with tabs it stays still", () => {
    expect(M.motionSubMove(false, true, false)).toBe("down");
    expect(M.motionSubMove(true, false, false)).toBe("up");
    expect(M.motionSubMove(true, true, false)).toBeNull();
    expect(M.motionSubMove(false, false, false)).toBeNull();
    expect(M.motionSubMove(false, true, true)).toBeNull();   // the first page of a visit just shows
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    expect(render.indexOf("Motion.keepSub()")).toBeGreaterThan(-1);
    expect(render.indexOf("Motion.keepSub()")).toBeLessThan(render.indexOf('$("#app").innerHTML'));
    const after = index.split("const Motion = {")[1].split("\n};\n")[0].split("afterRender(){")[1].split("\n  },\n")[0];
    expect(after).toContain("this.subMove(");
  });
  it("doesn't animate the page banner (by request): it comes with the page like the rest of it", () => {
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    expect(js).not.toContain("morphHead");
    expect(js).not.toContain("headOld");
    expect(css).not.toContain("--mo-dur-head");
    const after = js.split("afterRender(){")[1].split("\n  },\n")[0];
    expect(after).not.toContain(".pagehead");
    expect(after).toContain('area.classList.add("mo-page-in")');
  });
  it("shows skeletons, not loading text, while the admin analytics load", () => {
    const an = index.split("function adminAnalytics(){")[1].split("\n}\n")[0];
    expect(an).toContain("analyticsSkeleton()");
    expect(an).not.toContain("Loading traffic data...</p>");
  });
});
