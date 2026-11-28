// Quick wins from the virtual usability test (owner, 2026-11-27: "start the quick wins 1 to 7").
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const spell = readFileSync(new URL("../games/spelling-detective.html", import.meta.url), "utf8");
const fn = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("usability quick wins", () => {
  it("1. no update box to dismiss: new versions arrive at the next page change (owner, 2026-11-28)", () => {
    expect(html).not.toContain("showUpdateBanner");
    expect(html).toContain("function swUpdateOnNextPage(url){");
  });

  it("2. the tour welcome goes for good after the first click anywhere else", () => {
    const after = html.split("function renderTourRoot(){")[1];
    expect(after).toContain('document.addEventListener("click", (ev) => {');
    expect(after).toContain('ev.target.closest("#tour-root"))) return;');
    expect(after).toContain("saveTourState({ seen: true });");
  });

  it("3. a game card is a real link: the title, stretched over the card, with Share above it", () => {
    const card = fn(html, "gameCard");
    expect(card).toContain('<article class="card card--game">');
    expect(card).not.toContain('data-act="go"');
    expect(card).toContain('<a class="card__link" href="#/play/\' + E(g.id) + \'">');
    expect(html).toContain('.card__link::after{ content:""; position:absolute; inset:0; z-index:1;');
    expect(html).toContain(".card:has(.card__link) .card__share, .card:has(.card__link) .sharecount--note{ position:relative; z-index:2; }");
  });

  it("4. an icon-only Share button's count is words beside it, not a corner bubble", () => {
    const dec = fn(html, "decorateShareCounts");
    expect(dec).toContain('badge.className = icon ? "sharecount--note" : "sharecount";');
    expect(dec).toContain('k + (n === 1 ? " share" : " shares")');
  });

  it("5. on a phone the Finder's matches don't add their own scroll room on top of the page's", () => {
    expect(html).toContain("html{ scroll-padding-top:calc(var(--nav-h) + 54px); }\n  /* that already clears the bars");
    expect(html).toContain(".findresults{ scroll-margin-top:0; }");
  });

  it("6. Spelling Detective answers a typed letter that has no tile, at no cost", () => {
    const guess = fn(spell, "handleGuess");
    const i = guess.indexOf("There\\'s no ");
    expect(i).toBeGreaterThan(0);
    expect(guess.indexOf("wrongLettersCount++")).toBeGreaterThan(i);
    expect(guess.slice(0, i)).toContain("if (!button && !Array.from(document.querySelectorAll('.letter-button')).some(b => b.textContent === letter)) {");
  });

  it("7. on a phone Chike is smaller in the corner and back to top moves to the other corner", () => {
    const phone = html.split("/* On a phone the corner keeps out of the way")[1].split("\n}\n")[0];
    expect(phone).toContain(".tour-avatar{ width:56px; height:56px; right:12px; }");
    expect(phone).toContain(".back-to-top{ left:12px;");
    expect(phone).toContain("html body.has-bottom-nav .quiz-bubble{ bottom:calc(8px + var(--bottom-nav-h, 0px) + 56px + 10px); }");
  });
});
