// Chike's Creative Space - the writing helper for Newsletter Archive entries and their emails.
//
// It talks to an Ollama server the person running the admin already has on their own computer
// (default http://localhost:11434), so what they write and what the site contains never leaves
// their machine. This file holds everything that is not the screen: how to find the server and
// a model, how to turn the site's contents into something a small model can be "aware" of, the
// prompts, and how to read the answers back. It has no DOM or database dependency, so
// test/writer.test.js runs the very same code as the live admin (with a pretend server).

export const DEFAULT_OLLAMA = "http://localhost:11434";

/** One fixed size for every request. Ollama reloads the model whenever this changes between calls,
    which costs many seconds, so the quick suggestions and the long drafts all use the same value. */
export const NUM_CTX = 6144;

/* ---------------- the server ---------------- */

/** Only a machine on this computer or this home/office network may be used - never a public
    address, a path, or a login in the URL. Returns the tidy origin, or "". */
export function ollamaUrl(input) {
  const raw = String(input || "").trim() || DEFAULT_OLLAMA;
  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : "http://" + raw); } catch (_e) { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  if (u.username || u.password) return "";
  const h = u.hostname.toLowerCase();
  const local = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local")
    || /^10\.\d+\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h);
  if (!local) return "";
  return u.protocol + "//" + u.host;
}

const NOT_FOR_WRITING = /embed|vl([-:._]|$)|vision|llava|coder|code|rerank|bge|minilm/i;
const PREFERRED = ["qwen2.5:7b", "llama3.1:8b", "qwen3:8b", "llama3.2", "gemma2", "mistral", "qwen2.5", "llama3", "qwen3"];

/** Models that can write, in the order Ollama listed them. */
/** Models that can look at a picture. */
const SEES_PICTURES = /vl([-:._]|$)|vision|llava|moondream|minicpm-v/i;
const VISION_PREFERRED = ["qwen2.5vl", "llama3.2-vision", "minicpm-v", "llava", "moondream"];
export function visionModels(names) { return (names || []).map(String).filter((n) => SEES_PICTURES.test(n)); }
export function pickVision(names, saved) {
  const ok = visionModels(names);
  if (saved && ok.indexOf(saved) >= 0) return saved;
  for (const want of VISION_PREFERRED) { const hit = ok.find((n) => n.indexOf(want) === 0); if (hit) return hit; }
  return ok[0] || "";
}

export function chatModels(names) {
  return (names || []).map(String).filter((n) => n && !NOT_FOR_WRITING.test(n));
}

/** The remembered model if it is still installed, else the best-liked one that is. */
export function pickModel(names, saved) {
  const ok = chatModels(names);
  if (saved && ok.indexOf(saved) >= 0) return saved;
  for (const want of PREFERRED) {
    const hit = ok.find((n) => n === want || n.indexOf(want) === 0);
    if (hit) return hit;
  }
  return ok[0] || "";
}

export async function listModels(base, fetchImpl) {
  const f = fetchImpl || fetch;
  try {
    const res = await f(base + "/api/tags");
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch (_e) {
    return { ok: false, models: [] };
  }
}

/** Downloads a model, reporting progress as it goes. Resolves when Ollama says it is done; abort with `signal`.
    onProgress gets { status, pct, completed, total } (pct is null until the size is known). */
export async function pullModel(base, name, onProgress, signal, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(base + "/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: signal,
    body: JSON.stringify({ model: name, stream: true }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch (_e) { /* not JSON */ }
    throw new Error(detail || "Ollama would not download that (" + res.status + ").");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", ok = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_e) { continue; }
      if (msg.error) throw new Error(msg.error);
      const pct = msg.total > 0 && msg.completed >= 0 ? Math.min(100, (msg.completed / msg.total) * 100) : null;
      if (msg.status === "success") ok = true;
      if (onProgress) onProgress({ status: String(msg.status || ""), pct: pct, completed: msg.completed, total: msg.total });
    }
  }
  if (!ok) throw new Error("The download stopped before it finished.");
  return true;
}

/** Loads the model into memory ahead of time, so the first real request does not wait for it
    (a 7B model can take most of a minute to load). Quietly does nothing if the server is not there. */
export async function warm(base, model, fetchImpl) {
  const f = fetchImpl || fetch;
  try {
    await f(base + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, keep_alive: "10m", options: { num_ctx: NUM_CTX } }),
    });
  } catch (_e) { /* not running: nothing to warm */ }
}

/** One chat call. Answers stream in as they are written (onToken gets each piece). Resolves to the
    full text. `json` asks the model for a single JSON object. Abort with `signal`. */
export async function chat(o) {
  const f = o.fetchImpl || fetch;
  const res = await f(o.base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: o.signal,
    body: JSON.stringify({
      model: o.model,
      messages: o.messages,
      stream: true,
      think: false,
      keep_alive: "10m",
      format: o.json ? "json" : undefined,
      options: { temperature: o.temperature == null ? 0.7 : o.temperature, num_ctx: NUM_CTX, num_predict: o.maxTokens || 900 },
    }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch (_e) { /* not JSON */ }
    throw new Error(detail || "The writing helper answered with an error (" + res.status + ").");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_e) { continue; }
      if (msg.error) throw new Error(msg.error);
      const piece = msg.message && msg.message.content;
      if (piece) { text += piece; if (o.onToken) o.onToken(piece, text); }
    }
  }
  return text;
}

/* ---------------- what the helper knows about the site ---------------- */

const STOP = new Set("the and for with that this from your you our are was were has have had not but all can will its into about new out how what when who why any more some just over than then them they their here there make made get got".split(" "));
const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !STOP.has(w));
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const liveOnly = (r) => r && r.status !== "archived" && r.status !== "draft";

/** Everything the site has, as one flat list: { kind, title, text, path }. `data` is the admin's
    own copy of the site's collections (db.get()). Only published things; never people's emails. */
export function siteItems(data, opts) {
  const d = data || {};
  const live = (opts && opts.drafts) ? ((r) => r && r.status !== "archived") : liveOnly;   // drafts too, when finding a page to edit
  const out = [];
  const add = (kind, col, rows, map) => (rows || []).filter(live).forEach((r) => { const it = map(r); if (it && it.title) out.push(Object.assign({ kind, col, id: r.id, draft: r.status === "draft" }, it)); });
  add("Game", "games", d.games, (r) => ({ title: r.title, text: [r.summary, r.kind === "embed" ? "playable in the browser" : "", r.players ? "players: " + r.players : ""].filter(Boolean).join("; "), facts: (r.rules || []).join(" "), path: "/play/" + r.id }));
  add("Episode", "videos", d.videos, (r) => ({ title: r.title, text: "Episode " + (r.episode || "") + ". " + (r.description || ""), path: "/watch/" + r.id }));
  add("Book or story", "stories", d.stories, (r) => ({ title: r.title, text: [r.blurb, (r.pages || []).length ? (r.pages.length + "-page picture book read on the site") : "", r.learning].filter(Boolean).join(" "), path: "/stories/" + r.id }));
  add("Activity", "activities", d.activities, (r) => ({ title: r.title, text: [r.summary, r.ageMin ? "ages " + r.ageMin + "-" + r.ageMax : "", r.timeMinutes ? r.timeMinutes + " minutes" : ""].filter(Boolean).join("; "), path: "/activity/" + r.id }));
  add("Character", "characters", d.characters, (r) => ({ title: r.name, text: [r.tagline, r.strength].filter(Boolean).join(" - "), path: "/characters/" + (r.slug || r.id) }));
  add("Shop book", "amazonProducts", d.amazonProducts, (r) => ({ title: r.title, text: r.why, path: "/shop/amazon" }));
  add("Printable", "products", d.products, (r) => ({ title: r.title, text: r.blurb, path: "/shop/printables/" + r.id }));
  add("Collection", "collections", d.collections, (r) => ({ title: r.title, text: r.blurb, path: "/collection/" + r.id }));
  add("Article", "articles", d.articles, (r) => ({ title: r.title, text: r.blurb, path: "/article/" + r.id }));
  add("Archive entry", "portalEntries", d.portalEntries, (r) => ({ title: r.title, text: r.description, path: "/newsletter/" + (r.slug || r.id) }));
  (d.newsletters || []).filter((n) => n && n.status === "sent" && n.subject).slice(0, 8).forEach((n) => out.push({ kind: "Past email", title: n.subject, text: n.previewText || "", path: "" }));
  return out;
}

/** The whole site in a few thousand characters: every title by kind, with its page address, so
    the model can name real things and link to real pages. */
export function siteDigest(items, budget) {
  const max = budget || 5500;
  const kinds = [];
  (items || []).forEach((it) => { let k = kinds.find((x) => x.kind === it.kind); if (!k) kinds.push(k = { kind: it.kind, rows: [] }); k.rows.push(it); });
  let out = "";
  for (const k of kinds) {
    const line = k.kind.toUpperCase() + " (" + k.rows.length + "): " + k.rows.map((r) => r.title + (r.path ? " [" + r.path + "]" : "")).join("; ") + "\n";
    if (out.length + line.length > max) { out += k.kind.toUpperCase() + " (" + k.rows.length + "): " + k.rows.slice(0, 6).map((r) => r.title).join("; ") + "; and more\n"; continue; }
    out += line;
  }
  return out.trim();
}

/** The few things most related to what is being written, in detail. */
export function relevantItems(items, query, n) {
  const q = words(query);
  if (!q.length) return [];
  return (items || [])
    .map((it) => {
      const t = words(it.title), x = words(it.text);
      let score = 0;
      q.forEach((w) => { if (t.indexOf(w) >= 0) score += 3; if (x.indexOf(w) >= 0) score += 1; });
      return { it, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n || 6)
    .map((s) => s.it);
}

/* ---------------- the prompts ---------------- */

/** Who the helper is talking to, and when: a name from their admin profile (never their email) and today's date. */
export function whoLine(who) {
  const w = who || {};
  const today = w.today || new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (w.name ? "You are talking with " + w.name + (w.first ? " (call them " + w.first + ")" : "") + ", an admin of this site. If they ask who they are, tell them their name and that they are an admin. Greet them by first name when they say hello. " : "") + "Today is " + today + ".";
}

export function systemPrompt(brand, digest, detail, who) {
  const b = brand || {};
  return [
    "You are the writing helper for " + (b.name || "Chike's Creative Space") + ", a kids' creativity site (activities, games, episodes, picture books and a shop) made for children and the grown-ups who support them.",
    b.promise ? "Its promise: " + b.promise : "",
    whoLine(who),
    "Voice: warm, playful and clear, like a friendly teacher. Short sentences. Plain words a parent can read aloud. American English spelling. No hype, no pressure, no emojis unless asked.",
    "Our ebooks are interactive picture books that kids read for free in the site's own reader. They are never PDFs or downloads, and nothing in the Archive costs money, so never mention prices or buying.",
    "Tone: gentle invitations, never pressure. Do not use urgent or pushy phrases like \"now\", \"hurry\", \"don't miss out\", \"act fast\" or \"limited time\". Say things like \"come and see\" or \"take a look\".",
    "Rules: Only mention games, books, episodes or activities that appear in the site list below, and only use page addresses from that list. Never invent facts, dates, prices, quotes or links. If you do not know something, leave a clear [placeholder] for the writer to fill. Write plain text with no markdown, no asterisks and no headings.",
    "Some pages are drafts or unpublished and are not in the list below. If the owner names a page that is not listed, say it may be a draft you cannot see here, rather than saying it does not exist.",
    "WHAT IS ON THE SITE RIGHT NOW:",
    digest || "(nothing yet)",
    detail && detail.length ? "MOST RELEVANT DETAILS:\n" + detail.map((d) => "- " + d.kind + ": " + d.title + (d.path ? " [" + d.path + "]" : "") + (d.text ? " - " + clip(d.text, 220) : "")).join("\n") : "",
  ].filter(Boolean).join("\n\n");
}

const LAYOUT_WORDS = { article: "a story or update", video: "a video", game: "a new game", ebook: "a new interactive ebook (a picture book kids read for free on the site)", gallery: "a photo gallery" };

function entryNotes(ctx) {
  const e = ctx.entry || {};
  return [
    "Kind of entry: " + (LAYOUT_WORDS[e.layout] || "an update"),
    e.title ? "Title so far: " + e.title : "",
    e.description ? "Short description so far: " + e.description : "",
    e.body ? "Text so far: " + clip(e.body, 1200) : "",
    ctx.idea ? "The writer says it is about: " + ctx.idea : "",
  ].filter(Boolean).join("\n");
}

const JSON_NOTE = " Reply with one JSON object only and nothing else.";

/** The messages for one job. `ctx` = { brand, items, entry:{layout,title,description,body}, idea, field, fieldText, system } */
export function taskMessages(task, ctx) {
  const query = [ctx.idea, ctx.entry && ctx.entry.title, ctx.entry && ctx.entry.description, ctx.fieldText].filter(Boolean).join(" ");
  const sys = ctx.system || systemPrompt(ctx.brand, siteDigest(ctx.items), relevantItems(ctx.items, query, 6), ctx.who);
  const notes = entryNotes(ctx);
  const user = {
    draft: "Write a new Newsletter Archive entry and the email that announces it.\n" + notes
      + "\nReturn JSON with these keys: title (under 8 words), description (one or two sentences for a card), body (three or four short paragraphs separated by a blank line), emailSubject (under 8 words), emailPreview (one line), emailMessage (two short paragraphs for the email, ending with an invitation to take a look), emailButton (2 to 3 words)." + JSON_NOTE,
    titles: "Give me six different title ideas for this entry.\n" + notes + "\nReturn JSON like {\"titles\": [\"...\"]}. Each under 8 words." + JSON_NOTE,
    description: "Write the short description for this entry: one or two sentences that make someone want to open it.\n" + notes + "\nReply with only the sentences.",
    email: "Write the email that goes with this entry.\n" + notes + "\nReturn JSON with keys subject (under 8 words), preview (one line), message (two short paragraphs separated by a blank line, ending with an invitation to take a look), button (2 to 3 words)." + JSON_NOTE,
    improve: "Improve this " + (ctx.field || "text") + ": fix mistakes, make it warmer and clearer, keep the meaning and about the same length. Reply with only the improved text.\n\n" + (ctx.fieldText || ""),
    continue: "Continue this text with the next paragraph, in the same voice. Reply with only the new paragraph.\n" + notes,
    ask: ctx.idea || "",
  }[task];
  if (user == null) throw new Error("Unknown writing job: " + task);
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

/** A few words to finish what is being typed in one box. */
/** Suggestions have to come back in a second or two, so they get a short brief: the voice, and the
    couple of site items most related to what is being typed - not the whole site. */
export function leanSystem(brand, items, query) {
  const b = brand || {};
  const near = relevantItems(items, query, 3);
  return [
    "You help write for " + (b.name || "Chike's Creative Space") + ", a kids' creativity site. Voice: warm, playful, clear. American English. Gentle invitations, never pushy. Never invent facts or links.",
    near.length ? "Related things on the site:\n" + near.map((d) => "- " + d.title + (d.text ? ": " + clip(d.text, 120) : "")).join("\n") : "",
  ].filter(Boolean).join("\n");
}

/** What the form already says about the thing being written (how a game is played, its word, its steps...),
    as short "label: text" lines, so a suggestion can stay true to it instead of guessing. Skips ids, links,
    pictures, dates, switches and anything that is not words; `skip` leaves out the box being typed in. */
export function recordFacts(rec, skip) {
  const hide = /^(id|slug|status|layout|title|name|body)$|url|path|src|cover|email|date|gallery|embed|button|private|tip$/i;
  const lines = [];
  let used = 0;
  for (const key of Object.keys(rec || {})) {
    if (hide.test(key) || /(At|Id)$/.test(key) || (skip || []).indexOf(key) >= 0) continue;
    const v = rec[key];
    const text = (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("; ") : typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();
    if (text.length < 3 || /^https?:/i.test(text)) continue;
    const line = key.replace(/([A-Z])/g, " $1").toLowerCase() + ": " + clip(text, 280);
    if (used + line.length > 900) break;
    lines.push(line);
    used += line.length;
  }
  return lines.join("\n");
}

export function suggestMessages(ctx) {
  const sys = ctx.system || leanSystem(ctx.brand, ctx.items, [ctx.entry && ctx.entry.title, ctx.fieldText].join(" "));
  const facts = ctx.entry && ctx.entry.facts;
  return [
    { role: "system", content: sys },
    { role: "user", content: "The writer is typing the " + ctx.field + " for " + (ctx.kind ? "a " + String(ctx.kind).toLowerCase() : (LAYOUT_WORDS[(ctx.entry || {}).layout] || "an update")) + ".\n"
      + (ctx.entry && ctx.entry.title ? "Title: " + ctx.entry.title + "\n" : "")
      + (facts ? "What the form already says about it (these are the facts; never add features, rules, levels, characters or details that are not here):\n" + facts + "\n" : "")
      + "Here is what they have typed so far:\n" + ctx.fieldText + "\n\nWrite only the next few words (at most 14) that continue it naturally and truthfully. Do not repeat what they typed. No quotation marks. If you are not sure of a detail, finish the sentence in a general way rather than guessing." },
  ];
}

/* ---------------- reading the answers ---------------- */

const str = (v) => (Array.isArray(v) ? v.join("\n\n") : String(v == null ? "" : v)).replace(/\r/g, "").trim();

/** The model was asked for JSON. Be forgiving about code fences and chatter around it. */
export function parseJson(text) {
  const t = String(text || "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (_e) { return null; }
}

export function parseDraft(text) {
  const j = parseJson(text);
  if (!j) return null;
  const out = {
    title: str(j.title), description: str(j.description), body: str(j.body),
    emailSubject: str(j.emailSubject || j.subject), emailPreview: str(j.emailPreview || j.preview),
    emailMessage: str(j.emailMessage || j.message), emailButton: str(j.emailButton || j.button),
  };
  return Object.keys(out).some((k) => out[k]) ? out : null;
}

export function parseTitles(text) {
  const j = parseJson(text);
  const list = j && (j.titles || j.title_ideas || j.ideas);
  return Array.isArray(list) ? list.map(str).filter(Boolean).slice(0, 8) : [];
}

export function parseEmail(text) {
  const j = parseJson(text);
  if (!j) return null;
  const out = { subject: str(j.subject), preview: str(j.preview), message: str(j.message), button: str(j.button) };
  return Object.keys(out).some((k) => out[k]) ? out : null;
}

/** The model sometimes wraps a plain answer in quotes or a label. */
export function cleanText(text) {
  let t = String(text || "").trim();
  t = t.replace(/^(here(?:'s| is)[^\n:]*:|sure[^\n:]*:)\s*/i, "").trim();
  t = t.replace(/^["“](.*)["”]$/s, "$1").trim();
  return t.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
}

/** Paragraphs separated by blank lines, as safe HTML for the editor. */
export function paragraphsToHtml(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => "<p>" + esc(p).split("\n").join("<br>") + "</p>").join("");
}

/** What to offer as the next few words: no echo of what was typed, one short line. */
export function cleanSuggestion(raw, typed) {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.replace(/^["“'`]+|["”'`]+$/g, "").trim();
  s = s.replace(/^(?:\.{2,}|…)\s*/, "");   // a model that thinks it is finishing a sentence starts with "..."
  const t = String(typed || "").trim();
  if (t && s.toLowerCase().startsWith(t.toLowerCase())) s = s.slice(t.length).trim();
  if (s.length < 3) return "";
  if (s.length > 90) { s = s.slice(0, 90); s = s.slice(0, s.lastIndexOf(" ") > 20 ? s.lastIndexOf(" ") : 90).trim(); }
  const needsSpace = /\S$/.test(String(typed || "")) && /^[A-Za-z0-9(]/.test(s);
  return (needsSpace ? " " : "") + s;
}

/* ---------------- quick picks that need no model at all ---------------- */

export function subjectIdeas(layout, title) {
  const t = String(title || "").trim();
  if (!t) return [];
  const by = {
    game: [t + " is here", "Come and play " + t, "New game: " + t],
    video: ["Come and watch " + t, "New episode: " + t, t + " is ready to watch"],
    ebook: ["New book: " + t, "Peek inside " + t, t + " is ready to read"],
    gallery: ["Photos: " + t, "Take a look: " + t, t],
    article: [t, "New: " + t, "Have you seen this? " + t],
  };
  return by[layout] || by.article;
}

export function buttonIdeas(layout) {
  return ({ game: ["Come and play", "Take a look"], video: ["Come and watch", "Take a look"], ebook: ["Open the book", "Take a peek"], gallery: ["See the photos", "Take a look"], article: ["Take a look", "Come and read"] })[layout] || ["Take a look", "Come and see"];
}
