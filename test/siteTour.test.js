import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* The site tour's stop list, read straight from the page */
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.split("const TOUR_STOPS = ")[1].split("\n];")[0] + "\n]";
const STOPS = new Function("return " + src.replace(/\/\*[\s\S]*?\*\//g, ""))();
const keys = STOPS.map(s => s.key);

describe("Site tour", () => {
  it("visits Creative Space Studio right after Create", () => {
    const i = keys.indexOf("studio");
    expect(i).toBe(keys.indexOf("create") + 1);
    expect(STOPS[i]).toMatchObject({ hash:"#/create/studio", navLabel:"Creative Space Studio", target:".pagehead .shell" });
  });
  it("visits Articles right after For Grown-Ups", () => {
    const i = keys.indexOf("articles");
    expect(i).toBe(keys.indexOf("grown-ups") + 1);
    expect(STOPS[i]).toMatchObject({ hash:"#/grown-ups/articles", navLabel:"Articles", target:".arthead__row" });
  });
  it("every stop has its own key, a title, words and an icon, and only the last has no next line", () => {
    expect(new Set(keys).size).toBe(keys.length);
    STOPS.forEach((s, i) => {
      expect(s.title && s.body && s.icon && s.hash.startsWith("#/")).toBeTruthy();
      expect(Boolean(s.next)).toBe(i < STOPS.length - 1);
    });
  });
  it("the stop before Studio and the stop before Articles lead into them", () => {
    expect(STOPS[keys.indexOf("create")].next).toMatch(/studio/i);
    expect(STOPS[keys.indexOf("grown-ups")].next).toMatch(/articles/i);
  });
});
