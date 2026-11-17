// Read to me must read every word on a page. Kokoro cuts a single long take short (owner, 2026-11-17: "the audio reading
// stopped here" on the green pages), so long pages are recorded a few sentences at a time (scripts/narrate-books.mjs).
// A recording that is too short for its words, faster than anyone reads aloud, means the end was cut off.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../assets/books/narration/", import.meta.url);
const books = readdirSync(dir).filter(f => f.endsWith(".json"));

describe("every page's recording is long enough for all its words", () => {
  for (const f of books){
    it(f, () => {
      const j = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      for (const [i, p] of Object.entries(j.pages)){
        if (!p.text) continue;
        const words = p.text.split(/\s+/).length;
        expect(words / p.dur, f + " page " + i).toBeLessThan(3.4);
        /* the last word is timed inside the recording, not after it */
        expect(p.t[p.t.length - 1][0], f + " page " + i).toBeLessThan(p.dur);
      }
    });
  }
});
