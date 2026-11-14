import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Owner: the Recent cards on Home get a hover state, the same lift the starter tiles have, in both apps. */
const apps = {
  "Art Space": ["../assets/apps/art-studio.html", "img"],
  "Sound Space": ["../assets/apps/sound-space.html", "svg"]
};

describe.each(Object.entries(apps))("%s: Recent cards respond to the pointer", (name, [file, pic]) => {
  const html = readFileSync(new URL(file, import.meta.url), "utf8");
  it("lifts the card with the same shadow as the starter tiles", () => {
    expect(html).toMatch(/\.art\{[^}]*transition:transform \.12s ease, box-shadow \.12s ease/);
    expect(html).toMatch(/\.art:hover, \.art:has\(\.art__open:focus-visible\)\{ transform:translateY\(-2px\); box-shadow:var\(--pop\); \}/);
  });
  it("grows the small picture a little, like the starter tiles", () => {
    expect(html).toContain(".art:hover .art__open " + pic + ", .art:has(.art__open:focus-visible) .art__open " + pic + "{ transform:scale(1.04); }");
  });
  it("stays still for people who turn motion off", () => {
    expect(html).toMatch(/@media \(prefers-reduced-motion:reduce\)\{ \.art, \.art__open [a-z]+\{ transition:none; \} \.art:hover, \.art:has\(\.art__open:focus-visible\), \.art:hover \.art__open [a-z]+, \.art:has\(\.art__open:focus-visible\) \.art__open [a-z]+\{ transform:none; \} \}/);
  });
});
