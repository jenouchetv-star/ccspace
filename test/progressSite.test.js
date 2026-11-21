// The progress report in the Subscriber's Portal (index.html): the grown-up check, the report's three containers,
// "Your children", and how the page is reached. The rules it uses (buildReport, grownUpQuestion, GRADE_LABELS, ...)
// live in assets/lib/progress.js and are tested in test/progressLib.test.js; this reads the page's own code.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { recordTarget, quizBubbleAllowed } from "../assets/lib/progress.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
/* one of the page's functions, built on its own with the names it uses passed in (the last argument may be "async ") */
const fn = (name, ...deps) => {
  const prefix = deps.length && /^async $/.test(deps[deps.length - 1]) ? deps.pop() : "";
  return (...vals) => new Function(...deps, "return " + prefix + "function " + name + "(" + body(name))(...vals);
};
/* the report page and the pieces it is drawn from */
const view = () => ["viewProgress", "progressCheckHTML", "progressReportHTML", "progressChildrenHTML"].map(body).join("\n");

describe("the progress report page", () => {
  it("is its own page at /newsletter/progress, not an entry, and needs the portal sign-in like the archive", () => {
    const route = body("parseRoute");
    expect(route).toContain('seg[0] === "newsletter" && seg[1] === "progress"');
    expect(route.indexOf('name:"progress"')).toBeLessThan(route.indexOf("const detailable"));
    expect(body("renderRoute")).toContain('case "progress":          return viewProgress();');
    expect(body("portalOnRoute")).toContain('n === "progress"');
    expect(body("portalNextPath")).toContain('"/newsletter/progress"');
    const v = body("viewProgress");
    expect(v).toContain("portalKick()");
    expect(v.indexOf("return portalDecoy();")).toBeLessThan(v.indexOf("progressCheckHTML("));
  });

  it("asks for the portal session on every call to kid-progress, and says no_session without one", () => {
    const k = body("kidCall");
    expect(k).toContain('if (!session) return { ok: false, error: "no_session" };');
    expect(k).toContain('sb.functions.invoke("kid-progress"');
    expect(k).toContain("session: session");
  });

  it("viewProgress shows the grown-up check first", () => {
    const v = body("viewProgress");
    expect(v.indexOf("if (!ProgressState.grownUpOk)")).toBeGreaterThan(-1);
    expect(v.indexOf("if (!ProgressState.grownUpOk)")).toBeLessThan(v.indexOf("progressLoadChildren("));
    const check = body("progressCheckHTML");
    expect(check).toContain("A quick grown-up check");
    expect(html).toContain("grownUpQuestion(Math.random)");
    expect(html).toMatch(/ProgressState = \{[^}]*children: null[^}]*grownUpOk: false[^}]*reportFor: ""/);
  });

  it("gives a new question after a wrong answer, and remembers a right one only in memory", () => {
    const a = body("progressCheckAnswer");
    expect(a).toContain("ProgressState.grownUpOk = true");
    expect(a).toContain("grownUpQuestion(Math.random)");
    expect(a).not.toMatch(/localStorage|sessionStorage/);
  });

  it("the report uses the three containers", () => {
    const r = body("progressReportHTML");
    for (const c of ["box--week", "box--learned", "box--ask"]) expect(r).toContain(c);
    expect(r).toContain("buildReport(");
  });

  it("the learned container shows the six STEAMM subjects with the site's icons", () => {
    const r = body("progressReportHTML");
    expect(r).toContain("bySubject");
    expect(r).toContain("STEAMM_ICONS[");
    expect(r).toContain("Knows it");
    expect(r).toContain("Came across it");
    expect(r).toContain("Still remembered it 2 months later");
  });

  it("shows quizzes as so many right, never a score", () => {
    const r = body("progressReportHTML");
    expect(r).toContain('" of " + q.asked + " right"');
    expect(r).not.toMatch(/%|out of 100|score/i);
  });

  it("escapes every child name and content title", () => {
    const r = view();
    expect(r).not.toMatch(/\+ (c|child|kid)\.name \+/);
    expect(r).not.toMatch(/\+ (it|item|f|fact)\.title \+/);
  });

  it("Your children offers Kindergarten to 6th grade and at most 6", () => {
    const c = body("progressChildrenHTML");
    expect(c).toContain("GRADE_LABELS");
    expect(c).toContain("Up to 6 children");
    expect(c).toContain("PROGRESS_MAX_CHILDREN");
    expect(html).toContain("const PROGRESS_MAX_CHILDREN = 6;");
    expect(c).toContain('maxlength="24"');
  });

  it("removing a child asks first", () => {
    const c = body("progressChildrenHTML");
    expect(c).toContain("Everything recorded for");
    expect(c).toContain("This can’t be undone.");
    expect(c).toContain('data-act="progress-remove-yes"');
    expect(html).toContain('"progress-remove": (el) => { ProgressState.removing');
  });

  it("with no children yet, shows only Your children and the sign-in note", () => {
    const v = body("progressReportOrEmpty");
    expect(v).toContain("if (!kids.length) return progressChildrenHTML()");
    expect(body("progressChildrenHTML")).toContain("stay signed in to the Subscriber’s Portal");
  });

  it("the member bar links to the report", () => {
    const m = body("portalMemberBar");
    expect(m).toContain("portalReportLink()");
    const link = fn("portalReportLink", "AppState", "ic")({ route: { name: "newsletter", params: {} } }, () => "");
    expect(link()).toContain('href="#/newsletter/progress"');
    expect(link()).toContain("Progress report");
  });

  it("the admin's portal bar links to the report too; on the report itself neither bar has a portal link", () => {
    expect(body("portalAdminBar")).toContain("portalReportLink()");
    const link = (name) => fn("portalReportLink", "AppState", "ic")({ route: { name, params: {} } }, () => "")();
    expect(link("newsletter")).toContain('href="#/newsletter/progress"');
    expect(link("newsletter-detail")).toContain("Progress report");
    // owner, 2026-11-21: the header's Subscriber's Portal button and the breadcrumb already lead back
    expect(link("progress")).toBe("");
    const member = fn("portalMemberBar", "ic", "PortalState", "E", "portalReportLink")(() => "", { email: "" }, esc, () => link("progress"))();
    expect(member).not.toMatch(/Subscriber.s Portal|href=/);
    const onReport = fn("portalAdminBar", "ic", "portalReportLink")(() => "", () => link("progress"))();
    expect(onReport).not.toMatch(/Subscriber.s Portal|newsletter/);
    const bar = fn("portalAdminBar", "ic", "portalReportLink")(() => "", () => '<a href="#/newsletter/progress">Progress report</a>')();
    expect(bar).toContain('href="#/newsletter/progress"');
    expect(bar).toContain("Manage entries");
  });

  it("leaves out anything that is not published any more (draft, sent back for revision, archived)", () => {
    const lists = {
      videos: ["published", "draft", "revision", "archived"].map((s) => ({ id: "v-" + s, title: s, status: s })),
      stories: [{ id: "s1", title: "S", status: "draft" }, { id: "s2", title: "S2", status: "published" }],
      activities: [{ id: "a1", title: "A", status: "review" }, { id: "a2", title: "A2", status: "published" }],
    };
    const fakeDb = { find: (col, id) => (lists[col] || []).find((r) => r.id === id) || null, list: (col) => lists[col] || [] };
    const content = fn("progressContent", "db", "PortalState", "portalIsAdmin")(fakeDb, { detail: {}, entries: [{ id: "e1", slug: "e-one", title: "E" }] }, () => false)();
    expect(content.find("episode", "v-published")).toBeTruthy();
    for (const s of ["draft", "revision", "archived"]) expect(content.find("episode", "v-" + s)).toBe(null);
    expect(content.find("book", "s1")).toBe(null);
    expect(content.find("book", "s2")).toBeTruthy();
    expect(content.find("activity", "a1")).toBe(null);
    expect(content.find("activity", "a2")).toBeTruthy();
    expect(content.find("entry", "e-one")).toBeTruthy();     // the portal's entries come back published only
  });

  it("forgets the last family's report whenever the portal session changes or ends", () => {
    const store = {};
    const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    let forgot = 0;
    const save = fn("portalSaveSession", "localStorage", "PORTAL_SESSION_KEY", "portalSavedSession", "progressForget")(
      ls, "k", () => ls.getItem("k") || "", () => { forgot++; });
    save("first-member"); expect(forgot).toBe(1);
    save("first-member"); expect(forgot).toBe(1);             // the same sign-in restored on a reload keeps it
    save("second-member"); expect(forgot).toBe(2);            // another member signs in on this tab
    save(""); expect(forgot).toBe(3);                         // the session ends (list failure, an entry or a game finding it gone)
    save(""); expect(forgot).toBe(3);
    for (const f of ["portalLoadEntry", "portalUnlock"]) expect(body(f)).toContain('portalSaveSession("")');
    expect(body("progressForget")).toContain("S.grownUpOk = false");
  });

  it("keeps no stale error when kid-progress says no_session, so a new sign-in starts fresh", async () => {
    const S = { loading: false, error: "", children: null, reports: {}, reportLoading: {}, reportFor: "" };
    let forgot = 0, signedOut = 0;
    const forget = () => { forgot++; S.error = ""; S.children = null; S.reports = {}; S.reportLoading = {}; };
    const ended = fn("progressSessionEnded", "progressForget", "portalSavedSession", "PortalState", "artCloudForget", "progressOnRoute", "rerender")(
      forget, () => "", { phase: "ready" }, () => { signedOut++; }, () => true, () => {});
    const noSession = async () => ({ ok: false, error: "no_session" });
    const load = fn("progressLoadChildren", "ProgressState", "kidCall", "progressSessionEnded", "progressOnRoute", "rerender", "async ")(S, noSession, ended, () => true, () => {});
    await load();
    expect(S.error).toBe("");
    expect(S.children).toBe(null);
    expect(forgot).toBe(1);
    expect(signedOut).toBe(1);                                 // the portal's sign-in gate shows
    const report = fn("progressLoadReport", "ProgressState", "kidCall", "progressSessionEnded", "progressOnRoute", "rerender", "async ")(S, noSession, ended, () => true, () => {});
    await report("c1");
    expect(S.reports.c1).toBe(undefined);
    for (const f of ["progressSaveChild", "progressRemoveChild"]) {
      const b = body(f);
      expect(b.indexOf("if (progressSessionEnded(r)) return;")).toBeGreaterThan(-1);
      expect(b.indexOf("if (progressSessionEnded(r)) return;")).toBeLessThan(b.indexOf("toast("));
    }
  });

  it("takes a phone's curly apostrophe in a name (D’Andre) as a straight one", () => {
    const clean = fn("progressCleanName")();
    expect(clean("D’Andre")).toBe("D'Andre");
    expect(clean(" ‘Bo’ ")).toBe("'Bo'");
    expect(/^[\p{L} '.-]{1,24}$/u.test(clean("D’Andre"))).toBe(true);
    const save = body("progressSaveChild");
    expect(save).toContain("const name = progressCleanName(form.elements.name.value);");
    expect(save.indexOf("progressCleanName(")).toBeLessThan(save.indexOf('kidCall("child_save"'));
  });

  it("no em dashes and no he/she in the new copy", () => {
    const code = view() + body("progressCheckAnswer") + body("portalMemberBar") + body("portalReportLink");
    expect(code.includes("—")).toBe(false);
    const words = (code.match(/'[^']*'|"[^"]*"/g) || []).join(" ");
    expect(words).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
  });
});

/* a stand-in for the page's E(): enough to see that a name is escaped */
const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const KIDS = [{ id: "c1", name: "Maya", grade: 2 }, { id: "c2", name: "Leo", grade: 4 }];
/* one ACTIONS handler, as written in the page */
const action = (name) => html.split('"' + name + '": ')[1].split("\n  },")[0];

describe("who's playing, and recording what a child finishes", () => {
  /* progressRecord built with pretend parts: who's signed in, who's playing, and what kid-progress answers */
  const recorder = ({ session = "tok", playing = "", kids = KIDS, answer = { ok: true } } = {}) => {
    const calls = { kid: [], asked: 0, picked: [], done: [], fail: 0 };
    const S = { children: kids };
    let pick = playing;
    const record = fn("progressRecord", "portalSavedSession", "progressKids", "recordTarget", "progressPlaying", "openWhoIsPlaying",
      "kidCall", "progressSessionEnded", "ProgressState", "progressSetPlaying", "renderTourRoot", "progressPaintMade", "PROGRESS_ASKED", "async ")(
      () => session, async () => (session ? S.children || [] : []), recordTarget, () => pick,
      (after) => { calls.asked++; calls.after = after; },
      async (action, extra) => { calls.kid.push([action, extra]); return typeof answer === "function" ? answer(extra) : answer; },
      (r) => !!r && r.error === "no_session", S, (v) => { pick = v; calls.picked.push(v); }, () => {}, () => {}, false);
    return { record, calls, S, setPick: (v) => { pick = v; } };
  };

  it("records nothing without a session", async () => {
    const b = body("progressRecord");
    expect(b.indexOf("recordTarget(")).toBeGreaterThan(-1);
    expect(b.indexOf("recordTarget(")).toBeLessThan(b.indexOf("kidCall("));
    const none = recorder({ session: "", playing: "c1" });
    await none.record("episode", "v1");
    expect(none.calls.kid).toEqual([]);
    expect(none.calls.asked).toBe(0);
    const grown = recorder({ playing: "grownup" });
    await grown.record("episode", "v1");
    expect(grown.calls.kid).toEqual([]);                        // Just me, the grown-up records nothing
    expect(grown.calls.asked).toBe(0);
    const maya = recorder({ playing: "c1" });
    await maya.record("book", "story-question-mark");
    expect(maya.calls.kid).toEqual([["record", { child: "c1", kind: "book", item: "story-question-mark" }]]);
  });

  it("asks who's playing once per page load, then records for the child picked", async () => {
    const t = recorder({ playing: "" });
    await t.record("entry", "e1");
    expect(t.calls.asked).toBe(1);
    expect(t.calls.kid).toEqual([]);
    t.setPick("c2");
    await t.calls.after();
    expect(t.calls.kid).toEqual([["record", { child: "c2", kind: "entry", item: "e1" }]]);
    t.setPick("");
    await t.record("episode", "v2");
    expect(t.calls.asked).toBe(1);                              // not asked a second time on this page load
    const done = [];
    await t.record("activity", "a1", { pressed: true, done: (kid) => done.push(kid) });
    expect(t.calls.asked).toBe(2);                              // pressing We made it! is asking on purpose
  });

  it("a saved child removed on another device: the pick is forgotten and the picker asks again, no error", async () => {
    const t = recorder({ playing: "c1", answer: { ok: false, error: "not_found" } });
    let failed = 0;
    await t.record("episode", "v1", { fail: () => failed++ });
    expect(t.calls.picked).toEqual([""]);
    expect(t.S.children).toBe(null);
    expect(failed).toBe(0);
  });

  it("the episode player loads YouTube's script only for a picked child", async () => {
    const watch = (session, playing) => {
      let loaded = 0;
      const w = fn("progressWatchEpisode", "portalSavedSession", "progressKids", "recordTarget", "progressPlaying", "loadYouTubeApi", "AppState", "window", "YT", "async ")(
        () => session, async () => (session ? KIDS : []), recordTarget, () => playing, () => { loaded++; return Promise.reject(new Error("offline")); },
        { route: { name: "video-detail", params: { id: "v1" } } }, {}, undefined);
      return w("v1", { isConnected: true }).then(() => loaded);
    };
    expect(await watch("", "c1")).toBe(0);                      // no portal session: YouTube's script never loads
    expect(await watch("tok", "grownup")).toBe(0);
    expect(await watch("tok", "c1")).toBe(1);
    const b = body("progressWatchEpisode");
    expect(b.indexOf("recordTarget(")).toBeLessThan(b.indexOf("loadYouTubeApi("));
    expect(b).toContain("new YT.Player(frame,");
    expect(b).toContain("watchedEnough(");
    expect(b).toContain('progressRecord("episode"');
    const play = action("play-embed");
    expect(play).toContain('id="ep-player"');
    expect(play).toContain("enablejsapi=1");
    expect(play).toContain('progressWatchEpisode(episode, wrap.querySelector("iframe"))');
  });

  it("an episode's watcher only ever drives its own player: a child who moved on to another episode is not recorded for the first", async () => {
    const run = async ({ frame, route }) => {
      const made = [];
      const YT = { Player: function(el, opts){ made.push(el); this.opts = opts; } };
      const w = fn("progressWatchEpisode", "portalSavedSession", "progressKids", "recordTarget", "progressPlaying", "loadYouTubeApi", "AppState", "window", "YT", "async ")(
        () => "tok", async () => KIDS, recordTarget, () => "c1", async () => {}, { route }, { YT }, YT);
      await w("ep-a", frame);
      return made;
    };
    const frameA = { isConnected: true };
    expect(await run({ frame: frameA, route: { name: "video-detail", params: { id: "ep-a" } } })).toEqual([frameA]);
    // the child moved to episode B before YouTube's script arrived: A's frame left the page
    expect(await run({ frame: { isConnected: false }, route: { name: "video-detail", params: { id: "ep-b" } } })).toEqual([]);
    // or A's frame is somehow still there but the page is B's
    expect(await run({ frame: frameA, route: { name: "video-detail", params: { id: "ep-b" } } })).toEqual([]);
    expect(await run({ frame: null, route: { name: "video-detail", params: { id: "ep-a" } } })).toEqual([]);
    expect(body("progressWatchEpisode")).not.toContain('getElementById("ep-player")');
  });

  it("the book listener checks the origin", () => {
    expect(html).toContain("doneFromMessage(ev.data, ev.origin, location.origin)");
    const l = html.split("doneFromMessage(ev.data, ev.origin, location.origin)")[1].slice(0, 900);
    expect(l).toContain('progressRecord("book"');
  });

  it("opening a portal entry records it by its record id, a game entry only when it is played", () => {
    const seen = body("progressEntryOpened");
    expect(seen).toContain('e.layout === "game"');
    expect(seen).toContain('progressRecord("entry", e.id)');
    expect(body("viewNewsletterEntry")).toContain("progressEntryOpened(");
    expect(action("portal-play-private")).toContain("progressEntryPlayed()");
    expect(body("progressEntryPlayed")).toContain('progressRecord("entry", e.id)');
  });

  it("an admin trying out a game entry (a draft included) records nothing", () => {
    const played = (admin) => {
      const rec = [];
      fn("progressEntryPlayed", "portalCurrentEntry", "portalIsAdmin", "progressRecord")(
        () => ({ id: "e9", layout: "game", status: "draft" }), () => admin, (k, id) => rec.push([k, id]))();
      return rec;
    };
    expect(played(true)).toEqual([]);
    expect(played(false)).toEqual([["entry", "e9"]]);
  });

  it("progressKids waits for a load already under way, so nothing recorded in that moment is dropped", async () => {
    const S = { children: null, loading: false, error: "", reportFor: "" };
    let calls = 0, release;
    const kidCall = (action) => { calls++; return new Promise((res) => { release = () => res({ ok: true, children: KIDS }); }); };
    const load = fn("progressLoadChildren", "ProgressState", "kidCall", "progressSessionEnded", "progressOnRoute", "rerender", "async ")(
      S, kidCall, () => false, () => false, () => {});
    const kids = fn("progressKids", "ProgressState", "portalSavedSession", "progressLoadChildren")(S, () => "tok", load);
    const first = load();                                       // the report page (or Remove) started a load
    expect(S.loading).toBe(true);
    const got = kids();                                         // a record comes in while it runs
    const again = load();
    expect(calls).toBe(1);                                      // one request, shared
    release();
    expect(await got).toEqual(KIDS);
    await first; await again;
    expect(S.pending).toBe(null);
    expect(await kids()).toEqual(KIDS);
    expect(calls).toBe(1);
    expect(html).not.toContain("PROGRESS_KIDS_P");
  });

  it("a load the family signed out of meanwhile keeps nothing", async () => {
    const S = { children: null, loading: false, error: "", reportFor: "" };
    let release;
    const load = fn("progressLoadChildren", "ProgressState", "kidCall", "progressSessionEnded", "progressOnRoute", "rerender", "async ")(
      S, () => new Promise((res) => { release = () => res({ ok: true, children: KIDS }); }), () => false, () => false, () => {});
    const p = load();
    S.pending = null; S.loading = false;                        // progressForget() ran: another member, or signed out
    release();
    await p;
    expect(S.children).toBe(null);
    expect(body("progressForget")).toContain("S.pending = null");
  });

  it("We made it! shows only for a picked child", () => {
    const made = {};
    const inner = (session, playing, kids) => fn("progressMadeInner", "ProgressState", "portalSavedSession", "recordTarget", "progressPlaying", "PROGRESS_MADE", "progressWhen", "E")(
      { children: kids }, () => session, recordTarget, () => playing, made, () => "Thursday", esc)("a1");
    expect(inner("", "c1", KIDS)).toBe("");
    expect(inner("tok", "grownup", KIDS)).toBe("");
    expect(inner("tok", "c1", [])).toBe("");
    expect(inner("tok", "c1", null)).toBe("");
    const maya = inner("tok", "c1", KIDS);
    expect(maya).toContain("We made it!");
    expect(maya).toContain("Did Maya make it?");
    made["a1:c1"] = "2026-11-19T15:00:00Z";
    expect(inner("tok", "c1", KIDS)).toContain("Maya made this on Thursday");
    expect(body("viewActivity")).toContain("progressMadeHTML(a)");
    expect(action("progress-made")).toContain('"Nice work, "');
  });

  it("the picker offers Just me, the grown-up", () => {
    const h = fn("progressWhoHTML", "E")(esc)([{ id: "c1", name: "<Maya>" }, { id: "c2", name: "Leo" }]);
    expect(h).toMatch(/Who.s creating today\?/);              // owner, 2026-11-21: reading, watching or making
    expect(h).not.toMatch(/Who.s playing/);
    expect(h).toContain("assets/characters/chike-pose-wave");
    expect(h).toContain("Just me, the grown-up");
    expect(h).toContain('data-who="grownup"');
    expect(h).toContain('data-who="c1"');
    expect(h).toContain("&lt;Maya&gt;");
    expect(h).not.toContain("<Maya>");
  });

  it("the playing chip sits next to the avatar", () => {
    expect(body("renderTourRoot")).toContain("progressChipHTML(");
    const chip = (session, playing, kids) => fn("progressChipHTML", "portalSavedSession", "ProgressState", "progressPlaying", "E")(
      () => session, { children: kids }, () => playing, esc)();
    expect(chip("", "c1", KIDS)).toBe("");
    expect(chip("tok", "c1", [])).toBe("");
    const grown = chip("tok", "grownup", KIDS);                // the grown-up picked: a child can still say it's their turn
    expect(grown).toContain('data-act="who-open"');
    expect(grown).toMatch(/>Who.s creating\?</);
    expect(grown).not.toMatch(/Maya|Leo|playing/);
    for (const none of ["", "c9"]) {                           // nobody picked yet, or the saved child is gone
      expect(chip("tok", none, KIDS)).toMatch(/>Who.s creating\?</);
    }
    const c = chip("tok", "c2", KIDS);
    expect(c).toContain('class="tour-tag');
    expect(c).toContain('data-act="who-open"');
    expect(c).toContain(">Leo<");
    expect(c).toMatch(/aria-label="Leo is creating\. Change who.s creating"/);
    expect(c).not.toContain("playing");
    expect(html).toContain('const PLAYING_KEY = "ccs_playing_child";');
    expect(html).not.toContain("localStorage.clear()");
  });

  it("no em dashes and no he/she in the who's playing copy", () => {
    const code = ["progressWhoHTML", "progressChipHTML", "progressMadeInner", "progressRecord"].map(body).join("\n") + action("progress-made");
    expect(code.includes("—")).toBe(false);
    const words = (code.match(/'[^']*'|"[^"]*"/g) || []).join(" ");
    expect(words).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
  });
});

describe("Chike's pop quiz", () => {
  const MAYA = KIDS[0];
  /* progressQuizKid built with pretend parts: the page, who's signed in, who's creating, and Later */
  const quizKid = ({ route = { name: "home", params: {} }, session = "tok", playing = "c1", kids = KIDS, later = false } = {}) =>
    fn("progressQuizKid", "AppState", "quizBubbleAllowed", "portalSavedSession", "ProgressState", "progressPlaying", "recordTarget", "progressQuizLater")(
      { route }, quizBubbleAllowed, () => session, { children: kids }, () => playing, recordTarget, () => later)();
  const Q = { nuggetId: "book:kk-pyramid:t1", question: "What was a pharaoh?", choices: ["A ruler of ancient Egypt", "A kind of stone block", "A river in Egypt"], subject: "engineering" };
  const ICONS = { Engineering: '<svg data-icon="engineering"></svg>' };
  const answers = (q, st) => fn("progressQuizAnswersHTML", "E")(esc)(q, st);
  const reply = (q, st) => fn("progressQuizReplyHTML", "E")(esc)(q, st);
  const questionHTML = (...a) => fn("progressQuizQuestionHTML", "E", "STEAMM_ICONS", "progressSubjectLabel", "progressQuizAnswersHTML", "progressQuizReplyHTML")(
    esc, ICONS, (id) => (id === "engineering" ? "Engineering" : ""), answers, reply)(...a);
  /* the quiz's own CSS, between its two markers */
  const quizCss = () => html.split("/* ---- Chike's pop quiz ---- */")[1].split("/* ---- end of Chike's pop quiz ---- */")[0];
  const quizCode = () => ["progressQuizKid", "progressQuizBubbleHTML", "progressQuizBubble", "progressQuizOffer", "progressQuizQuestionHTML",
    "progressQuizAnswersHTML", "progressQuizReplyHTML", "progressQuizEndHTML", "openPopQuiz"].map(body).join("\n");

  it("the bubble only shows on list pages", () => {
    expect(body("renderTourRoot")).toContain("progressQuizBubble(");
    expect(body("progressQuizKid")).toContain("quizBubbleAllowed(AppState.route)");
    for (const name of ["home", "watch", "stories", "play", "create", "newsletter"]) expect(quizKid({ route: { name, params: {} } }), name).toEqual(MAYA);
    expect(quizKid({ route: { name: "video-detail", params: { id: "v1" } } })).toBe(null);     // an episode
    expect(quizKid({ route: { name: "watch", params: { id: "v1" } } })).toBe(null);
    expect(quizKid({ route: { name: "create", params: { app: "art" } } })).toBe(null);          // a Studio app
    expect(quizKid({ route: { name: "activity", params: { id: "a1" } } })).toBe(null);
    expect(quizKid({ route: { name: "admin", params: {} } })).toBe(null);
    expect(quizKid({ session: "" })).toBe(null);
    expect(quizKid({ playing: "grownup" })).toBe(null);                                         // Just me, the grown-up
    expect(quizKid({ playing: "" })).toBe(null);                                                // nobody picked yet
    expect(quizKid({ kids: null })).toBe(null);
    expect(quizKid({ later: true })).toBe(null);
    const b = fn("progressQuizBubbleHTML", "E")(esc)({ id: "c1", name: "<Maya>" });
    expect(b).toContain("Pop quiz! 3 quick questions about things you did.");
    expect(b).toMatch(/>Let.s go</);
    expect(b).toContain(">Later<");
    expect(b).toContain('data-act="quiz-go"');
    expect(b).toContain('data-act="quiz-later"');
    expect(b).not.toContain("<Maya>");
  });

  it("asks kid-progress whether a quiz is due at most once per page load per child", async () => {
    const offer = {}, calls = [];
    let shown = 0;
    const ask = fn("progressQuizOffer", "QUIZ_OFFER", "kidCall", "progressSessionEnded", "progressQuizBubble", "async ")(
      offer, async (action, extra) => { calls.push([action, extra]); return { ok: true, due: true }; }, () => false, () => { shown++; });
    await ask(MAYA);
    await ask(MAYA);
    expect(calls).toEqual([["quiz_offer", { child: "c1" }]]);
    expect(offer.c1).toBe(true);
    expect(shown).toBe(1);
    await ask(KIDS[1]);
    expect(calls).toHaveLength(2);
    const none = {};
    await fn("progressQuizOffer", "QUIZ_OFFER", "kidCall", "progressSessionEnded", "progressQuizBubble", "async ")(
      none, async () => ({ ok: false, error: "network" }), () => false, () => {})(MAYA);
    expect(none.c1).toBe(false);                                // not asked again on this page load
  });

  it("the bubble fades in once and is never drawn again by a redraw of the corner", () => {
    const b = body("progressQuizBubble");
    expect(b).toContain('getElementById("quiz-bubble")');
    expect(b).toContain("document.body.appendChild(");
    expect(body("renderTourRoot")).not.toContain("quiz-bubble");
    const css = quizCss();
    expect(css).toMatch(/\.quiz-bubble\{[^}]*animation:fade var\(--mo-dur-reveal\) var\(--mo-ease-out\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\{[^}]*\.quiz-bubble[^{]*\{[^}]*animation:none/);
  });

  it("Later waits for the next day", () => {
    const today = fn("progressToday")();
    expect(today(new Date(2026, 10, 21, 23, 59))).toBe("2026-11-21");   // the child's own calendar day
    expect(today(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
    const store = {};
    const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    const mem = {};
    let day = "2026-11-21";
    const setLater = fn("progressQuizSetLater", "localStorage", "QUIZ_LATER_MEM", "progressToday")(ls, mem, () => day);
    const isLater = () => fn("progressQuizLater", "localStorage", "QUIZ_LATER_MEM", "progressToday")(ls, mem, () => day)("c1");
    expect(isLater()).toBe(false);
    setLater("c1");
    expect(store).toEqual({ ccs_quiz_later_c1: "2026-11-21" });
    expect(isLater()).toBe(true);
    day = "2026-11-22";
    expect(isLater()).toBe(false);
    // a private window that keeps nothing: remembered for this page load
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    const mem2 = {};
    fn("progressQuizSetLater", "localStorage", "QUIZ_LATER_MEM", "progressToday")(broken, mem2, () => "2026-11-21")("c2");
    expect(fn("progressQuizLater", "localStorage", "QUIZ_LATER_MEM", "progressToday")(broken, mem2, () => "2026-11-21")("c2")).toBe(true);
    expect(action("quiz-later")).toContain("progressQuizSetLater(");
    expect(html).not.toContain("localStorage.clear()");
  });

  it("shows one question at a time with the picture, the STEAMM subject and where it came from", () => {
    const h = questionHTML(Q, 0, 3, { result: null }, { title: "<KK's> Pyramid", pic: "assets/kk.jpg" }, false);
    expect(h).toContain("What was a pharaoh?");
    expect(h).toContain('src="assets/kk.jpg"');
    expect(h).toContain('data-icon="engineering"');
    expect(h).toContain("Engineering");
    expect(h).toContain("From &lt;KK's&gt; Pyramid");
    expect(h).toContain("1 of 3");
    expect(h).toContain("chike-pose-");
    for (const c of Q.choices) expect(h).toContain(c);
    expect((h.match(/data-quiz="pick"/g) || []).length).toBe(3);
    // no picture or subject: neither shows, and nothing breaks
    const bare = questionHTML(Object.assign({}, Q, { subject: "" }), 2, 3, { result: null }, null, false);
    expect(bare).toContain("3 of 3");
    expect(bare).not.toContain('class="quiz__pic"');
    expect(bare).not.toContain("From ");
    // after the answer: Next, then Finish on the last one; Chike's pose shows how it went
    const right = { result: { correct: true, answer: 0, why: "Pharaohs ruled ancient Egypt." }, choice: 0 };
    expect(questionHTML(Q, 0, 3, right, null, false)).toMatch(/>Next</);
    expect(questionHTML(Q, 2, 3, right, null, false)).toMatch(/>Finish</);
    expect(questionHTML(Q, 0, 3, right, null, false)).toContain("chike-pose-thumbs-up");
    expect(questionHTML(Q, 0, 3, { result: { correct: false, answer: 0, why: "" }, choice: 1 }, null, false)).toContain("chike-pose-point.png");
    expect(questionHTML(Q, 0, 3, { result: null }, null, false)).not.toMatch(/>Next<|>Finish</);
  });

  it("a wrong answer is kind", () => {
    const wrong = reply(Q, { result: { correct: false, answer: 0, why: "Pharaohs ruled <ancient> Egypt." }, choice: 1 });
    expect(wrong).toContain("Good try!");
    expect(wrong).toMatch(/It.s <b>A ruler of ancient Egypt<\/b>/);
    expect(wrong).toContain("Pharaohs ruled &lt;ancient&gt; Egypt.");
    expect(wrong).not.toMatch(/wrong|incorrect|no!/i);
    const right = reply(Q, { result: { correct: true, answer: 0, why: "Pharaohs ruled ancient Egypt." }, choice: 0 });
    expect(right).toContain("You got it!");
    expect(right).toContain("Pharaohs ruled ancient Egypt.");
    // a question taken back mid-quiz: skipped kindly
    expect(reply(Q, { result: { skipped: true } })).toMatch(/skip/i);
    // the buttons: the right one green, the child's pick a soft neutral, all done with
    const a = answers(Q, { result: { correct: false, answer: 0, why: "" }, choice: 1 });
    expect(a).toMatch(/class="quiz__ans is-right"[^>]*disabled/);
    expect(a).toMatch(/class="quiz__ans is-missed"[^>]*disabled/);
    expect(a).not.toMatch(/red/i);
    expect(answers(Q, { result: null, busy: true, choice: 2 })).toMatch(/disabled/);          // a tap waits: no second tap
    expect(answers(Q, { result: null })).not.toMatch(/disabled/);
    const css = quizCss();
    expect(css).toContain(".quiz__ans.is-missed");
    expect(css).not.toMatch(/\bred\b|berry|#FBE3DF|#f00\b|crimson|tomato|coral/i);
    expect(quizCode()).not.toMatch(/["' ]red["' ]|-red\b|--red/);
  });

  it("acts only on the first answer, and skips a question taken back mid-quiz", () => {
    const o = body("openPopQuiz");
    expect(o).toContain("if (st.busy || st.result) return;");
    expect(o).toContain('kidCall("quiz_answer", { child: childId, quizId: quizId, nuggetId: q.nuggetId, choice: choice })');
    expect(o).toContain('res.error === "not_found"');
    expect(o).toContain("st.answered++");
    expect(o).toContain('kidCall("quiz_start", { child: childId })');
    expect(o).toContain("progressSessionEnded(");
  });

  it("K to 1st is read aloud", () => {
    const o = body("openPopQuiz");
    expect(o).toContain("speechSynthesis");
    expect(o).toContain('level === "k1"');
    expect(o).toContain('"speechSynthesis" in window');
    expect(o).toContain("speechSynthesis.cancel()");                         // and quiet again when the card closes
    expect(o.indexOf("speechSynthesis.cancel()", o.indexOf("const close"))).toBeGreaterThan(-1);
    const hear = questionHTML(Q, 0, 3, { result: null }, null, true);
    expect(hear).toContain('data-quiz="hear"');
    expect(hear).toContain("Hear it");
    expect(questionHTML(Q, 0, 3, { result: null }, null, false)).not.toContain("Hear it");
  });

  it("no score out of 100", () => {
    const end = fn("progressQuizEndHTML")();
    expect(end(2, 3)).toContain("You got 2 of 3 right. See you next week!");
    expect(end(1, 2)).toContain("You got 1 of 2 right. See you next week!");  // a question taken back is not counted
    expect(end(0, 0)).toContain("See you next week!");
    expect(end(0, 0)).not.toContain("0 of 0");
    const words = (quizCode().match(/'[^']*'|"[^"]*"/g) || []).join(" ");
    expect(words).not.toMatch(/%|\/100|out of 100|score|points/i);
  });

  it("no em dashes, no emojis and no he/she in the quiz copy", () => {
    const code = quizCode() + action("quiz-go") + action("quiz-later");
    expect(code.includes("—")).toBe(false);
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
    const words = (code.match(/'[^']*'|"[^"]*"/g) || []).join(" ");
    expect(words).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
  });
});
