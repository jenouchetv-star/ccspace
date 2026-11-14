// Loads Sound Space's classic-script modules into Node for vitest.
// Each file is evaluated in order against one stub window, so later
// modules see what earlier ones registered on window.SoundSpace.
import { readFileSync } from "node:fs";

export function loadSS(...files) {
  const stub = { indexedDB: undefined };
  for (const f of files) {
    const src = readFileSync(
      new URL(`../../assets/apps/sound-space/${f}`, import.meta.url),
      "utf8"
    );
    new Function("window", src)(stub);
  }
  return stub.SoundSpace;
}
