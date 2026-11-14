import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Owner: the Recent cards on Art Space's Home get a hover state, the same lift the starter tiles have. */
const html = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");

describe("Art Space: Recent cards respond to the pointer", () => {
  it("lifts the card with the same shadow as the starter tiles", () => {
    expect(html).toMatch(/\.art\{[^}]*transition:transform \.12s ease, box-shadow \.12s ease/);
    expect(html).toContain(".art:hover, .art:has(.art__open:focus-visible){ transform:translateY(-2px); box-shadow:var(--pop); }");
  });
  it("grows the small picture a little, like the starter tiles", () => {
    expect(html).toContain(".art:hover .art__open img, .art:has(.art__open:focus-visible) .art__open img{ transform:scale(1.04); }");
  });
  it("stays still for people who turn motion off", () => {
    expect(html).toContain("@media (prefers-reduced-motion:reduce){ .art, .art__open img{ transition:none; } .art:hover, .art:has(.art__open:focus-visible), .art:hover .art__open img, .art:has(.art__open:focus-visible) .art__open img{ transform:none; } }");
  });
});
