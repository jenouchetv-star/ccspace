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
  const PUSH_GAP_MS = 6000;          // and goes to the account at most this often (the server allows 600 saves an hour)
  const RETRY_MS = 300000;           // after "slow down", try the account again this much later
  const MAX_THUMB = 60000;           // the account's small picture limit (the server checks it too)
  const STATUS = { DEVICE: "Saved on this device", ACCOUNT: "Saved to your account" };

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
    if (e === "full") return { text: d + ". Your account is full.", bad: true };
    if (e === "too_big") return { text: d + ". It’s too big for your account.", bad: true };
    if (e === "storage_full") return { text: d + ". Your account is out of space.", bad: true };
    if (e === "slow_down") return { text: d + ". It goes to your account in a few minutes.", bad: false };
    if (e === "no_session") return { text: d + ". You’re not signed in.", bad: false };
    return { text: d + ". It goes to your account next time.", bad: false };
  }

  /** Bring this browser and the account into step. `call(action, extra)` is the site's bridge, `accept(project)`
      returns a valid song or null, `isOpen(id)` protects the song being edited, `thumb(song)` draws its picture.
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
    const mine = (id) => { const x = recs.get(id); return !x || !x.owner || !email || x.owner === email; };
    const remote = r.items.map(remoteMeta);
    const there = new Map(remote.map((m) => [m.id, m]));
    const plan = syncPlan(records.map(metaOf), remote, { skip: (id) => isOpen(id) || !mine(id) });
    const claim = async (rec) => { if (email && rec.owner !== email) { rec.owner = email; await store.put(rec); } };

    for (const id of plan.download) {
      const m = there.get(id);
      let g = null;
      try { g = await call("get", { id }); } catch (e) {}
      if (!g || !g.ok || !g.project) continue;
      const s = o.accept ? o.accept(g.project) : g.project;
      if (!s || s.id !== id) continue;                               // a copy that can't be read stays out
      const now = await store.get(id);                               // changed here while this was on its way
      if (isOpen(id) || (now && newer(now, m))) continue;
      s.updatedMs = m.updatedMs;
      await store.put(Object.assign(s, email ? { owner: email } : {}));
      out.changed = true;
    }
    for (const id of plan.removeLocal) {
      const x = recs.get(id);
      await store.remove(id);
      if (x && !x.deleted) out.changed = true;
    }
    for (const id of plan.deleteRemote) {
      let d = null;
      try { d = await call("delete", { id }); } catch (e) {}
      if (d && d.ok) await store.remove(id);
    }
    for (const id of plan.upload) {
      const rec = recs.get(id);
      let p = null;
      try { p = await call("put", { project: forCloud(rec, o.thumb ? o.thumb(rec) : undefined) }); } catch (e) {}
      if (p && p.error === "full") out.full = true;
      if (p && p.ok && !p.stale) { await claim(rec); there.set(id, metaOf(rec)); }
    }
    /* the songs that are in the account as they are here, so opening one can say so */
    const after = await store.list().catch(() => []);
    after.forEach((x) => {
      const m = there.get(x.id);
      if (!x.deleted && m && !m.deleted && m.updatedMs === x.updatedMs) {
        out.inAccount.set(x.id, x.updatedMs);
        if (!x.owner && email && mine(x.id)) claim(x).catch(() => {});
      }
    });
    return out;
  }

  SS.cloud = {
    DB_NAME, DB_STORE, AUTOSAVE_MS, PUSH_GAP_MS, RETRY_MS, MAX_THUMB, STATUS,
    mergeSongLists, syncPlan, openStore, tombstone, songOf, host, forCloud, putStatus, syncSongs
  };
})(typeof window !== "undefined" ? window : globalThis);
