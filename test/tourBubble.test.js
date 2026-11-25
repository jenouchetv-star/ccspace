// Chike's corner (owner, 2026-11-25): the tour's welcome bubble shows to someone who has never opened the tour; once
// they have, only while the pointer is on Chike. The "Who's creating?" tag carries a small window icon.
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
const HOVER = '<div class="tour-bubble tour-bubble--hover" aria-hidden="true">';

describe("the tour's welcome bubble", () => {
  it("shows to someone who has never opened the tour", () => {
    expect(corner({ status: "not_started" })).toContain(BIG);
  });
  it("after the tour was opened, dismissed or finished, it waits for the pointer on Chike", () => {
    for (const s of [{ status: "not_started", seen: true }, { status: "dismissed" }, { status: "completed" }]) {
      const c = corner(s);
      expect(c, JSON.stringify(s)).toContain(HOVER);
      expect(c, JSON.stringify(s)).not.toContain(BIG);
    }
  });
  it("never during the tour itself, nor while Chike offers his quiz", () => {
    expect(corner({ status: "in_progress" })).not.toContain("tour-bubble");
    expect(corner({ status: "not_started" }, true)).not.toContain("tour-bubble");
    expect(corner({ status: "completed" }, true)).not.toContain("tour-bubble");
  });
  it("the hover one comes after Chike in the corner, so hovering or focusing Chike shows it", () => {
    const c = corner({ status: "completed" }, false, '<button class="tour-tag">x</button>');
    expect(c.indexOf('class="tour-avatar"')).toBeLessThan(c.indexOf(HOVER));
    expect(html).toContain(".tour-bubble--hover{ display:none; pointer-events:none; }");
    expect(html).toContain(".tour-avatar:hover ~ .tour-bubble--hover, .tour-avatar:focus-visible ~ .tour-bubble--hover{ display:block; }");
    expect(html).toContain("@media (max-width:767px){ .tour-bubble, .tour-avatar:hover ~ .tour-bubble--hover{ display:none; } }");
  });
  it("opening the tour counts as having seen it, and the bubble on screen turns hover-only at once", () => {
    const open = html.split('"tour-open": (el) => {')[1].split("\n  },")[0];
    expect(open).toContain("saveTourState({ seen: true });");
    expect(open).toContain('b.classList.add("tour-bubble--hover")');
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
