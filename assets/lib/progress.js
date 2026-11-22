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

/* ---- grade adjust: games and activities fit the picked child's grade ---- */

/** A grade, 0 (Kindergarten) to 6, from a number or a string of one digit; anything else is null. */
export function childGradeFrom(raw) {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^[0-6]$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

/** The ages a grade fits: grade G is ages G+5 to G+6. */
export function gradeAges(g) {
  return { min: g + 5, max: g + 6 };
}

const DIFFICULTY_STEP = { easy: 0, medium: 1, challenge: 2 };

/** How far an activity's difficulty is from the grade's: 0 when it matches (K to 1st "easy", 2nd to 3rd "medium",
    4th to 6th "challenge" or "medium"), 1 one step away, 2 two steps, 3 when the difficulty or grade is unknown. */
export function difficultyDistance(a, g) {
  const grade = childGradeFrom(g);
  const step = a && Object.prototype.hasOwnProperty.call(DIFFICULTY_STEP, a.difficulty) ? DIFFICULTY_STEP[a.difficulty] : -1;
  if (grade === null || step < 0) return 3;
  const fits = grade <= 1 ? [0] : grade <= 3 ? [1] : [1, 2];
  return Math.min(...fits.map((f) => Math.abs(step - f)));
}

/** An activity fits a grade when its ages overlap the grade's and its difficulty matches. No ages or no difficulty:
    it never fits (owner, 2026-11-21). */
export function activityFitsGrade(a, g) {
  const grade = childGradeFrom(g);
  if (!a || grade === null || !Number.isFinite(a.ageMin) || !Number.isFinite(a.ageMax)) return false;
  const ages = gradeAges(grade);
  return a.ageMin <= ages.max && a.ageMax >= ages.min && difficultyDistance(a, grade) === 0;
}

/** The Activity Finder's age band for a grade (age G+5): "3-5" for Kindergarten, "6-8" for 1st to 3rd, "9-12" for
    4th to 6th. */
export function findAgeForGrade(g) {
  const age = gradeAges(g).min;
  return age <= 5 ? "3-5" : age <= 8 ? "6-8" : "9-12";
}

const GRADE_TAG = /<script>window\.CCS_GRADE=\d+;<\/script>/g;

/** A private game's code with the grade set before anything of its own runs: right after <head>, or at the start
    (after a <!doctype>, so the game keeps its standards mode). Never twice; a bad grade changes nothing. */
export function withChildGrade(html, g) {
  const grade = childGradeFrom(g);
  const src = String(html ?? "");
  if (grade === null) return src;
  const tag = "<script>window.CCS_GRADE=" + grade + ";</script>";
  const s = src.replace(GRADE_TAG, "");
  const head = /<head(\s[^>]*)?>/i.exec(s);
  const at = head ? head.index + head[0].length : ((/^\s*<!doctype[^>]*>\s*/i.exec(s) || [""])[0]).length;
  return s.slice(0, at) + tag + s.slice(at);
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

/** The grown-up check: a single-digit multiplication, 3 to 9 times 3 to 9 (owner, 2026-11-21). */
export function grownUpQuestion(rand) {
  const a = 3 + Math.floor(rand() * 7);
  const b = 3 + Math.floor(rand() * 7);
  return { a, b, answer: a * b };
}

/* ---- answers from the site's games (Solar System Sandbox's tours, ...) ---- */

const GAME_ID = /^[a-z0-9-]{1,40}$/;
const ANSWER_LEVELS = ["k1", "g23", "g45"];
const ANSWER_CAP = { question: 300, answer: 200, why: 400 };

/** A game's answer, read from a message it posted ({ ccsAnswer: { game, qid, subject, level, correct, question, answer,
    why } }), in the shape kid-progress's game_answer takes; null when it is not one. Who sent it is checked by the page
    (only its own game stage frame counts). */
export function answerFromMessage(data) {
  const a = data && typeof data === "object" ? data.ccsAnswer : null;
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const str = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const game = typeof a.game === "string" ? a.game : "", qid = typeof a.qid === "string" ? a.qid : "";
  if (!GAME_ID.test(game) || game === "pop-quiz" || !GAME_ID.test(qid)) return null;
  if (!STEAMM_SUBJECTS.some((s) => s.id === a.subject) || !ANSWER_LEVELS.includes(a.level) || typeof a.correct !== "boolean") return null;
  if (a.why !== undefined && a.why !== null && typeof a.why !== "string") return null;
  const question = str(a.question, ANSWER_CAP.question), answer = str(a.answer, ANSWER_CAP.answer);
  if (!question || !answer) return null;
  return { game, qid, subject: a.subject, level: a.level, correct: a.correct, question, answer, why: str(a.why, ANSWER_CAP.why) };
}

/** A STEAMM subject's level from the child's answers over the last 8 weeks (owner): none asked, null; fewer than 5 or
    under half right, "Getting started"; half to under 80%, "Growing"; 80% or more of at least 5, "Strong". The parent
    sees only the word, never a number. */
export function subjectLevel(counts) {
  const asked = Number(counts && counts.asked) || 0;
  const right = Number(counts && counts.right) || 0;
  if (asked <= 0) return null;
  const share = right / asked;
  if (asked < 5 || share < 0.5) return "Getting started";
  return share < 0.8 ? "Growing" : "Strong";
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
    (unpublished, deleted) are quietly left out. answers is what the report action
    returned for the games' answers: levels gives a level word only to the subjects
    with answers, and toGoOver the 5 newest missed questions. */
export function buildReport({ progress, nuggets, lessons, subjects, quizzes, answers, content, childName, now }) {
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

  const ans = answers && typeof answers === "object" ? answers : {};
  const counted = ans.bySubject && typeof ans.bySubject === "object" ? ans.bySubject : {};
  const levels = {};
  STEAMM_SUBJECTS.forEach((s) => {
    const level = Object.prototype.hasOwnProperty.call(counted, s.id) ? subjectLevel(counted[s.id]) : null;
    if (level) levels[s.id] = level;
  });
  const toGoOver = (Array.isArray(ans.missed) ? ans.missed : [])
    .filter((m) => m && clean(m.question) && clean(m.answer))
    .slice(0, 5)
    .map((m) => ({ game: clean(m.game), question: clean(m.question), answer: clean(m.answer), why: clean(m.why), at: m.at }));

  return {
    week: weekItems.map((x) => x.item),
    allTime: items.map((x) => x.item),
    facts, talk, quizzes: quizList, bySubject, weekSubjects, levels, toGoOver,
  };
}

/* ---- the admin's "Draft with Copilot" for a fact's quiz question ---- */

const DRAFT_LEVELS = {
  k1: { who: "children in Kindergarten and 1st grade (ages 5 to 7). It is read aloud to them, so keep it very short", n: 2 },
  g23: { who: "children in 2nd and 3rd grade (ages 7 to 9)", n: 3 },
  g46: { who: "children in 4th to 6th grade (ages 9 to 12). Make the other choices believable, so picking the right one takes knowing why", n: 3 },
};

/** The messages that ask the admin's own Copilot (Ollama) for one quiz question about one fact, at one level. */
export function questionDraftMessages(nugget, level) {
  const L = DRAFT_LEVELS[level] || DRAFT_LEVELS.g23;
  const n = nugget || {};
  const system = [
    "You write one quiz question for Chike's Creative Space, a STEAMM website for children.",
    "The question is for " + L.who + ".",
    "Use short, kid-friendly words a child that age knows. Be warm and clear. No trick questions.",
    "Ask only about the fact you are given, so a child who met it can answer.",
    "Give exactly " + L.n + " choices. Exactly one is right; the others are wrong to a child who remembers the fact.",
    "Add a why: one short sentence that says why the right answer is right.",
    "Pick the one STEAMM subject the fact belongs to: science, technology, engineering, art, math or music. Use \"\" when none fits.",
    "Never use em dashes. No emojis.",
    'Reply with JSON only, like {"question": "...", "choices": ["...", "..."], "answer": 0, "why": "...", "subject": "science"}, where answer is the position of the right choice, counting from 0.',
  ].join("\n");
  const user = "The fact" + (clean(n.title) ? " (from \"" + clean(n.title) + "\")" : "") + ": " + clean(n.text);
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/** Copilot's reply read back: {question, choices, answer, why, subject}, or null when it is not a usable question.
    K to 1st keeps the first 2 choices, the other levels the first 3; the right answer has to be one of them, and the
    subject is one of the six or "". */
export function parseQuestionDraft(text, level) {
  const need = DRAFT_LEVELS[level] ? DRAFT_LEVELS[level].n : 0;
  if (!need) return null;
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let o;
  try { o = JSON.parse(s.slice(a, b + 1)); } catch (_e) { return null; }
  if (!o || typeof o !== "object") return null;
  const tidy = (v) => (typeof v === "string" ? v.replace(/\s*\u2014\s*/g, ", ").replace(/\s+/g, " ").trim() : "");
  const question = tidy(o.question);
  const choices = (Array.isArray(o.choices) ? o.choices : []).slice(0, need).map((c) => tidy(typeof c === "number" ? String(c) : c));
  if (!question || choices.length !== need || choices.some((c) => !c)) return null;
  if (new Set(choices.map((c) => c.toLowerCase())).size !== need) return null;
  const answer = typeof o.answer === "string" && /^\d+$/.test(o.answer.trim()) ? Number(o.answer) : o.answer;
  if (!Number.isInteger(answer) || answer < 0 || answer >= need) return null;
  const subj = tidy(o.subject).toLowerCase();
  return { question, choices, answer, why: tidy(o.why), subject: STEAMM_SUBJECTS.some((x) => x.id === subj) ? subj : "" };
}

/** The pages where Chike's quiz bubble may show: list pages only (the list
    routes are named as parseRoute() in index.html names them). */
export const QUIZ_ROUTES = ["home", "watch", "stories", "play", "create", "newsletter"];

export function quizBubbleAllowed(route) {
  const params = (route && route.params) || {};
  return !!route && QUIZ_ROUTES.includes(route.name) && !params.id && !params.app;
}
