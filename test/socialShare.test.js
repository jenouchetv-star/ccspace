// Share buttons: a round one on every activity, story/book and game card; a Share button on a game's
// page and in the Meet Chike header; and a Share button in the full-screen game/book player. The share
// dialog leads with the phone's own share sheet (real contacts) where the browser offers it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name, next) => html.split("function " + name + "(")[1].split("function " + next + "(")[0];

describe("share buttons on cards and pages", () => {
  it("has one helper that builds the round card Share button from a page path", () => {
    expect(html).toContain("function cardShareBtn(path, title){");
    expect(html).toContain('class="btn btn--paper btn--icon card__share no-print" data-act="share"');
  });

  it("puts it on activity, book, story and game cards, each pointing at its own page", () => {
    expect(fn("activityCard", "characterCard")).toContain('cardShareBtn("/activity/" + a.id, a.title)');
    expect(fn("bookListCard", "bookCard")).toContain('cardShareBtn("/stories/" + b.id, b.title)');
    expect(fn("storyCard", "viewStory")).toContain('cardShareBtn("/stories/" + s.id, s.title)');
    expect(fn("gameCard", "gamePoster")).toContain('cardShareBtn("/play/" + g.id, g.title)');
  });

  it("adds Share to a game's page and to the Meet Chike header", () => {
    expect(fn("viewGame", "viewWatch")).toContain('"/play/" + g.id');
    expect(fn("viewCharacters", "viewCharacter")).toContain('data-url="\' + E(location.origin + "/characters")');
  });
});

describe("sharing from inside the player", () => {
  it("shows Share in the player bar and opens it as a sheet on top, so the game keeps running", () => {
    const stage = fn("gameStage", "openGameStage");
    expect(stage).toContain('data-act="share-over"');
    expect(html).toContain('"share-over": (el) => {');
    expect(html).toContain('openSheet(shareModalHTML(url, title).replace(/data-act="close-modal"/g, \'data-act="sheet-close"\')');
  });

  it("sends a game to /play/<id> and a book to /stories/<id>", () => {
    expect(html).toContain('return db.find("games", g.id) ? "/play/" + g.id : "/stories/" + g.id;');
  });
});

describe("the share dialog on a phone", () => {
  it("leads with the device share sheet when the browser has one", () => {
    const d = fn("shareModalHTML", "newsletterThanks") || html.split("function shareModalHTML(")[1].split("\n}\n")[0];
    expect(d).toContain('typeof navigator.share === "function"');
    expect(d).toContain('data-act="share-native"');
    expect(html).toContain("await navigator.share({ title: title, text: title, url: url })");
  });

  it("offers Text message on touch devices", () => {
    expect(html).toContain('href:"sms:?&body=" + enc(title + " " + url)');
    expect(html).toContain('matchMedia("(pointer:coarse)").matches');
  });
});
