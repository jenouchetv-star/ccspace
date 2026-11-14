(function (root) {
  const SS = root.SoundSpace = root.SoundSpace || {};

  SS.model = {
    CONST: {
      SCHEMA_VERSION: 1,
      STEPS_PER_COUNT: 2,
      COUNTS: [4, 8, 16],
      MAX_TRACKS: 8,
      TEMPO_MIN: 60,
      TEMPO_MAX: 160,
      TEMPO_DEFAULT: 100
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
