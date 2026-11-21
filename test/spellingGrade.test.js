// Grade adjust: Spelling Detective starts at the picked child's grade and skips the picker.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/spelling-detective.html", import.meta.url), "utf8");
const tail = page.split("// A picked child (the site passed a grade)")[1].split("});\n    </script>")[0];

describe("Spelling Detective with a picked child", () => {
  it("starts at the child's grade without the picker, and clamps 6th to 5th", () => {
    expect(tail).toContain("CCS_CHILD_GRADE === 0 ? 'k' : String(Math.min(CCS_CHILD_GRADE, 5))");
    expect(tail).toMatch(/if \(CCS_CHILD_GRADE !== null\) \{[\s\S]*chooseGrade\(start\);[\s\S]*\} else \{[\s\S]*openPicker\(\);/);
  });
  it("no grade: the picker shows as today", () => {
    expect(tail).toContain("Pick your grade to open your first case.");
    expect(tail.split("} else {")[1]).toContain("openPicker();");
  });
  it("the in-game change still opens the picker, and the grade shows", () => {
    expect(page).toContain("gradeButton.addEventListener('click', () => { sound('click'); openPicker(); });");
    expect(page).toContain("playingAtEl.textContent = 'Playing at ' + start.name;");
    expect(page).toContain('id="playing-at" hidden');
  });
  it("shows the chip only for the automatic start, and hides it on the picker and on any pick", () => {
    const fnBody = (name) => page.split("function " + name + "(")[1].split("\n            }\n")[0];
    expect(fnBody("chooseGrade")).not.toContain("playingAtEl.hidden = false");
    expect(fnBody("chooseGrade")).toContain("playingAtEl.hidden = true");
    expect(fnBody("openPicker")).toContain("playingAtEl.hidden = true");
    expect(tail.split("chooseGrade(start);")[1]).toContain("playingAtEl.hidden = false");
    expect(page.split("playingAtEl.hidden = false").length - 1).toBe(1);
  });
});
