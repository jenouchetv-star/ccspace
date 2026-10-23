// The Read page lists stories in database order unless a story carries an "order" number.
// Stories with one come first, lowest number first, and the rest keep their usual order.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("Read page story order", () => {
  it("sorts stories that have an order number ahead of the rest", () => {
    const fn = html.split("function viewStories(){")[1].split("function bookListCard")[0];
    expect(fn).toContain('typeof a.order === "number" ? a.order : 1e9');
    expect(fn).toContain('typeof b.order === "number" ? b.order : 1e9');
  });

  it("the sort rule puts ordered stories first and leaves unordered ones where they were", () => {
    const key = (s) => (typeof s.order === "number" ? s.order : 1e9);
    const list = [{ id: "a" }, { id: "b", order: 3 }, { id: "c" }, { id: "d", order: 1 }, { id: "e", order: 2 }];
    const sorted = list.slice().sort((x, y) => key(x) - key(y)).map((s) => s.id);
    expect(sorted).toEqual(["d", "e", "b", "a", "c"]);
  });
});
