// Saving in the background (owner, 2026-11-25; draft docs/mockups/background-save-draft-*.png): Art Space and Sound
// Space close at once inside the site, the site finishes sending the file to the account with a small dark card in
// the bottom-left corner, and lets go of the file's lock once the save lands.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as B from "../assets/lib/bgSave.js";
import { loadSS } from "./helpers/soundSpace.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const html = read("../index.html");
const art = read("../assets/apps/art-studio.html");
const sound = read("../assets/apps/sound-space.html");
const body = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("the card's words and waits (bgSave.js)", () => {
  it("saving, saved, waiting to try again, and can't be saved", () => {
    expect(B.bgSaveView({ kind: "art", title: "My robot", state: "sending", pct: 64.7 }))
      .toMatchObject({ tone: "art", title: "Saving “My robot”", side: "64%", bar: 64, tryNow: false, dismiss: false });
    expect(B.bgSaveView({ kind: "song", title: "Rainy Day Beat", state: "done" }))
      .toMatchObject({ tone: "done", title: "“Rainy Day Beat” is saved", side: "Done", note: "Saved to your account.", bar: null });
    const wait = B.bgSaveView({ kind: "art", title: "Sunset poster", state: "waiting", error: "network" });
    expect(wait).toMatchObject({ tone: "bad", title: "“Sunset poster” didn’t save yet", tryNow: true, dismiss: false });
    expect(wait.note).toBe("It’s safe in this browser. Trying again in a minute.");
    expect(B.bgSaveView({ kind: "art", title: "x", state: "waiting", error: "slow_down" }).note).toContain("in a few minutes");
    const full = B.bgSaveView({ kind: "song", title: "x", state: "failed", error: "full" });
    expect(full).toMatchObject({ tone: "bad", tryNow: false, dismiss: true });
    expect(full.note).toBe("It’s safe in this browser, but your account is full.");
    expect(B.bgSaveView({ kind: "art", title: "x", state: "failed", error: "no_session" }).note).toContain("Sign in again");
  });
  it("a file with no name still has one, and a long name is cut", () => {
    expect(B.bgSaveView({ kind: "art", title: "", state: "sending" }).title).toBe("Saving “Untitled”");
    expect(B.bgSaveView({ kind: "song", title: "  ", state: "sending" }).title).toBe("Saving “My song”");
    expect(B.bgSaveView({ kind: "art", title: "a".repeat(200), state: "sending" }).title.length).toBeLessThan(80);
  });
  it("tries again after a minute, a few minutes after a slow down, never when trying again can't help", () => {
    expect(B.bgSaveRetryMs("network")).toBe(60000);
    expect(B.bgSaveRetryMs("slow_down")).toBe(300000);
    for (const e of ["full", "storage_full", "too_big", "no_session", "invalid"]) expect(B.bgSaveRetryMs(e), e).toBe(0);
    expect(B.bgSavePct(32, 64)).toBe(50);
    expect(B.bgSavePct(5, 0)).toBe(0);
    expect(B.bgSavePct(99, 64)).toBe(100);
    expect(B.BG_SAVE_DONE_MS).toBe(4000);
  });
  it("no em dashes and no he/she in the words", () => {
    const src = read("../assets/lib/bgSave.js");
    expect(src).not.toContain("—");
    expect((src.match(/"[^"]*"/g) || []).join(" ")).not.toMatch(/\b(he|she)\b/i);
  });
});

/* the site's background saving, run on its own with a pretend connection, timers and page */
function site() {
  const src = html.split("const BG_SAVES = new Map();")[1].split('\nwindow.addEventListener("beforeunload"')[0];
  const sent = [], timers = [], calls = [], els = {};
  let session = "s1", now = 1000;
  class XHR {
    constructor() { this.upload = {}; }
    open(m, url) { this.url = url; }
    setRequestHeader() {}
    send(text) { sent.push({ x: this, url: this.url, body: JSON.parse(text) }); }
    answer(d) { this.responseText = JSON.stringify(d); this.onload(); }
  }
  const el = () => ({ attrs: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ""; }, setAttribute(k, v) { this.attrs[k] = v; }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } });
  const document = {
    getElementById: (id) => els[id] || null,
    createElement: () => el(),
    querySelectorAll: () => [],
    body: { appendChild: (n) => { els[n.id] = n; } },
  };
  const names = ["XMLHttpRequest", "SUPABASE_URL", "SUPABASE_ANON_KEY", "portalSavedSession", "artCloudForget", "artCloudCall", "soundCloudCall",
    "document", "E", "setTimeout", "clearTimeout", "Date", "BG_SAVE_TIMEOUT_MS", "bgSavePct", "bgSaveView", "bgSaveRetryMs", "BG_SAVE_DONE_MS"];
  const fns = new Function(...names, "const BG_SAVES = new Map();" + src
    + "; return { BG_SAVES, BG_LOCK_TAKEN, bgSavePut, studioSaveOnClose, bgSaveReveal, bgSaveRetry, renderBgSave };")(
    XHR, "https://x", "anon", () => session, () => {}, (a, x) => { calls.push(["art", a, x]); return Promise.resolve({ ok: true }); },
    (a, x) => { calls.push(["sound", a, x]); return Promise.resolve({ ok: true }); }, document, (s) => String(s),
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, () => {}, { now: () => now }, 120000, B.bgSavePct, B.bgSaveView, B.bgSaveRetryMs, 4000);
  return Object.assign(fns, { sent, timers, calls, els, setSession: (s) => { session = s; }, tick: (ms) => { now += ms; } });
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const pic = (updated, title = "My robot") => ({ id: "p1", title, updated, layers: [] });

describe("the site sends saves one after another per file", () => {
  it("a newer save of the same picture waits for the one on its way", async () => {
    const S = site();
    S.bgSavePut("art-cloud", { project: pic(1) }, "s1");
    S.bgSavePut("art-cloud", { project: pic(2) }, "s1");
    await flush();
    expect(S.sent.length).toBe(1);
    expect(S.sent[0].url).toBe("https://x/functions/v1/art-cloud");
    expect(S.sent[0].body).toMatchObject({ action: "put", session: "s1", project: { updated: 1 } });
    S.sent[0].x.answer({ ok: true });
    await flush(); await flush();
    expect(S.sent.length).toBe(2);
    expect(S.sent[1].body.project.updated).toBe(2);
  });
  it("the same version already on its way isn't sent twice, and the app hears how far it has gone", async () => {
    const S = site(), heard = [];
    const a = S.bgSavePut("art-cloud", { project: pic(5), onProgress: (p) => heard.push(p) }, "s1");
    const b = S.bgSavePut("art-cloud", { project: pic(5) }, "s1");
    await flush();
    expect(S.sent.length).toBe(1);
    expect(S.sent[0].body.onProgress).toBeUndefined();
    S.sent[0].x.upload.onprogress({ lengthComputable: true, loaded: 3, total: 4 });
    expect(heard).toEqual([75]);
    S.sent[0].x.answer({ ok: true });
    expect(await a).toEqual({ ok: true });
    expect(await b).toEqual({ ok: true });
  });
});

describe("closing an app with a save on its way", () => {
  it("the card shows once the app has closed, says saved, and the lock goes once the save lands", async () => {
    const S = site();
    S.studioSaveOnClose({ fn: "art-cloud", id: "p1", title: "My robot", project: pic(7), unlock: { id: "p1", holder: "tab-1" } });
    await flush();
    expect(S.sent.length).toBe(1);
    expect(S.els["bgsave-root"]).toBeUndefined();                 // not while the app is still on screen
    S.bgSaveReveal();
    expect(S.els["bgsave-root"].innerHTML).toContain("Saving “My robot”");
    expect(S.calls).toEqual([]);                                   // the lock waits for the save
    S.sent[0].x.answer({ ok: true });
    await flush(); await flush();
    expect(S.els["bgsave-root"].innerHTML).toContain("“My robot” is saved");
    expect(S.calls).toEqual([["art", "unlock", { id: "p1", holder: "tab-1" }]]);
    expect(S.timers.some((t) => t.ms === 4000)).toBe(true);        // and it goes after a moment
  });
  it("a picture opened again here before the save lands keeps its lock", async () => {
    const S = site();
    S.studioSaveOnClose({ fn: "art-cloud", id: "p1", project: pic(8), unlock: { id: "p1", holder: "tab-1" } });
    S.tick(50);
    S.BG_LOCK_TAKEN.set("art-cloud:p1", 1050);                     // the app took it again
    await flush();
    S.sent[0].x.answer({ ok: true });
    await flush(); await flush();
    expect(S.calls).toEqual([]);
  });
  it("nothing on its way: the lock goes now, as closing always did", () => {
    const S = site();
    S.studioSaveOnClose({ fn: "sound-cloud", id: "s9", project: null, unlock: { id: "s9", holder: "tab-2" } });
    expect(S.calls).toEqual([["sound", "unlock", { id: "s9", holder: "tab-2" }]]);
  });
  it("a save that didn't land tries again in a minute, and Try now sends it at once", async () => {
    const S = site();
    S.studioSaveOnClose({ fn: "sound-cloud", id: "s1", title: "Rainy Day Beat", project: { id: "s1", title: "Rainy Day Beat", updatedMs: 3 }, unlock: null });
    S.bgSaveReveal();
    await flush();
    S.sent[0].x.onerror();
    await flush(); await flush();
    expect(S.els["bgsave-root"].innerHTML).toContain("didn’t save yet");
    expect(S.els["bgsave-root"].innerHTML).toContain('data-act="bgsave-retry"');
    expect(S.timers.some((t) => t.ms === 60000)).toBe(true);
    S.bgSaveRetry("sound-cloud:s1");
    await flush();
    expect(S.sent.length).toBe(2);
    expect(S.sent[1].body).toMatchObject({ action: "put", session: "s1", project: { id: "s1", updatedMs: 3 } });
  });
  it("an account that's full says so, with a close button, and lets go of the lock", async () => {
    const S = site();
    S.studioSaveOnClose({ fn: "art-cloud", id: "p1", title: "Big one", project: pic(9, "Big one"), unlock: { id: "p1", holder: "t" } });
    S.bgSaveReveal();
    await flush();
    S.sent[0].x.answer({ ok: false, error: "full" });
    await flush(); await flush();
    expect(S.els["bgsave-root"].innerHTML).toContain("your account is full");
    expect(S.els["bgsave-root"].innerHTML).toContain('data-act="bgsave-dismiss"');
    expect(S.calls).toEqual([["art", "unlock", { id: "p1", holder: "t" }]]);
  });
  it("a save made while the app is open and still open never shows a card", async () => {
    const S = site();
    S.bgSavePut("art-cloud", { project: pic(4) }, "s1");
    await flush();
    S.sent[0].x.answer({ ok: true });
    await flush(); await flush();
    S.bgSaveReveal();
    expect(S.els["bgsave-root"]).toBeUndefined();
    expect(S.BG_SAVES.size).toBe(0);
  });
});

describe("the page", () => {
  it("both apps' saves to the account go through it, and an app taking a file's lock is noted", () => {
    for (const [fn, name] of [["art-cloud", "artCloudCall"], ["sound-cloud", "soundCloudCall"]]) {
      const f = body(html, name);
      expect(f, name).toContain('const data = await bgSavePut("' + fn + '", extra, session);');
      expect(f, name).toContain('BG_LOCK_TAKEN.set("' + fn + ':" + extra.id, Date.now())');
    }
    expect(body(html, "closeGameStage")).toContain("bgSaveReveal();");
    expect(html).toContain('import * as BgSave from "./assets/lib/bgSave.js";');
  });
  it("leaving the site mid-save asks first; the cards sit bottom-left, under an open app, the newest only on a phone", () => {
    expect(html).toContain('window.addEventListener("beforeunload", (e) => {');
    expect(html).toContain(".bgsave-wrap{ position:fixed; left:18px; bottom:18px; z-index:1050;");
    expect(html).toContain(".bgsave:not(:last-child){ display:none; }");
    expect(html).toContain("background:#1B1B1E; border:1px solid #37373D;");
    expect(html).toContain('"bgsave-retry": (el) => {');
    expect(html).toContain('"bgsave-dismiss": (el) => {');
  });
});

describe("the apps close at once inside the site", () => {
  for (const [name, src] of [["Art Space", art], ["Sound Space", sound]]) {
    it(name + ": hands its last save to the site, then closes without waiting for the account", () => {
      const close = src.split('if (act === "close-app"){')[1].split("\n    return;\n  }")[0];
      const inSite = close.split("} else {")[0];
      expect(inSite).toContain("handOffSave();");
      expect(inSite).toContain('postMessage({ ccsStudio:"close" }, location.origin)');
      expect(inSite).not.toContain("flushPush");
      expect(close.split("} else {")[1]).toContain("flushPush");      // on its own, it still finishes first
      const hand = body(src, "handOffSave");
      expect(hand).toContain("w.studioSaveOnClose({");
      expect(hand).toContain(".handOff()");
      expect(src).toContain("onProgress");
    });
  }
  it("Art Space: back to the pictures doesn't wait for the account either", () => {
    expect(art).toContain('if (act === "home"){ saveNow().then(() => { flushPush(); showHome(); }); return; }');
    expect(body(art, "saveNow")).toContain("clearTimeout(saveTimer); saveTimer = 0;");
  });
  it("Sound Space: Home doesn't wait for the account either", () => {
    expect(body(sound, "showHome")).toContain("if (song){ await saveNow(); flushPush(); }");
  });
  it("a lock handed over stops renewing and isn't let go of by the app", () => {
    const block = art.split("/* BEGIN art-lock */")[1].split("/* END art-lock */")[0];
    const { createArtLock } = new Function(block + "; return { createArtLock };")();
    const calls = [], stopped = [];
    const lock = createArtLock({ call: (a, x) => { calls.push(a); return Promise.resolve({ ok: true }); }, holder: "tab-one-12345678", every: () => 7, stop: (t) => stopped.push(t) });
    return lock.take("p1").then(() => {
      expect(lock.handOff()).toEqual({ id: "p1", holder: "tab-one-12345678" });
      expect(stopped).toEqual([7]);
      expect(lock.current).toBe(null);
      lock.release({ keepalive: true });
      expect(calls).toEqual(["lock"]);
      expect(lock.handOff()).toBe(null);
    });
  });
  it("Sound Space's lock hands over the same way", async () => {
    const { cloud: C } = loadSS("model.js", "cloud.js");
    const calls = [];
    const lock = C.createSongLock({ call: (a) => { calls.push(a); return Promise.resolve({ ok: true }); }, holder: "tab-two-12345678", every: () => 3, stop: () => {} });
    await lock.take("s1");
    expect(lock.handOff()).toEqual({ id: "s1", holder: "tab-two-12345678" });
    lock.release();
    expect(calls).toEqual(["lock"]);
  });
});
