// "Hear it" on a Word to know card plays Heart's recording of the word (assets/words/<word>.mp3, owner 2026-11-16: the
// Hear it buttons should use the Kokoro voice). These are the words on the site's games and portal posts on 2026-11-17;
// a word added later uses the device's voice until it's recorded with scripts/record-lines.mjs.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";

const WORDS = ["2D spatial awareness", "angle", "clue", "computer vision", "describe", "design", "durability", "Edutainment", "efficiency",
  "engineer", "gravity", "interaction", "invention", "load", "memory", "narrator", "operation", "orbit", "pattern", "place value",
  "probability", "prompt", "sequence", "step", "strategy", "sum", "transform", "vibration", "vocabulary"];
const slug = (w) => w.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

describe("Word to know recordings", () => {
  it("has Heart's recording of every word on the site", () => {
    for (const w of WORDS) expect(existsSync(new URL("../assets/words/" + slug(w) + ".mp3", import.meta.url)), w).toBe(true);
  });
});
