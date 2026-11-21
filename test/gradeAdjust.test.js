// Grade adjust: the site hands the picked child's grade to games (index.html's progressPickedGrade and
// openGameStage), and every game reads it with the same one-line snippet (assets/lib/childGrade.snippet.js).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { recordTarget, childGradeFrom, withChildGrade, activityFitsGrade, difficultyDistance, findAgeForGrade, gradeLabel } from "../assets/lib/progress.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SNIPPET_LINE = 'const CCS_CHILD_GRADE = (() => { try { const raw = window.CCS_GRADE ?? new URLSearchParams(location.search).get("grade"); const n = typeof raw === "number" ? raw : /^[0-6]$/.test(String(raw)) ? Number(raw) : NaN; return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null; } catch (_e) { return null; } })();';
const snippet = readFileSync(new URL("../assets/lib/childGrade.snippet.js", import.meta.url), "utf8");

/** The games that start at the picked child's grade. Tasks 4 to 7 add each game file here. */
const GAME_FILES = ["games/balloon-pop-math.html", "games/spelling-detective.html", "games/chrono-billiards.html", "games/echo-matrix.html", "games/word-quest.html"];

/** The text of one top-level function in index.html (plain or async), from its name to the closing brace at the start of a line. */
function fn(name) {
  let start = index.indexOf("async function " + name + "(");
  if (start < 0) start = index.indexOf("function " + name + "(");
  if (start < 0) return "";
  const end = index.indexOf("\n}\n", start);
  return index.slice(start, end + 2);
}

describe("progressPickedGrade", () => {
  const make = ({ session = "s", playing = "", children = null } = {}) =>
    new Function("ProgressState", "recordTarget", "portalSavedSession", "progressPlaying", "childGradeFrom",
      fn("progressPickedGrade") + "; return progressPickedGrade;")(
      { children }, recordTarget, () => session, () => playing, childGradeFrom);
  const kids = [{ id: "k1", name: "Ada", grade: 3 }, { id: "k2", name: "Bo", grade: 0 }, { id: "k3", name: "Cy", grade: 9 }];

  it("is the picked child's grade", () => {
    expect(make({ playing: "k1", children: kids })()).toBe(3);
    expect(make({ playing: "k2", children: kids })()).toBe(0);
  });

  it("is null for visitors, the grown-up, no pick, children not loaded yet, or a bad grade", () => {
    expect(make({ session: "", playing: "k1", children: kids })()).toBeNull();
    expect(make({ playing: "grownup", children: kids })()).toBeNull();
    expect(make({ playing: "", children: kids })()).toBeNull();
    expect(make({ playing: "gone", children: kids })()).toBeNull();
    expect(make({ playing: "k1", children: null })()).toBeNull();
    expect(make({ playing: "k1", children: [] })()).toBeNull();
    expect(make({ playing: "k3", children: kids })()).toBeNull();
  });

  it("is synchronous: it never loads the children", () => {
    expect(fn("progressPickedGrade")).not.toMatch(/async|await|progressKids|progressLoadChildren|portalCall/);
  });
});

describe("openGameStage", () => {
  const games = { "game-a": { id: "game-a", title: "A", path: "games/a.html" }, "game-p": { id: "game-p", title: "P", hasFile: true } };
  const HTML = "<!doctype html><html><head><script>start()</script></head><body></body></html>";
  async function opened(record, grade) {
    let staged = null;
    const modal = { innerHTML: "" };
    const open = new Function(
      "db", "loadGameHtml", "toast", "$", "gameStage", "rootAssetPaths", "document", "drawIcons",
      "progressPickedGrade", "withChildGrade", "closeGameStage",
      fn("openGameStage") + "; return openGameStage;",
    )(
      { find: (_t, id) => games[id] || null }, async () => HTML, () => {},
      (sel) => (sel === "#modal-root" ? modal : null), (g) => { staged = g; return ""; }, () => {},
      { body: { classList: { add() {} } } }, () => {}, () => grade, withChildGrade, () => {},
    );
    await open(record);
    return staged;
  }

  it("adds the grade only for a picked child", async () => {
    // no picked child: everything as today
    expect((await opened("game-a", null)).path).toBe("games/a.html");
    expect((await opened("game-p", null)).srcdoc).toBe(HTML);
    expect((await opened({ id: "portal", title: "X", hasFile: true, srcdoc: HTML }, null)).srcdoc).toBe(HTML);
    // a picked child in 3rd grade
    expect((await opened("game-a", 3)).path).toBe("games/a.html?grade=3");
    expect((await opened({ id: "portal", title: "X", path: "games/b.html?x=1" }, 3)).path).toBe("games/b.html?x=1&grade=3");
    expect((await opened("game-p", 3)).srcdoc.startsWith("<!doctype html><html><head><script>window.CCS_GRADE=3;</script><script>start()")).toBe(true);
    const priv = await opened({ id: "portal", title: "X", hasFile: true, srcdoc: HTML }, 0);
    expect(priv.srcdoc).toBe(HTML.replace("<head>", "<head><script>window.CCS_GRADE=0;</script>"));
  });

  it("never adds it to a book, a studio app or anything outside games/", async () => {
    const book = { id: "book-x", title: "B", path: "books/reader.html?story=book-x&read=1" };
    expect((await opened(book, 3)).path).toBe(book.path);
    const studio = { id: "studio-art", title: "Art", bare: true, path: "assets/apps/art-space.html" };
    expect((await opened(studio, 3)).path).toBe(studio.path);
    const lesson = { id: "x", title: "L", path: "assets/lessons/example.html" };
    expect((await opened(lesson, 3)).path).toBe(lesson.path);
    const outside = { id: "portal", title: "O", path: "https://example.org/games/x.html" };
    expect((await opened(outside, 3)).path).toBe(outside.path);
  });
});

describe("the child-grade snippet", () => {
  it("the snippet file is the one every game uses", () => {
    expect(snippet.replace(/\r\n/g, "\n")).toBe(SNIPPET_LINE + "\n");   // a Windows checkout may end the line with CRLF
    expect(snippet).not.toMatch(/—/);
    for (const file of GAME_FILES) {
      const src = readFileSync(new URL("../" + file, import.meta.url), "utf8");
      expect(src.includes(SNIPPET_LINE), file).toBe(true);
    }
  });

  it("reads the grade the site passes, and ignores anything else", () => {
    const run = (win, search) => new Function("window", "location", snippet + "; return CCS_CHILD_GRADE;")(win, { search });
    expect(run({ CCS_GRADE: 3 }, "")).toBe(3);
    expect(run({ CCS_GRADE: 0 }, "?grade=5")).toBe(0);
    expect(run({}, "?grade=5")).toBe(5);
    expect(run({}, "?x=1&grade=0")).toBe(0);
    for (const bad of ["", "?grade=", "?grade=7", "?grade=2.5", "?grade=abc", "?grade=-1", "?grade=03"]) {
      expect(run({}, bad), bad).toBeNull();
    }
    expect(run({ CCS_GRADE: 7 }, "")).toBeNull();
    expect(run({ CCS_GRADE: 2.5 }, "")).toBeNull();
    // a page with no way to read its address still starts
    expect(new Function("window", snippet + "; return CCS_CHILD_GRADE;")({})).toBeNull();
  });
});

describe("activities fit the child's age first", () => {
  const act = (id, ageMin, ageMax, difficulty, title) => ({ id, title: title || id, ageMin, ageMax, difficulty });
  const order = new Function("activityFitsGrade", "difficultyDistance", fn("gradeOrderActivities") + "; return gradeOrderActivities;")(activityFitsGrade, difficultyDistance);
  const tagFor = (g) => new Function("progressPickedGrade", "activityFitsGrade", "gradeLabel", "E", "ic", fn("gradeTagHTML") + "; return gradeTagHTML;")(
    () => g, activityFitsGrade, gradeLabel, (x) => String(x), () => "<svg></svg>");

  it("fitting activities come first for a picked child", () => {
    const list = [act("hard", 6, 10, "challenge"), act("fit", 6, 10, "medium"), act("easy", 6, 10, "easy"), act("old", 11, 14, "medium"), act("fit2", 7, 9, "medium")];
    // 2nd grade: ages 7-8, medium. Fitting first (given order), then the rest nearest in difficulty, ties in the given order.
    expect(order(list, 2).map((a) => a.id)).toEqual(["fit", "fit2", "old", "hard", "easy"]);
  });

  it("an activity without ages is not tagged", () => {
    const tag = tagFor(2);
    expect(tag({ id: "x", difficulty: "medium" })).toBe("");
    expect(tag({ id: "x", ageMin: 6, ageMax: 9 })).toBe("");
    expect(tag(act("x", 6, 9, "medium"))).toContain("Good for 2nd grade");
    expect(tagFor(0)(act("x", 4, 6, "easy"))).toContain("Good for Kindergarten");
    expect(tag(act("x", 6, 9, "medium"))).toContain("chip--sun");
  });

  it("no pick: same order and no tag", () => {
    const list = [act("b", 6, 10, "challenge"), act("a", 6, 10, "medium")];
    expect(order(list, null)).toBe(list);
    expect(tagFor(null)(act("x", 6, 9, "medium"))).toBe("");
    // the Create list sorts before paging, only through the one helper
    expect(fn("viewCreate")).toMatch(/gradeOrderActivities\(list, progressPickedGrade\(\)\)/);
    expect(fn("activityCard")).toMatch(/gradeTagHTML\(a\)/);
  });

  it("the finder age is filled in", () => {
    const make = (g, finder, auto = false) => {
      const AppState = { finder, finderAgeAuto: auto };
      new Function("AppState", "progressPickedGrade", "findAgeForGrade", fn("finderFillAge") + "; finderFillAge();")(AppState, () => g, findAgeForGrade);
      return AppState;
    };
    expect(make(0, { age: "" }).finder.age).toBe("3-5");
    expect(make(2, { age: "" }).finder.age).toBe("6-8");
    expect(make(5, { age: "" }).finder.age).toBe("9-12");
    expect(make(2, { age: "3-5" }).finder.age).toBe("3-5");
    expect(make(null, { age: "" }).finder.age).toBe("");
    expect(make(2, { age: "" }, true).finder.age).toBe("");
    expect(index).toMatch(/"find-clear": \(\) => \{[\s\S]*?finderAgeAuto = false/);
  });
});
