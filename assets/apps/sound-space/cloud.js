/* Sound Space saving: songs keep in this browser (IndexedDB "ccs-sound-space", store "songs", with a memory
   fallback when the browser blocks it) and, for a mailing-list member signed in on the site, in their account too.
   The copy in this browser is the one you work on; the account copy follows it. The site that opens the app holds
   the sign-in and the connection to the server (window.parent.soundCloudCall); opened on its own, the app keeps
   songs in this browser only and never says otherwise.

   A deleted song leaves a small marker here ({ id, deleted:true, updatedMs }) until the account has the delete
   too, so a song deleted while offline doesn't come back from the account. Every song record may also carry
   `owner` (the account it was last in step with), so another grown-up who signs in on this browser later doesn't
   get the first one's songs. Neither field ever goes to the account. */
(function (root) {
  const SS = root.SoundSpace = root.SoundSpace || {};

  const DB_NAME = "ccs-sound-space", DB_STORE = "songs";
  const AUTOSAVE_MS = 1500;          // the song saves this long after the last change
  const PUSH_GAP_MS = 10000;         // and goes to the account at most this often (360 of the server's 600 saves an hour)
  const RETRY_MS = 300000;           // after "slow down", try the account again this much later
  const MAX_THUMB = 60000;           // the account's small picture limit (the server checks it too)
  const STATUS = { DEVICE: "Saved on this device", ACCOUNT: "Saved to your account" };
  const LOCK_RENEW_MS = 25000;       // an open song renews its lock this often (the account lets a lock run out after 75 s)
  const LOCK_KEY = "ccs-sound-lock-holder";

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- which copy wins ---------- */
  /** The newer copy wins; on a tie, a delete wins. */
  function newer(a, b) {
    if (!b) return true;
    if (!a) return false;
    const x = Number(a.updatedMs) || 0, y = Number(b.updatedMs) || 0;
    return x > y || (x === y && !!a.deleted && !b.deleted);
  }
  const metaOf = (r) => ({ id: String(r.id), title: r.deleted ? "" : String(r.title || ""), updatedMs: Number(r.updatedMs) || 0, deleted: !!r.deleted });
  const remoteMeta = (it) => ({ id: String(it.id), title: String(it.title || ""), updatedMs: Number(it.updated) || 0, deleted: !!it.deleted });

  /** The songs to show, from this browser's list and the account's: Meta {id, title, updatedMs, deleted}, newest
      first, each marked with where the winning copy is (`from`: "local" or "remote"). A newer delete removes it. */
  function mergeSongLists(local, remote) {
    const out = new Map();
    (local || []).forEach((m) => out.set(m.id, Object.assign({}, m, { from: "local" })));
    (remote || []).forEach((m) => { if (newer(m, out.get(m.id))) out.set(m.id, Object.assign({}, m, { from: "remote" })); });
    return [...out.values()].filter((m) => !m.deleted).sort((a, b) => b.updatedMs - a.updatedMs);
  }

  /** What a sync does, from the same rule: ids to fetch from the account, send to it, remove here (a delete from
      the account, or a delete marker the account no longer needs) and delete in the account. `skip(id)` leaves a
      song alone (the open one, or another grown-up's). */
  function syncPlan(local, remote, opts) {
    const skip = (opts && opts.skip) || (() => false);
    const here = new Map((local || []).map((m) => [m.id, m]));
    const there = new Map((remote || []).map((m) => [m.id, m]));
    const plan = { download: [], upload: [], removeLocal: [], deleteRemote: [] };
    new Set([...here.keys(), ...there.keys()]).forEach((id) => {
      if (skip(id)) return;
      const L = here.get(id), R = there.get(id);
      if (R && newer(R, L)) {
        if (!R.deleted) plan.download.push(id);
        else if (L) plan.removeLocal.push(id);
      } else if (L && newer(L, R)) {
        if (!L.deleted) plan.upload.push(id);
        else if (R && !R.deleted) plan.deleteRemote.push(id);
        else plan.removeLocal.push(id);           // the account never had it, or already has the delete
      }
    });
    return plan;
  }

  /* ---------- this browser's store ---------- */
  /** IndexedDB "ccs-sound-space", store "songs" (the same database earlier versions used), or a memory store when
      the browser blocks it. `ok` says whether songs are kept between visits. */
  function openStore(idb) {
    if (idb === undefined) idb = root.indexedDB;
    const mem = new Map();
    const memStore = (ok) => ({
      ok,
      async get(id) { const r = mem.get(id); return r ? clone(r) : null; },
      async put(rec) { mem.set(rec.id, clone(rec)); },
      async list() { return [...mem.values()].map(clone); },
      async remove(id) { mem.delete(id); }
    });
    return new Promise((res, rej) => {
      try {
        const r = idb.open(DB_NAME, 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE, { keyPath: "id" }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error("blocked"));
      } catch (e) { rej(e); }
    }).then((db) => {
      const tx = (mode, fn) => new Promise((res, rej) => {
        const t = db.transaction(DB_STORE, mode), req = fn(t.objectStore(DB_STORE));
        t.oncomplete = () => res(req && req.result !== undefined ? req.result : undefined);
        t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
      return {
        ok: true,
        async get(id) { const r = await tx("readonly", (s) => s.get(id)); return r || null; },
        async put(rec) { const copy = clone(rec); await tx("readwrite", (s) => s.put(copy)); },
        async list() { return (await tx("readonly", (s) => s.getAll())) || []; },
        async remove(id) { await tx("readwrite", (s) => s.delete(id)); }
      };
    }, () => memStore(false));
  }
  /** The marker a deleted song leaves here. */
  const tombstone = (id, updatedMs, owner) => Object.assign({ id, deleted: true, updatedMs: updatedMs || Date.now() }, owner ? { owner } : {});
  /** The song itself, without what only this browser keeps. */
  function songOf(rec) {
    if (!rec || rec.deleted) return null;
    const s = Object.assign({}, rec);
    delete s.owner; delete s.deleted;
    return s;
  }

  /* ---------- the site ---------- */
  /** The site that opened the app, when it offers Sound Space's account bridge; null when the app is on its own. */
  function host(win) {
    try {
      const w = win.parent;
      if (w && w !== win && typeof w.soundCloudCall === "function" && typeof w.artCloudSignedIn === "function") return w;
    } catch (e) {}
    return null;
  }

  /** What goes to the account: the song and a small picture (when it is small enough), never `owner` or `deleted`. */
  function forCloud(rec, thumb) {
    const s = songOf(Object.assign({}, rec, { deleted: false }));
    if (typeof thumb === "string" && thumb.length <= MAX_THUMB) s.thumb = thumb;
    return s;
  }

  /** The save status after the account answered a save. Only an accepted save says "Saved to your account". */
  function putStatus(r) {
    if (r && r.ok && !r.stale) return { text: STATUS.ACCOUNT, bad: false };
    const d = STATUS.DEVICE;
    if (r && r.ok && r.stale) return { text: d + ". Your account has a newer copy.", bad: false };
    const e = r && r.error;
    if (!r || e === "network") return { text: d + ". It goes to your account when you’re back online.", bad: false };
    if (e === "full") return { text: d + ". Your account is full.", bad: true, full: true };
    if (e === "too_big") return { text: d + ". It’s too big for your account.", bad: true };
    if (e === "storage_full") return { text: d + ". Your account is out of space.", bad: true, full: true };
    if (e === "slow_down") return { text: d + ". It goes to your account in a few minutes.", bad: false };
    if (e === "no_session") return { text: d + ". You’re not signed in.", bad: false };
    return { text: d + ". It goes to your account next time.", bad: false };
  }

  /** Does a song with this owner go to the signed-in account? A song never in an account goes to whoever signs in;
      a song that belongs to an account goes only to that account, and nowhere while the account isn't known yet. */
  function mine(owner, email) { return !owner || (!!email && owner === email); }

  /** How soon the next save may go to the account. The server allows 600 saves an hour per member; a save at most
      every PUSH_GAP_MS uses 360 of them, leaving room for leaving a song (which may send at once, `force`) and for
      syncs. After a "slow down" nothing goes, forced or not, until RETRY_MS has passed. */
  function createPushGate(o) {
    const now = (o && o.now) || (() => Date.now());
    let lastAt = -Infinity, holdUntil = 0;
    return {
      delay(force) { const t = now(); return Math.max(0, holdUntil - t, force ? 0 : lastAt + PUSH_GAP_MS - t); },
      sent() { lastAt = now(); },
      result(r) { if (r && r.error === "slow_down") holdUntil = Math.max(holdUntil, now() + RETRY_MS); },
      get holdUntil() { return holdUntil; }
    };
  }

  /** Delete a song here, and in the account when `call` is given (someone is signed in).
      - Nobody signed in, and the song was never in an account: it is simply removed; no marker stays.
      - Otherwise a marker stays here until the account has the delete, so the song can't come back from there. It
        is cleared at once when the account takes the delete, unless a sync is running (`syncBusy()`): that sync
        planned with the song still here, so the marker stays for the next sync to clear. */
  async function deleteSong(o) {
    const { store, id } = o;
    const rec = await store.get(id);
    if (!o.call && !(rec && rec.owner)) { await store.remove(id); return; }
    const mark = tombstone(id, Math.max(Date.now(), ((rec && rec.updatedMs) || 0) + 1), rec && rec.owner);
    await store.put(mark);
    if (!o.call) return;
    let d = null;
    try { d = await o.call("delete", { id }); } catch (e) {}
    if (!d || !d.ok || (o.syncBusy && o.syncBusy())) return;
    const now = await store.get(id);
    if (now && now.deleted && now.updatedMs === mark.updatedMs) await store.remove(id);
  }

  /** How many songs come down from the account at once (owner, 2026-11-28: faster loading, each song showing as it
      arrives instead of all at the end). */
  const DOWNLOADS_AT_ONCE = 4;
  /** Run `fn` over `items`, at most `n` at a time, in order of starting. */
  async function eachAtMost(items, n, fn) {
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  }

  /** Bring this browser and the account into step. `call(action, extra)` is the site's bridge, `accept(project)`
      returns a valid song or null, `isOpen(id)` protects the song being edited, `thumb(song)` draws its picture.
      `onPlan(items)` hears, before any download, the account's list entries ({ id, title, thumb, updated, child })
      of the songs about to come down, so Home can show them at once as cards still loading; `onItem(id, ok)` hears
      each one as it lands (ok false: it couldn't be read, or changed here meanwhile).
      Returns { ok, changed, email, inAccount: Map id -> updatedMs of the songs the account has, as they are here }. */
  async function syncSongs(o) {
    const { store, call } = o;
    const isOpen = o.isOpen || (() => false);
    const out = { ok: false, changed: false, email: "", inAccount: new Map(), full: false };
    let r = null;
    try { r = await call("list"); } catch (e) {}
    if (!r || !r.ok || !Array.isArray(r.items)) { out.error = (r && r.error) || "network"; return out; }
    out.ok = true;
    const email = out.email = String(r.email || "").toLowerCase();
    const records = await store.list().catch(() => []);
    const recs = new Map(records.map((x) => [x.id, x]));
    const remote = r.items.map(remoteMeta);
    const there = new Map(remote.map((m) => [m.id, m]));
    const plan = syncPlan(records.map(metaOf), remote, { skip: (id) => isOpen(id) || !mine((recs.get(id) || {}).owner, email) });
    /* The plan was made from a snapshot; the grown-up can open, change or delete a song while the sync runs. So each
       step reads the song again and does nothing to one that is open or is no longer the copy it planned with. */
    const unchanged = (now, rec) => !!now && !!rec && !!now.deleted === !!rec.deleted && (Number(now.updatedMs) || 0) === (Number(rec.updatedMs) || 0);
    /** Mark a song as this account's, only if it is still exactly the copy that the account has. */
    const claim = async (id, updatedMs) => {
      if (!email) return;
      const now = await store.get(id);
      if (now && !now.deleted && now.updatedMs === updatedMs && now.owner !== email) { now.owner = email; await store.put(now); }
    };

    const listed = new Map(r.items.map((it) => [String(it.id), it]));
    if (o.onPlan && plan.download.length) { try { o.onPlan(plan.download.map((id) => listed.get(id)).filter(Boolean)); } catch (e) {} }
    const heard = (id, ok) => { if (o.onItem) { try { o.onItem(id, ok); } catch (e) {} } };
    await eachAtMost(plan.download, DOWNLOADS_AT_ONCE, async (id) => {
      const m = there.get(id);
      let g = null;
      try { g = await call("get", { id }); } catch (e) {}
      if (!g || !g.ok || !g.project) return heard(id, false);
      const s = o.accept ? o.accept(g.project) : g.project;
      if (!s || s.id !== id) return heard(id, false);                // a copy that can't be read stays out
      const now = await store.get(id);                               // changed here while this was on its way
      if (isOpen(id) || (now ? !unchanged(now, recs.get(id)) || newer(now, m) : recs.has(id))) return heard(id, false);
      s.updatedMs = m.updatedMs;
      await store.put(Object.assign(s, email ? { owner: email } : {}));
      out.changed = true;
      heard(id, true);
    });
    for (const id of plan.removeLocal) {
      const x = recs.get(id), now = await store.get(id);
      if (isOpen(id) || (now && !unchanged(now, x))) continue;
      if (now) await store.remove(id);
      if (x && !x.deleted) out.changed = true;
    }
    for (const id of plan.deleteRemote) {
      let d = null;
      try { d = await call("delete", { id }); } catch (e) {}
      if (!d || !d.ok) continue;
      const now = await store.get(id);
      if (unchanged(now, recs.get(id))) await store.remove(id);
    }
    for (const id of plan.upload) {
      if (o.gate && o.gate.delay(true) > 0) break;                  // the account asked to slow down: not now
      const rec = recs.get(id), now = await store.get(id);
      if (isOpen(id) || !unchanged(now, rec)) continue;              // deleted, changed or opened since the plan
      let p = null;
      try { p = await call("put", { project: forCloud(now, o.thumb ? o.thumb(now) : undefined) }); } catch (e) {}
      if (o.gate) { o.gate.sent(); o.gate.result(p); }
      if (p && p.error === "full") out.full = true;
      if (p && p.ok && !p.stale) { await claim(id, now.updatedMs); there.set(id, metaOf(now)); }
    }
    /* the songs that are in the account as they are here, so opening one can say so */
    const after = await store.list().catch(() => []);
    for (const x of after) {
      const m = there.get(x.id);
      if (!x.deleted && m && !m.deleted && m.updatedMs === x.updatedMs) {
        out.inAccount.set(x.id, x.updatedMs);
        if (!x.owner && mine(x.owner, email)) await claim(x.id, x.updatedMs).catch(() => {});
      }
    }
    return out;
  }

  /* ---------- song locks (owner, 2026-11-16): a song is open in one place at a time ---------- */
  /** This browser tab's lock id: kept for the tab (sessionStorage), so reloading the same tab is still "this tab",
      while another tab or device gets its own. Without storage, an id for this page only. */
  function lockHolder(storage) {
    try {
      const had = storage && storage.getItem(LOCK_KEY);
      if (had && /^[A-Za-z0-9_-]{8,64}$/.test(had)) return had;
    } catch (e) {}
    let id = "t";
    for (let i = 0; i < 20; i++) id += "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36));
    try { if (storage) storage.setItem(LOCK_KEY, id); } catch (e) {}
    return id;
  }
  /** What someone sees when the song they picked is open somewhere else. */
  function lockedMessage(title) {
    return {
      title: "This song is open on another device",
      text: "“" + (title || "My song") + "” is open right now on another device or browser tab. A song can only be open in one place at a time, so your changes don’t overwrite each other. Close it there, then try again. If nobody is using it, it unlocks by itself in about a minute."
    };
  }
  /** One song's lock for this tab. `take(id)` asks the account: "ok" (this tab has it, or the account couldn't say:
      nobody is ever kept out of their own song by a lost connection) or "locked" (open somewhere else). While held,
      it renews every LOCK_RENEW_MS; if another tab got the song after this tab's lock ran out (a sleeping laptop,
      say), `onLost(id)` is told. `release()` lets go; `release({ keepalive: true })` is the last word as a page closes. */
  function createSongLock(o) {
    const every = o.every || ((fn, ms) => setInterval(fn, ms)), stop = o.stop || ((t) => clearInterval(t));
    let timer = 0;
    const lock = {
      current: null,
      holder: o.holder,
      async take(id) {
        if (lock.current && lock.current !== id) lock.release();
        let r = null;
        try { r = await o.call("lock", { id, holder: o.holder }); } catch (e) {}
        if (r && r.ok === false && r.error === "locked") return "locked";
        if (lock.current !== id) {
          lock.current = id;
          if (timer) stop(timer);
          timer = every(() => lock.renew(), LOCK_RENEW_MS);
        }
        return "ok";
      },
      async renew() {
        const id = lock.current;
        if (!id) return;
        let r = null;
        try { r = await o.call("lock", { id, holder: o.holder }); } catch (e) {}
        if (lock.current === id && r && r.ok === false && r.error === "locked") {
          lock.current = null;
          if (timer) { stop(timer); timer = 0; }
          if (o.onLost) o.onLost(id);
        }
      },
      release(opts) {
        const id = lock.current;
        if (timer) { stop(timer); timer = 0; }
        lock.current = null;
        if (!id) return Promise.resolve();
        const extra = Object.assign({ id, holder: o.holder }, opts && opts.keepalive ? { keepalive: true } : {});
        try { return Promise.resolve(o.call("unlock", extra)).catch(() => {}); } catch (e) { return Promise.resolve(); }
      },
      /** Closing inside the site while the song still goes to the account: the site lets go of the lock once that
          save lands (owner, 2026-11-25), so this tab stops renewing it and doesn't let go of it itself. Returns what
          the site needs to let go of it ({ id, holder }), or null when this tab holds no lock. */
      handOff() {
        const id = lock.current;
        if (timer) { stop(timer); timer = 0; }
        lock.current = null;
        return id ? { id, holder: o.holder } : null;
      }
    };
    return lock;
  }
  /** The songs open right now in another browser tab or device (owner, 2026-11-18), for Home's locked cards: a Set of
      ids. Empty when the account can't answer, so a card is never locked by a lost connection. */
  async function lockedElsewhere(call, holder) {
    let r = null;
    try { r = await call("locks", { holder }); } catch (e) {}
    return new Set(r && r.ok && Array.isArray(r.ids) ? r.ids.filter((id) => typeof id === "string") : []);
  }

  SS.cloud = {
    DB_NAME, DB_STORE, AUTOSAVE_MS, PUSH_GAP_MS, RETRY_MS, MAX_THUMB, STATUS,
    mergeSongLists, syncPlan, openStore, tombstone, songOf, host, forCloud, putStatus, syncSongs,
    mine, createPushGate, deleteSong, eachAtMost, DOWNLOADS_AT_ONCE,
    LOCK_RENEW_MS, lockHolder, lockedMessage, createSongLock, lockedElsewhere
  };
})(typeof window !== "undefined" ? window : globalThis);
