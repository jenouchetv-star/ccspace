// Sound Space's real music keyboard: assets/apps/sound-space/midi.js reads Web MIDI messages (input only, never
// sysex) into notes and the sustain pedal. These tests run it against fake navigators: no browser, no keyboard.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const src = (() => {
  const u = new URL("../assets/apps/sound-space/midi.js", import.meta.url);
  return existsSync(u) ? readFileSync(u, "utf8") : "";
})();
const midi = () => loadSS("midi.js").midi;

/** A fake MIDI input: send(bytes) delivers a message the way a browser does, through onmidimessage. */
function fakeInput(id = "in1", state = "connected") {
  const inp = {
    id, name: "Fake keys", state, onmidimessage: null, closed: false,
    close() { this.closed = true; return Promise.resolve(this); },
    send(bytes, timeStamp = 1234) { if (inp.onmidimessage) inp.onmidimessage({ data: Uint8Array.from(bytes), timeStamp }); },
  };
  return inp;
}
/** A fake navigator: requestMIDIAccess resolves to an access whose inputs is a Map, as MIDIInputMap is maplike. */
function fakeNav(inputs = [], opts = {}) {
  const access = { inputs: new Map(inputs.map((i) => [i.id, i])), onstatechange: null };
  const nav = {
    calls: [],
    access,
    requestMIDIAccess(o) {
      nav.calls.push(o);
      return opts.reject ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve(access);
    },
  };
  if (opts.permission !== undefined) nav.permissions = { query: async (d) => { nav.asked = d; return { state: opts.permission }; } };
  return nav;
}

describe("SS.midi.parseMessage", () => {
  it("reads a note-on", () => {
    expect(midi().parseMessage([0x90, 60, 100])).toEqual({ type: "on", pitch: 60, vel: 100 });
    expect(midi().parseMessage(Uint8Array.from([0x9f, 61, 1]))).toEqual({ type: "on", pitch: 61, vel: 1 });   // any channel
  });
  it("reads a note-off sent as 0x80, and as 0x90 with velocity 0", () => {
    expect(midi().parseMessage([0x80, 60, 64])).toMatchObject({ type: "off", pitch: 60 });
    expect(midi().parseMessage([0x8a, 72, 0])).toMatchObject({ type: "off", pitch: 72 });
    expect(midi().parseMessage([0x90, 60, 0])).toMatchObject({ type: "off", pitch: 60 });
  });
  it("reads the sustain pedal (CC64): down at 64 or more, up below", () => {
    expect(midi().parseMessage([0xb0, 64, 127])).toEqual({ type: "pedal", down: true });
    expect(midi().parseMessage([0xb3, 64, 64])).toEqual({ type: "pedal", down: true });
    expect(midi().parseMessage([0xb0, 64, 63])).toEqual({ type: "pedal", down: false });
    expect(midi().parseMessage([0xb0, 64, 0])).toEqual({ type: "pedal", down: false });
  });
  it("ignores everything else: clock, active sensing, other controllers, sysex, pitch bend, junk", () => {
    const m = midi();
    expect(m.parseMessage([0xf8])).toBeNull();               // clock
    expect(m.parseMessage([0xfe])).toBeNull();               // active sensing
    expect(m.parseMessage([0xb0, 7, 100])).toBeNull();       // CC7, volume
    expect(m.parseMessage([0xf0, 0x7e, 0x7f, 0xf7])).toBeNull();   // sysex
    expect(m.parseMessage([0xe0, 0, 64])).toBeNull();        // pitch bend
    expect(m.parseMessage([0x90, 60])).toBeNull();           // cut short
    expect(m.parseMessage([60, 100])).toBeNull();            // no status byte
    expect(m.parseMessage([])).toBeNull();
    expect(m.parseMessage(null)).toBeNull();
  });
});

describe("SS.midi.velToVel", () => {
  it("gives 0.2 for the softest key and 1 for the hardest", () => {
    expect(midi().velToVel(1)).toBeCloseTo(0.2, 6);
    expect(midi().velToVel(127)).toBeCloseTo(1, 6);
  });
  it("rises steadily in between, gently, so soft playing is still heard", () => {
    const v = midi().velToVel;
    for (let i = 2; i <= 127; i++) expect(v(i)).toBeGreaterThan(v(i - 1));
    expect(v(32)).toBeGreaterThan(0.2 + 0.8 * (31 / 126));   // softer keys louder than a straight line
    expect(v(0)).toBeCloseTo(0.2, 6);                       // out of range is held in range
    expect(v(200)).toBeCloseTo(1, 6);
  });
});

describe("SS.midi.connect", () => {
  it("returns unsupported when the browser has no requestMIDIAccess (Safari, iPad, iPhone)", async () => {
    const states = [];
    const r = await midi().connect({}, () => {}, (s) => states.push(s));
    expect(r).toEqual({ ok: false, reason: "unsupported" });
    expect(midi().supported({})).toBe(false);
    expect(midi().supported(fakeNav())).toBe(true);
  });

  it("asks without sysex, reports connected with one input, and a message calls onEvent", async () => {
    const m = midi(), inp = fakeInput(), nav = fakeNav([inp]);
    const events = [], states = [];
    const r = await m.connect(nav, (e) => events.push(e), (s) => states.push(s));
    expect(r).toEqual({ ok: true });
    expect(nav.calls).toEqual([{ sysex: false }]);
    expect(states[states.length - 1]).toBe("connected");
    inp.send([0x90, 61, 90], 555);
    inp.send([0xf8]);                                  // clock: never reaches the app
    inp.send([0x80, 61, 0], 600);
    expect(events).toEqual([
      { type: "on", pitch: 61, vel: 90, ts: 555 },
      { type: "off", pitch: 61, vel: 0, ts: 600 },
    ]);
  });

  it("listens to every input, and to a keyboard plugged in later", async () => {
    const m = midi(), a = fakeInput("a"), b = fakeInput("b"), nav = fakeNav([a, b]);
    const events = [], states = [];
    await m.connect(nav, (e) => events.push(e.pitch), (s) => states.push(s));
    a.send([0x90, 60, 80]); b.send([0x90, 64, 80]);
    expect(events).toEqual([60, 64]);
    const c = fakeInput("c");
    nav.access.inputs.set("c", c);
    nav.access.onstatechange({ port: c });
    c.send([0x90, 67, 80]);
    expect(events).toEqual([60, 64, 67]);
    // every input unplugged: none
    for (const i of [a, b, c]) i.state = "disconnected";
    nav.access.onstatechange({ port: a });
    expect(states[states.length - 1]).toBe("none");
  });

  it("returns denied when the browser says no", async () => {
    const r = await midi().connect(fakeNav([fakeInput()], { reject: true }), () => {}, () => {});
    expect(r).toEqual({ ok: false, reason: "denied" });
  });

  it("returns none when no keyboard is plugged in, and still connects one plugged in afterwards", async () => {
    const m = midi(), nav = fakeNav([]), states = [], events = [];
    const r = await m.connect(nav, (e) => events.push(e), (s) => states.push(s));
    expect(r).toEqual({ ok: false, reason: "none" });
    expect(states).toEqual(["none"]);
    const k = fakeInput("k");
    nav.access.inputs.set("k", k);
    nav.access.onstatechange({ port: k });
    expect(states[states.length - 1]).toBe("connected");
    k.send([0x90, 60, 100]);
    expect(events.length).toBe(1);
  });

  it("disconnect stops listening and lets go of the inputs", async () => {
    const m = midi(), inp = fakeInput(), nav = fakeNav([inp]), events = [];
    await m.connect(nav, (e) => events.push(e), () => {});
    m.disconnect();
    expect(inp.onmidimessage).toBeNull();
    expect(nav.access.onstatechange).toBeNull();
    inp.send([0x90, 60, 100]);
    expect(events).toEqual([]);
  });

  it("connecting again leaves only the newest connection listening", async () => {
    const m = midi(), inp = fakeInput(), nav = fakeNav([inp]), first = [], second = [];
    await m.connect(nav, (e) => first.push(e), () => {});
    await m.connect(nav, (e) => second.push(e), () => {});
    inp.send([0x90, 60, 100]);
    expect(first).toEqual([]);
    expect(second.length).toBe(1);
  });
});

describe("SS.midi.autoConnect", () => {
  it("never asks the browser unless MIDI is already allowed", async () => {
    for (const permission of ["prompt", "denied", undefined]) {
      const nav = fakeNav([fakeInput()], { permission });
      const r = await midi().autoConnect(nav, () => {}, () => {});
      expect(r.ok).toBe(false);
      expect(nav.calls).toEqual([]);
    }
    // a browser whose permissions.query does not know "midi" throws: still no prompt
    const odd = fakeNav([fakeInput()]);
    odd.permissions = { query: () => Promise.reject(new TypeError("midi is not a permission name")) };
    expect((await midi().autoConnect(odd, () => {}, () => {})).ok).toBe(false);
    expect(odd.calls).toEqual([]);
    expect((await midi().autoConnect({}, () => {}, () => {})).reason).toBe("unsupported");
  });

  it("connects when MIDI is already granted", async () => {
    const nav = fakeNav([fakeInput()], { permission: "granted" });
    const r = await midi().autoConnect(nav, () => {}, () => {});
    expect(nav.asked).toEqual({ name: "midi" });
    expect(r).toEqual({ ok: true });
    expect(nav.calls).toEqual([{ sysex: false }]);
  });
});

describe("midi.js stays input only", () => {
  it("never asks for sysex, never sends, and uses no capture API", () => {
    expect(src.length).toBeGreaterThan(200);
    expect(src).not.toMatch(/sysex\s*:\s*true/);
    expect(src).not.toMatch(/\boutputs\b|\.send\(/);
    for (const api of ["getUserMedia", "getDisplayMedia", "MediaRecorder", "SpeechRecognition", "document."]) expect(src).not.toContain(api);
    expect(src).toMatch(/^\(function ?\(root\)\s*\{\s*const SS = \(?root\.SoundSpace = root\.SoundSpace \|\| \{\}\)?;/);
    expect(src).toMatch(/\}\)\(typeof window !== "undefined" \? window : globalThis\);\s*$/);
  });
});
