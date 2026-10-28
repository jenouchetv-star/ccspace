// Chike's Creative Space - newsletter portal: the parts that decide things.
//
// Everything here is plain TypeScript on top of Web Crypto (no Deno or
// Supabase imports), so the `portal` Edge Function, the two newsletter
// senders and the vitest suite (test/portal.test.js) all run the very same
// code. The Edge Function owns the network and the database; this file owns
// the rules: what counts as a valid email, how a subscriber's private access
// link is made and checked, which return addresses are allowed, and what a
// subscriber is allowed to see of an entry.

export const VERIFY_MINUTES = 30;       // an emailed verification link works for this long, once
export const JOIN_CONFIRM_MINUTES = 2880; // the link in a "please confirm you want to join" email works for 2 days, once
export const SESSION_DAYS = 30;         // a verified session lasts this long
export const ACCESS_LINK_DAYS = 60;     // the private link inside a newsletter works for this long
export const MAX_REQUESTS_PER_EMAIL_HOUR = 5;
export const MAX_REQUESTS_PER_IP_HOUR = 20;

export const ACCESS_KEY_MARK = "__ACCESS_KEY__";

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------- email ---------------- */

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function isValidEmail(v: unknown): boolean {
  const e = normalizeEmail(v);
  return e.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(e);
}

/* ---------------- encoding + hashing ---------------- */

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A random, unguessable token (256 bits). Only its SHA-256 is ever stored. */
export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/* ---------------- the private link inside a newsletter ---------------- */

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

/** A signed, self-contained key naming one subscriber and an expiry. It is
    what rides at the end of the "read it in the portal" link in each
    newsletter (?k=...). Nothing is stored for it: the signature is the proof. */
export async function signAccessKey(secret: string, subscriberId: string, expiresAtMs: number): Promise<string> {
  const payload = b64url(enc.encode(subscriberId + "|" + Math.floor(expiresAtMs)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), enc.encode(payload));
  return payload + "." + b64url(new Uint8Array(sig));
}

export type AccessKeyResult =
  | { ok: true; subscriberId: string }
  | { ok: false; reason: "invalid" | "expired" };

export async function readAccessKey(secret: string, key: unknown, nowMs: number): Promise<AccessKeyResult> {
  const k = String(key ?? "");
  const dot = k.indexOf(".");
  if (!secret || dot < 1 || k.length > 600) return { ok: false, reason: "invalid" };
  const payload = k.slice(0, dot);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), fromB64url(k.slice(dot + 1)), enc.encode(payload));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!ok) return { ok: false, reason: "invalid" };
  let text = "";
  try { text = dec.decode(fromB64url(payload)); } catch { return { ok: false, reason: "invalid" }; }
  const bar = text.lastIndexOf("|");
  const exp = Number(text.slice(bar + 1));
  const id = text.slice(0, bar);
  if (bar < 1 || !id || !Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  if (exp <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true, subscriberId: id };
}

/** Puts each recipient's own key into the newsletter's portal links. With no
    key (a test send, or no signing secret set) the link is left plain, so it
    simply opens the "Join our mailing list" gate rather than carrying a
    placeholder. */
export function personalizePortalLinks(html: string, key: string | null): string {
  if (key) return html.split(ACCESS_KEY_MARK).join(encodeURIComponent(key));
  return html
    .split("?k=" + ACCESS_KEY_MARK).join("")
    .split("&k=" + ACCESS_KEY_MARK).join("")
    .split("&amp;k=" + ACCESS_KEY_MARK).join("")
    .split(ACCESS_KEY_MARK).join("");
}

/* ---------------- where a verification link may send someone ---------------- */

/** Only the portal's own pages. Anything else becomes the portal index, so a
    crafted request can never turn the verification email into an open redirect. */
export function safeReturnPath(p: unknown): string {
  const s = String(p ?? "").trim();
  return /^\/newsletter(\/[a-z0-9][a-z0-9-]{0,80})?$/i.test(s) ? s : "/newsletter";
}

/* ---------------- subscribers ---------------- */

export type SubscriberRow = { id: string; data: Record<string, unknown> };

export type SubscriberLookup =
  | { state: "active"; id: string }
  | { state: "inactive"; id: string }   // on file but unsubscribed or never confirmed
  | { state: "none" };

/** Finds an email on the list. A duplicate row (the signup form never
    de-duplicated) must not hide an active one, so an active row wins. */
export function lookupSubscriber(rows: SubscriberRow[], email: string): SubscriberLookup {
  const want = normalizeEmail(email);
  const mine = (rows || []).filter((r) => normalizeEmail(r?.data?.email) === want);
  const active = mine.find((r) => r.data?.status === "published");
  if (active) return { state: "active", id: active.id };
  if (mine.length) return { state: "inactive", id: mine[0].id };
  return { state: "none" };
}

/* ---------------- what a subscriber is allowed to see ---------------- */

export const LAYOUTS = ["article", "video", "game", "ebook", "gallery"] as const;

const INDEX_FIELDS = ["id", "slug", "title", "description", "cover", "category", "publishedAt", "layout"];

export function isLive(entry: Record<string, unknown> | undefined, nowMs: number): boolean {
  if (!entry || entry.status !== "published") return false;
  const at = Date.parse(String(entry.publishedAt || ""));
  return Number.isNaN(at) || at <= nowMs;
}

/** The small card shown on the index. */
export function toIndexItem(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of INDEX_FIELDS) out[k] = entry[k];
  return out;
}

/** The whole entry, minus anything that is only for the team. */
export function toMemberEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...entry };
  delete out.adminNote;
  delete out.email;
  delete out.emailId;
  delete out.auditLog;
  return out;
}

export function sortNewestFirst<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.slice().sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

/* ---------------- request limits ---------------- */

export function overLimit(emailCount: number, ipCount: number): boolean {
  return emailCount >= MAX_REQUESTS_PER_EMAIL_HOUR || ipCount >= MAX_REQUESTS_PER_IP_HOUR;
}

export function inMinutes(nowMs: number, minutes: number): string {
  return new Date(nowMs + minutes * 60_000).toISOString();
}
export function inDays(nowMs: number, days: number): string {
  return new Date(nowMs + days * 86_400_000).toISOString();
}

/** Where a mailing-list sign-up came from ("home", "game-detail", ...): a short, plain label, or "" if it does not look like one. */
export function cleanSource(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9][a-z0-9 _\/-]*$/.test(s) ? s : "";
}

/** How long an emailed link lasts, in words. */
export function lastsFor(minutes: number): string {
  if (minutes >= 1440) {
    const d = Math.round(minutes / 1440);
    return d + (d === 1 ? " day" : " days");
  }
  if (minutes >= 60) {
    const h = Math.round(minutes / 60);
    return h + (h === 1 ? " hour" : " hours");
  }
  return minutes + " minutes";
}
