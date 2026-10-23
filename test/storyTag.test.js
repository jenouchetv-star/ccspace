// A picture-book "tag" (the small label above a page's text, e.g. "What Zech and Corey learned")
// is a pill that hugs its words. It used to be styled on the layer box itself, which has the
// layer's own width and height, so a long box turned the label into a huge pill with the words
// stuck in its corner. The box now only positions it; the pill look sits on an inner span.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const reader = readFileSync(new URL("../books/reader.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("book tag labels", () => {
  for (const [name, src] of [["the public reader", reader], ["the admin book builder", index]]) {
    it(name + " puts the pill on an inner span and leaves the layer box without pill styling", () => {
      expect(src).toMatch(/tag:\s+"font-weight:700"\s*\n?\s*\}/);          // box: just positioning + weight
      expect(src).toMatch(/const TAG_PILL_CSS = "display:inline-block;max-width:100%/);
      expect(src).toMatch(/border-radius:999px/);
      expect(src).toContain('<span style="\' + TAG_PILL_CSS');
    });
  }

  it("the filmstrip thumbnails use a small pill too", () => {
    expect(index).toContain("const THUMB_TAG_PILL_CSS");
    expect(index).toContain('<span style="\' + THUMB_TAG_PILL_CSS');
  });
});
