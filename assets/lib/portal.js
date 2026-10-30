// Chike's Creative Space - Subscriber’s Portal: the parts of the page that decide things.
//
// index.html draws the portal (the gate, the archive, each entry layout and the
// admin editor); this file holds the rules those screens depend on, with no
// dependency on the DOM or the database, so test/portalClient.test.js imports
// the very same code the live site runs.

export const PORTAL_LAYOUTS = [
  { id: "article", label: "Story", icon: "newspaper", hint: "Words and a picture", category: "Stories" },
  { id: "video", label: "Video", icon: "clapperboard", hint: "YouTube or Vimeo", category: "Videos" },
  { id: "game", label: "Game", icon: "gamepad-2", hint: "Play it on the page", category: "New games" },
  { id: "ebook", label: "Ebook", icon: "book-open", hint: "Interactive, free to read", category: "New books" },
  { id: "gallery", label: "Photos", icon: "images", hint: "A grid of pictures", category: "Photos" },
];

export const PORTAL_CATEGORIES = ["Stories", "Videos", "New games", "New books", "Photos", "Creative tips", "AI for kids", "Behind the scenes", "Updates"];

/** A quick check before anything is sent. The server does its own, stricter one. */
export function portalEmailOk(v) {
  const e = String(v || "").trim();
  return e.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/.test(e);
}

export const portalLayoutLabel = (id) => (PORTAL_LAYOUTS.find((l) => l.id === id) || PORTAL_LAYOUTS[0]).label;

/** The address shared for an entry. It is always the plain page address - never
    the private ?k= key from a newsletter and never a verification ?v= link. */
export function portalEntryUrl(origin, entry) {
  const base = String(origin || "").replace(/\/+$/, "");
  return base + "/newsletter/" + encodeURIComponent((entry && (entry.slug || entry.id)) || "");
}

/** Pulls the one-time bits out of a portal address and says what the address
    should be rewritten to once they have been used, so a private key never
    stays in the address bar where it could be copied into a message. */
export function portalReadQuery(query) {
  const q = query || {};
  return { verify: String(q.v || ""), key: String(q.k || ""), hasSecret: !!(q.v || q.k) };
}

const YT = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/;

/** An embed address for a YouTube or Vimeo link, or null for anything else.
    Only those two hosts are ever framed. */
export function portalVideoEmbed(input) {
  const raw = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return "https://www.youtube-nocookie.com/embed/" + raw + "?rel=0";
  if (!/^https:\/\//i.test(raw)) return null;
  let host = "";
  try { host = new URL(raw).hostname.replace(/^www\./, ""); } catch (_e) { return null; }
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const m = raw.match(YT);
    return m ? "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0" : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = raw.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
    return m ? "https://player.vimeo.com/video/" + m[1] : null;
  }
  return null;
}

/** Links an admin types for downloads and Buy buttons: a full https:// address
    or a file on this site. Nothing else (no javascript:, no data:). */
export function portalSafeUrl(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^(?!\/\/)[\w][\w./%?&=-]*$/.test(s) && s.indexOf("..") < 0 && !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return "";
}

/** The optional extra button on an entry: a full https:// address, a page on this
    site (starting with one /), or a mailto: link. Anything else is refused. */
export function portalLinkUrl(input) {
  const s = String(input || "").trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(s)) return s;
  if (/^mailto:[^\s"'<>]+$/i.test(s)) return s;
  return "";
}

/** Where an interactive ebook opens: the site's own page-turning reader for one of its books,
    or a link typed in for a book that is not in the list. "" when there is nothing to open. */
export function portalBookPath(e) {
  const typed = portalSafeUrl(e && e.bookPath);
  if (typed) return typed;
  const id = String((e && e.bookId) || "");
  return /^[a-z0-9][a-z0-9-]{0,80}$/i.test(id) ? "books/reader.html?story=" + id : "";
}

/** The gallery field is one photo per line: "picture | what it shows | caption". */
export function portalParseGallery(lines) {
  const arr = Array.isArray(lines) ? lines : String(lines || "").split("\n");
  return arr
    .map((l) => String(l).split("|").map((p) => p.trim()))
    .filter((p) => p[0])
    .map((p) => ({ src: p[0], alt: p[1] || "", caption: p[2] || "" }));
}

/** An entry's text, already cleaned by sanitizeHTML: when it has two or more big headings (h2), each heading and
    everything under it becomes its own card, so a long post reads as separate boxes. Text before the first
    heading stays above the cards. Fewer than two headings: the text is returned as it was. */
export function portalSections(html) {
  const s = String(html || "");
  const parts = s.split(/(?=<h2>)/);
  const secs = parts.filter((p) => p.startsWith("<h2>"));
  if (secs.length < 2) return s;
  const lead = parts[0].startsWith("<h2>") ? "" : parts[0];
  return lead + '<div class="psecs">' + secs.map((p) => '<section class="panel psec">' + p + "</section>").join("") + "</div>";
}

export function portalFormatGallery(images) {
  return (images || []).map((i) => [i.src, i.alt || "", i.caption || ""].join(" | ").replace(/( \| )+$/, ""));
}

export function portalSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Publication checks for the admin editor. Errors stop an entry going live;
    warnings do not. `others` is every other entry, to keep addresses unique. */
export function portalValidate(e, others) {
  const out = [];
  const err = (field, message) => out.push({ level: "error", field, message });
  const warn = (field, message) => out.push({ level: "warn", field, message });
  const blank = (v) => v === undefined || v === null || String(v).trim() === "";

  if (blank(e.title)) err("title", "Title is required.");
  if (blank(e.description)) err("description", "Description is required.");
  if (blank(e.category)) err("category", "Category is required.");
  if (blank(e.publishedAt)) err("publishedAt", "Publication date is required.");
  else if (Number.isNaN(Date.parse(e.publishedAt))) err("publishedAt", "That is not a date.");
  if (e.cover && e.cover.src && blank(e.cover.alt)) err("cover.alt", "Alt text is required whenever a cover image is set.");
  if (!(e.cover && e.cover.src)) warn("cover.src", "No cover image. The index card will show a plain colored block.");
  if (e.slug && (others || []).some((o) => o && o.id !== e.id && o.slug === e.slug)) err("slug", "Another entry already uses this address.");
  if (e.slug && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(e.slug)) err("slug", "Use lowercase letters, numbers and dashes only.");

  if (!blank(e.vocabWord) && blank(e.vocabMeaning)) err("vocabMeaning", "A word card needs its meaning. Add it, or clear the word.");
  if (!blank(e.aiPrompt) && String(e.aiPrompt).length > 1200) warn("aiPrompt", "That prompt is long. Short, simple prompts are easiest for kids to read and paste.");
  if (!blank(e.buttonLabel) && blank(e.buttonUrl)) err("buttonUrl", "The extra button needs a link.");
  if (!blank(e.buttonUrl) && !portalLinkUrl(e.buttonUrl)) err("buttonUrl", "Use a full https:// address, a page on this site like /play, or a mailto: link.");
  const layout = e.layout || "article";
  if (layout === "article" && blank(e.body)) err("body", "An article needs its text.");
  if (layout === "video") {
    if (blank(e.videoUrl)) err("videoUrl", "A video entry needs a YouTube or Vimeo link.");
    else if (!portalVideoEmbed(e.videoUrl)) err("videoUrl", "Only YouTube and Vimeo links can be embedded.");
  }
  if (layout === "game") {
    if (blank(e.gamePath) && blank(e.gameId) && blank(e.privateGameId) && blank(e.privateGameCode)) err("gamePath", "A game entry needs a game from the site, pasted game code, or a game file or link.");
    else if (!blank(e.gamePath) && !portalSafeUrl(e.gamePath)) err("gamePath", "Use a file on this site (games/example.html) or a full https:// address.");
  }
  if (layout === "ebook" && !portalBookPath(e)) err("bookId", "Choose which book this is, or add a link to it under More options.");
  if (layout === "gallery") {
    const photos = portalParseGallery(e.gallery);
    if (photos.length < 1) err("gallery", "A gallery needs at least one photo.");
    if (photos.some((p) => !p.alt)) warn("gallery", "Some photos have no description, which screen readers need.");
  }
  return out;
}

/* ---------------- the gate: what each situation says ---------------- */

/** Every state of the "Join our mailing list" gate, in plain words. `tone` is
    how it is announced ("polite" for progress, "assertive" for a problem). */
export function portalGateMessage(state, email) {
  const who = email ? " " + email : "";
  switch (state) {
    case "loading": return { tone: "polite", title: "Checking…", text: "One moment while we look that up." };
    case "verifying": return { tone: "polite", title: "Opening the Subscriber’s Portal…", text: "Checking your link." };
    case "sent": return { tone: "polite", title: "Check your inbox", text: "We sent a 6-digit code to" + who + ". Type it below to sign in. It works for 15 minutes." };
    case "consent_sent": return { tone: "polite", title: "One more step to join", text: "We sent a 6-digit code to" + who + ". Type it below to join the mailing list and unlock the Subscriber’s Portal. It works for 15 minutes." };
    case "wrong_code": return { tone: "assertive", title: "That code isn’t right", text: "Check the email and type the 6 numbers again." };
    case "too_many_tries": return { tone: "assertive", title: "Too many tries", text: "That code is locked. Press Send a new code." };
    case "code_expired": return { tone: "assertive", title: "That code has run out", text: "Codes work for 15 minutes. Press Send a new code." };
    case "needs_consent": return { tone: "polite", title: "You’re not on the list yet", text: "Join our mailing list to unlock the Subscriber’s Portal. We’ll email a link to confirm it’s really you." };
    case "invalid_email": return { tone: "assertive", title: "That email doesn’t look right", text: "Check it for typos – it should look like name@example.com." };
    case "expired": return { tone: "assertive", title: "That link has expired", text: "Links last 30 minutes and work once. Enter your email and we’ll send a fresh one." };
    case "used": return { tone: "assertive", title: "That link was already used", text: "Each link works once. Enter your email and we’ll send a new one." };
    case "invalid": return { tone: "assertive", title: "That link isn’t valid", text: "It may have been cut off when it was copied. Enter your email and we’ll send a new one." };
    case "not_subscribed": return { tone: "assertive", title: "That email isn’t subscribed", text: "Join the mailing list below and we’ll send a confirmation link." };
    case "ended": return { tone: "polite", title: "Welcome back", text: "It’s been a while, so we signed you out. Enter your email and we’ll send a fresh link." };
    case "consent_required": return { tone: "assertive", title: "Please tick the box to join", text: "We need your OK before we add you to the mailing list." };
    case "rate_limited": return { tone: "assertive", title: "Too many tries", text: "Please wait a little while before asking for another link." };
    case "send_failed": return { tone: "assertive", title: "We couldn’t send the email", text: "Please try again in a moment." };
    case "error": return { tone: "assertive", title: "Something went wrong", text: "We couldn’t reach the Subscriber’s Portal. Check your connection and try again." };
    default: return { tone: "polite", title: "", text: "" };
  }
}

/** The server answers expected problems as { ok:false, error }. Anything that
    is not one of the known codes is shown as a general error. */
export function portalErrorState(code) {
  const known = ["invalid_email", "expired", "used", "invalid", "not_subscribed", "rate_limited", "send_failed", "wrong_code", "too_many_tries", "code_expired"];
  return known.indexOf(code) >= 0 ? code : "error";
}
