// Play on your TV, part 1 (owner, 2026-11-26: "build it"; draft docs/mockups/play-on-tv-draft.html): an On TV button on
// every game player bar, a panel with the one way for this device, and For Grown-Ups > Play on your TV.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
// run tvWay on its own, with the device names it reads
const tvWay = new Function("TV_DEV_NAME", "return function tvWay(" + fn("tvWay") + ";")(
  { iphone: "iPhone or iPad", android: "Android phone or tablet", win: "Windows computer", mac: "Mac", chromebook: "Chromebook" });

describe("the On TV button", () => {
  it("sits on every game player bar, just before Share", () => {
    const stage = fn("gameStage");
    const tv = stage.indexOf('data-act="game-tv"'), share = stage.indexOf('data-act="share-over"');
    expect(tv).toBeGreaterThan(0);
    expect(tv).toBeLessThan(share);
    expect(stage).toContain('aria-label="On TV" aria-haspopup="dialog" aria-expanded="false">\' + ic("tv")');
    expect(html).toContain('"game-tv": (el) => openTvPanel(el),');
  });
  it("opens a panel for the device in hand, with a link to every way", () => {
    const panel = fn("tvPanelHTML");
    expect(panel).toContain("tvWay(\"\", dev)");
    expect(panel).toContain('Router.href("#/grown-ups/tv")');
    expect(fn("openTvPanel")).toContain('if (e.key === "Escape")');
  });
});

describe("the one way for each TV and device", () => {
  const cases = [
    ["roku", "iphone", "airplay"], ["roku", "android", "android"], ["roku", "win", "win"], ["roku", "chromebook", "hdmi"],
    ["atv", "mac", "airplay"], ["atv", "android", "hdmi"], ["gtv", "android", "android"], ["gtv", "win", "chrome"], ["gtv", "iphone", "hdmi"],
    ["fire", "android", "android"], ["fire", "iphone", "hdmi"], ["smart", "iphone", "airplay"], ["none", "win", "hdmi"],
    ["", "iphone", "airplay"], ["", "win", "win"], ["", "chromebook", "chrome"]
  ];
  for (const [tv, dev, key] of cases) it(`${tv || "any TV"} with ${dev}: ${key}`, () => expect(tvWay(tv, dev).key).toBe(key));
  it("keeps the mirroring steps about the device; the TV code lives only with TV-ready games", () => {
    expect(fn("tvWay")).not.toContain("/tv");
  });
});

describe("part 2: a TV-ready game runs on the TV itself", () => {
  const tv = readFileSync(new URL("../tv/index.html", import.meta.url), "utf8");
  it("lists the same TV-ready games as the tv-link function", () => {
    expect(html).toContain('const TV_READY_GAMES = { "pg-matching-suits": "Stack \'Em Up!" };');
  });
  it("the panel shows a code box for a TV-ready game and pairs through tv-link with the portal session", () => {
    expect(fn("tvPanelHTML")).toContain('data-act="tv-pair" data-game="');
    expect(fn("tvPair")).toContain('sb.functions.invoke("tv-link", { body:{ action:"pair", code:clean, game:gameId, session:portalSavedSession() } })');
    expect(html).toContain('privateGameId: (entry && entry.privateGameId) || ""');
    expect(html).toContain('privateGameId: e.privateGameId || ""');
  });
  it("a phone that scans the TV's code gets a Connect card, and only subscribers can pair", () => {
    const body = fn("tvHelpBody");
    expect(body).toContain("Connect your TV");
    expect(body).toContain('data-act="tv-pair-help"');
    expect(body).toContain("Subscribers only.");
  });
  it("the TV page is unlisted, never signs in, and runs the game sealed like the site's player", () => {
    expect(tv).toContain('<meta name="robots" content="noindex">');
    expect(tv).toContain('<base href="/">');
    expect(tv).toContain('f.setAttribute("sandbox", "allow-scripts allow-popups");');
    expect(tv).not.toContain("allow-same-origin");
    expect(tv).toContain('call({ action:"new" })');
    expect(tv).toContain('call({ action:"wait", code:link.code, secret:link.secret })');
    expect(tv).toContain('"/grown-ups/tv?code="');
    expect(tv).not.toMatch(/password|signIn|portal_session/i);
  });
});

describe("For Grown-Ups > Play on your TV", () => {
  it("is its own page that asks what TV and what device", () => {
    expect(html).toContain('else if (sub === "tv"){');
    const body = fn("tvHelpBody");
    expect(body).toContain('data-act="\' + act + \'"');
    expect(html).toContain('"tvh-tv": (el) =>');
    expect(html).toContain('"tvh-dev": (el) =>');
    expect(html).toContain('" - Play on your TV"');
  });
});
