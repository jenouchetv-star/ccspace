// The report's week looks like a calendar week, with the actual dates (owner, 2026-11-28).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const src = html.split("function weekCalHTML(")[1].split("\nfunction ")[0];
const weekCalHTML = new Function("return function weekCalHTML(" + src)();
const day = (key, letter, on) => ({ key, letter, on });

describe("the report's week as a calendar", () => {
  const week = [day("2026-11-22", "S", true), day("2026-11-23", "M", true), day("2026-11-24", "T", false), day("2026-11-25", "W", true),
    day("2026-11-26", "T", true), day("2026-11-27", "F", false), day("2026-11-28", "S", false)];

  it("shows the dates the week covers, then each day's letter and date", () => {
    const h = weekCalHTML(week, "2026-11-28");
    expect(h).toContain('<span class="rp-week__dates">Nov 22 to 28</span>');
    expect(h).toContain('<span class="rp-week__d on"><small>S</small><b>22</b></span>');
    expect(h).toContain('<span class="rp-week__d"><small>T</small><b>24</b></span>');
    expect((h.match(/rp-week__d on/g) || []).length).toBe(4);
  });

  it("rings today, and names both months when the week crosses one", () => {
    expect(weekCalHTML(week, "2026-11-28")).toContain('<span class="rp-week__d is-today"><small>S</small><b>28</b></span>');
    const cross = [day("2026-11-29", "S", false), day("2026-11-30", "M", false), day("2026-12-01", "T", true), day("2026-12-02", "W", false),
      day("2026-12-03", "T", false), day("2026-12-04", "F", false), day("2026-12-05", "S", false)];
    expect(weekCalHTML(cross, "")).toContain("Nov 29 to Dec 5");
  });

  it("is the Engagement block's week, and nothing for no days", () => {
    expect(html).toContain("+ weekCalHTML(G.week, dayKey(Date.now())))");
    expect(weekCalHTML([], "")).toBe("");
    expect(weekCalHTML(undefined, "")).toBe("");
  });
});
