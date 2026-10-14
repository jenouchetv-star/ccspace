// Pure rules for the admin 2FA reset (see index.ts). Kept in their own file,
// with no Deno or Supabase imports, so the exact code that runs in the Edge
// Function is also what test/adminResetMfa.test.js imports.

export const VERIFIED_HOW = ["in_person", "video_call", "known_phone_number"] as const;
export type VerifiedHow = typeof VERIFIED_HOW[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedRequest =
  | { ok: true; targetId: string; confirmEmail: string; verifiedHow: VerifiedHow }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): ParsedRequest {
  return { ok: false, status, error };
}

/** Validates the request body. `verifiedHow` is the resetting admin's
    attestation of how they confirmed it really is the person (recorded in
    the audit log); `confirmEmail` is the target's email typed back to prove
    the right account was meant. Resetting yourself is never allowed. */
export function parseResetRequest(body: unknown, callerId: string): ParsedRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Invalid request body");
  const b = body as Record<string, unknown>;
  const targetId = typeof b.targetId === "string" ? b.targetId.trim() : "";
  if (!UUID_RE.test(targetId)) return fail(400, "Invalid admin id");
  if (targetId.toLowerCase() === String(callerId).toLowerCase()) {
    return fail(400, "You can't reset your own two-step verification.");
  }
  const verifiedHow = typeof b.verifiedHow === "string" ? b.verifiedHow : "";
  if (!(VERIFIED_HOW as readonly string[]).includes(verifiedHow)) {
    return fail(400, "Say how you confirmed it is really them.");
  }
  const confirmEmail = typeof b.confirmEmail === "string" ? b.confirmEmail.trim() : "";
  if (!confirmEmail) return fail(400, "Type the admin's email to confirm.");
  return { ok: true, targetId: targetId.toLowerCase(), confirmEmail, verifiedHow: verifiedHow as VerifiedHow };
}

export function emailsMatch(a: string, b: string): boolean {
  const x = String(a ?? "").trim().toLowerCase();
  const y = String(b ?? "").trim().toLowerCase();
  return x !== "" && x === y;
}

/** The message for a limit that begin_mfa_reset() (the database, which owns
    the limits and records the attempt atomically) reported. */
export function limitMessage(code: string): string {
  if (code === "target_limit") {
    return "This admin's 2FA was already reset twice in the last 24 hours. Try again tomorrow, or ask the site owner.";
  }
  if (code === "actor_limit") {
    return "You've reset 2FA 5 times in the last 24 hours. Try again tomorrow.";
  }
  return "Reset limit reached. Try again later.";
}

/** The assurance level (aal1 / aal2) inside a bearer token, or null if it
    can't be read. Only call this AFTER the token has been verified with
    auth.getUser(); it reads the payload, it does not check the signature. A
    null result must be treated as "not verified". */
export function callerAal(authorizationHeader: string | null | undefined): string | null {
  try {
    const token = String(authorizationHeader ?? "").replace(/^Bearer\s+/i, "");
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const aal = JSON.parse(json)?.aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A long random password nobody knows, with every character class, so it
    passes any password policy. Used to kill the old password on a reset. */
export function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin) + "Aa1!";
}

/** The email that tells the person their 2FA was reset, by whom and when,
    so a reset they didn't expect is noticed. All names are escaped. */
export function resetNotificationHtml(o: { targetName: string; actorName: string; whenIso: string }): string {
  const target = escapeHtml(o.targetName || "there");
  const actor = escapeHtml(o.actorName || "another admin");
  const when = escapeHtml(o.whenIso);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1E2226">`
    + `<p>Hi ${target},</p>`
    + `<p>Two-step verification on your Chike’s Creative Space admin account was reset by <b>${actor}</b> at ${when} (UTC).</p>`
    + `<p>For your safety your password was also reset and you were signed out everywhere. To get back in, open the email titled “Reset your password” (or use “Forgot your password?” on the admin sign-in page), choose a new password, then set up your authenticator app again.</p>`
    + `<p><b>If you didn’t expect this, tell the site owner right away.</b></p>`
    + `</div>`;
}
