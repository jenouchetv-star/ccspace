// Chike's Creative Space - the progress report's rules
//
// This file decides WHAT counts as something a child met (the "nuggets"), WHO
// a finished item is recorded for, when a video counts as watched, what the
// grown-up report says, and when Chike's quiz bubble may show. It has no
// dependency on the DOM, the database or the network, so index.html imports it
// for the live site and test/progressLib.test.js imports the very same code.

export const STEAMM_SUBJECTS = [
  { id: "science", label: "Science" },
  { id: "technology", label: "Technology" },
  { id: "engineering", label: "Engineering" },
  { id: "art", label: "Art" },
  { id: "math", label: "Math" },
  { id: "music", label: "Music" },
];

const TOPIC_SUBJECT = {
  structures: "engineering",
  sound: "music",
  color: "art",
  nature: "science",
  space: "science",
  weather: "science",
  recycling: "science",
};

/** The STEAMM subject an activity topic belongs to, or "" when none fits. */
export function subjectFromTopic(topic) {
  return TOPIC_SUBJECT[String(topic || "").trim().toLowerCase()] || "";
}

export const GRADE_LABELS = ["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade"];

export function gradeLabel(n) {
  return GRADE_LABELS[n] || "";
}

/** "episode:<id>:discovery" */
export function nuggetId(kind, itemId, part) {
  return kind + ":" + itemId + ":" + part;
}

const KINDS = ["episode", "book", "entry", "activity"];

/** The pieces of a nugget id, or null when it is not one. */
export function parseNuggetId(id) {
  const s = String(id || "");
  const a = s.indexOf(":");
  const b = s.lastIndexOf(":");
  if (a <= 0 || b <= a) return null;
  const kind = s.slice(0, a);
  const itemId = s.slice(a + 1, b);
  const part = s.slice(b + 1);
  if (!KINDS.includes(kind) || !itemId || !part) return null;
  return { kind, itemId, part };
}

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const join = (...parts) => parts.map(clean).filter(Boolean).join(" ");

/** What a child can come away with from one item: facts ("fact") and things to
    talk about ("lesson"). Blank fields give nothing. */
export function nuggetsFor(kind, rec) {
  const out = [];
  if (!rec) return out;
  const add = (part, type, text, title) => {
    if (clean(text)) out.push({ id: nuggetId(kind, rec.id, part), type, text: clean(text), title: clean(title) });
  };
  if (kind === "episode") {
    add("discovery", "fact", rec.learning, rec.title);
    add("lesson", "lesson", rec.moral, rec.title);
  } else if (kind === "book") {
    const learn = (rec.data && rec.data.learn) || {};
    add("word", "fact", join(learn.word, learn.say), learn.word);
    (Array.isArray(learn.takeaways) ? learn.takeaways : []).slice(0, 3).forEach((t, i) => {
      if (t) add("t" + (i + 1), "fact", join(t.title, t.text), t.title);
    });
  } else if (kind === "entry") {
    add("word", "fact", join(rec.vocabWord, rec.vocabMeaning), rec.vocabWord);
  } else if (kind === "activity") {
    const l = rec.learning || {};
    add("fact", "fact", join(l.title, l.text), l.title);
    add("talk", "lesson", rec.discussionPrompt, l.title || rec.title);
  }
  return out;
}

/** Who a finished item is recorded for: a child id, "ask" (show the picker),
    or null (record nothing). */
export function recordTarget(hasSession, playing, children) {
  const list = Array.isArray(children) ? children : [];
  if (!hasSession || !list.length || playing === "grownup") return null;
  return list.some((c) => c && c.id === playing) ? playing : "ask";
}

/** A video counts as watched once 90% has played. */
export function watchedEnough(current, duration) {
  return duration > 0 && current / duration >= 0.9;
}

/** Reads a message posted by an embedded page. Only this site's own pages count. */
export function doneFromMessage(data, origin, siteOrigin) {
  if (origin !== siteOrigin || !data || typeof data !== "object") return null;
  if (data.source === "ccs-book" && data.atLastPage === true) return { kind: "book" };
  if (data.source === "ccs-done" && typeof data.kind === "string" && data.kind && typeof data.id === "string" && data.id) {
    return { kind: data.kind, id: data.id };
  }
  return null;
}

/** The grown-up check: a two-digit by one-digit multiplication. */
export function grownUpQuestion(rand) {
  const a = 12 + Math.floor(rand() * 8);
  const b = 3 + Math.floor(rand() * 7);
  return { a, b, answer: a * b };
}

const DAY = 24 * 60 * 60 * 1000;

function imgOf(kind, rec) {
  if (kind === "episode") return (rec.thumb && rec.thumb.src) || null;
  if (kind === "book") return (rec.data && rec.data.card && rec.data.card.src) || null;
  const c = rec.cover;
  if (typeof c === "string") return c || null;
  return (c && c.src) || null;
}

/** Everything the grown-up report shows, worked out from what the server
    returned and the site's own content. Items that can no longer be found
    (unpublished, deleted) are quietly left out. */
export function buildReport({ progress, nuggets, lessons, subjects, quizzes, content, childName, now }) {
  const nowMs = new Date(now).getTime();
  const status = {};
  (nuggets || []).forEach((n) => { status[n.nugget_id] = n; });
  const lessonSet = new Set(lessons || []);
  const subj = subjects || {};
  const time = (iso) => new Date(iso).getTime();

  const items = [];
  (progress || []).forEach((p) => {
    const rec = content.find(p.kind, p.item_id);
    if (!rec) return;
    items.push({ p, rec, item: { kind: p.kind, id: p.item_id, title: rec.title || "", img: imgOf(p.kind, rec) } });
  });
  items.sort((a, b) => time(b.p.last_at) - time(a.p.last_at));
  const weekItems = items.filter((x) => nowMs - time(x.p.last_at) <= 7 * DAY);

  const factsOf = (list) => {
    const out = [];
    list.forEach(({ p, rec }) => {
      nuggetsFor(p.kind, rec).forEach((n) => {
        if (n.type !== "fact") return;
        const s = status[n.id];
        out.push({
          id: n.id, title: n.title, text: n.text,
          status: s && s.status === "knows" ? "knows" : "met",
          remembered: !!(s && s.review_step >= 2),
          subject: subj[n.id] || "",
          kind: p.kind, itemId: p.item_id,
        });
      });
    });
    return out;
  };
  const facts = factsOf(items);

  const talk = [];
  items.forEach(({ p, rec }) => {
    nuggetsFor(p.kind, rec).forEach((n) => {
      if (n.type === "lesson" || lessonSet.has(n.id)) {
        talk.push({ id: n.id, title: n.title, text: "Ask " + childName + " about it: " + n.text });
      }
    });
  });

  const bySubject = STEAMM_SUBJECTS.map((s) => {
    const mine = facts.filter((f) => f.subject === s.id);
    return { id: s.id, label: s.label, met: mine.length, knows: mine.filter((f) => f.status === "knows").length };
  });

  const counts = {};
  factsOf(weekItems).forEach((f) => { if (f.subject) counts[f.subject] = (counts[f.subject] || 0) + 1; });
  const order = STEAMM_SUBJECTS.map((s) => s.id);
  const weekSubjects = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || order.indexOf(a) - order.indexOf(b));

  const quizList = (quizzes || [])
    .slice()
    .sort((a, b) => time(b.started_at) - time(a.started_at))
    .slice(0, 5)
    .map((q) => ({ date: q.started_at, right: q.right_count, asked: q.asked }));

  return {
    week: weekItems.map((x) => x.item),
    allTime: items.map((x) => x.item),
    facts, talk, quizzes: quizList, bySubject, weekSubjects,
  };
}

/** The pages where Chike's quiz bubble may show: list pages only (the list
    routes are named as parseRoute() in index.html names them). */
export const QUIZ_ROUTES = ["home", "watch", "stories", "play", "create", "newsletter"];

export function quizBubbleAllowed(route) {
  const params = (route && route.params) || {};
  return !!route && QUIZ_ROUTES.includes(route.name) && !params.id && !params.app;
}
