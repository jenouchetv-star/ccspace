// Art Space picture locks (owner, 2026-11-18): a picture is open in one place at a time, like Sound Space's songs.
// A picture open in another browser tab or device shows on the home page greyed out, with a lock where the trash can
// was; picking it says where it's open. The lock code runs here on its own (the art-lock block of art-studio.html).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const site = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const block = page.split("/* BEGIN art-lock */")[1].split("/* END art-lock */")[0];
const L = () => new Function(block + "; return { ART_LOCK_RENEW_MS, artLockHolder, artLockedMessage, createArtLock, artLockedElsewhere };")();

function rig(answers) {
  const { createArtLock } = L();
  const calls = [], timers = [], lost = [];
  const call = async (action, extra) => { calls.push({ action, ...extra }); const a = answers[action]; return typeof a === "function" ? a(extra) : a; };
  const lock = createArtLock({ call, holder: "tab-one-12345678", every: (fn, ms) => { timers.push({ fn, ms, on: true }); return timers.length; }, stop: (n) => { if (timers[n - 1]) timers[n - 1].on = false; }, onLost: (id) => lost.push(id) });
  return { lock, calls, timers, lost };
}

describe("the lock for the open picture", () => {
  it("each browser tab keeps its own id for the whole visit", () => {
    const { artLockHolder } = L();
    const store = new Map(), s = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const a = artLockHolder(s);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(artLockHolder(s)).toBe(a);
    expect(artLockHolder(null)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
  it("takes the lock, renews it every 25 seconds, and lets go", async () => {
    const { lock, calls, timers } = rig({ lock: { ok: true }, unlock: { ok: true } });
    expect(await lock.take("pic-1")).toBe("ok");
    expect(calls[0]).toEqual({ action: "lock", id: "pic-1", holder: "tab-one-12345678" });
    expect(timers[0].ms).toBe(25000);
    await timers[0].fn();
    expect(calls.at(-1)).toEqual({ action: "lock", id: "pic-1", holder: "tab-one-12345678" });
    await lock.release();
    expect(calls.at(-1)).toEqual({ action: "unlock", id: "pic-1", holder: "tab-one-12345678" });
    expect(timers[0].on).toBe(false);
    expect(lock.current).toBe(null);
  });
  it("says locked when the picture is open somewhere else, and never keeps anyone out over a lost connection", async () => {
    expect(await rig({ lock: { ok: false, error: "locked" } }).lock.take("pic-2")).toBe("locked");
    expect(await rig({ lock: () => { throw new Error("offline"); } }).lock.take("pic-2")).toBe("ok");
    expect(await rig({ lock: { ok: false, error: "network" } }).lock.take("pic-2")).toBe("ok");
  });
  it("tells the page when another tab got the picture after this tab's lock ran out", async () => {
    let answer = { ok: true };
    const { lock, timers, lost } = rig({ lock: () => answer });
    await lock.take("pic-3");
    answer = { ok: false, error: "locked" };
    await timers[0].fn();
    expect(lost).toEqual(["pic-3"]);
    expect(lock.current).toBe(null);
  });
  it("a last unlock as the page closes goes with keepalive", async () => {
    const { lock, calls } = rig({ lock: { ok: true }, unlock: { ok: true } });
    await lock.take("pic-4");
    await lock.release({ keepalive: true });
    expect(calls.at(-1)).toEqual({ action: "unlock", id: "pic-4", holder: "tab-one-12345678", keepalive: true });
  });
  it("says plainly that the picture is open somewhere else", () => {
    const m = L().artLockedMessage("Space Cat");
    expect(m.title).toBe("This picture is open on another device");
    expect(m.text).toContain("“Space Cat” is open right now on another device or browser tab.");
    expect(m.text).toContain("unlocks by itself in about a minute");
  });
  it("asks the account which pictures are open elsewhere; a lost connection locks nothing", async () => {
    const { artLockedElsewhere } = L();
    expect([...(await artLockedElsewhere(async () => ({ ok: true, ids: ["a1", null, "a2"] }), "tab-one-12345678"))]).toEqual(["a1", "a2"]);
    expect((await artLockedElsewhere(async () => { throw new Error("x"); }, "tab-one-12345678")).size).toBe(0);
  });
});

describe("the app uses it", () => {
  it("takes the lock before opening a picture, with the message and Try again when it's open elsewhere", () => {
    const fn = page.split("async function openStored(id){")[1].split("\n}\n")[0];
    expect(fn).toContain('(await artLock.take(id)) === "locked"');
    expect(fn).toContain('ask(m.title, m.text, "Try again", { noLabel:"OK", calm:true })');
    expect(page).toContain("if (b.dataset.open){ openStored(b.dataset.open); return; }");
  });
  it("a new picture is locked too, and the lock goes when the picture closes or the page goes", () => {
    expect(page.split("function openProject(p){")[1].split("\n}\n")[0]).toContain("if (cloud.on() && artLock.current !== p.id) artLock.take(p.id);");
    expect(page.split("function paintHome(){")[1].split("\n}\n")[0]).toContain("artLock.release();");
    expect(page).toMatch(/addEventListener\("pagehide"[^\n]*artLock\.release\(\{ keepalive: true \}\)/);
  });
  it("greys the card and puts a lock where the trash can was, and checks again while the home page shows", () => {
    const fn = page.split("function artCardFoot(p, locked){")[1].split("\n}\n")[0];
    expect(fn).toContain('<span class="art__lock" role="img"');
    expect(fn).toContain('<i data-lucide="lock"></i>');
    expect(fn).toContain('data-del="');
    expect(page).toMatch(/\.art--locked \.art__open > \*\{[^}]*grayscale/);
    expect(page).toContain('el.classList.toggle("art--locked", locked);');
    expect(page).toMatch(/setInterval\(\(\) => \{ if \(!cur && !document\.hidden\) paintLocks\(\); \}, 20000\);/);
  });
  it("the ask box can offer a calm Try again", () => {
    expect(page).toContain("function ask(title, text, yesLabel, opts){");
    expect(page).toContain('box.querySelector(\'[data-ask="yes"]\').className = "btn " + (o.calm ? "btn--primary" : "btn--danger");');
  });
  it("the site's bridge can send a last unlock as the page closes", () => {
    const fn = site.split("async function artCloudCall(action, extra){")[1].split("\n}\n")[0];
    expect(fn).toContain("keepalive: true");
    expect(fn).toContain("/functions/v1/art-cloud");
  });
});
