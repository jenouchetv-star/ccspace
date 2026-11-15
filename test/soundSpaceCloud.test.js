// Sound Space's saving: songs keep in this browser (IndexedDB "ccs-sound-space", store "songs") and, for a
// signed-in member, in their account through the site's soundCloudCall bridge. These tests run the real
// assets/apps/sound-space/cloud.js against a stubbed host and the in-memory store (Node has no IndexedDB).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const read = (p) => {
  const u = new URL(p, import.meta.url);
  return existsSync(u) ? readFileSync(u, "utf8") : "";
};
const page = read("../assets/apps/sound-space.html");
const site = read("../index.html");

const SS = () => loadSS("model.js", "cloud.js");
const meta = (id, updatedMs, deleted = false) => ({ id, title: id, updatedMs, deleted });
const song = (M, id, updatedMs, title = "My song") => Object.assign(M.newSong({ title }), { id, updatedMs });

/** A stand-in for the site's soundCloudCall: an account kept in a Map, with the server's rules for stale puts. */
function fakeAccount(email = "grownup@example.test") {
  const rows = new Map();
  const calls = [];
  let down = false, slow = false, hook = null;
  const call = async (action, extra) => {
    calls.push({ action, extra });
    if (hook) await hook(action, extra);       // what the grown-up does while this call is on its way
    if (down) return { ok: false, error: "network" };
    if (action === "put" && slow) return { ok: false, error: "slow_down" };
    if (action === "list") return { ok: true, email, items: [...rows.values()].map((r) => ({ id: r.id, title: r.title, thumb: "", updated: r.updated, deleted: r.deleted })) };
    if (action === "get") { const r = rows.get(extra.id); return r && !r.deleted ? { ok: true, project: JSON.parse(JSON.stringify(r.data)), updated: r.updated } : { ok: false, error: "not_found" }; }
    if (action === "put") {
      const p = extra.project, old = rows.get(p.id);
      if (old && old.updated >= p.updatedMs) return { ok: true, stale: true, updated: old.updated, deleted: old.deleted };
      const { thumb, ...data } = p;
      rows.set(p.id, { id: p.id, title: p.title, data, thumb, updated: p.updatedMs, deleted: false });
      return { ok: true, updated: p.updatedMs };
    }
    if (action === "delete") { const r = rows.get(extra.id); if (r) Object.assign(r, { deleted: true, data: null, title: "", updated: 9e12 }); return { ok: true, updated: 9e12 }; }
    if (action === "usage") return { ok: true, email, songs: [...rows.values()].filter((r) => !r.deleted).length, bytes: 10, maxSongs: 200, maxBytes: 20_000_000 };
    return { ok: false, error: "unknown" };
  };
  return { rows, calls, call, set down(v) { down = v; }, set slow(v) { slow = v; }, set hook(f) { hook = f; } };
}

describe("Sound Space saving (cloud.js)", () => {
  it("newer wins on both sides and a deleted song stays deleted", () => {
    const { mergeSongLists } = SS().cloud;
    // 1. the account has a newer copy of one song, this browser a newer copy of another
    const a = mergeSongLists([meta("a", 100), meta("b", 300)], [meta("a", 200), meta("b", 250)]);
    expect(a.map((m) => [m.id, m.updatedMs])).toEqual([["b", 300], ["a", 200]]);
    expect(a.find((m) => m.id === "a").from).toBe("remote");
    expect(a.find((m) => m.id === "b").from).toBe("local");
    // 2. a song deleted in the account after it was last changed here goes from this browser too
    expect(mergeSongLists([meta("c", 100), meta("d", 50)], [meta("c", 150, true)]).map((m) => m.id)).toEqual(["d"]);
    // 3. a song deleted here stays deleted, even though the account still has an older live copy
    expect(mergeSongLists([meta("e", 500, true)], [meta("e", 400)])).toEqual([]);
    // and a change made after a delete elsewhere brings the song back (the newer one wins)
    expect(mergeSongLists([meta("f", 900)], [meta("f", 800, true)]).map((m) => m.id)).toEqual(["f"]);
    // on a tie, the delete wins
    expect(mergeSongLists([meta("g", 700)], [meta("g", 700, true)])).toEqual([]);
  });

  it("plans a sync: what to fetch, send, remove here and delete in the account", () => {
    const { syncPlan } = SS().cloud;
    const plan = syncPlan(
      [meta("newer-there", 1), meta("newer-here", 9), meta("gone-there", 1), meta("deleted-here", 9, true), meta("only-here", 5), meta("old-tomb", 3, true), meta("same", 4)],
      [meta("newer-there", 2), meta("newer-here", 8), meta("gone-there", 2, true), meta("deleted-here", 8), meta("only-there", 6), meta("same", 4)],
    );
    expect(plan.download.sort()).toEqual(["newer-there", "only-there"]);
    expect(plan.upload.sort()).toEqual(["newer-here", "only-here"]);
    expect(plan.removeLocal.sort()).toEqual(["gone-there", "old-tomb"]);
    expect(plan.deleteRemote).toEqual(["deleted-here"]);
    // the open song and another grown-up's songs are left alone
    const skip = syncPlan([meta("open", 1), meta("theirs", 9)], [meta("open", 2)], { skip: (id) => id === "open" || id === "theirs" });
    expect(skip).toEqual({ download: [], upload: [], removeLocal: [], deleteRemote: [] });
  });

  it("keeps songs in the same database and store, falling back to memory when the browser blocks it", async () => {
    const C = SS().cloud;
    expect(C.DB_NAME).toBe("ccs-sound-space");
    expect(C.DB_STORE).toBe("songs");
    const st = await C.openStore();          // Node: no IndexedDB, so the memory store, and it says so
    expect(st.ok).toBe(false);
    await st.put({ id: "s1", title: "One", updatedMs: 1 });
    await st.put({ id: "s2", title: "Two", updatedMs: 2 });
    expect((await st.get("s1")).title).toBe("One");
    expect((await st.list()).map((r) => r.id).sort()).toEqual(["s1", "s2"]);
    await st.remove("s1");
    expect(await st.get("s1")).toBe(null);
    const blocked = await C.openStore({ open() { throw new Error("SecurityError"); } });
    expect(blocked.ok).toBe(false);
    expect(await blocked.list()).toEqual([]);
  });

  it("finds the site only when it offers Sound Space's own bridge", () => {
    const C = SS().cloud;
    const me = {};
    me.parent = me;
    expect(C.host(me)).toBe(null);                                                  // opened on its own
    const site = { soundCloudCall() {}, artCloudSignedIn() { return true; } };
    expect(C.host({ parent: site })).toBe(site);
    expect(C.host({ parent: { artCloudCall() {}, artCloudSignedIn() {} } })).toBe(null); // Art Space's bridge only
    const crossOrigin = { get parent() { throw new Error("blocked"); } };
    expect(C.host(crossOrigin)).toBe(null);
  });

  it("autosaves 1.5 seconds after the last change, and says where the song is saved", () => {
    const C = SS().cloud;
    expect(C.AUTOSAVE_MS).toBe(1500);
    expect(C.STATUS.DEVICE).toBe("Saved on this device");
    expect(C.STATUS.ACCOUNT).toBe("Saved to your account");
    expect(C.putStatus({ ok: true, updated: 5 })).toEqual({ text: "Saved to your account", bad: false });
    for (const r of [null, { ok: false, error: "network" }, { ok: false, error: "full" }, { ok: false, error: "too_big" }, { ok: false, error: "storage_full" }, { ok: false, error: "slow_down" }, { ok: true, stale: true }]) {
      expect(C.putStatus(r).text, JSON.stringify(r)).toMatch(/^Saved on this device/);
    }
    expect(C.putStatus({ ok: false, error: "full" }).bad).toBe(true);
    // an account that is full says so in maroon (full: true); other errors stay plain red
    expect(C.putStatus({ ok: false, error: "full" }).full).toBe(true);
    expect(C.putStatus({ ok: false, error: "storage_full" })).toMatchObject({ bad: true, full: true });
    expect(C.putStatus({ ok: false, error: "too_big" })).toEqual({ text: "Saved on this device. It’s too big for your account.", bad: true });
    // what goes to the account: the song and a small picture, never who owns it here or a delete marker
    const sent = C.forCloud({ id: "x", title: "T", updatedMs: 3, owner: "a@example.test", deleted: false, tracks: [] }, "data:image/svg+xml;base64,PHN2Zy8+");
    expect(sent).toEqual({ id: "x", title: "T", updatedMs: 3, tracks: [], thumb: "data:image/svg+xml;base64,PHN2Zy8+" });
    expect(C.forCloud({ id: "x", tracks: [] }, "x".repeat(70000)).thumb).toBe(undefined);   // too big to send
  });

  describe("syncing with the account", () => {
    async function setup() {
      const S = SS(), M = S.model, C = S.cloud;
      const store = await C.openStore();
      const acct = fakeAccount();
      const accept = (p) => { const v = M.validateSong(p, new Set()); return v.ok ? v.song : null; };
      const sync = (opts) => C.syncSongs(Object.assign({ store, call: acct.call, accept }, opts));
      return { M, C, store, acct, sync };
    }

    it("sends songs made here, and a song saved here is then in the account", async () => {
      const { M, store, acct, sync } = await setup();
      await store.put(song(M, "song-one", 1000, "Here first"));
      const r = await sync();
      expect(r.ok).toBe(true);
      expect(r.email).toBe("grownup@example.test");
      expect(acct.rows.get("song-one").title).toBe("Here first");
      expect(acct.rows.get("song-one").data.owner).toBe(undefined);
      expect(r.inAccount.get("song-one")).toBe(1000);
      expect((await store.get("song-one")).owner).toBe("grownup@example.test");
    });

    it("songs from the account come in with or without Reverb and Sustain, and older ones have them off", async () => {
      const { M, store, acct, sync } = await setup();
      const old = song(M, "before-fx", 1000, "Older song");
      M.addTrack(old, "piano");
      delete old.tracks[0].reverb; delete old.tracks[0].sustain;
      const fx = song(M, "with-fx", 1000, "Newer song");
      Object.assign(M.addTrack(fx, "piano"), { reverb: 2, sustain: true });
      await acct.call("put", { project: old });
      await acct.call("put", { project: fx });
      const r = await sync();
      expect(r.ok).toBe(true);
      expect((await store.get("before-fx")).tracks[0]).toMatchObject({ reverb: 0, sustain: false });
      expect((await store.get("with-fx")).tracks[0]).toMatchObject({ reverb: 2, sustain: true });
      expect(page).toMatch(/accept: p => \{ const v = M\.validateSong\(p, CATALOG_IDS\); return v\.ok \? v\.song : null; \}/);
    });

    it("a newer copy in the account replaces the one here", async () => {
      const { M, store, acct, sync } = await setup();
      await store.put(song(M, "song-two", 1000, "Old title"));
      await acct.call("put", { project: song(M, "song-two", 2000, "New title") });
      const r = await sync();
      expect(r.changed).toBe(true);
      const here = await store.get("song-two");
      expect(here.title).toBe("New title");
      expect(here.updatedMs).toBe(2000);
      expect(acct.calls.filter((c) => c.action === "put")).toHaveLength(1);   // nothing sent back up
    });

    it("a song deleted here is deleted in the account and stays deleted", async () => {
      const { M, C, store, acct, sync } = await setup();
      await store.put(song(M, "song-three", 1000));
      await sync();
      expect(acct.rows.get("song-three").deleted).toBe(false);
      await store.put(C.tombstone("song-three", 5000));
      expect(await store.get("song-three")).toMatchObject({ deleted: true });
      await sync();
      expect(acct.rows.get("song-three").deleted).toBe(true);
      expect(await store.get("song-three")).toBe(null);       // the marker is cleared once the account has it
      await sync();
      expect(await store.get("song-three")).toBe(null);       // and it never comes back
      expect(acct.rows.get("song-three").deleted).toBe(true);
    });

    it("a song deleted in another browser goes from here", async () => {
      const { M, store, acct, sync } = await setup();
      await store.put(song(M, "song-four", 1000));
      await sync();
      await acct.call("delete", { id: "song-four" });
      const r = await sync();
      expect(r.changed).toBe(true);
      expect(await store.get("song-four")).toBe(null);
    });

    it("leaves the open song, another grown-up's songs, and copies it can't read alone", async () => {
      const { M, store, acct, sync } = await setup();
      await store.put(song(M, "open-one", 1000, "Open"));
      await store.put(Object.assign(song(M, "theirs", 1000), { owner: "someone-else@example.test" }));
      await acct.call("put", { project: song(M, "open-one", 2000, "Changed elsewhere") });
      acct.rows.set("broken", { id: "broken", title: "x", data: { id: "broken", nope: true }, updated: 10, deleted: false });
      await sync({ isOpen: (id) => id === "open-one" });
      expect((await store.get("open-one")).title).toBe("Open");
      expect(acct.rows.has("theirs")).toBe(false);
      expect(await store.get("broken")).toBe(null);
    });

    it("does nothing when the account can't be reached", async () => {
      const { M, store, acct, sync } = await setup();
      await store.put(song(M, "song-five", 1000));
      acct.down = true;
      const r = await sync();
      expect(r.ok).toBe(false);
      expect(await store.get("song-five")).toMatchObject({ id: "song-five" });
    });
  });
});

describe("fix round 1: deletes during a sync, the save rate, and whose songs go where", () => {
  async function setup(email) {
    const S = SS(), M = S.model, C = S.cloud;
    const store = await C.openStore();
    const acct = fakeAccount(email);
    const accept = (p) => { const v = M.validateSong(p, new Set()); return v.ok ? v.song : null; };
    const sync = (opts) => C.syncSongs(Object.assign({ store, call: acct.call, accept }, opts));
    return { M, C, store, acct, sync };
  }
  /** The grown-up deletes a song on Home, the way the page does it (once, while the given call is on its way). */
  function deleteDuring(C, store, acct, action, id, syncBusy) {
    let done = false;
    acct.hook = async (a) => {
      if (done || a !== action) return;
      done = true;
      await C.deleteSong({ store, id, call: acct.call, syncBusy: () => syncBusy });
    };
  }

  for (const busy of [true, false]) {
    it(`a song deleted while a sync is uploading stays deleted (marker ${busy ? "kept for the next sync" : "cleared at once"})`, async () => {
      const { M, C, store, acct, sync } = await setup();
      await store.put(song(M, "song-a", 1000, "Sent first"));
      await store.put(song(M, "song-b", 1000, "Deleted mid-sync"));
      deleteDuring(C, store, acct, "put", "song-b", busy);
      await sync();
      acct.hook = null;
      expect(acct.rows.has("song-b")).toBe(false);                          // never sent to the account
      const here = await store.get("song-b");
      expect(here === null || here.deleted === true).toBe(true);            // and not written back here
      expect((await store.list()).filter((r) => !r.deleted).map((r) => r.id)).toEqual(["song-a"]);
      await sync();
      expect(await store.get("song-b")).toBe(null);                         // the next sync clears any marker
      expect(acct.rows.has("song-b")).toBe(false);
    });
  }

  it("a song deleted while its newer copy downloads stays deleted", async () => {
    const { M, C, store, acct, sync } = await setup();
    await store.put(song(M, "song-x", 1000, "Here"));
    await acct.call("put", { project: song(M, "song-x", 2000, "There") });
    // the account has already answered with the song when the grown-up deletes it here
    let done = false;
    const call = async (a, x) => {
      const r = await acct.call(a, x);
      if (a === "get" && !done) { done = true; await C.deleteSong({ store, id: "song-x", call: acct.call, syncBusy: () => false }); }
      return r;
    };
    await sync({ call });
    expect(await store.get("song-x")).toBe(null);
    expect(acct.rows.get("song-x").deleted).toBe(true);
  });

  it("a newer save made during a sync is not overwritten by the sync's older copy", async () => {
    const { M, store, acct, sync } = await setup();
    await store.put(song(M, "song-a", 1000));
    await store.put(song(M, "song-b", 1000, "Old"));
    let done = false;
    acct.hook = async (a) => { if (a === "put" && !done){ done = true; await store.put(song(M, "song-b", 5000, "Newer")); } };
    await sync();
    acct.hook = null;
    const b = await store.get("song-b");
    expect(b).toMatchObject({ title: "Newer", updatedMs: 5000 });
    expect(b.owner).toBe(undefined);   // the sync didn't claim a copy it didn't send
  });

  it("with nobody signed in, a delete removes the song outright, unless an account has it", async () => {
    const { M, C, store } = await setup();
    await store.put(song(M, "local-only", 1000));
    await store.put(Object.assign(song(M, "in-account", 1000), { owner: "grownup@example.test" }));
    await C.deleteSong({ store, id: "local-only", call: null });
    expect(await store.list().then((l) => l.map((r) => r.id))).not.toContain("local-only");   // no marker left
    await C.deleteSong({ store, id: "in-account", call: null });
    // its account still has it, so a marker waits for that account's next sync (then is cleared)
    expect(await store.get("in-account")).toMatchObject({ deleted: true, owner: "grownup@example.test" });
  });

  it("signed in, a delete reaches the account and leaves nothing behind (or a marker when the account can't be reached)", async () => {
    const { M, C, store, acct } = await setup();
    await acct.call("put", { project: song(M, "song-a", 1000) });
    await store.put(song(M, "song-a", 1000));
    await C.deleteSong({ store, id: "song-a", call: acct.call });
    expect(acct.rows.get("song-a").deleted).toBe(true);
    expect(await store.get("song-a")).toBe(null);
    await store.put(song(M, "song-b", 1000));
    acct.down = true;
    await C.deleteSong({ store, id: "song-b", call: acct.call });
    expect(await store.get("song-b")).toMatchObject({ deleted: true });
  });

  it("a song that belongs to an account only goes to that account, and not while the account is unknown", async () => {
    const { M, C, store, acct, sync } = await setup("");
    expect(C.mine("", "")).toBe(true);                       // made here, never in an account: goes to whoever signs in
    expect(C.mine("", "b@example.test")).toBe(true);
    expect(C.mine("a@example.test", "")).toBe(false);        // the account isn't known yet
    expect(C.mine("a@example.test", "b@example.test")).toBe(false);
    expect(C.mine("a@example.test", "a@example.test")).toBe(true);
    await store.put(Object.assign(song(M, "theirs", 1000), { owner: "a@example.test" }));
    await store.put(song(M, "fresh", 1000));
    await sync();                                             // the account answered without saying whose it is
    expect(acct.rows.has("theirs")).toBe(false);
    expect(acct.rows.has("fresh")).toBe(true);
  });

  it("saves to the account at most every 10 seconds, and a slow down holds every save until it ends", () => {
    const C = SS().cloud;
    expect(C.PUSH_GAP_MS).toBe(10000);
    expect(3600000 / C.PUSH_GAP_MS).toBeLessThanOrEqual(600 * 0.6);   // leaves room under the server's 600 an hour
    let t = 50_000;
    const gate = C.createPushGate({ now: () => t });
    expect(gate.delay(false)).toBe(0);
    gate.sent();
    t += 1000;
    expect(gate.delay(false)).toBe(9000);     // a change waits for the gap
    expect(gate.delay(true)).toBe(0);         // leaving the song may send at once
    gate.result({ ok: false, error: "slow_down" });
    expect(gate.delay(true)).toBe(C.RETRY_MS);   // but not during a slow down: nothing goes before it ends
    expect(gate.delay(false)).toBe(C.RETRY_MS);
    gate.result({ ok: true });                   // nothing shortens it
    t += C.RETRY_MS - 1;
    expect(gate.delay(true)).toBe(1);
    t += 1;
    expect(gate.delay(true)).toBe(0);
  });

  it("a sync's uploads count against the same saves, and stop at a slow down", async () => {
    const { M, C, store, acct, sync } = await setup();
    let t = 1_000_000;
    const gate = C.createPushGate({ now: () => t });
    for (const id of ["song-1", "song-2", "song-3"]) await store.put(song(M, id, 1000));
    acct.slow = true;
    await sync({ gate });
    expect(acct.calls.filter((c) => c.action === "put")).toHaveLength(1);   // the first slow down stops the rest
    expect(gate.delay(true)).toBe(C.RETRY_MS);
    acct.slow = false;
    await sync({ gate });
    expect(acct.calls.filter((c) => c.action === "put")).toHaveLength(1);   // still held: nothing sent
    t += C.RETRY_MS;
    await sync({ gate });
    expect(acct.rows.size).toBe(3);
    expect(gate.delay(false)).toBe(C.PUSH_GAP_MS);                          // and the open song's next save waits the gap
  });

  it("the page uses the gate, the delete and the account check from cloud.js", () => {
    expect(page).toContain("const pushGate = C.createPushGate();");
    expect(page).toMatch(/pushTimer = setTimeout\(pushNow, pushGate\.delay\(false\)\)/);
    expect(page).toMatch(/const wait = pushGate\.delay\(true\);/);
    expect(page).toContain("pushGate.result(r);");
    expect(page).not.toContain("C.RETRY_MS");                 // the gate holds slow downs, not a timer of its own
    expect(page).toContain("const mineToPush = () => C.mine(songOwner, cloud.email);");
    expect(page).toMatch(/gate: pushGate/);
    expect(page).toMatch(/C\.deleteSong\(\{ store: st, id, call: cloud\.on\(\) \? \(a, x\) => cloud\.call\(a, x\) : null, syncBusy: \(\) => !!syncing \}\)/);
    // the account is known from the moment the sign-in is checked, and forgotten when it ends or changes
    expect(page).toMatch(/r = await w\.soundCloudCall\("list"\);[^]*?cloud\.setEmail\(r && r\.ok \? r\.email : ""\);/);
    const lost = page.slice(page.indexOf("function cloudLost("), page.indexOf("\n}", page.indexOf("function cloudLost(")));
    expect(lost).toContain('cloud.setEmail("");');
    const check = page.slice(page.indexOf("async function checkCode("), page.indexOf("\n}", page.indexOf("async function checkCode(")));
    expect(check).toContain('cloud.setEmail("");');
  });
});

describe("Sound Space page uses cloud.js", () => {
  it("loads the module and keeps every song in the module's store", () => {
    expect(page).toContain('<script src="sound-space/cloud.js"></script>');
    expect(page).toMatch(/C\.openStore\(\)/);
    expect(page).not.toContain("indexedDB.open(");
    // autosave waits for the module's 1.5 seconds
    expect(page).toMatch(/saveTimer = setTimeout\(saveNow, C\.AUTOSAVE_MS\)/);
  });

  it("only talks to the account through Sound Space's own bridge, and says so only when it worked", () => {
    expect(page).toMatch(/host\(\)\{ return C\.host\(window\); \}/);
    expect(page).toContain('w.soundCloudCall(action, extra)');
    expect(page).not.toMatch(/artCloudCall\(/);
    // "Saved to your account" only ever comes from a put the account accepted, or a sync that found it there
    const claims = page.split("C.STATUS.ACCOUNT").length - 1;
    expect(claims).toBe(1);
    expect(page).toMatch(/accountHas\.get\(song\.id\) === song\.updatedMs\) setStatus\(C\.STATUS\.ACCOUNT, false\)/);
    expect(page).not.toContain('"Saved to your account"');
  });
});

describe("the site bridges Sound Space to its own function and counter, and keeps Art Space's counts separate", () => {
  it("has soundCloudCall, soundCount and the app parameter on artSignInCode", () => {
    expect(site).toContain('functions.invoke("sound-cloud"');
    expect(site).toContain('rpc("sound_space_count"');
    expect(site).toMatch(/async function artSignInCode\(email, code, app = "art"\)\{/);
    const fn = site.slice(site.indexOf("async function artSignInCode("), site.indexOf("\n}\n", site.indexOf("async function artSignInCode(")));
    expect(fn).toMatch(/if \(app === "sound"\) soundCount\("signed_in"\); else artCount\("signed_in"\);/);
    // the sound bridge carries the same sign-in as Art Space's, and forgets it the same way
    const call = site.slice(site.indexOf("async function soundCloudCall("), site.indexOf("\n}\n", site.indexOf("async function soundCloudCall(")));
    expect(call).toContain("const session = portalSavedSession();");
    expect(call).toContain('if (res.data.error === "no_session" && portalSavedSession() === session) artCloudForget();');
    const count = site.slice(site.indexOf("function soundCount("), site.indexOf("\n}\n", site.indexOf("function soundCount(")));
    expect(count).toContain("if (portalIsAdmin()) return;");
    // Art Space's own bridge and counter are unchanged
    expect(site).toContain('sb.functions.invoke("art-cloud", { body: Object.assign({}, extra || {}, { action: action, session: session }) });');
    expect(site).toContain('try { sb.rpc("art_studio_count", { ev: ev }).then(() => {}, () => {}); } catch(_e){ /* a lost count never matters */ }');
  });
});
