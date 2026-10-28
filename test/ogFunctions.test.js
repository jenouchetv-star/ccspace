// What a link-preview bot or a crawler reads for a page that is filled in by JavaScript for people:
// functions/_shared/og.js rewrites the <head> for bots only. These tests run it with stand-ins for
// Cloudflare's HTMLRewriter and for the database, so no network is used.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { renderWithOg } from "../functions/_shared/og.js";

function fakeRewriter() {
  const calls = [];
  class HTMLRewriter {
    on(selector, handlers) { calls.push({ selector, handlers }); return this; }
    transform(res) { res.__rewritten = calls; return res; }
  }
  return { HTMLRewriter, calls };
}
const element = () => { const set = {}; return { set, setAttribute: (k, v) => { set[k] = v; }, setInnerContent: (v) => { set.inner = v; } }; };
const run = (calls, selector) => { const c = calls.find(x => x.selector === selector); if (!c) return null; const el = element(); c.handlers.element(el); return el.set; };

const game = { id: "game-roadcraft", title: "Roadcraft", summary: "A 3D engineering puzzle.", status: "published", cover: { src: "assets/games/roadcraft.jpg" } };
let rw;
beforeEach(() => {
  rw = fakeRewriter();
  globalThis.HTMLRewriter = rw.HTMLRewriter;
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ data: game }] }));
});
afterEach(() => { delete globalThis.HTMLRewriter; vi.restoreAllMocks(); });

const ctx = (ua, id = "game-roadcraft", path = "/play/game-roadcraft") => ({
  request: new Request("https://www.chikescreativespace.com" + path, { headers: { "user-agent": ua } }),
  params: { id },
  next: async () => new Response("<html></html>"),
});
const OPTS = { table: "games", titleKey: "title", descKey: "summary", imageKey: "cover.src", fallbackTitle: "Chike's Creative Space" };

describe("what a bot reads for a game page", () => {
  it("is the game's own title, description, picture and address, not the home page's", async () => {
    await renderWithOg(ctx("Googlebot/2.1"), OPTS);
    expect(run(rw.calls, "title").inner).toBe("Roadcraft | Chike's Creative Space");
    expect(run(rw.calls, 'meta[name="description"]').content).toBe("A 3D engineering puzzle.");
    expect(run(rw.calls, 'meta[property="og:description"]').content).toBe("A 3D engineering puzzle.");
    expect(run(rw.calls, 'meta[property="og:image"]').content).toBe("https://www.chikescreativespace.com/assets/games/roadcraft.jpg");
    expect(run(rw.calls, 'meta[property="og:url"]').content).toBe("https://www.chikescreativespace.com/play/game-roadcraft");
    expect(run(rw.calls, "link#canonical-link").href).toBe("https://www.chikescreativespace.com/play/game-roadcraft");
  });

  it("ignores a trailing slash in the address", async () => {
    await renderWithOg(ctx("Googlebot/2.1", "game-roadcraft", "/play/game-roadcraft/"), OPTS);
    expect(run(rw.calls, "link#canonical-link").href).toBe("https://www.chikescreativespace.com/play/game-roadcraft");
  });

  it("leaves a real visitor's page exactly as it is", async () => {
    const res = await renderWithOg(ctx("Mozilla/5.0 (Windows NT 10.0) Chrome/120"), OPTS);
    expect(rw.calls).toHaveLength(0);
    expect(res.__rewritten).toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("leaves the page alone when the game is not published or is not found", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ data: { ...game, status: "draft" } }] }));
    await renderWithOg(ctx("Googlebot/2.1"), OPTS);
    expect(rw.calls).toHaveLength(0);
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
    await renderWithOg(ctx("Googlebot/2.1", "online", "/play/online"), OPTS);
    expect(rw.calls).toHaveLength(0);
  });

  it("serves the normal page if the database cannot be reached", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); });
    const res = await renderWithOg(ctx("Googlebot/2.1"), OPTS);
    expect(rw.calls).toHaveLength(0);
    expect(await res.text()).toBe("<html></html>");
  });
});

describe("the routes", () => {
  it("has one for games, reading the games table", () => {
    const f = readFileSync(new URL("../functions/play/[id].js", import.meta.url), "utf8");
    expect(f).toContain('table: "games"');
    expect(f).toContain('descKey: "summary"');
    expect(f).toContain('imageKey: "cover.src"');
    for (const r of ["activity", "article", "stories", "watch", "play"]) expect(existsSync(new URL("../functions/" + r + "/[id].js", import.meta.url)), r).toBe(true);
  });
});
