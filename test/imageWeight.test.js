// Pictures load fast: no oversized file where a small one does the same job, and pictures uploaded through the
// admin (Supabase Storage sends them "no-cache") are kept on the device by the service worker after the first visit.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const size = p => statSync(new URL("../" + p, import.meta.url)).size;
const index = read("index.html");
const sw = read("sw.js");

describe("small files for small pictures", () => {
  it("draws Chike's round avatar (on every page) from a small WebP, not the 1.5 MB PNG", () => {
    expect(index).not.toContain("chike-avatar.png");
    expect(index.split("assets/characters/chike-avatar.webp").length - 1).toBe(3);
    expect(size("assets/characters/chike-avatar.webp")).toBeLessThan(30 * 1024);
  });
  it("plays the home page's game reel as an animated WebP, with the GIF kept for older browsers", () => {
    const pic = index.split('<source type="image/webp" srcset="assets/newsletter/arcade-update/reel.webp">')[1];
    expect(pic).toBeTruthy();
    expect(pic.slice(0, 200)).toContain('src="assets/newsletter/arcade-update/reel.gif"');
    expect(pic.slice(0, 200)).toContain('loading="lazy"');
    // the still picture for reduced motion still comes first, so it wins over the moving WebP
    const before = index.split('<source type="image/webp" srcset="assets/newsletter/arcade-update/reel.webp">')[0];
    expect(before.slice(-300)).toContain('media="(prefers-reduced-motion: reduce)" srcset="assets/newsletter/arcade-update/reel-still.jpg"');
    expect(size("assets/newsletter/arcade-update/reel.webp")).toBeLessThan(size("assets/newsletter/arcade-update/reel.gif") / 2);
  });
});

describe("uploaded pictures are kept on the device", () => {
  it("serves Supabase Storage pictures cache-first, asked for with CORS", () => {
    expect(sw).toContain('const STORAGE_PUBLIC = "https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/"');
    expect(sw).toContain("if (isStoragePicture(request, url))");
    expect(sw).toContain('fetch(request.url, { mode: "cors", credentials: "omit" })');
  });
  it("only pictures: videos and everything else from Supabase pass straight through", () => {
    const fn = sw.split("function isStoragePicture(request, url){")[1].split("\n}\n")[0];
    expect(fn).toContain('request.destination === "image"');
    expect(fn).not.toMatch(/mp4|webm|video/);
  });
  it("keeps at most a few hundred, in this version's runtime cache (a deploy starts them fresh)", () => {
    expect(sw).toMatch(/const STORAGE_MAX = \d{2,3};/);
    expect(sw.split("async function storageCacheFirst(request){")[1].split("\n}\n")[0]).toContain("caches.open(RUNTIME_CACHE)");
  });
  it("never overwrites an upload in place, which is what makes keeping copies safe", () => {
    expect(index.split("upsert: false").length - 1).toBeGreaterThanOrEqual(2);
    expect(index).not.toMatch(/storage\.from\(UPLOAD_BUCKET\)\.upload\([^)]*upsert: true/);
  });
});
