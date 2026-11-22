// Digital Activities: the newest first, and the Photo Comic and the Audiobook last (owner, 2026-11-22).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = html.split("/* BEGIN digital-order-pure */")[1].split("/* END digital-order-pure */")[0];
const { digitalActivityOrder, DIGITAL_LAST } = new Function(pure + "; return { digitalActivityOrder, DIGITAL_LAST };")();

const A = (id, title, createdAt, access = "free") => ({ id, title, createdAt, access });
const LIVE = [
  A("act-photo-comic", "Make a Photo Comic with Your Toys", "2026-11-04T09:54:32.948Z"),
  A("act-audiobook", "Record Your Own Audiobook", "2026-11-04T09:54:32.948Z"),
  A("act-ai-lesson-gravity-four", "AI Lesson 01: Make Your Own Gravity 4 Game", "2026-10-31T12:00:00.000Z", "members"),
  A("act-computer-story", "Type and Illustrate Your Own Story", "2026-11-04T09:54:32.948Z"),
  A("act-flipbook-movie", "Make a Camera Flip-Book Movie", "2026-11-04T09:54:32.948Z"),
  A("act-color-drawing", "Color Your Own Drawing", "2026-11-06T14:27:42.188Z"),
  A("act-air-harp", "Air Harp", "2026-11-20T12:00:00.000Z", "members"),
  A("act-mirror-pattern", "Paint a Pattern That Repeats Like a Beat", "2026-11-05T22:20:31.905Z"),
  A("act-pixel-sprite", "Design a Pixel Game Character", "2026-11-05T22:20:31.905Z"),
  A("act-ai-lesson-gesture-lab", "AI Lesson 05: Control a Page with Hand Gestures", "2026-11-01T22:00:00.000Z", "members")
];

describe("the Digital Activities order", () => {
  it("puts the newest first and the Photo Comic and the Audiobook at the very end", () => {
    expect(LIVE.slice().sort(digitalActivityOrder).map(a => a.id)).toEqual([
      "act-air-harp", "act-color-drawing", "act-mirror-pattern", "act-pixel-sprite",
      "act-computer-story", "act-flipbook-movie", "act-ai-lesson-gesture-lab", "act-ai-lesson-gravity-four",
      "act-photo-comic", "act-audiobook"
    ]);
    expect(DIGITAL_LAST).toEqual(["act-photo-comic", "act-audiobook"]);
  });
  it("lists the AI lessons added together newest first: 05, 04, 03, then 02, 01", () => {
    const lessons = [
      A("act-ai-lesson-gravity-four", "AI Lesson 01: Make Your Own Gravity 4 Game", "2026-10-31T12:00:00.000Z", "members"),
      A("act-ai-lesson-3d-computer", "AI Lesson 02: Make an Interactive 3D Computer", "2026-10-31T12:00:00.000Z", "members"),
      A("act-ai-lesson-math-robot", "AI Lesson 03: Make a Talking 3D Math Robot", "2026-11-01T12:00:00.000Z", "members"),
      A("act-ai-lesson-picture-puzzle", "AI Lesson 04: Make a Picture Puzzle Game", "2026-11-01T12:00:00.000Z", "members"),
      A("act-ai-lesson-gesture-lab", "AI Lesson 05: Control a Page with Hand Gestures", "2026-11-01T22:00:00.000Z", "members")
    ];
    expect(lessons.sort(digitalActivityOrder).map(a => a.title.slice(0, 12))).toEqual(["AI Lesson 05", "AI Lesson 04", "AI Lesson 03", "AI Lesson 02", "AI Lesson 01"]);
  });
  it("puts a brand new activity at the top, and one with no date after the dated ones", () => {
    const list = LIVE.concat([A("act-new", "Zebra Stripes", "2026-11-22T10:00:00.000Z"), A("act-undated", "Aardvark", "")]);
    const ids = list.sort(digitalActivityOrder).map(a => a.id);
    expect(ids[0]).toBe("act-new");
    expect(ids.slice(-3)).toEqual(["act-undated", "act-photo-comic", "act-audiobook"]);
  });
  it("is what the Digital Activities tab sorts by, while Art & Craft stays A to Z", () => {
    expect(html).toContain("list = list.slice().sort(tech ? digitalActivityOrder : (a,b) => a.title.localeCompare(b.title));");
  });
});
