// Chike's Creative Space - the admin Copilot: the parts that decide things.
//
// The Copilot is a chat panel on every admin page. What it can do is deliberately narrow and
// deterministic: it reads what the admin pasted or typed, works out which job that is (no model
// needed for that), asks the person's own Ollama only to WRITE (descriptions, rules, drafts), and
// turns the answer into a proposal the admin reviews. Nothing is saved until they approve it.
//
// This file has no DOM, database or network dependency so test/copilot.test.js runs exactly what
// the live admin runs. The chat transport and the site knowledge are in writer.js.

import { siteDigest, relevantItems, systemPrompt, parseJson, cleanText } from "./writer.js";

/* ---------------- what did the admin just give us? ---------------- */

const YT_URL = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s"'<>]*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})[^\s"'<>]*/gi;

/** Every YouTube video in the text, once each, in the order given. */
export function findYoutubeIds(text) {
  const out = [];
  String(text || "").replace(YT_URL, (_m, id) => { if (out.indexOf(id) < 0) out.push(id); return _m; });
  return out;
}

/** Game code pasted into the chat: a fenced block, a whole page, or a bare script. "" if it is not code. */
export function extractHtml(text) {
  const t = String(text || "");
  const fence = t.match(/```(?:html|HTML)?\s*\n([\s\S]*?)```/);
  const body = (fence ? fence[1] : t).trim();
  const start = body.search(/<!doctype html|<html[\s>]/i);
  if (start >= 0) {
    const endTag = body.toLowerCase().lastIndexOf("</html>");
    return body.slice(start, endTag >= 0 ? endTag + 7 : undefined).trim();
  }
  const tags = (body.match(/<\/?[a-z][^>]*>/gi) || []).length;
  if (body.length > 400 && tags >= 6 && /<script|<canvas|<body|<div/i.test(body)) return body;
  return "";
}

const PORTAL_RE = /\b(?:newsletter|members?(?:['\u2019]s?)?|subscribers?(?:['\u2019]s?)?) (?:archive|portal|corner|area)\b|\b(?:archive|portal) (?:entry|content|post)\b|\bsubscriber[- ]only\b|\bmembers[- ]only\b|\bexclusive (?:content|story|post)\b/i;
const UPDATE_VERBS = "update|change|rewrite|revise|improve|shorten|lengthen|expand|simplify|proofread|fix|edit|polish|reword|rephrase|tweak|refresh|tighten|soften|brighten";
const UPDATE_RE = new RegExp("\\b(?:" + UPDATE_VERBS + ")\\b", "i");
const REVISE_START = new RegExp("^\\s*(?:please\\s+)?(?:" + UPDATE_VERBS + "|make (?:this|it|these)|can you (?:" + UPDATE_VERBS + "))\\b", "i");

/** Which site item (if any) the message is talking about: the longest title it quotes. */
export function findItemInText(items, text) {
  const t = String(text || "").toLowerCase();
  let best = null;
  (items || []).forEach((it) => {
    const title = String(it.title || "").toLowerCase();
    if (title.length >= 4 && it.col && it.id && t.indexOf(title) >= 0 && (!best || title.length > best.title.length)) best = { item: it, title };
  });
  return best ? best.item : null;
}

/** The kind of Subscriber’s Portal entry a request asks for, from its own words: "lesson" for an AI
    lesson, "activity" for something to make or do, "article" for a story. null when it does not say,
    so a pasted video, game or book can decide instead. */
export function portalLayoutFor(text) {
  const t = String(text || "").replace(/\b(?:subscriber|member|newsletter)s?['’]?s? (?:portal|archive|corner|area)\b/gi, " ");
  const AI = "(?:AI|A\\.I\\.|artificial intelligence|Gemini|ChatGPT|chat ?bots?|prompts?|machine learning)";
  if (new RegExp("\\b" + AI + "[- ]lessons?\\b|\\b(?:lessons?|teach|teaches|teaching|learn|learning)\\b[^.?\\n]{0,50}\\b" + AI + "\\b|\\b(?:use|uses|using|with)\\s+" + AI + "\\b", "i").test(t)) return "lesson";
  if (/\bactivit(?:y|ies)\b|\bcrafts?\b|\bDIY\b|\bhands[- ]on\b|\bprintables?\b|\bworksheets?\b|\bsomething (?:to|kids can) (?:make|build|do)\b/i.test(t)) return "activity";
  if (/\bstor(?:y|ies)\b/i.test(t)) return "article";
  return null;
}

/** The first thing the Copilot does with a message: decide which job it is. `items` (the site's
    contents) lets it recognize "make the Doodle Dash summary friendlier". */
export function chooseIntent(text, expecting, items) {
  const t = String(text || "");
  const html = extractHtml(t);
  if (html) return { kind: "game", html };
  const ids = findYoutubeIds(t);
  /* content for the members-only Subscriber’s Portal: it may name a video link or something already on the site */
  /* an AI lesson lives only in the portal, so asking for one is a portal job even when the portal is not named */
  const aiLesson = !/\?\s*$/.test(t) && !/\b(?:newsletter|email)\b/i.test(t) && /\b(?:write|draft|make|create|add|put together|prepare|build|plan)\b[^.?\n]{0,40}\b(?:AI|A\.I\.)[- ]lessons?\b/i.test(t);
  if (expecting === "portal" || PORTAL_RE.test(t) || aiLesson) return { kind: "portal", request: t, layout: portalLayoutFor(t), youtubeIds: ids.slice(0, 1), item: items ? findItemInText(items, t) : null };
  if (ids.length) return { kind: "youtube", ids: ids.slice(0, 5), extra: ids.length - Math.min(ids.length, 5) };
  if (/\b(?:alt text|alt tags?|image tags?|image descriptions?|picture descriptions?|describe (?:(?:all|the|my|our) )*(?:images|pictures|photos))\b/i.test(t)) return { kind: "alt" };
  if (/\b(?:suggest|add|write|fill in|generate|missing|need)\b[^.?\n]{0,30}\btags\b|\btags (?:for|are missing)\b/i.test(t)) return { kind: "tags" };
  if (/\bwhat needs (?:attention|fixing|work)\b|\bneeds attention\b|\bcontent (?:problems|issues|health)\b|\bwhat(?:'s| is) (?:wrong|broken)\b/i.test(t)) return { kind: "attention" };
  const found = items ? findItemInText(items, t) : null;
  const FIX_RE = /\b(?:fix|address|resolve|sort out|clean up|repair|deal with|help me (?:fix|with))\b[^.?\n]{0,40}\b(?:issues?|problems?|errors?|warnings?|what(?:'s| is) (?:wrong|missing)|missing|attention)\b|\bhelp me fix\b/i;
  if (FIX_RE.test(t) && !/\?\s*$/.test(t)) return found ? { kind: "fix", item: found } : { kind: "fixall" };
  const MAKE_RE = /\bmake\b[^.?\n]{0,70}\b(?:friendl|warm|short|long|simpl|clear|better|fun|playful|formal|casual|excit|gentle|kind|punchi|easier|brighter|sound)\w*/i;
  if (found && !/\?\s*$/.test(t) && (UPDATE_RE.test(t) || MAKE_RE.test(t)) && !/\b(?:newsletter|email)\b/i.test(t)) return { kind: "update", item: found, request: t };
  const lines = t.split("\n");
  if (REVISE_START.test(t) && (t.length > 90 || lines.length > 2 || /["\u201C\u201D]/.test(t))) return { kind: "revise", request: t };
  const asking = /\?\s*$|^\s*(?:what|which|who|how|why|when|where|should|could|can|do|does|is|are)\b/i.test(t);
  if (expecting === "newsletter" || (!asking && /\b(?:write|draft|compose|create|make|prepare|start|put together|send)\b[^.?\n]{0,60}\b(?:newsletter|email)\b|\bnewsletter (?:about|on|announcing|telling|introducing)\b/i.test(t))) return { kind: "newsletter", request: t };
  if (expecting === "story" || (!asking && /\b(?:write|draft|make|create|tell|compose)\b[^.\n]{0,40}\b(?:story|stories|picture book)\b|\bstory (?:about|where|of)\b/i.test(t))) return { kind: "story", request: t };
  return { kind: "chat" };
}

/* ---------------- editing what is already on the site ---------------- */

/** The text boxes the Copilot may rewrite, by collection. The first of each is the usual one. `words`
    are what someone might call it. Titles and addresses are left alone: other pages link to them. */
export const TEXT_FIELDS = {
  games: [{ path: "summary", label: "summary", words: ["summary", "description", "blurb", "listing", "about"] }, { path: "rules", label: "rules", type: "lines", words: ["rules", "instructions", "how to play"] }],
  videos: [{ path: "description", label: "description", words: ["description", "summary", "blurb", "about"] }, { path: "learning", label: "educational discovery", words: ["learning", "discover"] }, { path: "moral", label: "theme", words: ["moral", "theme"] }],
  stories: [{ path: "blurb", label: "short description", words: ["blurb", "description", "summary"] }, { path: "opening", label: "opening line", words: ["opening", "first line"] }, { path: "learning", label: "discovery", words: ["learning", "discovery"] }],
  activities: [{ path: "summary", label: "summary", words: ["summary", "description", "blurb"] }, { path: "learning.text", label: "discovery text", words: ["learning", "discovery"] }, { path: "discussionPrompt", label: "discussion prompt", words: ["discussion", "question"] }, { path: "variation", label: "variation", words: ["variation"] }],
  articles: [{ path: "blurb", label: "short description", words: ["blurb", "description", "summary"] }],
  characters: [{ path: "tagline", label: "tagline", words: ["tagline", "description"] }, { path: "storyValue", label: "story value", words: ["story value", "value"] }],
  amazonProducts: [{ path: "why", label: "reason we recommend it", words: ["why", "reason", "description", "blurb"] }],
  products: [{ path: "blurb", label: "description", words: ["blurb", "description"] }],
  collections: [{ path: "blurb", label: "description", words: ["blurb", "description"] }],
  portalEntries: [{ path: "description", label: "short description", words: ["description", "summary", "blurb"] }, { path: "body", label: "text", type: "richtext", words: ["text", "body", "story", "write-up"] }],
  announcements: [{ path: "body", label: "message", type: "richtext", words: ["message", "body", "text"] }, { path: "heading", label: "heading", words: ["heading"] }],
  pages: [{ path: "intro", label: "intro", type: "richtext", words: ["intro", "introduction"] }, { path: "heading", label: "heading", words: ["heading"] }],
};

/** Which box of that record the request is about. */
export function pickField(col, text) {
  const fields = TEXT_FIELDS[col] || [];
  const t = String(text || "").toLowerCase();
  // the more specific box names first, so "opening line" is not read as "description"
  const hit = fields.slice().sort((a, b) => Math.max(...b.words.map((w) => w.length)) - Math.max(...a.words.map((w) => w.length)))
    .find((f) => f.words.some((w) => new RegExp("\\b" + w.replace(/ /g, "\\s+") + "\\b").test(t)));
  return hit || fields[0] || null;
}

export function updateMessages(ctx) {
  const it = ctx.item || {};
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, it.title, ctx.who) },
    { role: "user", content: "Revise one text box on the site.\n" + it.kind + ": " + it.title + "\nBox: " + ctx.field.label
      + "\nCurrent text:\n" + (ctx.before || "(empty)")
      + "\n\nThe owner asks: " + ctx.request
      + "\nKeep the facts unless they ask you to change them. Keep a similar length unless they ask otherwise."
      + (ctx.field.type === "lines" ? " Reply with one item per line." : " Reply with only the new text.") },
  ];
}

export function reviseMessages(ctx) {
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, ctx.request, ctx.who) },
    { role: "user", content: "The owner gives you some text and may include an instruction (like shorten it, or make it warmer). Follow the instruction. If there is none, fix mistakes and make it clearer and warmer. Keep the facts. Reply with only the revised text.\n\n" + ctx.request },
  ];
}

/* ---- picture descriptions (alt text) ---- */

/** Every place a picture is attached to a record: where the picture is, and where its description goes. */
export const ALT_FIELDS = [
  { col: "activities", path: "image" }, { col: "videos", path: "thumb" }, { col: "stories", path: "image" }, { col: "characters", path: "image" },
  { col: "games", path: "cover" }, { col: "articles", path: "image" }, { col: "announcements", path: "image" }, { col: "pages", path: "image" },
  { col: "products", path: "image" }, { col: "portalEntries", path: "cover" },
];
const COL_LABEL = { activities: "Activity", videos: "Episode", stories: "Story", characters: "Character", games: "Game", articles: "Article", announcements: "Announcement", pages: "Page", products: "Printable", portalEntries: "Archive entry", mediaAssets: "Media library", amazonProducts: "Shop book", collections: "Collection" };
export const colLabel = (c) => COL_LABEL[c] || c;

const getIn = (o, path) => String(path).split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

/** Pictures that have no description, across the whole site. Archived records are left out. */
export function altTargets(data) {
  const d = data || {};
  const out = [];
  ALT_FIELDS.forEach((f) => (d[f.col] || []).forEach((r) => {
    if (!r || r.status === "archived") return;
    const src = getIn(r, f.path + ".src");
    if (!blank(src) && blank(getIn(r, f.path + ".alt"))) out.push({ col: f.col, id: r.id, srcPath: f.path + ".src", altPath: f.path + ".alt", src: String(src), title: r.title || r.name || r.id, status: r.status, context: r.summary || r.blurb || r.description || r.tagline || "" });
  }));
  (d.mediaAssets || []).forEach((r) => {
    if (!r || r.status === "archived" || blank(r.path) || !blank(r.alt)) return;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(r.path) || r.kind === "video" || r.kind === "printable") return;
    out.push({ col: "mediaAssets", id: r.id, srcPath: "path", altPath: "alt", src: String(r.path), title: r.usage || r.path.split("/").pop(), status: r.status, context: r.usage || "" });
  });
  return out;
}

export function altMessages(ctx, seesPicture) {
  const t = ctx.target || {};
  return [
    { role: "system", content: "You write picture descriptions (alt text) for a children's creativity website, for people who cannot see the picture. American English." },
    Object.assign({ role: "user", content: (seesPicture ? "Look at this picture. " : "You cannot see the picture, so write a careful description from what is known. ")
      + "It appears on: " + colLabel(t.col) + " \"" + t.title + "\"." + (t.context ? " About that page: " + String(t.context).slice(0, 300) : "")
      + "\nWrite one plain sentence, under 22 words, saying what the picture shows. Do not start with \"image of\" or \"picture of\". Do not guess names unless the page says them. Reply with only the sentence." },
      seesPicture && ctx.image ? { images: [ctx.image] } : {}),
  ];
}

/** One clean sentence, whatever the model wrapped it in. */
export function parseAlt(text) {
  const unquote = (x) => x.replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, "").trim();
  let t = unquote(cleanText(text).split("\n")[0]);
  t = unquote(t.replace(/^alt(?: text)?\s*[:\-]\s*/i, ""));
  t = t.replace(/^(?:an? )?(?:image|picture|photo|photograph|illustration) (?:of|showing|that shows|depicting)\s+/i, "").trim();
  if (!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > 170) { t = t.slice(0, 170); t = t.slice(0, t.lastIndexOf(" ")).trim(); }
  return /[.!?]$/.test(t) ? t : t + ".";
}

/* ---- fixing what blocks a page from being published ---- */

/** The missing pieces the Copilot may write, by collection, keyed by the field the publishing check names.
    Anything not listed here (a video that is not marked Live, a link to something deleted...) is a decision
    for a person, and is handed back to them. */
const T = (label, hint) => ({ label, type: "text", hint });
const L = (label, hint) => ({ label, type: "lines", hint });
export const FIXABLE = {
  activities: { steps: L("numbered steps", "at least three short steps, one per item"), materialsDetail: L("what you need", "one thing per item"), safetyNotes: L("safety notes", "at least one, for a grown-up to watch for"),
    "learning.title": T("discovery headline", "a short headline for the fact this teaches"), "learning.text": T("discovery text", "a sentence or two explaining that fact"),
    discussionPrompt: T("discussion prompt", "one question a grown-up can ask afterward"), variation: T("variation", "one way to make it easier or harder"), summary: T("summary", "one or two sentences"),
    timeMinutes: { label: "minutes it takes", type: "number", hint: "a number of minutes, more than zero" } },
  videos: { description: T("description", "one or two sentences for the episode page"), creation: T("the creation", "a one-line note"), adventure: T("the adventure", "a one-line note"), learning: T("educational discovery", "one sentence"), moral: T("theme", "one sentence") },
  stories: { blurb: T("short description", "one or two sentences"), opening: T("opening line", "the first line of the story"), learning: T("discovery", "one sentence on what it teaches") },
  games: { summary: T("summary", "one or two sentences"), rules: L("rules", "at least two short instructions a player follows") },
  characters: { storyValue: T("story value", "the value or theme their stories explore"), tagline: T("tagline", "a short line that captures them"), strength: T("creative strength", "a few words") },
  articles: { blurb: T("short description", "one or two sentences"), body: L("paragraphs", "at least two paragraphs, one per item") },
  products: { blurb: T("description", "one or two sentences"), includes: L("what is included", "at least one item") },
  amazonProducts: { why: T("reason we recommend it", "one sentence") },
  collections: { blurb: T("description", "one or two sentences") },
  portalEntries: { description: T("short description", "one or two sentences") },
};

/** Sorts a record's blocking problems into: things to write, pictures to describe, and things only a person can settle. */
export function planFix(col, rec, errors) {
  const spec = FIXABLE[col] || {};
  const fillable = [], alts = [], manual = [];
  const seen = new Set();
  (errors || []).forEach((e) => {
    const f = String(e.field || "");
    if (seen.has(f)) return;
    seen.add(f);
    if (spec[f]) fillable.push(Object.assign({ path: f, message: e.message }, spec[f]));
    else if (/(^|\.)alt$/.test(f) && !blank(getIn(rec, f.replace(/alt$/, "src")))) alts.push({ altPath: f, srcPath: f.replace(/alt$/, "src"), src: String(getIn(rec, f.replace(/alt$/, "src"))), message: e.message });
    else manual.push({ field: f, message: e.message });
  });
  return { fillable, alts, manual };
}

/** Fixes that need no writing: one obvious value to put in a box. Each is shown to the person first;
    the ones that change what is published are marked `risky` and start unticked, so choosing them is a decision. */
export function quickFixes(col, rec, errors) {
  const rows = [], covered = [], advice = {};
  const has = (f) => (errors || []).some((e) => e.field === f);
  const r = rec || {};
  if (col === "videos" && has("videoState") && !/^[A-Za-z0-9_-]{11}$/.test(String(r.youtubeId || ""))) {
    advice.videoState = "This episode has no YouTube video yet. Add its link (the Generate from YouTube button reads it for you), then set Video state to Live.";
  }
  if (col === "videos" && has("videoState") && /^[A-Za-z0-9_-]{11}$/.test(String(r.youtubeId || ""))) {
    rows.push({ path: "videoState", label: "video state", ftype: "select", value: "live", risky: true, note: "The YouTube video id is set, so this episode can be marked Live. Only tick this if it is ready to air." });
    covered.push("videoState");
  }
  if (col === "videos" && has("youtubeId")) {
    const ids = findYoutubeIds(r.youtubeUrl);
    if (ids.length) { rows.push({ path: "youtubeId", label: "YouTube video id", ftype: "line", value: ids[0], note: "Taken from the watch link on this page." }); covered.push("youtubeId"); }
  }
  if (has("ageMin") && Number(r.ageMin) > Number(r.ageMax)) {
    rows.push({ path: "ageMin", label: "age from", ftype: "number", value: String(r.ageMax), note: "The two ages were the wrong way round, so they are swapped." },
      { path: "ageMax", label: "age to", ftype: "number", value: String(r.ageMin), note: "" });
    covered.push("ageMin");
  }
  return { rows, covered, advice };
}

/** The text already on a record, as plain facts the model can build on. */
export function recordFacts(rec) {
  const out = [];
  const skip = /^(id|slug|status|createdAt|updatedAt|at|order|featured|path|youtubeId|youtubeUrl|icon|p1|p2|kind|videoState|pages|html|hasFile)$/;
  Object.keys(rec || {}).forEach((k) => {
    if (skip.test(k)) return;
    const v = rec[k];
    if (typeof v === "string" && v.trim()) out.push(k + ": " + clipText(v.replace(/<[^>]+>/g, " "), 300));
    else if (Array.isArray(v) && v.length && v.every((x) => typeof x === "string")) out.push(k + ": " + clipText(v.join("; "), 300));
    else if (v && typeof v === "object" && !Array.isArray(v) && k !== "image" && k !== "thumb" && k !== "cover") {
      Object.keys(v).forEach((kk) => { if (typeof v[kk] === "string" && v[kk].trim()) out.push(k + "." + kk + ": " + clipText(v[kk], 200)); });
    }
  });
  return out.slice(0, 18).join("\n");
}

export function fixMessages(ctx) {
  const it = ctx.item || {};
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, it.title, ctx.who) },
    { role: "user", content: "Some parts of this " + (it.kind || "page") + " are still empty: \"" + it.title + "\".\nWhat is already on it:\n" + (ctx.facts || "(very little)") + (ctx.idea ? "\nThe owner says: " + ctx.idea : "")
      + "\n\nWrite the missing parts, using only what is already there and what the site list supports. If something cannot be known, write a short [placeholder] for the owner to fill.\nMissing:\n"
      + (ctx.missing || []).map((f) => "- " + f.path + " (" + f.label + "; " + f.hint + ")" + (f.type === "lines" ? " - an array of strings" : f.type === "number" ? " - a number" : " - a string")).join("\n")
      + "\nReturn one JSON object whose keys are exactly: " + (ctx.missing || []).map((f) => f.path).join(", ") + "." + JSON_ONLY },
  ];
}

/** Reads the model's answer, keeping only the pieces that were asked for, in the right shape. */
export function parseFix(text, missing) {
  const j = parseJson(text);
  if (!j) return {};
  const out = {};
  (missing || []).forEach((f) => {
    let v = j[f.path];
    if (v === undefined || v === null) return;
    if (f.type === "lines") {
      v = (Array.isArray(v) ? v : String(v).split("\n")).map((x) => String(x).replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim()).filter(Boolean);
      if (v.length) out[f.path] = v;
    } else if (f.type === "number") {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n > 0) out[f.path] = n;
    } else {
      v = String(v).replace(/\s+/g, " ").trim();
      if (v) out[f.path] = v;
    }
  });
  return out;
}

/* ---- tags ---- */

export function tagTargets(data) {
  return ((data || {}).activities || []).filter((r) => r && r.status !== "archived" && !(r.tags || []).length)
    .map((r) => ({ col: "activities", id: r.id, title: r.title, status: r.status, context: r.summary || "", src: r.image && r.image.src || "" }));
}

/** The tags already in use, most used first, so new ones reuse them. */
export function existingTags(data, n) {
  const count = {};
  ((data || {}).activities || []).forEach((r) => (r.tags || []).forEach((t) => { const k = String(t).toLowerCase().trim(); if (k) count[k] = (count[k] || 0) + 1; }));
  return Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, n || 30);
}

export function tagMessages(ctx) {
  const t = ctx.target || {};
  return [
    { role: "system", content: "You choose search tags for a children's activity website. Tags are short, lowercase, one or two words." },
    { role: "user", content: "Activity: " + t.title + (t.context ? "\nAbout it: " + String(t.context).slice(0, 400) : "")
      + "\nTags already used on the site (prefer these when they fit): " + (ctx.existing || []).join(", ")
      + "\nChoose 4 to 6 tags. Return JSON like {\"tags\": [\"...\"]}." + JSON_ONLY },
  ];
}

export function parseTags(text) {
  const j = parseJson(text);
  const list = j && (j.tags || j.keywords);
  const arr = Array.isArray(list) ? list : String(list || "").split(",");
  return [...new Set(arr.map((x) => String(x).toLowerCase().replace(/[^a-z0-9 \-]/g, "").replace(/\s+/g, " ").trim()).filter((x) => x && x.length <= 24))].slice(0, 6);
}

/* ---------------- pasted game code ---------------- */

export const MAX_GAME_BYTES = 2.5 * 1024 * 1024;

const byteLength = (s) => new TextEncoder().encode(String(s || "")).length;

/** A quick look at pasted game code: its name, size, and anything that will not work when it is
    stored on its own (files it expects to sit next to it, saving to the browser, size). */
export function analyzeGameHtml(html) {
  const h = String(html || "");
  const bytes = byteLength(h);
  const warnings = [];
  const warn = (level, text) => warnings.push({ level, text });
  const title = ((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  if (bytes > MAX_GAME_BYTES) warn("error", "This is " + (bytes / 1048576).toFixed(1) + " MB, over the " + (MAX_GAME_BYTES / 1048576).toFixed(1) + " MB limit. Pictures and sounds are best added as links.");
  if (!/<script[\s>]/i.test(h)) warn("warn", "There is no script in this, so it will show a page but nothing will move.");

  const rel = new Set();
  const external = new Set();
  const attr = /\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')\s]+)["']?\s*\)/gi;
  let m;
  while ((m = attr.exec(h))) {
    const u = (m[1] || m[2] || "").trim();
    if (!u || /^(#|data:|blob:|javascript:|mailto:|about:)/i.test(u)) continue;
    if (/^https?:\/\//i.test(u)) { try { external.add(new URL(u).hostname); } catch (_e) { /* skip */ } }
    else if (/\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|js|css|json|woff2?|ttf)(\?|#|$)/i.test(u)) rel.add(u);
  }
  if (rel.size) warn("warn", "It refers to files that will not be there: " + [...rel].slice(0, 4).join(", ") + (rel.size > 4 ? " and " + (rel.size - 4) + " more" : "") + ". Use full https:// links, or put them inside the code.");
  const hosts = [...external].filter((x) => !/(^|\.)(googleapis|gstatic)\.com$/i.test(x));
  if (hosts.length) warn("info", "It loads things from " + hosts.slice(0, 3).join(", ") + ", so it needs an internet connection to run.");
  const usesStorage = /\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/.test(h);
  if (usesStorage) warn("info", "It tries to save to the browser. Games shown this way run in a sealed box, so scores and settings will not be remembered.");
  if (!/<meta[^>]+viewport/i.test(h)) warn("info", "It has no phone sizing line (viewport), so it may look tiny on a phone.");
  return { title, bytes, kb: Math.round(bytes / 1024), warnings, usesStorage, blocked: warnings.some((w) => w.level === "error") };
}

/** What the model is shown of a game: the words on the page and the start of the code. */
export function gameDigest(html) {
  const h = String(html || "");
  const visible = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const scripts = (h.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []).map((s) => s.replace(/<\/?script[^>]*>/gi, "")).join("\n").replace(/\s+/g, " ").trim();
  const comments = (h.match(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g) || []).join(" ").replace(/\s+/g, " ").slice(0, 600);
  return { visible: visible.slice(0, 1400), code: scripts.slice(0, 3200), comments };
}

export function gameSlug(title) {
  return String(title || "game").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "game";
}

/* ---------------- prompts ---------------- */

const COPILOT_ROLE = "You are the Copilot for the admin of this site. You help the owner add and improve content: episodes, games, stories and newsletters. Be brief and practical. When you are not sure, say so.";
const JSON_ONLY = " Reply with one JSON object only and nothing else.";

/** The standing brief: who you are, the voice, and the whole site. `where` says which admin screen they are on. */
export function copilotSystem(brand, items, where, query, who) {
  const base = systemPrompt(brand, siteDigest(items, 4800), relevantItems(items, query || "", 4), who);
  return COPILOT_ROLE + (where ? "\nThe admin is currently on: " + where + "." : "") + "\n\n" + base;
}

const clipText = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

/** A normal back-and-forth, keeping only the recent turns. */
export function chatMessages(history, ctx) {
  const recent = (history || []).filter((m) => (m.role === "user" || m.role === "assistant") && m.text).slice(-8);
  const last = recent.filter((m) => m.role === "user").slice(-1)[0];
  return [{ role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, last && last.text, ctx.who) }]
    .concat(recent.map((m) => ({ role: m.role, content: clipText(m.text, 1500) })));
}

export function episodeMessages(ctx) {
  const v = ctx.video || {};
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, v.title, ctx.who) },
    { role: "user", content: "A new YouTube video is being added as an episode page.\nVideo title: " + v.title + (v.author ? "\nChannel: " + v.author : "")
      + (ctx.notes ? "\nThe owner says: " + ctx.notes : "")
      + "\nCast available on the site: " + (ctx.cast || []).join(", ")
      + "\nWrite the episode page text. Only describe what the title and the owner's notes support; leave out anything you cannot know."
      + "\nReturn JSON with keys: description (one or two sentences for the episode page), learning (one sentence: what a child discovers), moral (one sentence: the social-emotional theme), cast (an array of names from the cast list who are likely in it, or an empty array)." + JSON_ONLY },
  ];
}

export function parseEpisode(text, castList) {
  const j = parseJson(text);
  if (!j) return null;
  const str = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const known = (castList || []).map((c) => ({ slug: c.slug, name: String(c.name || "").toLowerCase() }));
  const cast = (Array.isArray(j.cast) ? j.cast : []).map((n) => known.find((k) => k.name === String(n).trim().toLowerCase())).filter(Boolean).map((k) => k.slug);
  const out = { description: str(j.description), learning: str(j.learning), moral: str(j.moral), cast: [...new Set(cast)] };
  return out.description || out.learning || out.moral ? out : null;
}

export function gameMessages(ctx) {
  const a = ctx.analysis || {}, d = ctx.digest || {};
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, a.title, ctx.who) },
    { role: "user", content: "A new browser game is being added to the Play page. Here is what the game's code shows.\nPage title: " + (a.title || "(none)")
      + "\nWords shown on the page: " + (d.visible || "(none)") + (d.comments ? "\nComments in the code: " + d.comments : "")
      + "\nStart of the code: " + (d.code || "(none)")
      + "\nWrite the game's listing for kids and parents. Only say what the code supports; do not invent features."
      + "\nReturn JSON with keys: title (the game's name), summary (one or two sentences), rules (an array of 3 to 5 short instructions a player follows), players (like \"1\" or \"1 or 2\"), minutes (a number), ageMin (a number), ageMax (a number)." + JSON_ONLY },
  ];
}

export function parseGame(text) {
  const j = parseJson(text);
  if (!j) return null;
  const str = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const rules = (Array.isArray(j.rules) ? j.rules : String(j.rules || "").split(/\n+/)).map(str).filter(Boolean).slice(0, 6);
  const out = { title: str(j.title), summary: str(j.summary), rules, players: str(j.players) || "1", minutes: num(j.minutes, 1, 120, 10), ageMin: num(j.ageMin, 2, 17, 5), ageMax: num(j.ageMax, 3, 18, 11) };
  if (out.ageMax < out.ageMin) out.ageMax = out.ageMin;
  return out.title || out.summary ? out : null;
}

const KIND_MEANS = { Game: "a game kids play on the site (not a video)", Episode: "a video episode kids watch", "Book or story": "a picture book kids read on the site", Activity: "a hands-on activity to do away from the screen", "Archive entry": "an entry in the Subscriber’s Portal" };

/** What the email may say: the site's own words about each thing the request names (by title or by its page link), nothing else. */
export function newsletterFacts(items, request) {
  const text = String(request || "");
  const paths = (text.match(/\/(?:play|watch|stories|activity|characters|newsletter|article|collection)\/[A-Za-z0-9_-]+/g) || []);
  const byLink = (items || []).filter((it) => it.path && paths.indexOf(it.path) >= 0);
  const picked = byLink.length ? byLink : relevantItems(items, text.replace(/https?:\/\/\S+/g, " "), 3);
  return picked.map((it) => "- " + it.kind + " (" + (KIND_MEANS[it.kind] || it.kind) + "): " + it.title + (it.path ? " [" + it.path + "]" : "") + (it.text ? ". " + clipText(it.text, 400) : "") + (it.facts ? " How it works: " + clipText(it.facts, 500) : "")).join("\n");
}

export function newsletterMessages(ctx) {
  const facts = newsletterFacts(ctx.items, ctx.request);
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, ctx.request, ctx.who) },
    { role: "user", content: "Write a newsletter email for our mailing list.\nThe owner asks: " + ctx.request
      + "\nFACTS YOU MAY USE (from the site itself):\n" + (facts || "(none found; use only what the owner wrote and leave a [placeholder] for anything else)")
      + "\nSay only what those facts and the owner's words support. Do not say who guides it, how it was made, whether it is new or back, how long it takes or that there is a timer or a prize unless a fact says so. A game is played, never watched; an episode is watched, never played. You cannot open links, so rely on the facts above."
      + "\nWhen you mention something from the site, use its page address from the site list for the button. If nothing fits, use /."
      + "\nReturn JSON with keys: subject (under 8 words), preview (one line), label (2 to 4 words in capitals, like NEW EPISODE), headline (under 9 words), paragraphs (an array of 2 to 4 short paragraphs), buttonLabel (2 to 3 words, a gentle invitation), buttonPath (a page address from the site list)." + JSON_ONLY },
  ];
}

export function parseNewsletter(text, validPaths) {
  const j = parseJson(text);
  if (!j) return null;
  const str = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const paragraphs = (Array.isArray(j.paragraphs) ? j.paragraphs : String(j.paragraphs || j.body || "").split(/\n\s*\n/)).map(str).filter(Boolean).slice(0, 5);
  const path = str(j.buttonPath);
  const ok = path === "/" || (validPaths || []).indexOf(path) >= 0;
  const out = { subject: str(j.subject), preview: str(j.preview), label: str(j.label).toUpperCase(), headline: str(j.headline), paragraphs, buttonLabel: str(j.buttonLabel) || "Take a look", buttonPath: ok ? path : "/" };
  return out.subject && paragraphs.length ? out : null;
}

export function storyMessages(ctx) {
  return [
    { role: "system", content: copilotSystem(ctx.brand, ctx.items, ctx.where, ctx.request, ctx.who) },
    { role: "user", content: "Write a short picture-book story for children.\nThe owner asks: " + ctx.request
      + "\nCharacters you can use: " + (ctx.characters || []).map((c) => c.name + " (" + c.slug + ")" + (c.tagline ? " - " + c.tagline : "")).join("; ")
      + "\nValues to pick from: " + (ctx.values || []).join(", ")
      + "\nKeep it kind, simple and age-appropriate. Each page is one to three short sentences."
      + "\nReturn JSON with keys: title, blurb (one or two sentences), opening (the first line of the story), learning (one sentence), value (one value from the list), character (the slug of the main character), readMinutes (a number), ageMin (a number), ageMax (a number), pages (an array of 6 to 8 page texts)." + JSON_ONLY },
  ];
}

export function parseStory(text, opts) {
  const j = parseJson(text);
  if (!j) return null;
  const o = opts || {};
  const str = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const pages = (Array.isArray(j.pages) ? j.pages : String(j.pages || "").split(/\n\s*\n/)).map(str).filter(Boolean).slice(0, 10).map((p) => clipText(p, 320));
  const value = (o.values || []).find((v) => v === str(j.value).toLowerCase()) || "kindness";
  const character = (o.characters || []).find((c) => c.slug === str(j.character).toLowerCase()) ? str(j.character).toLowerCase() : "chike";
  const out = { title: str(j.title), blurb: str(j.blurb), opening: str(j.opening) || pages[0] || "", learning: str(j.learning), value, character,
    readMinutes: Math.max(2, Math.ceil(pages.length * 0.6)), ageMin: num(j.ageMin, 2, 17, 4), ageMax: num(j.ageMax, 3, 18, 9), pages };
  if (out.ageMax < out.ageMin) out.ageMax = out.ageMin;
  return out.title && pages.length >= 2 ? out : null;
}

/** Simple, ready-to-edit pages for the story builder: one pastel page per text, the first with the title. */
export function storyPagesFrom(title, texts, uid) {
  const tints = ["#FDECEA", "#E6F0F2", "#FFF6E2", "#E8F3E1", "#EFE6F7", "#E3F1F9"];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const layer = (content, style, y, h) => ({ id: uid("ly"), type: "text", content: "<p>" + esc(content) + "</p>", x: 10, y, w: 80, h, style, align: style === "heading" ? "center" : "left", color: "", fontSize: "", locked: false });
  return texts.map((t, i) => ({
    id: uid("pg"),
    background: { type: "color", value: tints[i % tints.length] },
    layers: (i === 0 && title ? [layer(title, "heading", 12, 22), layer(t, "body", 42, 40)] : [layer(t, "body", 25, 50)]),
  }));
}

/** Where on the admin the person is, in words the model can use. */
export function whereLabel(route) {
  const r = route || {};
  if (r.name !== "admin") return "the public site";
  const sec = r.params && r.params.section;
  const names = { dashboard: "the Dashboard", videos: "the Episodes list", games: "the Games list", stories: "the Stories list", articles: "the Articles list", activities: "the Activities list",
    "send-newsletter": "the Emails list", portalEntries: "the Subscriber’s Portal content list", subscribers: "the Subscribers list", homepage: "the Homepage editor", media: "the Media library" };
  return names[sec] || (sec ? "the " + sec + " section" : "the Dashboard");
}
