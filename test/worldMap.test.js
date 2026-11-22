// The admin's Visitor countries map is a Robinson projection (owner, 2026-11-21: "the Robinson map is the style that I
// want ... keep the color the same"). Country paths stay keyed by lowercase ISO alpha-2 so the colouring code works.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../assets/vendor/world-map.svg", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("the Visitor countries map", () => {
  it("is the Robinson projection with its outline and grid", () => {
    expect(svg).toContain("Robinson");
    expect(svg).toContain('class="wm-sphere"');
    expect(svg).toContain('class="wm-grat"');
  });
  it("keeps one path per country keyed by its two-letter code", () => {
    for (const code of ["us", "gb", "in", "se", "de", "ng", "br", "au", "ca", "cn"]) expect(svg).toContain('<path id="' + code + '"');
    expect(svg.match(/<path id="[a-z]{2}"/g).length).toBeGreaterThan(160);
  });
  it("names every country on hover, and a country with visitors adds its views (owner, 2026-11-21)", () => {
    expect(svg).toContain('<path id="us" data-name="United States"');
    expect(svg.match(/<path id="[a-z_]+" data-name="[^"]+"/g).length).toBe(svg.match(/<path id="/g).length);
    const fn = html.split("function countryMapHTML(byCountry){")[1].split("\n}\n")[0];
    expect(fn).toContain(`data-tip="$2"`);
    expect(fn).toContain('data-name="([^"]*)"');
  });
  it("gets the full width of the dashboard", () => {
    expect(html).toContain('<div class="wmap-big" style="max-width:1100px;margin:0 auto">');
  });
  it("styles the outline and grid apart from the countries, in the admin's own greys", () => {
    expect(html).toContain(".wmap-wrap svg path.wm-sphere{");
    expect(html).toContain(".wmap-wrap svg path.wm-grat{ fill:none;");
  });
});
