// The progress report's rules: nuggets, who is playing, the report, the grown-up check.
import { describe, it, expect } from "vitest";
import {
  STEAMM_SUBJECTS, subjectFromTopic, GRADE_LABELS, gradeLabel, nuggetId, parseNuggetId,
  nuggetsFor, recordTarget, watchedEnough, doneFromMessage, grownUpQuestion,
  buildReport, QUIZ_ROUTES, quizBubbleAllowed, questionDraftMessages, parseQuestionDraft,
} from "../assets/lib/progress.js";

const NOW = new Date("2026-11-21T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe("subjects and grades", () => {
  it("lists the six STEAMM subjects in order", () => {
    expect(STEAMM_SUBJECTS.map((s) => s.id)).toEqual(["science", "technology", "engineering", "art", "math", "music"]);
  });
  it("subjectFromTopic", () => {
    expect(subjectFromTopic("structures")).toBe("engineering");
    expect(subjectFromTopic("sound")).toBe("music");
    expect(subjectFromTopic("color")).toBe("art");
    expect(subjectFromTopic("weather")).toBe("science");
    expect(subjectFromTopic("language")).toBe("");
    expect(subjectFromTopic(undefined)).toBe("");
  });
  it("gradeLabel", () => {
    expect(GRADE_LABELS).toHaveLength(7);
    expect(gradeLabel(0)).toBe("Kindergarten");
    expect(gradeLabel(3)).toBe("3rd grade");
    expect(gradeLabel(9)).toBe("");
  });
});

describe("nugget ids", () => {
  it("builds and parses them", () => {
    expect(nuggetId("episode", "v1", "discovery")).toBe("episode:v1:discovery");
    expect(parseNuggetId("episode:v1:discovery")).toEqual({ kind: "episode", itemId: "v1", part: "discovery" });
    expect(parseNuggetId("nonsense")).toBeNull();
    expect(parseNuggetId("movie:v1:x")).toBeNull();
  });
});

describe("nuggetsFor", () => {
  it("reads an episode", () => {
    const n = nuggetsFor("episode", { id: "v1", title: "Bridges", learning: "Triangles are strong.", moral: "Share ideas." });
    expect(n).toEqual([
      { id: "episode:v1:discovery", type: "fact", text: "Triangles are strong.", title: "Bridges" },
      { id: "episode:v1:lesson", type: "lesson", text: "Share ideas.", title: "Bridges" },
    ]);
  });
  it("leaves out blank fields", () => {
    const n = nuggetsFor("episode", { id: "v1", title: "Bridges", learning: "Triangles are strong.", moral: "" });
    expect(n.map((x) => x.id)).toEqual(["episode:v1:discovery"]);
  });
  it("reads a book", () => {
    const n = nuggetsFor("book", { id: "b1", title: "B", data: { learn: { word: "gravity", say: "GRAV-ih-tee", takeaways: [{ title: "Down", text: "Things fall." }, { title: "", text: "" }, { title: "Fast", text: "Heavy is not faster." }] } } });
    expect(n.map((x) => x.id)).toEqual(["book:b1:word", "book:b1:t1", "book:b1:t3"]);
    expect(n[0].text).toBe("gravity GRAV-ih-tee");
    expect(n[1]).toMatchObject({ type: "fact", title: "Down", text: "Down Things fall." });
  });
  it("reads a portal entry and an activity", () => {
    expect(nuggetsFor("entry", { id: "e1", vocabWord: "orbit", vocabMeaning: "a path around." })).toEqual([
      { id: "entry:e1:word", type: "fact", text: "orbit a path around.", title: "orbit" },
    ]);
    const a = nuggetsFor("activity", { id: "a1", title: "T", learning: { topic: "sound", title: "Pitch", text: "Short is high." }, discussionPrompt: "What did you hear?" });
    expect(a.map((x) => [x.id, x.type])).toEqual([["activity:a1:fact", "fact"], ["activity:a1:talk", "lesson"]]);
    expect(nuggetsFor("activity", { id: "a2" })).toEqual([]);
    expect(nuggetsFor("book", null)).toEqual([]);
  });
});

describe("who is playing", () => {
  it("recordTarget asks again when the saved child is gone", () => {
    expect(recordTarget(true, "c9", [{ id: "c1" }])).toBe("ask");
    expect(recordTarget(true, "c1", [{ id: "c1" }])).toBe("c1");
    expect(recordTarget(false, "c1", [{ id: "c1" }])).toBeNull();
    expect(recordTarget(true, "grownup", [{ id: "c1" }])).toBeNull();
    expect(recordTarget(true, "c1", [])).toBeNull();
  });
});

describe("watchedEnough", () => {
  it("counts 90 percent", () => {
    expect(watchedEnough(89, 100)).toBe(false);
    expect(watchedEnough(90, 100)).toBe(true);
    expect(watchedEnough(5, 0)).toBe(false);
  });
});

describe("doneFromMessage", () => {
  const site = "https://www.chikescreativespace.com";
  it("reads a finished book and a shared done message", () => {
    expect(doneFromMessage({ source: "ccs-book", atLastPage: true }, site, site)).toEqual({ kind: "book" });
    expect(doneFromMessage({ source: "ccs-done", kind: "activity", id: "a1" }, site, site)).toEqual({ kind: "activity", id: "a1" });
    expect(doneFromMessage({ source: "ccs-book", atLastPage: false }, site, site)).toBeNull();
    expect(doneFromMessage("hello", site, site)).toBeNull();
    expect(doneFromMessage(null, site, site)).toBeNull();
  });
  it("doneFromMessage ignores other origins", () => {
    expect(doneFromMessage({ source: "ccs-book", atLastPage: true }, "https://evil.test", site)).toBeNull();
    expect(doneFromMessage({ source: "ccs-done", kind: "activity", id: "a1" }, "https://evil.test", site)).toBeNull();
  });
});

describe("grownUpQuestion", () => {
  it("grownUpQuestion is a single-digit multiplication (owner, 2026-11-21)", () => {
    expect(grownUpQuestion(() => 0)).toEqual({ a: 3, b: 3, answer: 9 });
    expect(grownUpQuestion(() => 0.999)).toEqual({ a: 9, b: 9, answer: 81 });
  });
});

describe("buildReport", () => {
  const videos = {
    v1: { id: "v1", title: "Bridges", thumb: { src: "t1.jpg" }, learning: "Triangles are strong.", moral: "Sharing makes ideas bigger." },
    v2: { id: "v2", title: "Rain", thumb: { src: "t2.jpg" }, learning: "Clouds hold water.", moral: "" },
  };
  const books = { b1: { id: "b1", title: "Star Book", data: { card: { src: "b.jpg" }, learn: { word: "orbit", say: "OR-bit", takeaways: [] } } } };
  const content = {
    find: (kind, id) => (kind === "episode" ? videos[id] : kind === "book" ? books[id] : null) || null,
  };
  const base = {
    progress: [
      { kind: "episode", item_id: "v1", first_at: daysAgo(30), last_at: daysAgo(2), times: 1 },
      { kind: "episode", item_id: "v2", first_at: daysAgo(40), last_at: daysAgo(20), times: 2 },
      { kind: "book", item_id: "b1", first_at: daysAgo(1), last_at: daysAgo(1), times: 1 },
      { kind: "episode", item_id: "gone", first_at: daysAgo(1), last_at: daysAgo(1), times: 1 },
    ],
    nuggets: [], lessons: [], subjects: {}, quizzes: [], content, childName: "Maya", now: NOW,
  };

  it("splits this week from all time, newest first, with pictures", () => {
    const r = buildReport(base);
    expect(r.week.map((i) => i.id)).toEqual(["b1", "v1"]);
    expect(r.allTime.map((i) => i.id)).toEqual(["b1", "v1", "v2"]);
    expect(r.week[0]).toEqual({ kind: "book", id: "b1", title: "Star Book", img: "b.jpg" });
    expect(r.allTime[1].img).toBe("t1.jpg");
  });
  it("buildReport skips items it cannot find", () => {
    const r = buildReport(base);
    const all = JSON.stringify(r);
    expect(all).not.toContain("gone");
    expect(r.facts.some((f) => f.id.includes("gone"))).toBe(false);
    expect(r.talk.some((f) => f.id.includes("gone"))).toBe(false);
  });
  it("marks facts met, knows and remembered", () => {
    const r = buildReport({ ...base, nuggets: [
      { nugget_id: "episode:v1:discovery", status: "knows", review_step: 2, known_at: daysAgo(1) },
      { nugget_id: "episode:v2:discovery", status: "met", review_step: 0, known_at: null },
    ] });
    const f1 = r.facts.find((f) => f.id === "episode:v1:discovery");
    const f2 = r.facts.find((f) => f.id === "episode:v2:discovery");
    const f3 = r.facts.find((f) => f.id === "book:b1:word");
    expect(f1).toMatchObject({ status: "knows", remembered: true });
    expect(f2).toMatchObject({ status: "met", remembered: false });
    expect(f3.status).toBe("met");
  });
  it("buildReport names the child and never says her or him", () => {
    const r = buildReport(base);
    expect(r.talk.map((t) => t.text)).toEqual(["Ask Maya about it: Sharing makes ideas bigger."]);
    expect(JSON.stringify(r)).not.toMatch(/\b(her|him|his|she|he)\b/i);
  });
  it("adds fact nuggets listed in lessons to the talk list", () => {
    const r = buildReport({ ...base, lessons: ["episode:v2:discovery"] });
    expect(r.talk.map((t) => t.text)).toContain("Ask Maya about it: Clouds hold water.");
  });
  it("buildReport counts each STEAMM subject in order, zeros included", () => {
    const r = buildReport({ ...base,
      nuggets: [{ nugget_id: "episode:v1:discovery", status: "knows", review_step: 0, known_at: daysAgo(1) }],
      subjects: { "episode:v1:discovery": "science", "episode:v2:discovery": "science", "book:b1:word": "engineering" } });
    expect(r.bySubject.map((s) => s.id)).toEqual(["science", "technology", "engineering", "art", "math", "music"]);
    expect(r.bySubject[0]).toEqual({ id: "science", label: "Science", met: 2, knows: 1 });
    expect(r.bySubject[1]).toEqual({ id: "technology", label: "Technology", met: 0, knows: 0 });
    expect(r.facts.find((f) => f.id === "episode:v1:discovery").subject).toBe("science");
    expect(r.facts.find((f) => f.id === "episode:v2:discovery").subject).toBe("science");
  });
  it("weekSubjects lists this week's subjects, most first", () => {
    const r = buildReport({ ...base, subjects: { "episode:v1:discovery": "engineering", "book:b1:word": "engineering", "episode:v2:discovery": "science" } });
    expect(r.weekSubjects).toEqual(["engineering"]);
  });
  it("keeps the newest 5 quizzes as date, right, asked", () => {
    const quizzes = [1, 2, 3, 4, 5, 6].map((d) => ({ started_at: daysAgo(d), asked: 3, right_count: d % 4 }));
    const r = buildReport({ ...base, quizzes });
    expect(r.quizzes).toHaveLength(5);
    expect(r.quizzes[0]).toEqual({ date: daysAgo(1), right: 1, asked: 3 });
  });
  it("accepts a cover given as a string or an object", () => {
    const c = { find: (k, id) => ({ id, title: "A", cover: id === "x" ? "s.jpg" : { src: "o.jpg" } }) };
    const r = buildReport({ ...base, content: c, progress: [
      { kind: "entry", item_id: "x", last_at: daysAgo(1) }, { kind: "activity", item_id: "y", last_at: daysAgo(2) } ] });
    expect(r.week.map((i) => i.img)).toEqual(["s.jpg", "o.jpg"]);
  });
});

describe("quiz bubble", () => {
  it("shows only on list pages", () => {
    expect(QUIZ_ROUTES).toEqual(["home", "watch", "stories", "play", "create", "newsletter"]);
    expect(quizBubbleAllowed({ name: "watch", params: {} })).toBe(true);
    expect(quizBubbleAllowed({ name: "play", params: { sub: "online" } })).toBe(true);
    expect(quizBubbleAllowed({ name: "stories", params: { id: "b1" } })).toBe(false);
    expect(quizBubbleAllowed({ name: "video-detail", params: { id: "v1" } })).toBe(false);
    expect(quizBubbleAllowed({ name: "create", params: { sub: "studio", app: "art" } })).toBe(false);
    expect(quizBubbleAllowed({ name: "admin", params: {} })).toBe(false);
  });
});

describe("drafting quiz questions with Copilot", () => {
  const fact = { id: "episode:v1:discovery", type: "fact", text: "Triangles make bridges strong.", title: "The Bridge" };
  const draft = (o) => JSON.stringify(Object.assign({ question: "What shape makes a bridge strong?", choices: ["A triangle", "A circle", "A star"], answer: 0, why: "Triangles keep their shape.", subject: "engineering" }, o));

  it("parseQuestionDraft keeps 2 choices for k1 and 3 otherwise and rejects an answer outside them", () => {
    expect(parseQuestionDraft(draft({}), "g23")).toEqual({ question: "What shape makes a bridge strong?", choices: ["A triangle", "A circle", "A star"], answer: 0, why: "Triangles keep their shape.", subject: "engineering" });
    expect(parseQuestionDraft(draft({}), "g46").choices).toHaveLength(3);
    const k1 = parseQuestionDraft(draft({}), "k1");
    expect(k1.choices).toEqual(["A triangle", "A circle"]);
    expect(k1.answer).toBe(0);
    expect(parseQuestionDraft(draft({ answer: 2 }), "k1")).toBe(null);           // the right one was cut off
    expect(parseQuestionDraft(draft({ answer: 3 }), "g23")).toBe(null);
    expect(parseQuestionDraft(draft({ answer: -1 }), "g23")).toBe(null);
    expect(parseQuestionDraft(draft({ answer: 1.5 }), "g23")).toBe(null);
    expect(parseQuestionDraft(draft({ answer: "1" }), "g23").answer).toBe(1);
    expect(parseQuestionDraft(draft({ choices: ["A triangle", "A circle"] }), "g23")).toBe(null);   // too few
    expect(parseQuestionDraft(draft({ choices: ["A triangle", "a triangle", "A star"] }), "g23")).toBe(null);  // one right answer only
    expect(parseQuestionDraft(draft({ question: " " }), "g23")).toBe(null);
    expect(parseQuestionDraft("not json", "g23")).toBe(null);
    expect(parseQuestionDraft(draft({}), "lesson")).toBe(null);
    // the model's chatter around the JSON, and an em dash, are tidied away
    const t = parseQuestionDraft("Here you go:\n" + draft({ why: "Triangles \u2014 they keep their shape." }) + "\nDone", "g23");
    expect(t.why).toBe("Triangles, they keep their shape.");
    expect(t.why.includes("\u2014")).toBe(false);
  });

  it("parseQuestionDraft drops a subject that is not one of the six", () => {
    expect(parseQuestionDraft(draft({ subject: "Science" }), "g23").subject).toBe("science");
    expect(parseQuestionDraft(draft({ subject: "history" }), "g23").subject).toBe("");
    expect(parseQuestionDraft(draft({ subject: "STEM" }), "g23").subject).toBe("");
    expect(parseQuestionDraft(draft({ subject: 3 }), "g23").subject).toBe("");
    expect(parseQuestionDraft(draft({ subject: undefined }), "g23").subject).toBe("");
  });

  it("questionDraftMessages asks for kid-friendly words, no em dashes, one right answer and one STEAMM subject", () => {
    for (const level of ["k1", "g23", "g46"]) {
      const m = questionDraftMessages(fact, level);
      expect(m.map((x) => x.role)).toEqual(["system", "user"]);
      const all = m.map((x) => x.content).join("\n");
      expect(all).toMatch(/kid-friendly/i);
      expect(all).toMatch(/never use em dashes/i);
      expect(all.includes("\u2014")).toBe(false);
      expect(all).toMatch(/exactly one (choice )?is right/i);
      expect(all).toMatch(/one STEAMM subject/);
      for (const s of STEAMM_SUBJECTS) expect(all).toContain(s.id);
      expect(all).toContain("Triangles make bridges strong.");
      expect(all).toMatch(/JSON/);
      expect(all).not.toMatch(/\b(he|she|her|his|him)\b/i);
    }
    expect(questionDraftMessages(fact, "k1")[0].content).toMatch(/exactly 2 choices/);
    expect(questionDraftMessages(fact, "k1")[0].content).toMatch(/Kindergarten and 1st grade/);
    expect(questionDraftMessages(fact, "g23")[0].content).toMatch(/exactly 3 choices/);
    expect(questionDraftMessages(fact, "g46")[0].content).toMatch(/4th to 6th grade/);
  });
});
