(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  function stepSeconds(tempo) {
    return 60 / tempo / 2;
  }

  // Events for notes with fromStep <= step < toStep, honoring mute/solo.
  function compileEvents(song, fromStep, toStep) {
    const anySolo = song.tracks.some((t) => t.solo);
    const out = [];
    for (const t of song.tracks) {
      if (t.mute) continue;
      if (anySolo && !t.solo) continue;
      for (const n of t.notes) {
        if (n.step < fromStep || n.step >= toStep) continue;
        out.push({
          step: n.step,
          trackId: t.id,
          instrumentId: t.instrumentId,
          pitch: n.pitch,
          len: n.len,
          vel: n.vel,
          gain: t.volume * song.volume * n.vel,
        });
      }
    }
    out.sort((a, b) => a.step - b.step);
    return out;
  }

  // Steps due at nextStepTime + k*stepDur. Those more than one step in the
  // past are skipped; the rest, up to now + horizon, are counted.
  function stepsToSchedule(nextStepTime, now, horizon, stepDur) {
    let skipped = 0;
    let steps = 0;
    const eps = 1e-9;
    for (let k = 0; ; k++) {
      const t = nextStepTime + k * stepDur;
      if (t >= now + horizon - eps) break;
      if (t < now - stepDur - eps) skipped++;
      else steps++;
    }
    return { steps, skipped };
  }

  function exportFrames(song, times, sampleRate, tailSec) {
    const rate = sampleRate || 44100;
    const tail = tailSec === undefined ? 2 : tailSec;
    const total = song.counts * SS.model.CONST.STEPS_PER_COUNT;
    const seconds = total * stepSeconds(song.tempo) * times + tail;
    return Math.round(seconds * rate);
  }

  SS.engine = Object.assign(SS.engine || {}, {
    stepSeconds,
    compileEvents,
    stepsToSchedule,
    exportFrames,
  });
})(typeof window !== "undefined" ? window : globalThis);
