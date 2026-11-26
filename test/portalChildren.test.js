// "Your children this week" on the Subscriber's Portal page (owner, 2026-11-25; draft
// docs/mockups/portal-children-summary-draft-*.png): what each child did in the last 7 days, never how well, up to 3.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { portalWeekSummary, dayKey } from "../assets/lib/progress.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

const now = new Date(2026, 10, 25, 15, 0, 0).getTime();
const ago = (d) => new Date(now - d * 86400000);
const day = (d) => dayKey(ago(d));

describe("portalWeekSummary", () => {
  const raw = {
    ok: true,
    answerRows: [],
    progress: [
      { kind: "activity", item_id: "act-sailcar", last_at: ago(0).toISOString() },
      { kind: "activity", item_id: "act-orrery", last_at: ago(3).toISOString() },
      { kind: "book", item_id: "book-1", last_at: ago(2).toISOString() },
      { kind: "episode", item_id: "vid-ep1", last_at: ago(1).toISOString() },
      { kind: "episode", item_id: "vid-ep2", last_at: ago(10).toISOString() },   // last week: not counted
      { kind: "entry", item_id: "air-harp", last_at: ago(1).toISOString() },     // a Subscriber's Portal game
    ],
    days: [
      { day: day(1), kind: "game", item_id: "game-spelling", done: false, answers: 4, right_count: 3 },
      { day: day(1), kind: "game", item_id: "episode-vid-ep1", done: false, answers: 2, right_count: 2 },   // Chike's questions
      { day: day(5), kind: "game", item_id: "pop-quiz", done: false, answers: 3, right_count: 2 },          // the weekly quiz
    ],
  };
  it("counts what was made, read, watched and played in the 7 days ending today", () => {
    const s = portalWeekSummary(raw, now);
    expect(s).toMatchObject({ made: 2, books: 1, episodes: 1, games: 2 });
    expect(s.days).toHaveLength(7);
    expect(s.days[6].key).toBe(day(0));
    expect(s.days.filter((d) => d.on).map((d) => d.key).sort()).toEqual([day(0), day(1), day(2), day(3), day(5)].sort());
    expect(s.activeDays).toBe(5);
    for (const d of s.days) expect("SMTWTFS").toContain(d.letter);
  });
  it("only what they did, never how well", () => {
    const s = portalWeekSummary(raw, now);
    expect(Object.keys(s).sort()).toEqual(["activeDays", "books", "days", "episodes", "games", "made"]);
  });
  it("nothing to show without a report", () => {
    expect(portalWeekSummary(null, now)).toBe(null);
    expect(portalWeekSummary({ ok: false, error: "network" }, now)).toBe(null);
    expect(portalWeekSummary({ ok: true }, now)).toMatchObject({ made: 0, books: 0, episodes: 0, games: 0, activeDays: 0 });
  });
});

describe("the portal page", () => {
  it("shows the section under the page's words, for a signed-in member only", () => {
    const v = body("viewNewsletter");
    expect(v).toContain("+ '<p class=\"lede\">' + slot(\"system\", \"portalText\") + '</p>'\n    + portalKidsHTML()");
    const k = body("portalKidsHTML");
    expect(k).toContain("if (!portalSavedSession()) return \"\";");
  });
  it("at most 3 children, each with a picture, name, grade, the days, the four counts and the full report button", () => {
    const k = body("portalKidsHTML");
    expect(k).toContain("S.children.slice(0, PROGRESS_MAX_CHILDREN)");
    expect(html).toContain("const PROGRESS_MAX_CHILDREN = 3;");
    expect(k).toContain("portalWeekSummary(raw, now)");
    expect(k).toContain('[["Made", sum.made], ["Books", sum.books], ["Episodes", sum.episodes], ["Games", sum.games]]');
    expect(k).toContain("Your children this week");
    expect(k).toContain('data-act="portal-kid-report"');
    expect(k).toContain('Add or change children');
    /* never the ratings or levels: those stay behind the grown-up check */
    expect(k).not.toMatch(/overallRating|status|pct|Excellent|Developing/);
  });
  it("the full report button opens that child's report, which still asks the grown-up question", () => {
    const a = html.split('"portal-kid-report": (el) => {')[1].split("\n  },")[0];
    expect(a).toContain("ProgressState.reportFor = id;");
    expect(a).toContain('navigate("#/newsletter/progress");');
    expect(body("viewProgress")).toContain("if (!ProgressState.grownUpOk) return bar + progressCheckHTML();");
  });
  it("the children and their reports draw the portal page again when they arrive", () => {
    expect(body("progressShownHere")).toContain('AppState.route.name === "newsletter"');
    expect(body("progressLoadChildren")).toContain("if (progressShownHere()) rerender();");
    expect(body("progressLoadReport")).toContain("if (progressShownHere()) rerender();");
  });
  it("no em dashes and no he/she", () => {
    const k = body("portalKidsHTML");
    expect(k).not.toContain("—");
    expect((k.match(/'[^']*'/g) || []).join(" ")).not.toMatch(/\b(he|she|his|her)\b/i);
  });
});
