// Books: "Read to me" (owner, 2026-11-16). A voice (Kokoro's Heart, the owner's pick) reads each page aloud while a
// highlighter marks the word being said, and the book turns its own pages. Narration is recorded ahead of time
// (assets/books/narration/<book>/p<page>.mp3) with a time for every word (assets/books/narration/<book>.json).
// A page whose words changed since it was recorded, or a book with no recording yet, is read by the browser's own voice.
// Draft: docs/mockups/read-to-me-1.png, read-to-me-2.png
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const reader = readFileSync(new URL("../books/reader.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const site = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const main = reader.split("document.addEventListener('DOMContentLoaded'")[1];
const lib = reader.split("<script>\n(function(){")[1].split("})();\n</script>")[0];
const R = (() => { const w = {}; new Function("window", "document", lib)(w, {}); return w.CCS_READER; })();

const BOOKS = ["book-space-adventure", "story-city-that-sank", "story-drawing-nobody-understood", "story-fold-that-would-not",
  "story-question-mark", "story-slowest-dancer", "story-song-in-the-rain", "story-train-with-no-signals"];

describe("the recorded narration", () => {
  it("exists for every published book, in the Heart voice, with a time for every word", () => {
    for (const id of BOOKS){
      const f = new URL("../assets/books/narration/" + id + ".json", import.meta.url);
      expect(existsSync(f), id).toBe(true);
      const n = JSON.parse(readFileSync(f, "utf8"));
      expect(n.voice).toBe("kokoro af_heart");
      const pages = Object.entries(n.pages);
      expect(pages.length).toBeGreaterThan(3);
      for (const [p, pg] of pages){
        expect(pg.t.length, id + " p" + p).toBe(pg.text.split(" ").length);
        expect(existsSync(new URL("../assets/books/narration/" + id + "/" + pg.src, import.meta.url))).toBe(true);
        for (let i = 1; i < pg.t.length; i++) expect(pg.t[i][0]).toBeGreaterThanOrEqual(pg.t[i - 1][0]);   // words in order
      }
    }
  });
});

describe("finding the word being said", () => {
  const t = [[0, 0.5], [0.6, 1.0], [1.2, 1.6]];
  it("lights the word whose time it is, and keeps the last one lit in the small gaps between words", () => {
    expect(R.wordAt(t, 0.2)).toBe(0);
    expect(R.wordAt(t, 0.55)).toBe(0);
    expect(R.wordAt(t, 0.7)).toBe(1);
    expect(R.wordAt(t, 1.5)).toBe(2);
  });
  it("lights nothing before the first word starts", () => {
    expect(R.wordAt([[0.4, 0.8]], 0.1)).toBe(-1);
  });
});

describe("the browser's own voice, when a page has no recording", () => {
  it("says the names the owner's way, and still knows which word it is on", () => {
    const s = R.spokenWords(["Chike", "and", "Zech's", "friend", "Yuna."]);
    expect(s.text).toBe("Chee-kay and Zack's friend You-nah.");
    expect(s.wordForChar(0)).toBe(0);
    expect(s.wordForChar(s.text.indexOf("Zack"))).toBe(2);
    expect(s.wordForChar(s.text.indexOf("You-nah"))).toBe(4);
  });
});

describe("the reader's controls", () => {
  it("has a Read to me button beside All pages", () => {
    expect(reader).toMatch(/<button[^>]*id="read-btn"[\s\S]*?READ TO ME[\s\S]*?<button id="all-pages-btn"/);
  });
  it("highlights the word being read with a soft yellow marker", () => {
    expect(reader).toMatch(/\.rw\.now\{[^}]*background:rgba\(242,194,48/);
  });
  it("wraps the words of every text box so they can be highlighted", () => {
    expect(reader).toContain('class="txt"');
    expect(main).toContain("window.CCS_READER.wrapWords(");
  });
  it("loads the book's narration and plays each page's recording", () => {
    expect(main).toContain("'/assets/books/narration/' + storyId + '.json'");
    expect(main).toContain("new Audio('/assets/books/narration/' + storyId + '/' + pg.src)");
  });
  it("turns the page by itself after reading it, and stops if the reader turns a page by hand", () => {
    expect(main).toMatch(/RT\.auto = true; [^\n]*goNextPage\(\)/);
    expect(main).toContain("function handTurn(){ if (RT.on && !RT.auto) stopReading(); }");
    for (const fn of ["function goNextPage() {", "function goPrevPage() {", "function goToPage(pageNum) {", "function mobileNext() {", "function mobilePrev() {"]){
      expect(main.split(fn)[1].split("\n")[0] + main.split(fn)[1].split("\n")[1]).toContain("handTurn()");
    }
  });
  it("can start reading as soon as the book opens (the Read to me button on a book card)", () => {
    expect(main).toContain("params.get('read') === '1'");
  });
});

describe("Read to me on the book cards", () => {
  it("each book card has a Read to me button that opens the book reading aloud", () => {
    const card = site.split("function bookListCard(b){")[1].split("\n}\n")[0];
    expect(card).toContain('data-act="open-book" data-read="1"');
    expect(card).toContain("Read to me");
  });
  it("opens the reader with read=1, and lets it play sound right away", () => {
    const open = site.split('"open-book": (el) => {')[1].split("\n  },\n")[0];
    expect(open).toContain('el.getAttribute("data-read") === "1"');
    expect(open).toContain('"&read=1"');
    expect(site).toMatch(/allow="fullscreen; camera; clipboard-write; autoplay' \+ \(g\.sandboxExtra/);
  });
});
