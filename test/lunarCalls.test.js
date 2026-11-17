// Remote Lunar Salvage: the kids on the rocket's monitor are animated talking faces, not still pictures (owner, 2026-11-17:
// "Just create the animated talking faces for the game"). Each is a silent 10 s loop made on Higgsfield (Seedance 2.0) from
// the kid's own portrait, played forward then backward so it loops without a jump. No voices (Kokoro has no kid voices).
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/remote-lunar-salvage.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => "function " + name + "(" + game.split("function " + name + "(")[1].split("\n}\n")[0] + "\n}";
const KIDS = ["chike", "zech", "corey", "kylah"];

describe("the video calls on the rocket's monitor", () => {
  it("has a small silent loop for each kid who calls", () => {
    for (const k of KIDS){
      const size = statSync(new URL("../assets/games/lunar-salvage/calls/" + k + ".mp4", import.meta.url)).size;
      expect(size).toBeGreaterThan(50000);
      expect(size).toBeLessThan(700000);
    }
  });
  it("the monitor is a muted, looping video with the kid's portrait as its poster", () => {
    expect(game).toContain('<video id="flKid" muted loop playsinline preload="auto"></video>');
    expect(game).toContain('const CALLS = "/assets/games/lunar-salvage/calls/";');
    const c = fn("playCall");
    expect(c).toContain('v.poster = "/assets/characters/" + kid + ".jpg";');
    expect(c).toContain("v.src = CALLS + kid + \".mp4\";");
    expect(c).toContain("v.muted = true;");
  });
  it("shows one kid at a time: on the flight home, whoever is talking fills the screen (owner: \"only show 1 kid, not 4\")", () => {
    const s = fn("showBriefLine");
    expect(s).toContain('kid = home ? (KID_BY_NAME[who] || b.kid) : b.kid;');
    expect(s).toContain('playCall($("flKid"), kid);');
    expect(game).toContain('const KID_BY_NAME = { Chike: "chike", Zech: "zech", Corey: "corey", Kiyah: "kylah" };');
    expect(game).not.toContain('id="flGrid"');
  });
  it("the rocket's screen is a clean sci-fi video call: the caller with captions, the next world and its mission (draft: docs/mockups/lunar-call-hud-draft.jpg)", () => {
    expect(game).toContain('<div class="console hud">');
    expect(game).toContain('<div class="cc" aria-live="polite"><span class="n" id="flName"></span><p id="flLine"></p></div>');
    expect(game).toContain('<div class="orb"><div class="radar"></div><div class="r2"></div><div class="r1"></div><img id="flOrb" alt=""></div>');
    const h = fn("paintHud");
    expect(h).toContain('$("flOrb").src = "/assets/games/lunar-salvage/planets/" + id + ".png";');
    expect(h).toContain('(w.g).toFixed(2) + " m/s²</span>');
    expect(h).toContain('m.goal.replace(/^Goal: /, "")');
    expect(h).toContain("m.steps.slice(0, 3)");
    expect(fn("showBriefLine")).toContain("paintHud(");
    expect(fn("showBriefLine")).toContain("typeCaption(text);");
  });
  it("captions type out, but show at once for players who turn motion down", () => {
    const t = fn("typeCaption");
    expect(t).toContain('matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(t).toContain("clearTimeout(FL.typeT);");
  });
  it("stops the videos when the flight screen closes", () => {
    expect(game).toContain('function closeOv(id){ $(id).classList.remove("open"); if (id === "ovFlight") $(id).querySelectorAll("video").forEach(v => v.pause()); }');
  });
});
