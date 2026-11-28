// Matching ages and game counts (owner, 2026-11-27: "build it and remove 6th grade"; docs/mockups/ages-counts-real-*.png).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gradeSpanFromAges, GRADE_LABELS, gradeLabel, childGradeFrom } from "../assets/lib/progress.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("one promise: Kindergarten to 5th grade", () => {
  it("6th grade is gone; a child saved in 6th shows as 5th", () => {
    expect(GRADE_LABELS).toEqual(["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"]);
    expect(childGradeFrom(6)).toBe(5);
    expect(childGradeFrom("6")).toBe(5);
    expect(childGradeFrom(7)).toBe(null);
    expect(gradeLabel(6)).toBe("5th grade");
    expect(html).not.toContain("4th to 6th grade");
    expect(html).toContain('if (!/^[0-5]$/.test(grade)){ S.formMsg = "Pick a school grade."');
  });

  it("an age range is said as grades inside K to 5th", () => {
    expect(gradeSpanFromAges(3, 7)).toBe("K and 1st grade");
    expect(gradeSpanFromAges(3, 7, true)).toBe("kindergarten and 1st grade");
    expect(gradeSpanFromAges(5, 10)).toBe("K to 4th grade");
    expect(gradeSpanFromAges(5, 10, true)).toBe("kindergarten to 4th grade");
    expect(gradeSpanFromAges(7, 12)).toBe("1st to 5th grade");
    expect(gradeSpanFromAges(8, 9)).toBe("2nd and 3rd grade");
    expect(gradeSpanFromAges(9, 9)).toBe("3rd grade");
    expect(gradeSpanFromAges(3, 5)).toBe("Kindergarten");
    expect(gradeSpanFromAges(3, 5, true)).toBe("kindergarten");
    expect(gradeSpanFromAges(undefined, undefined)).toBe("K to 5th grade");
  });

  it("a Finder activity page says grades, not ages", () => {
    expect(fn("findChallengeLine")).toContain('" challenge for " + gradeSpanFromAges(a.ageMin, a.ageMax, true)');
    expect(html).toContain("' &middot; ' + E(gradeSpanFromAges(a.ageMin, a.ageMax)) + '</p>'");
    expect(html).not.toContain("' &middot; Ages ' + a.ageMin");
  });

  it("the games filter has no age row", () => {
    const fields = fn("gameFilterFieldsHTML");
    expect(fields).not.toContain('chip("age"');
    expect(fields).not.toContain(">Ages<");
    expect(html).not.toContain("GAME_AGES");
    expect(fn("gameFilterActive")).not.toContain("f.age");
  });
});

describe("the home page counts its games", () => {
  const withGameCount = new Function("plural", fn("withGameCount") .replace(/^/, "function withGameCount(") + "; return withGameCount;")(
    (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s")));

  it("a number of games at the start becomes the real count", () => {
    expect(withGameCount("8 games, one big arcade makeover!", 23)).toBe("23 games, one big arcade makeover!");
    expect(withGameCount("23 games, one big arcade!", 24)).toBe("24 games, one big arcade!");
    expect(withGameCount("1 game to start", 2)).toBe("2 games to start");
    expect(withGameCount("New games every week", 23)).toBe("New games every week");
  });

  it("the heading counts the Online Games list, like the Play page", () => {
    expect(fn("newGamesPromoHTML")).toContain('withGameCount(pageVal("home", "arcadeHeading", "23 games, one big arcade!"), onlineGames().length)');
    expect(fn("onlineGames")).toContain('g.status === "published" && g.interactive');
  });
});
