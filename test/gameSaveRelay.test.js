// A sealed game (a members-only game such as Math Runner runs in a frame with no storage of its own) asks the site
// to keep a small save for it on this device, such as its best scores, by message.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pure = index.split("/* BEGIN game-save-pure */")[1].split("/* END game-save-pure */")[0];
const S = new Function(pure + "; return { gameSaveKey, gameSaveText, GAME_SAVE_MAX };")();

describe("the site keeps a sealed game's save", () => {
  it("files each game's save under its own name, and only a plain name", () => {
    expect(S.gameSaveKey("math-runner")).toBe("ccs-game-save:math-runner");
    for (const bad of ["", "Math Runner", "../x", "a".repeat(41), "-x", null, 5, { a: 1 }]) expect(S.gameSaveKey(bad), String(bad)).toBeNull();
  });
  it("keeps a small object, and nothing else", () => {
    expect(S.gameSaveText({ best: { k: "50" } })).toBe('{"best":{"k":"50"}}');
    expect(S.gameSaveText({ big: "x".repeat(S.GAME_SAVE_MAX) })).toBeNull();
    for (const bad of [null, "text", 5, [1, 2]]) expect(S.gameSaveText(bad), String(bad)).toBeNull();
  });
  it("only answers a sealed game frame, and answers it alone", () => {
    const handler = index.split("/* BEGIN game-save-pure */")[1].split("\n});\n")[0];
    expect(handler).toContain('d.ccsSave !== "get" && d.ccsSave !== "set"');
    expect(handler).toContain("/allow-same-origin/.test(");
    expect(handler).toContain('ev.source.postMessage({ ccsSave: "data"');
  });
});
