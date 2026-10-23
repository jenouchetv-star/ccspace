// "Play all" on the Watch page: every published episode in order, Episode 1 to the
// newest, then back to Episode 1. This pins the ordering and the wrap-around, using
// the same module the live site imports.
import { describe, it, expect } from "vitest";
import { playAllOrder, playAllStep } from "../assets/lib/playAll.js";

const ep = (episode, extra) =>
  Object.assign({ id: "v" + episode, episode, status: "published", youtubeId: "abcdefghi" + String(10 + episode) }, extra);

describe("playAllOrder", () => {
  it("plays Episode 1 first and the newest last, whatever order they are stored in", () => {
    const shuffled = [ep(3), ep(10), ep(1), ep(7), ep(2)];
    expect(playAllOrder(shuffled).map((v) => v.episode)).toEqual([1, 2, 3, 7, 10]);
  });

  it("leaves out drafts, archived episodes and ones with no usable YouTube id", () => {
    const list = [
      ep(1),
      ep(2, { status: "draft" }),
      ep(3, { status: "archived" }),
      ep(4, { youtubeId: "" }),
      ep(5, { youtubeId: "too-short" }),
      ep(6),
    ];
    expect(playAllOrder(list).map((v) => v.episode)).toEqual([1, 6]);
  });

  it("does not change the list it is given, and copes with nothing at all", () => {
    const input = [ep(2), ep(1)];
    playAllOrder(input);
    expect(input.map((v) => v.episode)).toEqual([2, 1]);
    expect(playAllOrder(undefined)).toEqual([]);
    expect(playAllOrder([])).toEqual([]);
  });
});

describe("playAllStep", () => {
  it("moves to the next episode and back to the previous one", () => {
    expect(playAllStep(0, 10, 1)).toBe(1);
    expect(playAllStep(5, 10, 1)).toBe(6);
    expect(playAllStep(5, 10, -1)).toBe(4);
  });

  it("loops from the last episode back to the first when it finishes (Episode 10 to Episode 1)", () => {
    expect(playAllStep(9, 10, 1)).toBe(0);
  });

  it("goes from the first episode to the last when Previous is pressed", () => {
    expect(playAllStep(0, 10, -1)).toBe(9);
  });

  it("replays the only episode when there is just one, and never returns a bad position", () => {
    expect(playAllStep(0, 1, 1)).toBe(0);
    expect(playAllStep(0, 1, -1)).toBe(0);
    expect(playAllStep(0, 0, 1)).toBe(0);
  });
});
