import { describe, it, expect } from "vitest";
import { loadSS } from "./helpers/soundSpace.js";

describe("Sound Space model", () => {
  it("exposes the song constants from the design", () => {
    const SS = loadSS("model.js");
    expect(SS.model.CONST).toEqual({ SCHEMA_VERSION: 1, STEPS_PER_COUNT: 2, COUNTS: [4, 8, 16], MAX_TRACKS: 8, TEMPO_MIN: 60, TEMPO_MAX: 160, TEMPO_DEFAULT: 100 });
  });
});
