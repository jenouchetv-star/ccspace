// About > Our Vision: the "how confidence grows" panel talks about self-esteem, playfully (owner, 2026-11-16).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("how STEAMM builds self-esteem", () => {
  it("names the panel after self-esteem, not confidence", () => {
    expect(site).toContain('fb:"How STEAMM builds self-esteem"');
    expect(site).toContain('fb:"Self-esteem grows one creation at a time:"');
    expect(site).not.toContain('fb:"How confidence grows"');
  });
  it("tells the story with a playful I did that! moment and no confidence wording", () => {
    const text = site.split('pageVal("about/vision", "confidenceText",')[1].split(");")[0];
    expect(text).toContain("“I did that!”");
    expect(text).toContain("self-esteem");
    expect(text).not.toMatch(/confiden/i);
  });
});
