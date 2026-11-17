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
  it("highlights the word being read in the same blue as the site's menu (owner, 2026-11-16)", () => {
    expect(reader).toMatch(/\.rw\{background:linear-gradient\(180deg,transparent 40%,#8FE3F0 40%,#8FE3F0 96%,transparent 96%\)/);
    expect(reader).toContain(".rw.now{background-size:100% 100%}");
    expect(site).toContain('.nav__link[aria-current="page"]{ --hl:#8FE3F0;');
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

describe("the green What you learned page at the end of every book (owner, 2026-11-16)", () => {
  const story = (lastText) => ({ layers: [{ type: "text", content: lastText }] });
  const learn = { word: "maglev", say: "MAG-lev", tryIt: "Try two magnets.", takeaways: [{ title: "Word to know", text: "Maglev floats." }, { title: "Same Sides Push Away", text: "Magnets push." }, { title: "Less Friction", text: "It glides." }] };
  it("takes the place of the book's The End page", () => {
    const pages = [story("Once upon a time"), story("<p>The End</p> What will you create next?")];
    const shown = R.pagesWithLearn(pages, learn);
    expect(shown.length).toBe(2);
    expect(shown[1].learnPage).toBe(true);
  });
  it("is added after the last page when a book has no The End page", () => {
    const shown = R.pagesWithLearn([story("Once"), story("What Zech learned")], learn);
    expect(shown.length).toBe(3);
    expect(shown[2].learnPage).toBe(true);
  });
  it("leaves a book alone if it has no takeaways yet", () => {
    const pages = [story("The End")];
    expect(R.pagesWithLearn(pages, null)).toBe(pages);
  });
  it("shows three takeaways, the word with a Hear it button, and a try-it line, in the green card style", () => {
    const h = R.learnPageHTML(learn, "f9", 10);
    expect(h).toContain('class="page-content learnpage"');
    expect(h).toContain("3 big takeaways");
    expect((h.match(/class="lp__card"/g) || []).length).toBe(3);
    expect(h).toContain('class="lp__hear" data-word="maglev"');
    expect(h).toContain("<b>Try it at home:</b> Try two magnets.");
    expect(reader).toMatch(/\.learnpage\{[^}]*background-color:#E3F3DC/);
  });
  it("reads aloud in the same order the recording was made", () => {
    const h = R.learnPageHTML(learn, "f9", 10);
    const read = [...h.matchAll(/<(span|b|p|h2) class="[^"]*\btxt\b[^"]*">([\s\S]*?)<\/\1>/g)].map(m => m[2].replace(/<[^>]*>/g, ""));
    const script = readFileSync(new URL("../scripts/narrate-books.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const fn = "function learnItems(learn){" + script.split("function learnItems(learn){")[1].split("\n}\n")[0] + "\n}";
    const learnItems = new Function(fn + "\nreturn learnItems;")();
    expect(read).toEqual(learnItems(learn));
  });
  it("is recorded for every book, with its word to hear on its own", () => {
    for (const id of BOOKS){
      const n = JSON.parse(readFileSync(new URL("../assets/books/narration/" + id + ".json", import.meta.url), "utf8"));
      expect(Object.values(n.pages).some(p => p.text.startsWith("3 big takeaways Word to know")), id).toBe(true);
      expect(existsSync(new URL("../assets/books/narration/" + id + "/word.mp3", import.meta.url)), id).toBe(true);
    }
  });
});

describe("the green page's words stay plain text once they're wrapped for highlighting", () => {
  it("styles only the try-it icon box, never the words beside it (each word became a little box)", () => {
    expect(reader).toContain(".lp__try>span{");
    expect(reader).not.toMatch(/\.lp__try span\{/);
  });
});
