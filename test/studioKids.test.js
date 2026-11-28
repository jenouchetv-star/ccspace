// Each child's own space in the Studio apps, with one family space shared by everyone (owner, 2026-11-28; draft
// docs/mockups/studio-per-child-draft.html). assets/lib/studioKids.js is a classic script; it is run here against a stub.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/lib/studioKids.js", import.meta.url), "utf8");
const root = {};
new Function("window", "globalThis", src)(root, root);
const K = root.StudioKids;
const KIDS = [{ id: "kid-maya", name: "Maya", grade: "2nd grade" }, { id: "kid-leo", name: "Leo", grade: "Kindergarten" }];
const get = (it) => it.child;

describe("which shelf a file is on", () => {
  it("its child when that child is in the family, else the Family shelf", () => {
    expect(K.shelfOf("kid-maya", KIDS)).toBe("kid-maya");
    expect(K.shelfOf("", KIDS)).toBe("");
    expect(K.shelfOf(undefined, KIDS)).toBe("");
    expect(K.shelfOf("kid-gone", KIDS)).toBe("");          // a child removed from the family: their files go to the Family shelf
    expect(K.shelfOf("<script>", KIDS)).toBe("");
  });
  it("lists and counts the shelves", () => {
    const items = [{ child: "kid-maya" }, { child: "kid-maya" }, { child: "kid-leo" }, {}, { child: "kid-gone" }];
    expect(K.onShelf(items, "kid-maya", KIDS, get)).toHaveLength(2);
    expect(K.onShelf(items, "", KIDS, get)).toHaveLength(2);
    expect(K.counts(items, KIDS, get)).toEqual({ "": 2, "kid-maya": 2, "kid-leo": 1 });
  });
  it("keeps only clean child ids", () => {
    expect(K.cleanChild("3f2a-11")).toBe("3f2a-11");
    expect(K.cleanChild("a".repeat(65))).toBe("");
    expect(K.cleanChild(7)).toBe("");
  });
});

describe("who is making", () => {
  it("no children: one shelf, as before; the grown-up: the Family shelf; nobody picked: ask", () => {
    expect(K.pickedShelf({ kids: [], picked: "kid-maya" })).toBe(null);
    expect(K.pickedShelf(null)).toBe(null);
    expect(K.pickedShelf({ kids: KIDS, picked: "grownup" })).toBe("");
    expect(K.pickedShelf({ kids: KIDS, picked: "kid-leo" })).toBe("kid-leo");
    expect(K.pickedShelf({ kids: KIDS, picked: "" })).toBe(undefined);
    expect(K.pickedShelf({ kids: KIDS, picked: "kid-gone" })).toBe(undefined);
  });
  it("names read naturally", () => {
    expect(K.possessive("Maya")).toBe("Maya’s");
    expect(K.joinNames(["Maya"])).toBe("Maya");
    expect(K.joinNames(["Maya", "Leo"])).toBe("Maya and Leo");
    expect(K.joinNames(["Maya", "Leo", "Ava"])).toBe("Maya, Leo and Ava");
    expect(K.countText(1, "song", "songs")).toBe("1 song");
    expect(K.countText(4, "song", "songs")).toBe("4 songs");
  });
});

describe("the family space bar", () => {
  it("one piece per child in the family's order, then the Family shelf; gone children count as Family", () => {
    const by = [{ child: "kid-leo", items: 4, bytes: 900 }, { child: "", items: 1, bytes: 100 }, { child: "kid-maya", items: 12, bytes: 3100 }, { child: "kid-gone", items: 1, bytes: 300 }];
    expect(K.segments(by, KIDS, "items")).toEqual([
      { shelf: "kid-maya", color: K.COLORS[0], value: 12 },
      { shelf: "kid-leo", color: K.COLORS[1], value: 4 },
      { shelf: "", color: K.FAMILY_COLOR, value: 2 },
    ]);
    expect(K.segments(by, KIDS, "bytes").map((s) => s.value)).toEqual([3100, 900, 400]);
  });
  it("leaves out empty pieces", () => {
    expect(K.segments([{ child: "kid-maya", items: 3, bytes: 10 }], KIDS, "items")).toEqual([{ shelf: "kid-maya", color: K.COLORS[0], value: 3 }]);
    expect(K.segments(undefined, KIDS, "items")).toEqual([]);
  });
});

describe("both apps use it", () => {
  const sound = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");
  const art = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
  const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  it("loads the module and sets a new file's child", () => {
    for (const page of [sound, art]) {
      expect(page).toContain('<script src="../lib/studioKids.js"></script>');
      expect(page).toContain("StudioKids.create(");
      expect(page).toContain("kids.child");
    }
  });
  it("the site says who's in the family and takes the pick", () => {
    expect(site).toContain("async function studioFamily(");
    expect(site).toContain("function studioPick(");
  });
});
