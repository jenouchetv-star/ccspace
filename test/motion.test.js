// The site's motion system (index.html, "MOTION"): one set of timings in CSS tokens, and the small rules the
// count-up numbers follow, so a number never loses its look while it moves and a date or a phone number never moves.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pure = index.split("/* BEGIN motion-pure */")[1].split("/* END motion-pure */")[0];
const M = new Function(pure + "; return { motionParseCount, motionFormatCount, motionCountMs, motionEase, motionStaggerDelay };")();
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
  it("caps the stagger so a long list never feels slow", () => {
    expect(M.motionStaggerDelay(0, 50, 8)).toBe(0);
    expect(M.motionStaggerDelay(3, 50, 8)).toBe(150);
    expect(M.motionStaggerDelay(40, 50, 8)).toBe(400);
  });
});

describe("the motion system in the page", () => {
  it("keeps every timing and curve in one set of tokens", () => {
    for (const t of ["--mo-dur-press", "--mo-dur-state", "--mo-dur-reveal", "--mo-dur-page", "--mo-stagger", "--mo-rise", "--mo-ease-out", "--mo-ease-state"]){
      expect(css, t).toContain(t + ":");
    }
  });
  it("runs after every render", () => {
    const render = index.split("function render(){")[1].split("\n}\n")[0];
    expect(render).toContain("Motion.afterRender()");
  });
  it("turns off movement, count-ups and shimmer for reduced motion", () => {
    const block = css.split("/* ---- reduced motion: no movement")[1].split("}\n}")[0];
    for (const sel of [".mo-page-in", ".mo-arrive", ".mo-stagger", ".mo-ind"]) expect(block).toContain(sel);
    const js = index.split("const Motion = {")[1].split("\n};\n")[0];
    expect(js).toContain("reduced()");
  });
  it("marks the current page in every nav it slides along", () => {
    const fn = name => index.split("function " + name + "(")[1].split("\n}\n")[0];
    for (const name of ["navBar", "subNavBar", "bottomNav"]) expect(fn(name), name).toContain('aria-current="');
    const motion = index.split("const Motion = {")[1].split("\n};\n")[0];
    for (const sel of ['.nav__link[aria-current="page"]', ".subnav__link[aria-current]", '.bottom-nav__item[aria-current="page"]']) expect(motion).toContain(sel);
  });
  it("shows skeletons, not loading text, while the admin analytics load", () => {
    const an = index.split("function adminAnalytics(){")[1].split("\n}\n")[0];
    expect(an).toContain("analyticsSkeleton()");
    expect(an).not.toContain("Loading traffic data...</p>");
  });
});
