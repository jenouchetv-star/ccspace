// Chike's corner: the tour's welcome bubble shows only to a new visitor who has never done the tour (owner, 2026-11-27).
// The "Who's creating?" tag carries a small window icon.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
const fn = (name, ...deps) => (...vals) => new Function(...deps, "return function " + name + "(" + body(name))(...vals);
const corner = (state, quizOn = false, chip = "") => {
  const root = { innerHTML: "" };
  fn("renderTourRoot", "$", "tourState", "progressQuizBubble", "AppState", "progressChipHTML", "teardownTourStep", "TOUR_STOPS", "tourStopMatchesRoute", "mountTourStep")(
    () => root, () => Object.assign({ hidden: false, stepIndex: 0 }, state), () => quizOn, { route: { name: "home", params: {} } }, () => chip, () => {}, [], () => false, () => {})();
  return root.innerHTML;
};
const BIG = '<div class="tour-bubble" role="status">';

// owner, 2026-11-27: "only show this for new visitor who has never done the tour"
describe("the tour's welcome bubble", () => {
  it("shows to a new visitor who has never done the tour", () => {
    expect(corner({ status: "not_started" })).toContain(BIG);
  });
  it("never again once the tour was opened, dismissed or finished, or the visitor clicked past it, not even on hover", () => {
    for (const s of [{ status: "not_started", seen: true }, { status: "dismissed" }, { status: "completed" }]) {
      expect(corner(s), JSON.stringify(s)).not.toContain("tour-bubble");
    }
    expect(html).not.toContain("tour-bubble--hover");
  });
  it("never during the tour itself, nor while Chike offers his quiz", () => {
    expect(corner({ status: "in_progress" })).not.toContain("tour-bubble");
    expect(corner({ status: "not_started" }, true)).not.toContain("tour-bubble");
    expect(corner({ status: "completed" }, true)).not.toContain("tour-bubble");
  });
  it("opening the tour counts as having done it, and the bubble on screen goes at once", () => {
    const open = html.split('"tour-open": (el) => {')[1].split("\n  },")[0];
    expect(open).toContain("saveTourState({ seen: true });");
    expect(open).toContain("if (b) b.remove();");
    expect(open.indexOf("saveTourState({ seen: true })")).toBeLessThan(open.indexOf("openModal("));
  });
});

describe("the Who's creating tag", () => {
  it("has a small window icon, hidden from screen readers, on both its forms", () => {
    const chip = body("progressChipHTML");
    expect(chip).toContain('<svg class="tour-tag__pop"');
    expect(chip).toContain('aria-hidden="true"');
    expect(chip).toContain("Who’s creating?' + pop + '</button>'");
    expect(chip).toContain("E(kid.name) + pop + '</button>'");
    expect(html).toContain(".tour-tag__pop{ width:14px; height:14px;");
  });
});
