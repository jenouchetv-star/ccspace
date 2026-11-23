// The parent report's numbers (owner, 2026-11-23; docs/superpowers/specs/2026-11-23-progress-report-redesign-design.md):
// statuses, the week, practice picks, the day log, the trend and the opening sentence, all from the report action's rows.
import { describe, it, expect } from "vitest";
import { subjectStatus, sourceOf, dayKey, weekPeriod, parentReport, answerFromMessage, REPORT_SUBJECTS, STATUS_LABELS } from "../assets/lib/progress.js";

const NOW = new Date(2026, 10, 23, 9, 14);   // Monday, November 23, 2026, 9:14 AM in the family's time zone
const at = (d, h = 10) => new Date(2026, 10, d, h).toISOString();
const row = (d, o = {}) => ({ g: "spelling-detective", q: "spell-x", s: "reading", k: null, c: true, h: 0, at: at(d), ...o });

describe("subject status", () => {
  it("needs 5 answers before rating", () => {
    expect(subjectStatus({ own: 4, sources: 3 })).toBe("none");
    expect(subjectStatus({ own: 5, sources: 2 })).toBe("cons");
  });
  it("is developing under 60% on their own, practicing from 60%, consistently demonstrated from 85% in 2 sources", () => {
    expect(subjectStatus({ own: 5, hint: 2, miss: 3, sources: 2 })).toBe("dev");     // 50% on their own
    expect(subjectStatus({ own: 6, hint: 3, miss: 1, sources: 2 })).toBe("prac");    // 60%
    expect(subjectStatus({ own: 17, hint: 2, miss: 1, sources: 2 })).toBe("cons");   // 85%
    expect(subjectStatus({ own: 12, miss: 0, sources: 1 })).toBe("prac");            // 100% but one source
  });
  it("has the words the page shows", () => {
    expect(STATUS_LABELS).toEqual({ none: "Not enough evidence yet", dev: "Developing", prac: "Practicing", cons: "Consistently demonstrated" });
    expect(REPORT_SUBJECTS.map((s) => s.id)).toEqual(["science", "technology", "engineering", "art", "math", "music", "reading"]);
  });
});

describe("sources and dates", () => {
  it("counts each Solar System Sandbox tour as its own source", () => {
    expect(sourceOf({ g: "solar-system-sandbox", q: "mars-1" })).toBe("solar-system-sandbox:mars");
    expect(sourceOf({ g: "solar-system-sandbox", q: "moon-4" })).not.toBe(sourceOf({ g: "solar-system-sandbox", q: "mars-1" }));
    expect(sourceOf({ g: "spelling-detective", q: "spell-cat" })).toBe("spelling-detective");
  });
  it("covers the 7 days ending today, steps back a week at a time, and never into the future or past 26 weeks", () => {
    const w0 = weekPeriod(NOW, 0), w1 = weekPeriod(NOW, 1);
    expect(dayKey(w0.from)).toBe("2026-11-17");
    expect(dayKey(w0.to)).toBe("2026-11-24");
    expect(dayKey(w1.from)).toBe("2026-11-10");
    expect(weekPeriod(NOW, -3).offset).toBe(0);
    expect(weekPeriod(NOW, 99).offset).toBe(25);
  });
});

describe("the report", () => {
  const rows = [
    // Science: two tours, 11 of 12 on their own -> consistently demonstrated
    ...Array.from({ length: 6 }, (_, i) => row(22, { g: "solar-system-sandbox", q: "mars-" + i, s: "science", k: "Mars", c: i !== 0, ...(i === 0 ? { qt: "How many moons does Mars have?", a: "Two", gv: "One", w: "Phobos and Deimos." } : {}) })),
    ...Array.from({ length: 6 }, (_, i) => row(23, { g: "solar-system-sandbox", q: "moon-" + i, s: "science", k: "The Moon" })),
    // Math: 6 on their own, 3 after a hint, 1 missed
    ...Array.from({ length: 4 }, (_, i) => row(19, { g: "balloon-pop-math", q: "add-" + i, s: "math", k: "Adding within 10" })),
    ...Array.from({ length: 3 }, (_, i) => row(19 + i * 2, { g: i ? "math-runner" : "balloon-pop-math", q: "sub-" + i, s: "math", k: "Taking away past 10", h: 1, qt: "13 - 5", a: "8", gv: "7", w: "Count back to 10 first." })),
    row(19, { g: "balloon-pop-math", q: "add-20", s: "math", k: "Adding within 20", c: false, qt: "9 + 6", a: "15", gv: "14" }),
    ...Array.from({ length: 2 }, (_, i) => row(23, { g: "math-runner", q: "skip-" + i, s: "math", k: "Counting by 2s" })),
    // Reading: two "ea" misses on two days
    row(17, { k: "Spelling ea words", c: false, qt: "Spell the sandy place by the sea", a: "beach", gv: "beech", w: "Beach is spelled B-E-A-C-H." }),
    row(23, { k: "Spelling ea words", c: false, qt: "Spell a place to sit", a: "seat", gv: "seet" }),
    row(17, { k: "Short vowels" }), row(17, { k: "Short vowels" }), row(17, { k: "Short vowels" }),
    // last week, and an unknown subject that is skipped
    row(12, { s: "science", g: "solar-system-sandbox", q: "sun-1" }),
    row(22, { s: "history", g: "nope" }),
  ];
  const days = [{ day: "2026-11-21", kind: "book", item_id: "space-adventure", done: true, answers: 0, right_count: 0 }];
  const progress = [{ kind: "book", item_id: "flying-box", last_at: at(21, 18) }];
  const r = parentReport({ answerRows: rows, days, progress, now: NOW, childName: "Zech" });
  const subj = (id) => r.subjects.find((s) => s.id === id);

  it("rates each subject from this week's answers only", () => {
    expect(subj("science")).toMatchObject({ n: 12, own: 11, miss: 1, status: "cons", pct: 92, ownPct: 92 });
    expect(subj("math")).toMatchObject({ n: 10, own: 6, hint: 3, miss: 1, status: "prac", pct: 90, ownPct: 60 });
    expect(subj("reading")).toMatchObject({ n: 5, own: 3, miss: 2, status: "prac" });
    expect(subj("art")).toMatchObject({ n: 0, status: "none" });
    expect(r.totals).toMatchObject({ n: 27, rated: 3 });
  });

  it("lists the answers to look at, newest first, with what the child gave", () => {
    expect(subj("reading").look.map((x) => x.gv)).toEqual(["seet", "beech"]);
    expect(subj("science").look[0]).toMatchObject({ qt: "How many moons does Mars have?", gv: "One", a: "Two" });
  });

  it("picks the skills worth practicing: 2 or more not on their own, most first", () => {
    expect(r.focus.map((f) => f.skill)).toEqual(["Taking away past 10", "Spelling ea words"]);
    expect(r.focus[0]).toMatchObject({ hint: 3, right: 3, n: 3, tip: "Count back to 10 first." });
    expect(r.focus[0].games.sort()).toEqual(["balloon-pop-math", "math-runner"]);
    expect(r.focus[1].days).toEqual(["2026-11-17", "2026-11-23"]);
  });

  it("lists what went well: 3 or more answers, 85% or more on their own", () => {
    // Mars is 5 of 6 (83%) and Counting by 2s only 2 answers, so neither shows
    expect(r.going.map((g) => g.skill)).toEqual(["The Moon", "Adding within 10", "Short vowels"]);
  });

  it("logs each day: games from their answers, finished books from the day log and from progress", () => {
    expect(r.dayLog.get("2026-11-21").map((x) => x.kind + ":" + x.item).sort()).toEqual(["book:flying-box", "book:space-adventure", "game:math-runner"]);
    expect(r.dayLog.get("2026-11-23").find((x) => x.item === "solar-system-sandbox")).toMatchObject({ answers: 6, right: 6, own: 6 });
    expect(r.dayLog.get("2026-11-12")).toHaveLength(1);
  });

  it("counts engagement apart from understanding", () => {
    expect(r.engagement.week.map((d) => d.letter).join("")).toBe("TWTFSSM");
    expect(r.engagement.week.filter((d) => d.on).map((d) => d.key)).toEqual(["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-22", "2026-11-23"]);
    expect(r.engagement).toMatchObject({ activeDays: 5, completed: 2, answered: 27 });
  });

  it("draws the trend only for subjects with a rated week, with a gap when a week has under 5 answers", () => {
    expect(r.trend.series.map((s) => s.id)).toEqual(["science", "math", "reading"]);
    const sci = r.trend.series[0].points;
    expect(sci).toHaveLength(8);
    expect(sci[7]).toEqual({ n: 12, own: 92 });
    expect(sci[6]).toEqual({ n: 1, own: null });
  });

  it("opens with a plain sentence", () => {
    expect(r.verdict).toBe("A strong week in science, with math and reading and writing still in practice.");
    expect(r.verdictSub).toBe("Zech was active on 5 of the last 7 days and answered 27 questions built into games and books, getting 85% of them right.");   // 11 + 9 + 3 = 23 of 27
    expect(r.verdict + r.verdictSub).not.toMatch(/—|\bhe\b|\bshe\b/i);
  });

  it("goes back a week, and to all time", () => {
    const last = parentReport({ answerRows: rows, days, progress, now: NOW, childName: "Zech", weekOffset: 1 });
    expect(last.totals.n).toBe(1);
    expect(last.verdictSub).toContain("of those 7 days");
    const all = parentReport({ answerRows: rows, days, progress, now: NOW, childName: "Zech", span: "all" });
    expect(all.totals.n).toBe(28);
    expect(all.engagement.week).toEqual([]);
  });

  it("still works with nothing at all", () => {
    const empty = parentReport({ now: NOW, childName: "Zech" });
    expect(empty.subjects.every((s) => s.status === "none")).toBe(true);
    expect(empty.verdict).toBe("No questions answered this week.");
    expect(empty.trend.series).toEqual([]);
    expect(empty.focus).toEqual([]);
  });
});

describe("a game's answer keeps the parent report's fields", () => {
  const base = { game: "solar-system-sandbox", qid: "mars-1", subject: "science", level: "g23", correct: false, question: "How many moons?", answer: "Two" };
  it("keeps given, hints, tries and skill when valid", () => {
    expect(answerFromMessage({ ccsAnswer: { ...base, given: "  One ", hints: 1, tries: 2, skill: "Mars" } })).toMatchObject({ given: "One", hints: 1, tries: 2, skill: "Mars" });
  });
  it("drops an odd value but keeps the answer", () => {
    const a = answerFromMessage({ ccsAnswer: { ...base, given: 5, hints: -1, tries: 0, skill: "" } });
    expect(a).toMatchObject({ game: "solar-system-sandbox", correct: false });
    expect(a).not.toHaveProperty("given"); expect(a).not.toHaveProperty("hints"); expect(a).not.toHaveProperty("tries"); expect(a).not.toHaveProperty("skill");
  });
});
