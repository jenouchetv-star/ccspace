// The progress report in the Subscriber's Portal (index.html): the grown-up check, the report's three containers,
// "Your children", and how the page is reached. The rules it uses (buildReport, grownUpQuestion, GRADE_LABELS, ...)
// live in assets/lib/progress.js and are tested in test/progressLib.test.js; this reads the page's own code.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
/* the report page and the pieces it is drawn from */
const view = () => ["viewProgress", "progressCheckHTML", "progressReportHTML", "progressChildrenHTML"].map(body).join("\n");

describe("the progress report page", () => {
  it("is its own page at /newsletter/progress, not an entry, and needs the portal sign-in like the archive", () => {
    const route = body("parseRoute");
    expect(route).toContain('seg[0] === "newsletter" && seg[1] === "progress"');
    expect(route.indexOf('name:"progress"')).toBeLessThan(route.indexOf("const detailable"));
    expect(body("renderRoute")).toContain('case "progress":          return viewProgress();');
    expect(body("portalOnRoute")).toContain('n === "progress"');
    expect(body("portalNextPath")).toContain('"/newsletter/progress"');
    const v = body("viewProgress");
    expect(v).toContain("portalKick()");
    expect(v.indexOf("return portalDecoy();")).toBeLessThan(v.indexOf("progressCheckHTML("));
  });

  it("asks for the portal session on every call to kid-progress, and says no_session without one", () => {
    const k = body("kidCall");
    expect(k).toContain('if (!session) return { ok: false, error: "no_session" };');
    expect(k).toContain('sb.functions.invoke("kid-progress"');
    expect(k).toContain("session: session");
  });

  it("viewProgress shows the grown-up check first", () => {
    const v = body("viewProgress");
    expect(v.indexOf("if (!ProgressState.grownUpOk)")).toBeGreaterThan(-1);
    expect(v.indexOf("if (!ProgressState.grownUpOk)")).toBeLessThan(v.indexOf("progressLoadChildren("));
    const check = body("progressCheckHTML");
    expect(check).toContain("A quick grown-up check");
    expect(html).toContain("grownUpQuestion(Math.random)");
    expect(html).toMatch(/ProgressState = \{[^}]*children: null[^}]*grownUpOk: false[^}]*reportFor: ""/);
  });

  it("gives a new question after a wrong answer, and remembers a right one only in memory", () => {
    const a = body("progressCheckAnswer");
    expect(a).toContain("ProgressState.grownUpOk = true");
    expect(a).toContain("grownUpQuestion(Math.random)");
    expect(a).not.toMatch(/localStorage|sessionStorage/);
  });

  it("the report uses the three containers", () => {
    const r = body("progressReportHTML");
    for (const c of ["box--week", "box--learned", "box--ask"]) expect(r).toContain(c);
    expect(r).toContain("buildReport(");
  });

  it("the learned container shows the six STEAMM subjects with the site's icons", () => {
    const r = body("progressReportHTML");
    expect(r).toContain("bySubject");
    expect(r).toContain("STEAMM_ICONS[");
    expect(r).toContain("Knows it");
    expect(r).toContain("Came across it");
    expect(r).toContain("Still remembered it 2 months later");
  });

  it("shows quizzes as so many right, never a score", () => {
    const r = body("progressReportHTML");
    expect(r).toContain('" of " + q.asked + " right"');
    expect(r).not.toMatch(/%|out of 100|score/i);
  });

  it("escapes every child name and content title", () => {
    const r = view();
    expect(r).not.toMatch(/\+ (c|child|kid)\.name \+/);
    expect(r).not.toMatch(/\+ (it|item|f|fact)\.title \+/);
  });

  it("Your children offers Kindergarten to 6th grade and at most 6", () => {
    const c = body("progressChildrenHTML");
    expect(c).toContain("GRADE_LABELS");
    expect(c).toContain("Up to 6 children");
    expect(c).toContain("PROGRESS_MAX_CHILDREN");
    expect(html).toContain("const PROGRESS_MAX_CHILDREN = 6;");
    expect(c).toContain('maxlength="24"');
  });

  it("removing a child asks first", () => {
    const c = body("progressChildrenHTML");
    expect(c).toContain("Everything recorded for");
    expect(c).toContain("This can’t be undone.");
    expect(c).toContain('data-act="progress-remove-yes"');
    expect(html).toContain('"progress-remove": (el) => { ProgressState.removing');
  });

  it("with no children yet, shows only Your children and the sign-in note", () => {
    const v = body("progressReportOrEmpty");
    expect(v).toContain("if (!kids.length) return progressChildrenHTML()");
    expect(body("progressChildrenHTML")).toContain("stay signed in to the Subscriber’s Portal");
  });

  it("the member bar links to the report", () => {
    const m = body("portalMemberBar");
    expect(m).toContain('href="#/newsletter/progress"');
    expect(m).toContain("Progress report");
  });

  it("no em dashes and no he/she in the new copy", () => {
    const code = view() + body("progressCheckAnswer") + body("portalMemberBar");
    expect(code.includes("—")).toBe(false);
    const words = (code.match(/'[^']*'|"[^"]*"/g) || []).join(" ");
    expect(words).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
  });
});
