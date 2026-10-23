// The Shop page's Amazon book cards: the two newest books are listed, and each cover is
// shown as a book on the same colour as the card (no second tone, no dividing line).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("shop books", () => {
  it("lists the Composition Journal and the Creative Sketch Book, each with its own Amazon page", () => {
    expect(html).toContain('B("B0HMMB9CD2", "Composition Journal: Chike\'s Creative Space"');
    expect(html).toContain('B("B0HN2V2TZF", "Creative Sketch Book: Chike\'s Creative Space"');
  });

  it("shows the two new books first, each marked New, and sorts New books ahead of the rest", () => {
    expect(html).toContain("A composition journal for drawing and notetaking.\", false, true)");
    expect(html).toContain("A sketch book with drawing paper for your own creations.\", false, true)");
    expect(html).toContain("(b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)");
  });

  it("builds each cover as a book (spine, pages, shadow) inside a compact card", () => {
    expect(html).toContain('<article class="card rec"');
    expect(html).toContain('<div class="cover"><span class="book"><img');
    expect(html).toContain(".cover .book::before");
  });

  it("puts the price, New and Pick of the shelf pills along the top of the card, above the cover", () => {
    const card = html.split("function recCard(r){")[1].split("function recListRow")[0];
    expect(card.indexOf('class="rec__tags"')).toBeGreaterThan(-1);
    expect(card.indexOf('class="rec__tags"')).toBeLessThan(card.indexOf('<div class="cover">'));
    expect(card.indexOf('class="rec__tags"')).toBeLessThan(card.indexOf('<div class="card__body">'));
  });

  it("gives the cover no background of its own and no line under it, so the card is one colour", () => {
    const rule = html.split("\n.cover{")[1].split("}")[0];
    expect(rule).toMatch(/background:none/);
    expect(rule).toMatch(/border:0/);
    expect(rule).not.toMatch(/border-bottom/);
  });
});
