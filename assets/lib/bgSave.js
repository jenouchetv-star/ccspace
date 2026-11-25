// Saving in the background (owner, 2026-11-25; draft docs/mockups/background-save-draft-*.png): Art Space and Sound
// Space close at once, and the site finishes sending the picture or song to the member's account, with a small dark
// card in the bottom-left corner. These are the card's words and the waits before trying again; the sending and the
// card itself are in index.html (studioSaveOnClose, bgSavePut, renderBgSave).

/** How long "saved" stays before it goes. */
export const BG_SAVE_DONE_MS = 4000;
/** Never wait longer than this for one save (a stuck connection): then it counts as not saved yet, and tries again. */
export const BG_SAVE_TIMEOUT_MS = 120000;

/** How long to wait before trying a save again after this answer; 0 when trying again can't help (the account is
    full, the file is too big, or the grown-up has to sign in again). */
export function bgSaveRetryMs(error) {
  if (error === "slow_down") return 300000;
  if (error === "full" || error === "storage_full" || error === "too_big" || error === "no_session" || error === "invalid") return 0;
  return 60000;
}

/** Whole percent sent, 0 to 100, from bytes sent of a total (unknown total: 0). */
export function bgSavePct(sent, total) {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.floor((sent / total) * 100)));
}

const cleanTitle = (job) => {
  const t = String((job && job.title) || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return t || (job && job.kind === "song" ? "My song" : "Untitled");
};

/** What one card says. job: { kind: "art"|"song", title, state: "sending"|"done"|"waiting"|"failed", pct, error }.
    Returns { tone: "art"|"song"|"done"|"bad", title, side, note, bar (a percent, or null), tryNow, dismiss }. */
export function bgSaveView(job) {
  const name = "“" + cleanTitle(job) + "”";
  const tone = job.kind === "song" ? "song" : "art";
  if (job.state === "done") {
    return { tone: "done", title: name + " is saved", side: "Done", note: "Saved to your account.", bar: null, tryNow: false, dismiss: false };
  }
  if (job.state === "waiting") {
    const when = job.error === "slow_down" ? "in a few minutes" : "in a minute";
    return { tone: "bad", title: name + " didn’t save yet", side: "", note: "It’s safe in this browser. Trying again " + when + ".", bar: null, tryNow: true, dismiss: false };
  }
  if (job.state === "failed") {
    const notes = {
      full: "It’s safe in this browser, but your account is full.",
      storage_full: "It’s safe in this browser, but your account is out of space.",
      too_big: "It’s too big for your account, so it stays in this browser.",
      no_session: "It’s safe in this browser. Sign in again to save it to your account.",
    };
    return { tone: "bad", title: name + " didn’t save to your account", side: "", note: notes[job.error] || "It’s safe in this browser.", bar: null, tryNow: false, dismiss: true };
  }
  const pct = Math.max(0, Math.min(100, Math.floor(Number(job.pct) || 0)));
  return { tone, title: "Saving " + name, side: pct + "%", note: "", bar: pct, tryNow: false, dismiss: false };
}
