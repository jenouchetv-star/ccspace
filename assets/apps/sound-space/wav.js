(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  function writeStr(v, off, s) {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  }

  // Interleaved 16-bit little-endian PCM in a standard 44-byte RIFF header.
  function encodeWav(channels, sampleRate) {
    const nch = channels.length;
    const frames = nch ? channels[0].length : 0;
    const dataBytes = frames * nch * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const v = new DataView(buf);
    writeStr(v, 0, "RIFF");
    v.setUint32(4, 36 + dataBytes, true);
    writeStr(v, 8, "WAVE");
    writeStr(v, 12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, nch, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * nch * 2, true);
    v.setUint16(32, nch * 2, true);
    v.setUint16(34, 16, true);
    writeStr(v, 36, "data");
    v.setUint32(40, dataBytes, true);
    let off = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < nch; c++) {
        let s = channels[c][i];
        s = s > 1 ? 1 : s < -1 ? -1 : s;
        v.setInt16(off, Math.round(s * 32767), true);
        off += 2;
      }
    }
    return buf;
  }

  SS.wav = Object.assign(SS.wav || {}, { encodeWav });
})(typeof window !== "undefined" ? window : globalThis);
