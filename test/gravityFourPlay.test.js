// Chike's Gravity 4 is on the Play page, but only subscribers can play it: the card has a lock, and its page
// sends everyone to the game's Subscriber's Portal entry, where the portal's own gate signs people up (email,
// consent, confirm link) before the game's code is ever handed out. The code never becomes a site file.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/gravity-four-play.sql", import.meta.url), "utf8");
const fn = (name) => index.split("function " + name + "(")[1].split("\n}\n")[0];

describe("Gravity 4 on the Play page", () => {
  it("is a games row of its own kind, pointing at the portal entry, with no game file", () => {
    const seed = index.split('G({ id:"game-gravity-four"')[1].split("}),")[0];
    expect(seed).toContain('kind:"members"');
    expect(seed).toContain('portalSlug:"chikes-gravity-four"');
    expect(seed).toContain('path:""');
    expect(seed).toContain("interactive:true");
    expect(sql).toContain("insert into games (id, data) values ('game-gravity-four'");
    expect(sql).toContain('"kind":"members","portalSlug":"chikes-gravity-four","path":""');
    const statements = sql.split("\n").filter((l) => !l.startsWith("--")).join("\n");
    expect(statements).not.toMatch(/portal_game_files|gameHtml|<html/i); // the code stays in the locked table
  });
  it("shows a Subscribers only lock on its card", () => {
    expect(fn("gameCard")).toContain('g.kind === "members" ? \'<span class="card__badge chip chip--members">\' + ic("lock") + \' Subscribers only</span>\'');
    expect(index).toContain(".chip--members{");
  });
  it("never plays the game on its own page: the button goes to the portal entry", () => {
    const p = fn("membersPoster");
    expect(p).toContain('const to = "#/newsletter/" + encodeURIComponent(g.portalSlug || "");');
    expect(p).toContain("portalIsSubscriber()");
    expect(p).toContain("Subscribe to play");
    expect(p).not.toContain("open-game");
    expect(p).not.toContain("srcdoc");
    expect(fn("viewGame")).toContain('if (g.kind === "members"){');
  });
  it("brings people back to the game after they confirm their email", () => {
    expect(fn("portalNextPath")).toContain('"/newsletter/" + encodeURIComponent(r.params.id)');
  });
  it("can be set up from the admin games form, which insists on the portal game", () => {
    expect(index).toContain('{value:"members",label:"Subscribers only (plays in the Subscriber’s Portal)"}');
    expect(index).toContain('{ key:"portalSlug", label:"Subscriber’s Portal game", type:"select"');
    expect(index).toContain('if (r.kind === "members" && isBlank(r.portalSlug)) err("portalSlug"');
  });
  it("has a cover and a small copy for the card, and stays out of the sitemap like the rest of the members' content", () => {
    expect(existsSync(new URL("../assets/games/gravity-four.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/gravity-four-thumb.jpg", import.meta.url))).toBe(true);
    expect(readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8")).not.toContain("gravity-four");
  });
});

describe("Pathbuilder's How to play", () => {
  it("no longer says players take turns", () => {
    const seed = index.split('G({ id:"game-pathbuilder"')[1].split("}),")[0];
    expect(seed).not.toContain("take turns");
    expect(seed).not.toContain("Randomize my deck");
    expect(seed).toContain("You both build at the same time");
    expect(sql).toContain("where id = 'game-pathbuilder'");
  });
});
