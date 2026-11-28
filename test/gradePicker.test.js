// The grade picker beside search on Play and Books (owner, 2026-11-27: "streamline the grade picker", then "build it";
// docs/mockups/grade-picker-draft-2.png).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { gradePickFrom, siteGradeFrom, gradeShortLabel } from "../assets/lib/progress.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("grade pick helpers", () => {
  it("reads what the device kept: any, a grade, or nothing", () => {
    expect(gradePickFrom("any")).toBe("any");
    expect(gradePickFrom("0")).toBe(0);
    expect(gradePickFrom("6")).toBe(5);   // the site stops at 5th grade
    expect(gradePickFrom("7")).toBe(null);
    expect(gradePickFrom(null)).toBe(null);
    expect(gradePickFrom("")).toBe(null);
    expect(gradePickFrom("2nd")).toBe(null);
  });

  it("the picker wins; with no pick the child's grade; any is no grade", () => {
    expect(siteGradeFrom(3, 1)).toBe(3);
    expect(siteGradeFrom(0, 4)).toBe(0);
    expect(siteGradeFrom(null, 4)).toBe(4);
    expect(siteGradeFrom(null, null)).toBe(null);
    expect(siteGradeFrom("any", 4)).toBe(null);
  });

  it("short labels for a phone", () => {
    expect(gradeShortLabel(0)).toBe("K");
    expect(gradeShortLabel(2)).toBe("2nd");
    expect(gradeShortLabel(5)).toBe("5th");
    expect(gradeShortLabel(6)).toBe("");
  });
});

describe("grade picker on the site", () => {
  it("games and books open at the site grade, not only a picked child's", () => {
    expect(fn(html, "openGameStage")).toContain("const grade = siteGrade();");
  });

  it("the picker sits beside search on Online games and Books, not Offline games", () => {
    expect(fn(html, "listToolsHTML")).toContain('(o.grade ? gradePickHTML() : "")');
    const play = fn(html, "viewPlay");
    expect(play).toContain("grade: !offline");
    expect(play).toContain('(offline ? "" : gradeNoteHTML("games"))');
    const books = fn(html, "viewStories");
    expect(books).toContain("grade: true");
    expect(books).toContain('gradeNoteHTML("books")');
  });

  it("the picker lists Any grade, then Kindergarten to 5th grade, and is labelled", () => {
    const pick = fn(html, "gradePickHTML");
    expect(pick).toContain('[["any", "Any grade"]].concat(GRADE_LABELS');
    expect(pick).toContain('data-act="grade-pick" aria-label="Your child’s grade"');
  });

  it("the games that read the grade are the ones tagged", () => {
    const list = html.split("const GRADE_GAMES = [")[1].split("];")[0];
    for (const file of ["balloon-pop-math", "chrono-billiards", "echo-matrix", "maze-quest", "spelling-detective", "word-quest"]){
      expect(list).toContain('"' + file + '"');
      expect(readFileSync(new URL("../games/" + file + ".html", import.meta.url), "utf8")).toContain("CCS_CHILD_GRADE");
    }
    for (const [slug, file] of [["math-runner", "number-dash"], ["remote-lunar-salvage", "remote-lunar-salvage"],
      ["solar-system-sandbox", "solar-system-sandbox"], ["how-to-build-your-own-math-robot", "math-robot"]]){
      expect(list).toContain('"' + slug + '"');
      const p = new URL("../supabase/private-games/" + file + ".html", import.meta.url);
      expect(existsSync(p)).toBe(true);
      expect(readFileSync(p, "utf8")).toMatch(/CCS_GRADE/);
    }
    expect(fn(html, "gameCard")).toContain('(gameAdaptsToGrade(g) ? gradeGameTagHTML() : "")');
  });

  it("a choice is kept on the device; picking who's creating follows the child again", () => {
    expect(html).toContain('if (pact === "grade-pick"){ gradePickKeep(');
    expect(html).toContain('const GRADE_PICK_KEY = "ccs_grade_pick";');
    const who = fn(html, "openWhoIsPlaying");
    expect(who).toContain('gradePickKeep("");');
    expect(who).toContain("gradePickPaint();");
  });

  it("the picker redraws in place so it keeps focus", () => {
    const paint = fn(html, "gradePickPaint");
    expect(paint).not.toContain("pick.outerHTML");
    expect(paint).toContain("sel.value =");
  });

  it("a phone shows the short label so search keeps its width", () => {
    expect(html).toContain("@media (max-width:600px){ .gradepick{ padding:0 10px 0 12px; gap:6px; } .gradepick__long{ display:none; } .gradepick__short{ display:inline; } }");
  });

  it("a family account sign-up line only for visitors, no all-caps or em dashes in the copy", () => {
    const note = fn(html, "gradeNoteHTML");
    expect(note).toContain('portalSavedSession() ? ""');
    expect(note).not.toMatch(/—/);
  });
});
