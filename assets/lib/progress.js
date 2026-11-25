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

/** Reading and Writing (owner, 2026-11-22): what the spelling and word games count toward. A line of its own on the
    report, set apart beside the six STEAMM subjects; it is not one of them (the site stays STEAMM). */
export const READING_SUBJECT = Object.freeze({ id: "reading", label: "Reading and Writing" });
/** Everything a game's answer may count toward. */
const ANSWER_SUBJECTS = [...STEAMM_SUBJECTS.map((s) => s.id), READING_SUBJECT.id];

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

const NAME_TAG = /<script>window\.CCS_NAME=[^<]*;<\/script>/g;

/** A private game's code with the picked child's name set before anything of its own runs, like withChildGrade
    (owner, 2026-11-24: Robo Math Buddy knows who is playing). The name is a JSON string with <, >, & and the two line
    separators escaped, so it can never end its script tag. Only for a sealed game's code: a name never goes in an
    address. No name: the code is unchanged. */
export function withChildName(html, name) {
  const src = String(html ?? "");
  const n = String(name ?? "").trim();
  if (!n) return src;
  const json = JSON.stringify(n).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const tag = "<script>window.CCS_NAME=" + json + ";</script>";
  const s = src.replace(NAME_TAG, "");
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
/** "Who's creating today?" lasts a week from the day it was picked, then the device asks again (owner, 2026-11-22: a
    pick kept for good kept recording for the same child; asking every day or after an hour was too often). Kept on the
    device as "<YYYY-MM-DD>|<child id or grownup>"; a pick 7 or more days old, one dated after today, or one kept before
    the day was added (just an id) counts as no pick. */
export const PLAYING_DAYS = 7;
const dayNumber = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN;
};
export function playingToStore(who, today) {
  return who ? today + "|" + who : "";
}
export function playingFromStored(raw, today) {
  if (typeof raw !== "string") return "";
  const bar = raw.indexOf("|");
  if (bar < 0) return "";
  const age = dayNumber(today) - dayNumber(raw.slice(0, bar)), who = raw.slice(bar + 1);
  return who && age >= 0 && age < PLAYING_DAYS ? who : "";
}

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

/** The grown-up check: a single-digit multiplication, 3 to 9 times 3 to 9 (owner, 2026-11-21), answered by tapping one
    of 4 choices (owner, 2026-11-24). The 3 wrong ones are the mistakes a near miss makes (one row too many or too few,
    off by ten or by one), so the right one can't be picked out by its size. Listed smallest first. */
export function grownUpQuestion(rand) {
  const a = 3 + Math.floor(rand() * 7);
  const b = 3 + Math.floor(rand() * 7);
  const answer = a * b;
  const pool = [...new Set([answer - a, answer + a, answer - b, answer + b, answer - 10, answer + 10, answer - 1, answer + 1])]
    .filter((n) => n > 0 && n !== answer);
  const picked = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return { a, b, answer, choices: [answer, ...picked].sort((x, y) => x - y) };
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
  if (!ANSWER_SUBJECTS.includes(a.subject) || !ANSWER_LEVELS.includes(a.level) || typeof a.correct !== "boolean") return null;
  if (a.why !== undefined && a.why !== null && typeof a.why !== "string") return null;
  const question = str(a.question, ANSWER_CAP.question), answer = str(a.answer, ANSWER_CAP.answer);
  if (!question || !answer) return null;
  const out = { game, qid, subject: a.subject, level: a.level, correct: a.correct, question, answer, why: str(a.why, ANSWER_CAP.why) };
  /* the parent report's optional fields (owner, 2026-11-23): kept only when valid, so an odd value never loses the answer */
  const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (typeof a.given === "string" && str(a.given, 200)) out.given = str(a.given, 200);
  if (whole(a.hints, 0, 20)) out.hints = a.hints;
  if (whole(a.tries, 1, 50)) out.tries = a.tries;
  if (typeof a.skill === "string" && str(a.skill, 80)) out.skill = str(a.skill, 80);
  return out;
}

/* ---- the parent report (owner, 2026-11-23; docs/superpowers/specs/2026-11-23-progress-report-redesign-design.md) ---- */

/** The report's subjects in order: the six STEAMM subjects, then Reading and Writing. */
export const REPORT_SUBJECTS = [...STEAMM_SUBJECTS, READING_SUBJECT];
/** What each status is called on the page. */
export const STATUS_LABELS = { none: "Not enough evidence yet", dev: "Developing", prac: "Practicing", cons: "Consistently demonstrated" };
/** A subject is rated only from this many answers in the period. */
export const MIN_EVIDENCE = 5;
/** How many weeks back the report can go (the server returns 26 weeks). */
export const REPORT_WEEKS = 26;
const TREND_WEEKS = 8;

/** A subject's status from its answers in the period: fewer than 5, not enough evidence; under 60% on their own,
    developing; 85% or more on their own from 2 or more sources, consistently demonstrated; otherwise practicing. */
export function subjectStatus({ own = 0, hint = 0, miss = 0, sources = 0 } = {}) {
  const n = own + hint + miss;
  if (n < MIN_EVIDENCE) return "none";
  const r = own / n;
  if (r < 0.6) return "dev";
  return r >= 0.85 && sources >= 2 ? "cons" : "prac";
}

/** The report's overall rating, shown in place of the big percent (owner, 2026-11-24: "from needs improvement to
    excellent"): four steps on the report's own cut-offs, under 60, 60 to 74, 75 to 84, and 85 or more. */
export const OVERALL_RATINGS = [
  { id: "needs", label: "Needs improvement", from: 0 },
  { id: "good", label: "Good", from: 60 },
  { id: "very", label: "Very good", from: 75 },
  { id: "excellent", label: "Excellent", from: 85 },
];
/** The step for a percent correct, or null under MIN_EVIDENCE answers (as a subject, nothing is rated from a few). */
export function overallRating(pct, n) {
  if (!(n >= MIN_EVIDENCE)) return null;
  let step = 0;
  OVERALL_RATINGS.forEach((r, i) => { if (pct >= r.from) step = i; });
  return { ...OVERALL_RATINGS[step], step };
}

/** Where an answer came from, for "at least 2 different games, books or activities": the game, except that each
    Solar System Sandbox tour counts on its own (a question id is the tour and its number, as in "gas-giants-q1"). */
export function sourceOf(row) {
  const g = String(row && row.g || "");
  return g === "solar-system-sandbox" ? g + ":" + String(row.q || "").replace(/-q?\d+$/, "") : g;
}

/** A date's key in the family's own time zone: YYYY-MM-DD. */
export function dayKey(d) {
  const x = new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}

/** The 7 days a week offset covers, in the family's time zone: offset 0 is the 7 days ending today, 1 the 7 before
    that, and so on (never below 0, never past 26 weeks back). from is the first day's start, to the day after the last. */
export function weekPeriod(now, offset) {
  return periodAt(now, Math.max(0, Math.min(REPORT_WEEKS - 1, Math.floor(Number(offset) || 0))));
}
/* the 7 days k weeks back, with no limit: the trend can reach past the 26 weeks the server returns (those weeks are
   simply empty) without repeating the last one */
function periodAt(now, k) {
  const t = new Date(now);
  const to = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1 - 7 * k);
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 7);
  return { offset: k, from: from.getTime(), to: to.getTime() };
}

const pctOf = (a, n) => (n ? Math.round((a / n) * 100) : 0);
const tallyKind = (r) => (r.c ? (r.h > 0 ? "hint" : "own") : "miss");

function cleanRows(answerRows) {
  const ok = new Set(REPORT_SUBJECTS.map((s) => s.id));
  return (answerRows || []).filter((r) => r && ok.has(r.s) && typeof r.g === "string" && !isNaN(Date.parse(r.at)))
    .map((r) => ({ ...r, c: r.c === true, h: Number(r.h) || 0, ms: Date.parse(r.at) }));
}

/** Everything the parent report shows, from what the report action returned. span "week" (the 7 days weekOffset
    covers) or "all" (every answer returned). Pure: the page adds titles, pictures and links. */
export function parentReport({ answerRows, days, progress, now, weekOffset = 0, span = "week", childName = "" } = {}) {
  const nowMs = new Date(now).getTime();
  const rows = cleanRows(answerRows);
  const period = span === "all" ? { offset: 0, from: -Infinity, to: Infinity, all: true } : weekPeriod(nowMs, weekOffset);
  const inPeriod = (ms) => ms >= period.from && ms < period.to;
  const inRows = rows.filter((r) => inPeriod(r.ms));

  /* subjects */
  const subjects = REPORT_SUBJECTS.map((s) => {
    const mine = inRows.filter((r) => r.s === s.id);
    const t = { own: 0, hint: 0, miss: 0 };
    const sources = new Set(), games = new Set(), skills = new Map();
    for (const r of mine) {
      t[tallyKind(r)] += 1;
      sources.add(sourceOf(r)); games.add(r.g);
      const key = r.k ? "k:" + r.k : "g:" + r.g;
      const sk = skills.get(key) || { key, skill: r.k || null, game: r.g, own: 0, hint: 0, miss: 0, games: new Set(), days: new Set() };
      sk[tallyKind(r)] += 1; sk.games.add(r.g); sk.days.add(dayKey(r.ms));
      skills.set(key, sk);
    }
    const n = t.own + t.hint + t.miss;
    const status = subjectStatus({ ...t, sources: sources.size });
    return {
      id: s.id, label: s.label, n, ...t, status,
      pct: pctOf(t.own + t.hint, n), ownPct: pctOf(t.own, n),
      games: [...games],
      skills: [...skills.values()].map((k) => ({ ...k, n: k.own + k.hint + k.miss, games: [...k.games], days: [...k.days] }))
        .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1)),
      look: mine.filter((r) => !r.c || r.h > 0).sort((a, b) => b.ms - a.ms).slice(0, 12),
    };
  });

  const totals = subjects.reduce((acc, s) => ({ n: acc.n + s.n, own: acc.own + s.own, hint: acc.hint + s.hint, miss: acc.miss + s.miss }), { n: 0, own: 0, hint: 0, miss: 0 });
  totals.pct = pctOf(totals.own + totals.hint, totals.n);
  totals.ownPct = pctOf(totals.own, totals.n);
  totals.rated = subjects.filter((s) => s.status !== "none").length;

  /* worth practicing: skills with 2 or more answers not on their own, most first, then the ones seen on more days */
  const focus = subjects.flatMap((s) => s.skills.filter((k) => k.hint + k.miss >= 2).map((k) => ({
    subject: s.id, ...k, right: k.own + k.hint,
    examples: s.look.filter((r) => (r.k ? "k:" + r.k : "g:" + r.g) === k.key).slice(0, 3),
  }))).sort((a, b) => (b.hint + b.miss) - (a.hint + a.miss) || b.days.length - a.days.length || b.games.length - a.games.length).slice(0, 2);
  focus.forEach((f) => { const w = f.examples.find((r) => r.w); f.tip = w ? w.w : ""; });

  /* going well: skills of 3 or more answers, 85% or more on their own */
  const going = subjects.flatMap((s) => s.skills.filter((k) => k.n >= 3 && k.own / k.n >= 0.85).map((k) => ({ subject: s.id, ...k })))
    .sort((a, b) => b.n - a.n).slice(0, 3);

  /* the day log: days from the server (the family's dates), answers by their own date, finished items by last_at */
  const log = new Map();
  const put = (key, kind, item, o) => {
    if (!log.has(key)) log.set(key, new Map());
    const m = log.get(key), id = kind + ":" + item;
    const cur = m.get(id) || { kind, item, done: false, answers: 0, right: 0, own: 0, hint: 0, subjects: [] };
    if (o.done) cur.done = true;
    if (o.answers > cur.answers) { cur.answers = o.answers; cur.right = o.right || 0; }
    if (o.own !== undefined) { cur.own = o.own; cur.hint = o.hint; }
    if (o.subjects) cur.subjects = REPORT_SUBJECTS.map((s) => s.id).filter((id) => o.subjects.has(id));
    m.set(id, cur);
  };
  for (const d of days || []) if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.day)) put(d.day, d.kind, d.item_id, { done: d.done === true, answers: Number(d.answers) || 0, right: Number(d.right_count) || 0 });
  const byDayGame = new Map();
  for (const r of rows) {
    const key = dayKey(r.ms) + "|" + r.g;
    const t = byDayGame.get(key) || { answers: 0, right: 0, own: 0, hint: 0, subjects: new Set() };
    t.subjects.add(r.s);
    t.answers += 1; if (r.c) t.right += 1; if (r.c && r.h === 0) t.own += 1; if (r.c && r.h > 0) t.hint += 1;
    byDayGame.set(key, t);
  }
  for (const [key, t] of byDayGame) { const [day, g] = key.split("|"); put(day, "game", g, t); }
  for (const p of progress || []) if (p && p.last_at && !isNaN(Date.parse(p.last_at))) put(dayKey(p.last_at), p.kind, p.item_id, { done: true });
  const dayLog = new Map([...log].map(([k, m]) => [k, [...m.values()]]));

  /* engagement */
  const periodDays = [];
  if (!period.all) for (let i = 0; i < 7; i++) { const d = new Date(period.from); d.setDate(d.getDate() + i); periodDays.push(dayKey(d)); }
  const inSpan = (key) => period.all ? true : periodDays.includes(key);
  const activeKeys = [...dayLog.keys()].filter(inSpan);
  const items = new Map();
  for (const k of activeKeys) for (const it of dayLog.get(k)) { const id = it.kind + ":" + it.item; items.set(id, (items.get(id) || false) || it.done); }
  const engagement = {
    activeDays: activeKeys.length,
    week: periodDays.map((k) => ({ key: k, letter: "SMTWTFS"[new Date(k + "T12:00:00").getDay()], on: dayLog.has(k) })),
    completed: [...items.values()].filter(Boolean).length,
    inProgress: [...items.values()].filter((v) => !v).length,
    answered: totals.n,
  };

  /* progress over time: % on their own per week for the 8 weeks ending with the period, a gap when under 5 answers */
  const end = period.all ? weekPeriod(nowMs, 0) : period;
  const weeks = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) weeks.push(periodAt(nowMs, end.offset + i));
  const trend = {
    weeks: weeks.map((w) => ({ from: w.from, current: w.offset === 0 })),
    series: subjects.map((s) => ({
      id: s.id, label: s.label,
      points: weeks.map((w) => {
        const ws = rows.filter((r) => r.s === s.id && r.ms >= w.from && r.ms < w.to);
        const own = ws.filter((r) => r.c && r.h === 0).length;
        return { n: ws.length, own: ws.length >= MIN_EVIDENCE ? pctOf(own, ws.length) : null };
      }),
    })).filter((s) => s.points.some((p) => p.own !== null)),
  };

  /* the opening sentence */
  const lower = (s) => (s.id === "reading" ? "reading and writing" : s.label.toLowerCase());
  const and = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  const cons = subjects.filter((s) => s.status === "cons").map(lower);
  const rest = subjects.filter((s) => s.status === "prac" || s.status === "dev").map(lower);
  const who = childName || "Your child";
  let verdict;
  if (!totals.n) verdict = period.all ? "No questions answered yet." : "No questions answered this week.";
  else if (cons.length) verdict = (period.all ? "Strong so far in " : "A strong week in ") + and(cons) + (rest.length ? ", with " + and(rest) + " still in practice." : ".");
  else if (rest.length) verdict = who + " is practicing " + and(rest) + ".";
  else verdict = who + " has started answering questions. A subject is rated after " + MIN_EVIDENCE + " answers.";
  const q = (n) => n + (n === 1 ? " question" : " questions");
  const verdictSub = !totals.n
    ? "Ratings appear once " + who + " answers questions inside the games, books and activities."
    : period.all
      ? who + " has answered " + q(totals.n) + " built into games and books, getting " + totals.pct + "% of them right."
      : who + " was active on " + engagement.activeDays + (period.offset ? " of those 7 days" : " of the last 7 days") + " and answered " + q(totals.n) + " built into games and books, getting " + totals.pct + "% of them right.";

  return { period, span: period.all ? "all" : "week", subjects, totals, focus, going, engagement, dayLog, trend, verdict, verdictSub };
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
  ANSWER_SUBJECTS.forEach((id) => {
    const level = Object.prototype.hasOwnProperty.call(counted, id) ? subjectLevel(counted[id]) : null;
    if (level) levels[id] = level;
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

/* ---- Chike's quick questions after an episode or a "We made it!" activity (owner, 2026-11-24; drafts
   docs/mockups/tracker-quick-questions-*.png). Each item keeps its questions in its record as quiz: { subject, k1, g23,
   g45 }, 4 per grade band, each { q, choices, why } with the right choice first (scripts/item-quiz.mjs). The first time
   the child finishes it, Chike asks 2; the second time the other 2; after that 2 again just for fun, not counted. ---- */
export const ITEM_QUIZ_PER_TIME = 2;

/* ---- Chike reads the K-1 questions aloud in Heart's voice (owner, 2026-11-25), on the weekly quiz and the quick
   questions. Each thing said is a few pieces recorded with Kokoro (scripts/quiz-voice-lines.mjs, then
   scripts/record-lines.mjs into assets/voice/quiz/<key>.mp3) and played one after another: the choices come mixed, so
   the question, each choice and "or" are separate pieces. A piece with no recording: the device's own voice. ---- */
export const QUIZ_VOICE_DIR = "assets/voice/quiz/";
export const QUIZ_POP_SIZE = 3;   /* the weekly quiz asks 3 (kid-progress QUIZ_SIZE) */
/** The recording's name for a piece of text (FNV-1a, 32 bit, base 36, as the games' lineKey). */
export function quizLineKey(text) {
  let h = 0x811c9dc5;
  const t = String(text);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const sayPiece = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
/** A question read aloud: the question, then the choices with "or" between them. */
export function quizQuestionParts(question, choices) {
  const parts = [sayPiece(question)];
  (choices || []).forEach((c, i) => { if (i) parts.push("or"); parts.push(sayPiece(c)); });
  return parts.filter(Boolean);
}
/** What Chike says after an answer (the words on the card, progressQuizReplyHTML in index.html). */
export function quizReplyParts(st, choices) {
  if (!st) return [];
  if (st.error) return ["That didn’t go through. Tap your answer again."];
  const res = st.result;
  if (!res) return [];
  if (res.skipped) return ["Let’s skip that one. On to the next!"];
  const why = sayPiece(res.why);
  if (res.correct) return ["You got it!", why].filter(Boolean);
  const right = (choices || [])[res.answer];
  return ["Good try!", right != null ? "It’s " + sayPiece(right).replace(/[.!?]+$/, "") + "." : "", why].filter(Boolean);
}
/** The weekly quiz's last line: so many right of those answered. */
export function quizPopEndLine(right, answered) {
  return (answered ? "You got " + right + " of " + answered + " right. " : "") + "See you next week!";
}
/** The quick questions' last line. */
export function quizItemEndLine(right, n, practice) {
  return "You got " + right + " of " + n + " right. " + (practice ? "Great practice!" : "Great job!");
}
/** Every piece to record for the K-1 questions of these items' quizzes (right choice first, as stored), with the
    lines every quiz can say. Each once. */
export function quizVoiceLines(quizzes) {
  const lines = new Set(["or", "You got it!", "Good try!", "That didn’t go through. Tap your answer again.", "Let’s skip that one. On to the next!"]);
  for (let a = 0; a <= QUIZ_POP_SIZE; a++) for (let r = 0; r <= a; r++) lines.add(quizPopEndLine(r, a));
  for (let n = 1; n <= ITEM_QUIZ_PER_TIME; n++) for (let r = 0; r <= n; r++) { lines.add(quizItemEndLine(r, n, false)); lines.add(quizItemEndLine(r, n, true)); }
  for (const quiz of quizzes || []) for (const x of (quiz && Array.isArray(quiz.k1) ? quiz.k1 : [])) {
    if (!okItemQuestion(x)) continue;
    quizQuestionParts(x.q, x.choices).forEach((p) => lines.add(p));
    quizReplyParts({ result: { correct: true, why: x.why } }, x.choices).forEach((p) => lines.add(p));
    quizReplyParts({ result: { correct: false, answer: 0, why: x.why } }, x.choices).forEach((p) => lines.add(p));
  }
  return [...lines];
}
/** The band a grade's questions come from: K and 1st k1, 2nd and 3rd g23, 4th to 6th g45. Null for no grade. */
export function quizLevelFor(grade) {
  const g = childGradeFrom(grade);
  return g === null ? null : g <= 1 ? "k1" : g <= 3 ? "g23" : "g45";
}
/** The game an item's answers are kept under ("episode-<id>", "activity-<id>"), or "" when it can't be one. */
export function itemQuizGame(kind, id) {
  const g = String(kind) + "-" + String(id == null ? "" : id);
  return (kind === "episode" || kind === "activity") && /^[a-z0-9-]{1,40}$/.test(g) ? g : "";
}
/** The subject an item's answers count toward, or "". */
export function itemQuizSubject(quiz) {
  return quiz && ANSWER_SUBJECTS.includes(quiz.subject) ? quiz.subject : "";
}
const okItemQuestion = (x) => x && typeof x.q === "string" && x.q.trim() && Array.isArray(x.choices)
  && x.choices.length >= 2 && x.choices.every((c) => typeof c === "string" && c.trim());
/** The questions to ask now: the first 2 at this level not yet answered (qid "<level>-<n>", n from 1), counted; or, once
    all are answered, 2 of them at random just for fun (practice). Each comes with its choices mixed, the right one's
    place (answer) and words (right), the why and the subject. Nothing to ask: an empty list. */
export function itemQuizPick(quiz, level, answered, rand) {
  const subject = itemQuizSubject(quiz);
  const list = subject && Array.isArray(quiz[level]) ? quiz[level] : [];
  const done = new Set(answered || []);
  const all = list.map((x, i) => ({ x, qid: level + "-" + (i + 1) })).filter((o) => okItemQuestion(o.x));
  let pick = all.filter((o) => !done.has(o.qid)).slice(0, ITEM_QUIZ_PER_TIME);
  const practice = !pick.length && all.length > 0;
  if (practice) {
    const pool = all.slice();
    pick = [];
    while (pick.length < ITEM_QUIZ_PER_TIME && pool.length) pick.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return {
    practice,
    questions: pick.map(({ x, qid }) => {
      const order = x.choices.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const choices = order.map((i) => x.choices[i]);
      const answer = order.indexOf(0);
      return { qid, question: x.q, choices, answer, right: choices[answer], why: typeof x.why === "string" ? x.why : "", subject };
    }),
  };
}
