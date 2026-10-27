// Share buttons: a round one in the bottom row of every activity, story/book, game and Watch card (next to
// the card's main button, or at the end of the row when there is none); a Share button on a game's page and
// in the Meet Chike header; and a Share button in the full-screen game/book player. The share dialog leads
// with the phone's own share sheet (real contacts) where the browser offers it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("share buttons on cards and pages", () => {
  it("has one helper that builds the round card Share button from a page path", () => {
    expect(html).toContain("function cardShareBtn(path, title, atEnd){");
    expect(html).toContain('class="btn btn--paper btn--icon card__share no-print');
    expect(html).toContain('data-act="share"');
  });

  it("puts it on activity, book, story, game and Watch cards, each pointing at its own page", () => {
    expect(body("activityCard")).toContain('cardShareBtn("/activity/" + a.id, a.title)');
    expect(body("bookListCard")).toContain('cardShareBtn("/stories/" + b.id, b.title)');
    expect(body("storyCard")).toContain('cardShareBtn("/stories/" + s.id, s.title, true)');
    expect(body("gameCard")).toContain('cardShareBtn("/play/" + g.id, g.title, true)');
    expect(body("episodeRow")).toContain('cardShareBtn("/watch/" + v.id, v.title)');
  });

  it("keeps Share in the bottom row: beside the main button when there is one, at the end when there is not", () => {
    const book = body("bookListCard");
    expect(book.indexOf("Read</button>")).toBeLessThan(book.indexOf("cardShareBtn("));
    expect(body("activityCard")).toContain(" Try it</button>");
    expect(body("activityCard")).not.toContain("a.title, true)");
  });

  it("makes the main button and the Share button the same height", () => {
    expect(html).toContain(".card__foot .btn--sm{ height:44px; min-height:44px;");
    expect(html).toContain("width:44px; height:44px; min-height:44px;");
  });

  it("shows the word Share as a label on hover or keyboard focus, without moving the row", () => {
    expect(html).toContain(".card__share:hover .card__share-label, .card__share:focus-visible .card__share-label{ display:block; }");
    expect(html).toContain("position:absolute; bottom:calc(100% + 8px)");
  });

  it("adds Share to a game's page and to the Meet Chike header", () => {
    expect(body("viewGame")).toContain('"/play/" + g.id');
    expect(body("viewCharacters")).toContain('E(location.origin + "/characters")');
  });
});

describe("sharing from inside the player", () => {
  it("shows Share in the player bar and opens it as a sheet on top, so the game keeps running", () => {
    expect(body("gameStage")).toContain('data-act="share-over"');
    expect(html).toContain('"share-over": (el) => {');
    expect(html).toContain("shareModalHTML(url, title).replace(/data-act=\"close-modal\"/g, 'data-act=\"sheet-close\"')");
    expect(html).toContain("openSheet('<div class=\"sheet__body\">' + shareModalHTML(url, title)");   /* padded, and scrolls on a short screen */
  });

  it("sends a game to /play/<id> and a book to /stories/<id>", () => {
    expect(html).toContain('return db.find("games", g.id) ? "/play/" + g.id : "/stories/" + g.id;');
  });
});

describe("the share dialog on a phone", () => {
  it("leads with the device share sheet when the browser has one", () => {
    const d = body("shareModalHTML");
    expect(d).toContain('typeof navigator.share === "function"');
    expect(d).toContain('data-act="share-native"');
    expect(html).toContain("await navigator.share({ title: title, text: title, url: url })");
  });

  it("offers Text message on touch devices", () => {
    expect(html).toContain('href:"sms:?&body=" + enc(title + " " + url)');
    expect(html).toContain('matchMedia("(pointer:coarse)").matches');
  });
});
