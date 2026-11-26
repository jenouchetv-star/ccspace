// The Maker Program demo, version 3 (owner, 2026-11-26): one clickable simulation of the program for school and
// library partners, at assets/apps/maker-demo.html. Content follows the owner's program overview (2026-11-26).
// Hosts are the Chike & friends cartoon characters; prices are the overview's proposed prices; every adult screen is
// calm and editorial, and only what kids see (the video stage, pause cards, clips, the family showcase) wears the .com look.
// The page now opens full window from Admin (a "Present the demo" button), so no test here checks index.html.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const page = read("assets/apps/maker-demo.html");
const css = page.split("<style>")[1].split("</style>")[0];
const script = page.split("<script>")[1].split("</script>")[0];
const rule = (sel) => { const m = css.match(new RegExp("(^|\\n|\\})\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}")); return m ? m[2] : null; };
const view = (id) => script.split("V." + id + " = ")[1].split("\nV.")[0].split("\nfunction ")[0];
const fn = (name) => script.split("function " + name + "(")[1].split("\nfunction ")[0];

// the data and pure functions between CORE-START and CORE-END, loaded on their own
const core = page.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0];
const C = new Function(core + "\nreturn { STAGES, SCREENS, SCREEN_ORDER, screenTitle, HOSTS, pose, ROLES, CASTS, UNITS, WORKSHOPS, PROGRAMS, castFor, programMatches, LESSON, STEP_TEXTS, CONCEPT, DISCUSSION, SAFETY, lessonLines, videoSeconds, TEAMS, ROSTER, AGE_BANDS, headcountKids, ORGS, YEAR_PLAN, SHOWCASE_DAY, LIB_CALENDAR, scheduleDates, weekdayOf, nextWeekday, addDaysISO, PLANS, ADDONS, discountRate, checkoutTotals, fmtMoney, checkoutErrors, ORDER_NO, SETUP_STEPS, SETUP_FIELDS, setupMissing, SEED, PARTNERS, OPEN_DECISIONS, freshState, TOUR, TIMER_RATE, SPEEDS, STORE_KEY };")();

// visible copy: everything except the CSS and the code's own comments
const text = page.replace(/<style>[\s\S]*?<\/style>/, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*\/\/[^\n]*/g, "");

describe("maker demo v3: where it lives", () => {
  it("is a standalone full-window page that search engines skip, with no network calls besides fonts", () => {
    expect(page).toMatch(/^<!doctype html>/);
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(page).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|supabase/i);
    for (const u of page.match(/https?:\/\/[^"'\s)]+/g) || []) expect(u).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  });
});

describe("maker demo v3: the single journey", () => {
  it("has six presenter stages and every journey screen, each with a renderer", () => {
    expect(C.STAGES).toEqual(["Discover", "Partner", "Plan the year", "Run a session", "Share and report", "CCS admin"]);
    expect(C.SCREEN_ORDER).toEqual(["home", "schools", "libraries", "how", "pricing", "steps", "plans", "checkout", "agreement", "setup",
      "phome", "year", "catalog", "unit", "schedule", "team", "fhome", "prep", "run", "done", "portfolio", "builder", "family", "feedback", "report", "admin"]);
    for (const id of C.SCREEN_ORDER) expect(script).toContain("V." + id + " = ");
    const stages = C.SCREEN_ORDER.map((id) => C.SCREENS[id].stage);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    expect(C.screenTitle("phome", "library")).toBe("Librarian home");
    expect(C.screenTitle("portfolio", "library")).toBe("Event photo wall");
    expect(C.screenTitle("year", "library")).toBe("Workshop calendar");
  });

  it("puts the public pages in the site shell, the partner screens in the portal, and the family page in the brand", () => {
    for (const id of ["home", "schools", "libraries", "how", "pricing", "steps", "plans", "checkout", "agreement"]) expect(C.SCREENS[id].shell).toBe("pub");
    for (const id of ["setup", "phome", "year", "catalog", "unit", "schedule", "team", "fhome", "prep", "run", "done", "portfolio", "builder", "feedback", "report", "admin"]) expect(C.SCREENS[id].shell).toBe("app");
    expect(C.SCREENS.family.shell).toBe("fam");
  });

  it("has the dark presenter bar with Back, Next, School / Library, view as, speed, tour and reset", () => {
    expect(rule(".jbar")).toContain("background:var(--ink)");
    const bar = fn("jbarHTML");
    for (const id of ["jprev", "jnext", "tourBtn", "resetBtn"]) expect(bar).toContain('id="' + id + '"');
    expect(bar).toContain('seg("Setting", "mode", [["school", "School"], ["library", "Library"]]');
    expect(bar).toContain('seg("View as", "role"');
    expect(bar).toContain('seg("Demo speed", "speed"');
  });

  it("marks the current public link with the highlighter stroke and Home marks nothing", () => {
    expect(rule(".hl")).toContain("linear-gradient(180deg,transparent 40%,var(--hl) 40%,var(--hl) 96%,transparent 96%)");
    expect(rule('.hl[aria-current="page"]')).toContain("--hl:var(--hl-now)");
    expect(css).toContain("--hl-now:#8FE3F0");
    const pub = fn("pubShell");
    expect(pub).toContain('const cur = { schools: "schools", libraries: "libraries", how: "how", pricing: "pricing" }[S.screen] || "";');
    for (const l of ['"For schools"', '"For libraries"', '"How it works"', '"Pricing"']) expect(pub).toContain(l);
  });

  it("gives the portal an ink rail with the transparent logo at 64px, partner name, nav and user", () => {
    expect(rule(".rail")).toContain("background:var(--ink)");
    expect(rule(".rail__logo img")).toBe(" height:64px; width:auto; ");
    expect(rule('.rail__nav button[aria-current="page"]')).toContain("background:var(--blue)");
    const shell = fn("appShell");
    expect(shell).toContain('src="../brand/logo.webp"');
    expect(shell).toContain('class="rail__org"');
    expect(shell).toContain('class="rail__user"');
    for (const sel of [".site__logo img", ".rail__logo img"]) expect(rule(sel)).not.toMatch(/background|border|box-shadow/);
  });
});

describe("maker demo v3: the design system", () => {
  it("uses the brief's color tokens", () => {
    for (const t of ["--ink:#1E2226", "--paper:#FAF4E6", "--canvas:#F2F3F1", "--surface:#FFFFFF", "--line:#E2E4E1", "--line-strong:#CDD1CC", "--slate:#56616A", "--blue:#1273B0", "--blue-soft:#E3EEF6", "--sun:#F2C230", "--sun-soft:#FBF1D2", "--leaf:#2F6B2C", "--leaf-soft:#E4F0E2", "--clay:#B4532A"]) expect(css).toContain(t);
    expect(rule(".portal")).toContain("background:var(--canvas)");
  });

  it("uses Plus Jakarta Sans only, the type scale, sentence case and no code-style labels", () => {
    expect(page).toContain("family=Plus+Jakarta+Sans");
    expect(page).not.toMatch(/Roboto|monospace|text-transform:\s*uppercase/i);
    expect(rule(".t-display")).toContain("font-size:40px; line-height:44px; font-weight:800; letter-spacing:-.02em");
    expect(rule(".t-title")).toContain("font-size:28px; line-height:34px; font-weight:800; letter-spacing:-.015em");
    expect(rule(".t-section")).toContain("font-size:19px; line-height:26px; font-weight:700");
    expect(css).toMatch(/body\{[^}]*font-size:16px; line-height:26px; font-weight:500/);
  });

  it("keeps portal panels quiet: 1px line, radius 12, no shadow, padding 24; portal buttons radius 10", () => {
    expect(rule(".panel")).toBe(" background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:24px; min-width:0; ");
    expect(rule(".btn")).toContain("border-radius:10px");
    expect(rule(".btn")).not.toMatch(/box-shadow/);
  });

  it("uses the styleguide segmented control: paper track, 3px padding, ink pill when chosen", () => {
    expect(rule(".seg")).toContain("padding:3px; background:var(--paper); gap:3px");
    expect(rule(".seg__opt.is-on")).toBe(" background:var(--ink); color:var(--paper); ");
    expect(fn("seg")).toContain('role="radiogroup"');
    expect(fn("seg")).toContain('role="radio" aria-checked="');
  });

  it("keeps hard shadows and the halftone on kid-facing surfaces and public buttons only", () => {
    const blocks = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "").split("}").map((b) => b.split("{")).filter((p) => p.length === 2);
    for (const [sel, body] of blocks) {
      const s = sel.trim();
      if (/\dpx \dpx 0 var\(--ink\)/.test(body)) expect(s).toMatch(/^(\.kid-|\.pbtn|body\.is-projector|@media)/);
      if (/var\(--halftone\)/.test(body) && !/^:root/.test(s)) expect(s).toMatch(/^\.kid-/);
    }
    expect(rule(".kid-stage")).toContain("border:3px solid var(--ink)");
    expect(rule(".kid-pause__in")).toContain("box-shadow:5px 5px 0 var(--ink)");
    expect(view("run")).toContain("On the screen for the kids");
    expect(view("family")).not.toMatch(/class="(panel|btn|tbl)/);
  });

  it("follows the anti-slop copy rules: no em dashes, middle dots, arrows, emoji or all-caps styling", () => {
    expect(page).not.toMatch(/[—–·→]|&mdash;|&ndash;|&middot;|&rarr;/);
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("says STEAMM, never STEM", () => {
    expect(page).not.toMatch(/\bSTEM\b/);
    expect(page).toContain("STEAMM");
  });

  it("never uses he, she, his or her (the hosts and kids are children)", () => {
    expect(text).not.toMatch(/\b(he|she|his|her|him|hers|himself|herself)\b/i);
  });

  it("honors reduced motion and a visible keyboard focus", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\{\s*\*, \*::before, \*::after\{ animation:none !important; transition:none !important; \}/);
    expect(rule(":focus-visible")).toContain("outline:3px solid var(--blue)");
  });
});

describe("maker demo v3: hosts and the lesson video", () => {
  it("uses the eight Chike & friends characters, with every pose file on disk", () => {
    expect(Object.keys(C.HOSTS)).toEqual(["chike", "stacey", "kiyah", "zech", "corey", "yuna", "mateo", "averi"]);
    expect(C.HOSTS.kiyah.file).toBe("kylah");
    for (const id of Object.keys(C.HOSTS)) for (const p of ["wave", "point", "explain", "think", "cheer"]) {
      expect(existsSync(new URL("../assets/characters/poses/" + C.HOSTS[id].file + "-" + p + ".png", import.meta.url))).toBe(true);
    }
    expect(C.ROLES.map((r) => r.name)).toEqual(["The Wonderer", "The Explainer", "The Builder", "Chike, the mascot"]);
  });

  it("casts Strings and pitch: Kiyah wonders, Mateo explains, Stacey builds, Chike is the mascot; one Builder per unit", () => {
    expect(C.CASTS["u-music"]).toEqual({ wonderer: "kiyah", explainer: "mateo", builder: "stacey", mascot: "chike" });
    for (const u of C.UNITS) { const c = C.CASTS[u.id]; expect(new Set([c.wonderer, c.explainer, c.builder]).size).toBe(3); expect(c.mascot).toBe("chike"); }
    expect(C.castFor(C.WORKSHOPS.find((w) => w.id === "w-guitar"))).toBe(C.CASTS["u-music"]);
    expect(C.LESSON.cast).toBe(C.CASTS["u-music"]);
  });

  it("opens with a lesson intro, then the overview's five steps with their minutes", () => {
    const ch = C.LESSON.chapters;
    expect(ch.map((c) => c.name)).toEqual(["Lesson intro", "Hook", "Mini-lesson", "Make time", "Share and reflect", "Clean-up and preview"]);
    expect(ch.slice(1).map((c) => c.minutes)).toEqual([10, 15, 45, 15, 5]);
    expect(ch[0].lines.map((l) => l.who)).toEqual(["chike", "kiyah", "mateo", "stacey", "chike"]);
    expect(ch[1].host).toBe("kiyah");
    expect(ch[1].pause.kind).toBe("Turn and talk");
    expect(ch[2].host).toBe("mateo");
    expect(ch[2].pause.kind).toBe("Quick test");
    expect(ch[5].host).toBe("chike");
    for (const c of ch.slice(1)) expect(c.pause.minutes).toBeGreaterThan(0);
    const secs = C.videoSeconds();
    expect(secs).toBeGreaterThanOrEqual(12 * 60);
    expect(secs).toBeLessThanOrEqual(16 * 60);
  });

  it("hosts the whole build with one Builder over Stacey's six step pictures, with the exact step texts", () => {
    expect(C.STEP_TEXTS).toEqual([
      "Stretch the four rubber bands around the box, across the hole, spaced apart.",
      "Slide a pencil underneath the bands at each end so they lift off the box.",
      "Pluck each band and listen. Put them in order from lowest to highest.",
      "Look at the ones that sounded highest. What do they have in common?",
      "Now move one pencil closer to the other and pluck the same band again.",
      "Work out how to play three different notes on a single band, then play a tune."
    ]);
    const make = C.LESSON.chapters.find((c) => c.id === "make");
    expect(new Set(make.lines.map((l) => l.who))).toEqual(new Set(["stacey"]));
    expect(make.lines.filter((l) => l.step).map((l) => l.text)).toEqual(C.STEP_TEXTS);
    for (let n = 1; n <= 6; n++) expect(existsSync(new URL("../assets/activities/rubber-band-guitar/step-" + n + "-large.jpg", import.meta.url))).toBe(true);
    expect(fn("stageHTML")).toContain("frame(line.step)");
    expect(css).toContain("@keyframes kenburns");
    expect(rule(".kid-stage.is-paused .kid-frame img")).toContain("animation-play-state:paused");
  });

  it("teaches the owner's concept, discussion question and safety notes", () => {
    expect(C.CONCEPT.title).toBe("Tighter and thinner strings make higher sounds");
    expect(C.CONCEPT.text).toBe("A plucked band vibrates back and forth. Thin, tight, short bands vibrate faster, and faster vibrations reach your ear as a higher note. Every stringed instrument is built around this one idea.");
    expect(C.DISCUSSION).toBe("How is your box like a real guitar, and what is the box itself doing to the sound?");
    expect(C.SAFETY).toEqual(["Rubber bands snap. Point the box away from faces while you stretch them on.", "A grown-up cuts the hole in the box."]);
    expect(fn("guideHTML")).toContain("LESSON.safety.map");
  });

  it("adds the hosts' short \"New here?\" welcome to the library hook only", () => {
    const hook = C.LESSON.chapters[1];
    expect(C.lessonLines(hook, "school").length).toBe(3);
    const lib = C.lessonLines(hook, "library");
    expect(lib.length).toBe(4);
    expect(lib[0].text).toMatch(/^New here\?/);
  });

  it("pauses at every turn with a timer and keeps captions on by default", () => {
    expect(fn("pauseHTML")).toContain("Your turn: ");
    expect(fn("timerHTML")).toContain('id="timerNum" role="timer"');
    expect(fn("endChapter")).toContain("enterPause()");
    expect(C.freshState().captions).toBe(true);
    expect(view("run")).toContain('id="ccBtn" data-act="captions"');
    expect(C.TIMER_RATE).toBe(20);
    expect(C.SPEEDS).toEqual([1, 2, 4]);
  });

  it("has projector mode with only the branded stage, and Esc leaves it", () => {
    expect(css).toContain("body.is-projector .jbar, body.is-projector .rail, body.is-projector #sidePanel, body.is-projector .phead, body.is-projector .kid-label, body.is-projector .chaps{ display:none !important; }");
    expect(script).toContain("if (UI.projector) { e.preventDefault(); setProjector(false); return; }");
  });
});

describe("maker demo v3: proposed prices and checkout", () => {
  const P = (m, id) => C.PLANS[m].find((p) => p.id === id);
  it("uses the overview's proposed prices", () => {
    expect([P("school", "starter").amount, P("school", "plus").amount, P("school", "full").amount]).toEqual([2000, 4000, 350]);
    expect(P("school", "full").per).toBe("per session, about $5,250 per 15-week semester");
    expect(C.ADDONS.school).toMatchObject({ amount: 450, per: "per unit" });
    expect([P("library", "workshop").amount, P("library", "annual").amount, P("library", "full").amount]).toEqual([300, 1200, 450]);
    expect(P("library", "annual").per).toBe("per year, up to 12 workshops");
    expect(C.ADDONS.library).toMatchObject({ amount: 90, per: "per workshop" });
    for (const m of ["school", "library"]) for (const p of C.PLANS[m].concat([C.ADDONS[m]])) expect(C.fmtMoney(p.amount)).toBe(p.price);
    expect(text).toContain("Proposed pricing");
    expect(page).not.toMatch(/\$1,500"|\$2,400|\$4,800|Demo prices/);
  });

  it("applies the district discount: 10% for 3 to 5 sites, 15% for 6 or more", () => {
    expect([1, 2, 3, 5, 6, 12].map(C.discountRate)).toEqual([0, 0, 0.1, 0.1, 0.15, 0.15]);
    expect(C.checkoutTotals("school", "plus", { sites: 1 })).toMatchObject({ subtotal: 4000, discount: 0, total: 4000, payments: 1 });
    expect(C.checkoutTotals("school", "plus", { sites: 3 })).toMatchObject({ subtotal: 12000, discount: 1200, total: 10800 });
    expect(C.checkoutTotals("school", "plus", { sites: 6 })).toMatchObject({ subtotal: 24000, discount: 3600, total: 20400 });
    expect(C.checkoutTotals("library", "annual", { sites: 3 })).toMatchObject({ subtotal: 3600, discount: 360, total: 3240 });
  });

  it("does the per-session, per-workshop, add-on and semester math", () => {
    expect(C.checkoutTotals("school", "full", { sites: 1, billing: "semester" })).toMatchObject({ total: 10500, payments: 2, perPayment: 5250 });
    expect(C.checkoutTotals("library", "workshop", { sites: 1, workshops: 4 }).total).toBe(1200);
    expect(C.checkoutTotals("school", "starter", { sites: 1, kits: 2 }).total).toBe(2900);
    expect(C.checkoutTotals("school", "plus", { sites: 1, kits: 2 }).kits).toBe(0);
    expect(C.checkoutTotals("library", "annual", { sites: 1, kits: 4 }).total).toBe(1560);
    expect(C.checkoutTotals("school", "plus", { sites: 40 }).sites).toBe(12);
    expect(C.fmtMoney(10800)).toBe("$10,800");
  });

  it("bills by invoice by default or by purchase order, and confirms with an order number", () => {
    const s = C.freshState();
    expect(s.order.method).toBe("invoice");
    expect(s.order.billing).toBe("annual");
    const b = { org: "Lincoln Elementary", contact: "Dana Brooks", email: "ap@mvusd.example", po: "" };
    expect(C.checkoutErrors(b, "invoice")).toEqual([]);
    expect(C.checkoutErrors(b, "po").map((e) => e.k)).toEqual(["po"]);
    expect(C.checkoutErrors(Object.assign({}, b, { email: "nope" }), "invoice")[0].msg).toBe("Enter a billing email, like name@school.example.");
    expect(C.ORDER_NO).toMatch(/^CCS-2026-\d{5}$/);
    expect(fn("confirmationHTML")).toContain("Sign the partnership agreement");
    expect(fn("placeOrder")).toContain("}, 1200);");
    expect(page).not.toMatch(/\b(?:\d{4}[ -]?){3}\d{4}\b/);
  });

  it("asks for both agreements and a typed name before signing", () => {
    const sign = fn("signAgreement");
    for (const k of ['"dpa"', '"terms"', '"name"']) expect(sign).toContain(k);
    expect(view("agreement")).toContain('id: "provideTable"');
    expect(view("agreement")).toContain("Simulated e-signature. Nothing is sent.");
  });
});

describe("maker demo v3: setup, plan, run, share", () => {
  it("has the 5 setup steps, prefilled, with library variants", () => {
    expect(C.SETUP_STEPS.school).toEqual(["School details", "Contacts and billing", "Program setup", "Your team", "Agreements"]);
    expect(C.SETUP_STEPS.library[0]).toBe("Library details");
    const titles = C.SETUP_FIELDS.school[2].map((s) => s.title);
    expect(titles).toEqual(["Your group", "Room tech", "Kit shipping"]);
    const v = C.freshState().setup.v.school;
    for (let n = 1; n <= 5; n++) expect(C.setupMissing("school", n, v)).toEqual([]);
    expect(C.setupMissing("school", 1, Object.assign({}, v, { name: " " })).map((e) => e.k)).toEqual(["name"]);
    expect(C.setupMissing("school", 4, Object.assign({}, v, { team: [] })).map((e) => e.k)).toEqual(["team"]);
  });

  it("seeds the year plan with the owner's units and dates", () => {
    const y = C.YEAR_PLAN.map((p) => [p.unit, p.start, p.end, p.status]);
    expect(y).toEqual([["u-tinyhouse", "2026-09-16", "2026-10-21", "done"], ["u-music", "2026-11-11", "2026-12-16", "now"], ["u-animate", "2027-01-13", "2027-02-17", "next"], ["u-boardgame", "2027-02-24", "2027-03-17", "next"], [null, "2027-04-14", "2027-05-19", "open"]]);
    expect(C.YEAR_PLAN[3].group).toBe("K-2 group");
    expect(C.SHOWCASE_DAY).toBe("2027-05-27");
    for (const p of C.YEAR_PLAN) expect(C.weekdayOf(p.start)).toBe(3);
  });

  it("works out the six weekly dates for a unit", () => {
    expect(C.scheduleDates("2027-01-13", 6)).toEqual(["2027-01-13", "2027-01-20", "2027-01-27", "2027-02-03", "2027-02-10", "2027-02-17"]);
    expect(C.nextWeekday("2027-01-11", 3)).toBe("2027-01-13");
    expect(C.weekdayOf("2026-11-25")).toBe(3);
  });

  it("seeds the library calendar on real Saturdays and a Monday to Friday camp week", () => {
    const c = (id) => C.LIB_CALENDAR.find((x) => x.id === id);
    expect([c("c2").date, c("c3").date, c("c4").date]).toEqual(["2026-12-05", "2026-12-19", "2027-01-09"]);
    for (const id of ["c0", "c1", "c2", "c3", "c4"]) expect(C.weekdayOf(c(id).date)).toBe(6);
    expect([C.weekdayOf(c("c5").date), C.weekdayOf(c("c5").end)]).toEqual([1, 5]);
    expect([c("c2").minutes, c("c3").minutes, c("c4").minutes]).toEqual([75, 90, 60]);
  });

  it("lists the overview's unit library and launch workshops", () => {
    expect(C.UNITS.map((u) => [u.title, u.grades, u.sessions])).toEqual([["Build a Musical Instrument", "3-5", 6], ["Animate Your Own Story", "3-5", 6], ["Engineer a Tiny House", "3-5", 6], ["Design a Board Game", "K-2", 4]]);
    expect(C.UNITS[0].list.map((s) => s.title)).toEqual(["Sound and vibration", "Drums and rhythm", "Strings and pitch", "Wind and air", "Design your own instrument", "Rehearse and showcase"]);
    expect(C.WORKSHOPS.map((w) => [w.title, w.minutes])).toEqual([["Rubber-Band Guitar Workshop", 75], ["Stop-Motion Mini Movie Workshop", 90], ["Build-a-Board-Game Workshop", 60]]);
    const f = { format: "workshop", grades: "all", focus: "all" };
    expect(C.PROGRAMS.filter((p) => C.programMatches(p, f)).length).toBe(3);
    expect(C.PROGRAMS.filter((p) => C.programMatches(p, { format: "all", grades: "all", focus: "Music" })).map((p) => p.id)).toEqual(["u-music", "w-guitar"]);
  });

  it("seeds Lincoln Elementary and Maple Street Library as fictional partners with .example emails", () => {
    expect(C.ORGS.school).toMatchObject({ name: "Lincoln Elementary", parent: "Maple Valley Unified", coordinator: "Dana Brooks", facilitator: "Ms. Rivera", room: "Room 104", kids: 22 });
    expect(C.ORGS.library).toMatchObject({ name: "Maple Street Library", parent: "Riverbend Library System" });
    for (const e of page.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []) expect(e).toMatch(/\.example$/);
    const fac = C.SEED.facilitators.school;
    expect(fac.some((f) => f.label === "Completed")).toBe(true);
    expect(fac.some((f) => f.label === "Invited")).toBe(true);
  });

  it("labels the CCS admin numbers as sample data and lists the open decisions", () => {
    expect(view("admin")).toContain("Sample data");
    expect(C.OPEN_DECISIONS.map((d) => d[0])).toEqual(["Final prices", "Kid host names", "First units and workshops to film", "Kit packing"]);
    expect(C.PARTNERS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("maker demo v3: privacy", () => {
  it("records school attendance as first name and last initial only, 22 kids in 5 teams of 4 to 5", () => {
    expect(C.ROSTER.length).toBe(22);
    expect(C.TEAMS).toEqual(["Comet", "Volt", "Nova", "Orbit", "Spark"]);
    for (const k of C.ROSTER) { expect(k.display).toMatch(/^[A-Z][a-z]+ [A-Z]\.$/); expect(Object.keys(k).sort()).toEqual(["display", "id", "team"]); }
    for (const t of C.TEAMS) { const n = C.ROSTER.filter((k) => k.team === t).length; expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(5); }
    expect(fn("drawerHTML")).toContain("esc(k.display)");
  });

  it("counts library visitors by age band, never by name", () => {
    expect(C.AGE_BANDS.map((b) => b.id)).toEqual(["5-7", "8-10", "11-13", "caregivers"]);
    expect(C.headcountKids({ "5-7": 3, "8-10": 9, "11-13": 5, caregivers: 4 })).toBe(17);
    expect(Object.keys(C.freshState().session.library.headcount)).toEqual(["5-7", "8-10", "11-13", "caregivers"]);
    expect(fn("drawerHTML")).toContain("No names are recorded.");
  });

  it("takes photos of projects and hands only, with a media-release check before saving", () => {
    expect(fn("drawerHTML")).toContain("Projects and hands only. No faces.");
    expect(fn("drawerHTML")).toContain("Everyone whose hands are in this photo has a signed media release.");
    expect(script.split("  capSave: () => {")[1].split("\n  },")[0]).toContain("if (!c.release)");
  });

  it("shares the family showcase by a private link that expires in 30 days, with no names", () => {
    expect(fn("linkExpiry")).toContain("addDaysISO(showcase().created || DEMO_TODAY, 30)");
    expect(C.addDaysISO("2026-11-25", 30)).toBe("2026-12-25");
    expect(view("builder")).toContain("No children\\'s names, no faces.");
    expect(view("family")).toContain("no names and no faces");
  });
});

describe("maker demo v3: guided tour and reset", () => {
  it("has 18 to 22 steps on each path, each on a known screen with a target", () => {
    for (const path of ["school", "library"]) {
      const t = C.TOUR[path];
      expect(t.length).toBeGreaterThanOrEqual(18);
      expect(t.length).toBeLessThanOrEqual(22);
      for (const s of t) { expect(C.SCREENS[s.screen]).toBeTruthy(); expect(s.target).toMatch(/^#/); expect(page).toContain('"' + s.target.slice(1) + '"'); }
    }
    const setups = script.split("const TOUR_SETUP = {")[1].split("\n};")[0], actions = script.split("const TOUR_ACTIONS = {")[1].split("\n};")[0];
    for (const s of C.TOUR.school.concat(C.TOUR.library)) { if (s.setup) expect(setups).toContain("  " + s.setup + ": "); if (s.action) expect(actions).toContain("  " + s.action + ": "); }
  });

  it("moves with the arrow keys, exits on Escape and traps focus in the tip", () => {
    expect(script).toContain('e.key === "ArrowRight"');
    expect(script).toContain('e.key === "ArrowLeft"');
    expect(script).toContain('if (e.key === "Escape") { e.preventDefault(); tourExit(); return; }');
    expect(script).toContain('id="tourTip" role="dialog" aria-modal="true"');
    expect(script).toContain('if (e.key === "Tab")');
  });

  it("resets to a clean copy of the seed and clears only its own saved key", () => {
    const a = C.freshState();
    a.data.portfolio.push({ id: "x" }); a.session.school.attendance.k1 = true; a.order.sites = 6;
    const b = C.freshState();
    expect(b.data).toEqual(C.SEED);
    expect(b.session.school.attendance).toEqual({});
    expect(b.order.sites).toBe(1);
    expect(b.screen).toBe("home");
    expect(C.STORE_KEY).toBe("ccsMakerDemo:v1");
    const reset = fn("resetDemo");
    expect(reset).toContain("S = freshState();");
    expect(reset).toContain("localStorage.removeItem(STORE_KEY)");
    expect(page).not.toContain("localStorage.clear(");
  });
});
