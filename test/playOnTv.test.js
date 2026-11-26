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
  it("never sends anyone to the TV code yet (part 2 isn't built)", () => {
    expect(fn("tvWay")).not.toContain("/tv");
    expect(fn("tvHelpBody")).not.toContain("chikescreativespace.com/tv");
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
