(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  // A real music keyboard over Web MIDI: input only. Sysex is never asked for, nothing is ever sent to the
  // keyboard, and no microphone or other capture is used. This file knows nothing of the page: the app hands
  // connect() a navigator and two callbacks.
  //  - onEvent({ type:"on", pitch, vel, ts } | { type:"off", pitch, vel, ts } | { type:"pedal", down, ts })
  //  - onState("connected" | "none"): connected while at least one keyboard is plugged in.

  // One MIDI message (status byte first) as a note or the sustain pedal, or null for anything else: clock,
  // active sensing, other controllers, sysex, pitch bend.
  function parseMessage(data) {
    if (!data || data.length < 3) return null;
    const status = data[0], hi = status & 0xf0;
    if (status < 0x80) return null;
    const a = data[1] & 0x7f, b = data[2] & 0x7f;
    if (hi === 0x90) return b > 0 ? { type: "on", pitch: a, vel: b } : { type: "off", pitch: a, vel: 0 };
    if (hi === 0x80) return { type: "off", pitch: a, vel: b };
    if (hi === 0xb0 && a === 64) return { type: "pedal", down: b >= 64 };
    return null;
  }

  // How hard a key was pressed (1 to 127) as a note's loudness (0.2 to 1). The curve bends up, so soft playing
  // is still heard.
  function velToVel(v) {
    const x = (Math.max(1, Math.min(127, Number(v) || 1)) - 1) / 126;
    return 0.2 + 0.8 * Math.pow(x, 0.6);
  }

  function supported(nav) {
    return !!nav && typeof nav.requestMIDIAccess === "function";
  }

  let access = null, gen = 0;

  // Asks the browser for MIDI (it may show a prompt), then listens on every input, and on inputs plugged in later.
  async function connect(nav, onEvent, onState) {
    disconnect();
    if (!supported(nav)) return { ok: false, reason: "unsupported" };
    const mine = ++gen;
    let a;
    try { a = await nav.requestMIDIAccess({ sysex: false }); } catch (e) { return { ok: false, reason: "denied" }; }
    if (mine !== gen || !a) return { ok: false, reason: "none" };   // a newer connect (or a disconnect) came first
    access = a;
    const onMessage = (e) => {
      const m = parseMessage(e && e.data);
      if (m) { m.ts = e.timeStamp; onEvent(m); }
    };
    const attach = () => {
      let n = 0;
      a.inputs.forEach((inp) => {
        if (inp.state === "disconnected") return;
        n++;
        if (inp.onmidimessage !== onMessage) inp.onmidimessage = onMessage;   // setting it also opens the port
      });
      onState(n ? "connected" : "none");
      return n;
    };
    a.onstatechange = () => { if (access === a) attach(); };
    return attach() ? { ok: true } : { ok: false, reason: "none" };
  }

  // Stops listening and lets go of the inputs, so other programs can use the keyboard.
  function disconnect() {
    gen++;
    const a = access;
    access = null;
    if (!a) return;
    a.onstatechange = null;
    try {
      a.inputs.forEach((inp) => {
        inp.onmidimessage = null;
        try { const p = inp.close && inp.close(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      });
    } catch (e) {}
  }

  // On opening: connects only when the browser already allows MIDI here, so it never shows a prompt.
  async function autoConnect(nav, onEvent, onState) {
    if (!supported(nav)) return { ok: false, reason: "unsupported" };
    let st = null;
    try { st = nav.permissions && nav.permissions.query ? await nav.permissions.query({ name: "midi" }) : null; } catch (e) { st = null; }
    if (!st || st.state !== "granted") return { ok: false, reason: "not-granted" };
    return connect(nav, onEvent, onState);
  }

  SS.midi = { parseMessage, velToVel, supported, connect, disconnect, autoConnect };
})(typeof window !== "undefined" ? window : globalThis);
