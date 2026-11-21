// Maze Quest starts at the picked child's grade (the site passes ?grade=N); the card says "Playing at 2nd grade. Change".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../games/maze-quest.html", import.meta.url), "utf8");
const snippet = readFileSync(new URL("../assets/lib/childGrade.snippet.js", import.meta.url), "utf8");
const pure = page.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const grab = (name) => {
  const start = page.indexOf("        function " + name + "(");
  return page.slice(start, page.indexOf("\n        }\n", start) + 10);
};
const wiring = page.slice(page.indexOf("            // a picked child starts at their own grade"), page.indexOf("document.getElementById('raceBtn').addEventListener"));

function el() {
  const e = { style: { cssText: "" }, hidden: false, children: [], text: "", listeners: {}, dataset: {},
    appendChild(c) { this.children.push(c); }, addEventListener(t, f) { this.listeners[t] = f; }, focus() {}, setAttribute() {} };
  Object.defineProperty(e, "textContent", { get() { return this.text; }, set(v) { this.text = v; this.children = []; } });
  return e;
}
function boot(search) {
  const row = el(), fixed = el(), display = el(); fixed.hidden = true;
  const saved = {};
  const document = {
    querySelector: (q) => (q === ".mq-grade-row" ? row : null),
    querySelectorAll: () => [],
    getElementById: (id) => (id === "mq-grade-fixed" ? fixed : id === "grade-display" ? display : el()),
    createElement: () => el(),
  };
  const localStorage = { setItem: (k, v) => { saved[k] = v; } };
  const code = snippet + pure + "let gradeIndex = DEFAULT_GRADE; const GRADE_KEY = 'mq-grade'; const sfx = () => {};" +
    grab("setGrade") + grab("showGradeRow") + wiring + "; return { get gradeIndex() { return gradeIndex; }, setGrade, showGradeRow, CCS_CHILD_GRADE };";
  const api = new Function("window", "location", "document", "localStorage", code)({}, { search }, document, localStorage);
  return { api, row, fixed, display, saved };
}

describe("Maze Quest grade from the site", () => {
  it("uses the child's grade without saving it", () => {
    const g = boot("?grade=3");
    expect(g.api.gradeIndex).toBe(3);
    expect(g.saved["mq-grade"]).toBeUndefined();
    expect(g.row.style.display).toBe("none");
    expect(g.fixed.hidden).toBe(false);
    expect(g.fixed.text).toBe("Playing at 3rd grade. ");
    expect(g.fixed.children[0].text).toBe("Change");
    expect(g.fixed.children[0].style.background).toBe("none");
    expect(boot("?grade=0").fixed.text).toBe("Playing at Kindergarten. ");
  });

  it("clamps", () => {
    const g = boot("?grade=6");
    expect(g.api.gradeIndex).toBe(5);
    expect(g.fixed.text).toBe("Playing at 5th grade. ");
  });

  it("no grade: as today", () => {
    for (const q of ["", "?grade=abc", "?grade=9"]) {
      const g = boot(q);
      expect(g.api.gradeIndex).toBe(2);
      expect(g.row.style.display).toBe("");
      expect(g.fixed.hidden).toBe(true);
      expect(g.saved["mq-grade"]).toBeUndefined();
    }
  });

  it("Change shows the grades again, and a pick saves as today", () => {
    const g = boot("?grade=1");
    g.fixed.children[0].listeners.click();
    expect(g.row.style.display).toBe("");
    expect(g.fixed.hidden).toBe(true);
    g.api.setGrade(4, true);
    expect(g.api.gradeIndex).toBe(4);
    expect(g.saved["mq-grade"]).toBe("4");
  });
});
