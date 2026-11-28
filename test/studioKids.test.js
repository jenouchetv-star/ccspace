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

describe("faster loading (owner, 2026-11-28)", () => {
  const sound = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");
  const art = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
  it("Home never waits long for the family: 300 ms at most, then stand-in cards, never a sibling's files", () => {
    for (const page of [sound, art]) {
      expect(page).toContain("Promise.race([ask.then(() => true, () => true), wait(300).then(() => false)])");
      expect(page).toContain("kids.ghostCardsHTML(3)");
    }
  });
  it("files from the account show at once as cards still loading, and fill in as they land", () => {
    expect(sound).toContain("onPlan: items => { items.forEach(it => pendingSongs.set(String(it.id), it)); repaintSoon(); }");
    expect(sound).toContain("Getting it from your account");
    expect(art).toContain("todo.forEach(it => pendingArt.set(it.id, it));");
    expect(art).toContain("await Promise.all(Array.from({ length: Math.min(4, todo.length) }");
    expect(art).toContain("Getting it from your account");
  });
  it("the note beside the shelf says how many are coming", () => {
    const k = K.create({ doc: { addEventListener() {} }, host: () => null, one: "song", many: "songs", Many: "Songs", own: "songs" });
    expect(k.noteHTML(8)).toContain("Getting 8 songs from your account");
    expect(k.noteHTML(1)).toContain("Getting 1 song from your account");
    expect(k.noteHTML(0)).toBe("");
    expect(k.ghostCardsHTML(3).match(/sk-ghost/g)).toHaveLength(3);
  });
});

describe("sharing a copy with a brother or sister (owner, 2026-11-28)", () => {
  const sound = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");
  const art = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
  it("a shared copy is a new file in the sibling's space, marked shared and new; the original is untouched", () => {
    const orig = { id: "s1", title: "Maya's beat", child: "kid-maya", updatedMs: 5, owner: "a@b.c", tracks: [{ id: "t" }] };
    const copy = K.sharedCopy(orig, "kid-leo", "kid-maya", "s9", "updatedMs", 1000);
    expect(copy).toMatchObject({ id: "s9", title: "Maya's beat", child: "kid-leo", sharedFrom: "kid-maya", sharedNew: true, updatedMs: 1000 });
    expect(copy.owner).toBeUndefined();
    expect(orig).toEqual({ id: "s1", title: "Maya's beat", child: "kid-maya", updatedMs: 5, owner: "a@b.c", tracks: [{ id: "t" }] });
    copy.tracks[0].id = "changed";
    expect(orig.tracks[0].id).toBe("t");
    expect(K.isShared(copy)).toBe(true);
    expect(K.isShared(orig)).toBe(false);
  });
  it("Share shows only on a child's own files when they have a brother or sister", () => {
    const one = K.create({ doc: { addEventListener() {} }, host: () => null, one: "song", many: "songs", Many: "Songs", own: "songs" });
    expect(one.canShare).toBe(false);
  });
  it("both apps share, show Shared with you, and clear New when the copy is first opened", () => {
    expect(sound).toContain("async function shareSong(btn)");
    expect(sound).toContain('sec.id = "shared-shelf"');
    expect(sound).toContain("if (rec && !rec.deleted && rec.sharedNew){");
    expect(art).toContain("async function sharePicture(btn)");
    expect(art).toContain('sec.id = "shared-shelf"');
    expect(art).toContain("if (p.sharedNew){ delete p.sharedNew;");
    expect(art).toContain("if (StudioKids.cleanChild(g.project.sharedFrom)){ p.sharedFrom = g.project.sharedFrom;");
  });
});
