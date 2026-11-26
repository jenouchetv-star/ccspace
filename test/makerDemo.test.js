// The Maker Program demo (owner, 2026-11-25; PRD workshop-prd.md, approved look docs/mockups/maker-demo-dashboard-draft.html, draft 3):
// a standalone, fictional, clickable prototype at assets/apps/maker-demo.html, opened from Admin > Partners > Maker program demo.
// Owner changes: one host per lesson; the guitar video is built from the site's activity "The Rubber-Band Guitar"
// (act-rubber-band-guitar), hosted by Stacey, with its real step pictures; demo prices instead of placeholders.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const page = read("assets/apps/maker-demo.html");
const html = read("index.html");
const fn = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];
const css = page.split("<style>")[1].split("</style>")[0];
const rule = (sel) => { const m = css.match(new RegExp("(^|\\n|\\})\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}")); return m ? m[2] : null; };

// the data and pure functions between CORE-START and CORE-END, loaded on their own
const core = page.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0];
const C = new Function(core + "\nreturn { SEED, HOST_ART, USE_POSES, POSE_NAMES, hostArt, frame, TOUR, TOUR_FLOWS, STAGES, SCREENS, PLANS, AGE_BANDS, TEAMS, freshState, headcountTotal, lessonLines, pauseMinutes, programMatches, TIMER_RATE, SPEEDS };")();
const lesson = C.SEED.lessons.find((l) => l.id === "l-music-3");

// the site's activity this video is built from
const act = html.split('A({ id:"act-rubber-band-guitar"')[1].split("\n    A({")[0];
const actSteps = act.split("steps:[")[1].split("]")[0].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));

describe("maker demo: where it lives", () => {
  it("has an Admin nav entry under Partners and renders the app in a full-width frame", () => {
    const nav = html.split("const ADMIN_NAV = [")[1].split("\n];")[0];
    const group = nav.split('{ heading:"Partners"')[1].split("{ heading:")[0];
    expect(group).toContain('{ hash:"#/admin/maker-demo",     label:"Maker program demo", icon:"presentation" }');
    expect(fn(html, "viewAdmin")).toContain('else if (section === "maker-demo") body = adminMakerDemo();');
    const view = fn(html, "adminMakerDemo");
    expect(view).toContain('const src = "assets/apps/maker-demo.html";');
    expect(view).toMatch(/<iframe class="maker-demo-frame" src="' \+ src \+ '"/);
    expect(view).toContain("width:100%");
  });

  it("is a standalone page that search engines skip, with no network calls besides fonts", () => {
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(page).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|supabase/i);
    const urls = page.match(/https?:\/\/[^"'\s)]+/g) || [];
    for (const u of urls) expect(u).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
    expect(page).toContain("Plus+Jakarta+Sans");
  });
});

describe("maker demo: the approved look", () => {
  it("has the dark presenter journey bar with 6 stages and 17 screens", () => {
    expect(C.STAGES).toEqual(["Sign up", "Schedule", "Prep", "Run", "Share", "Admin"]);
    expect(Object.keys(C.SCREENS)).toEqual(Array.from({ length: 17 }, (_, i) => "s" + (i + 1)));
    expect(rule(".jbar")).toContain("background:var(--ink)");
    const bar = fn(page, "jbarHTML");
    expect(bar).toContain("Screen ' + (i + 1) + \" of \" + SCREEN_ORDER.length");
    for (const id of ["jprev", "jnext", "tourBtn", "resetBtn"]) expect(bar).toContain('id="' + id + '"');
    expect(bar).toContain('seg("Setting", "mode"');
    expect(bar).toContain('seg("View as", "role"');
    expect(bar).toContain('seg("Demo speed", "speed"');
  });

  it("shows the real transparent logo with no plate around it", () => {
    expect(page).toContain('src="../brand/logo.webp"');
    const tags = page.match(/<[^<>]*>\s*<img src="\.\.\/brand\/logo\.webp"[^>]*>/g) || [];
    expect(tags.length).toBe(3);
    for (const t of tags) {
      expect(t).toMatch(/class="(pub__logo|side__logo)"/);
      expect(t).not.toMatch(/style=/);
    }
    for (const sel of [".pub__logo", ".pub__logo img", ".side__logo", ".side__logo img"]) {
      const r = rule(sel);
      expect(r).not.toBeNull();
      expect(r).not.toMatch(/background|border|box-shadow/);
    }
  });

  it("marks the current nav link with the blue highlighter stroke, hover in yellow", () => {
    expect(css).toContain("--hl-now:#8FE3F0");
    expect(rule(".hl")).toContain("--hl:var(--sun)");
    expect(rule(".hl")).toContain("linear-gradient(180deg,transparent 40%,var(--hl) 40%,var(--hl) 96%,transparent 96%)");
    expect(rule('.hl[aria-current="page"]')).toContain("--hl:var(--hl-now)");
    expect(rule(".hl:hover")).toContain("background-size:100% 1.3em");
    const side = fn(page, "appShell");
    expect(side).toContain('class="hl"');
    expect(side).toContain("aria-current=\"page\"");
    expect(rule(".side")).toContain("background:#fff");
  });

  it("uses the site's styleguide segmented control for every toggle", () => {
    expect(rule(".seg")).toContain("border:2.5px solid var(--ink)");
    expect(rule(".seg")).toContain("padding:3px");
    expect(rule(".seg")).toContain("background:var(--paper)");
    expect(rule(".seg")).toContain("gap:3px");
    expect(rule(".seg")).not.toMatch(/box-shadow/);
    expect(rule(".seg__opt")).toContain("border-radius:999px");
    expect(rule(".seg__opt")).toContain("padding:8px 18px");
    expect(rule(".seg__opt.is-on")).toBe(" background:var(--ink); color:var(--paper); ");
    expect(css).not.toMatch(/\.seg button \+ button|\.jseg|\.tabs button/);
    const seg = fn(page, "seg");
    expect(seg).toContain('class="seg" role="radiogroup"');
    expect(seg).toContain(`class="seg__opt' + (on ? " is-on" : "")`);
    expect(seg).toContain('role="radio" aria-checked="');
    expect(page).not.toMatch(/class="(seg|jseg|tabs)"[^>]*>\s*<button(?! type="button" class="seg__opt)/);
    for (const g of ["Setting", "View as", "Demo speed", "Plans for", "Repeats", "Week"]) expect(page).toContain('seg("' + g + '"');
    expect(page).toContain("tabs = (act, opts, cur, label) => seg(label, act, opts, cur)");
  });

  it("uses round pill buttons with hard ink shadows and the sky halftone band", () => {
    expect(rule(".btn")).toContain("border-radius:999px");
    expect(rule(".btn")).toContain("box-shadow:2px 2px 0 var(--ink)");
    expect(rule(".band")).toContain("var(--halftone)");
  });
});

describe("maker demo: one host per lesson", () => {
  it("gives every program exactly one host, and the guitar lesson to Stacey", () => {
    for (const p of C.SEED.programs) {
      expect(typeof p.host).toBe("string");
      expect(C.HOST_ART[p.host]).toBeTruthy();
      expect(p.hosts).toBeUndefined();
    }
    const host = (id) => C.SEED.programs.find((p) => p.id === id).host;
    expect(host("p-music")).toBe("stacey");
    expect(host("w-guitar")).toBe("stacey");
    expect(host("p-animate")).toBe("yuna");
    expect(host("p-boardgame")).toBe("mateo");
    expect(host("p-tinyhouse")).toBe("zech");
    expect(lesson.host).toBe("stacey");
    expect(lesson.cast).toBeUndefined();
    for (const c of lesson.chapters) for (const l of c.lines) expect(l.host).toBeUndefined();
    expect(page).not.toMatch(/Builder|Wonderer|Explainer|h-chike|side-hosts|Pops in/);
  });
});

describe("maker demo: the Rubber-Band Guitar video", () => {
  it("is built from the site's activity act-rubber-band-guitar", () => {
    expect(lesson.activityId).toBe("act-rubber-band-guitar");
    expect(act).toContain('character:"stacey"');
    expect(C.SEED.programs.find((p) => p.id === "w-guitar").lessonId).toBe("l-music-3");
    expect(C.SEED.schedules.find((s) => s.id === "s-2").programId).toBe("w-guitar");
  });

  it("has Welcome, 6 steps and The science, in order, with an auto-pause after each step", () => {
    expect(lesson.chapters.map((c) => c.name)).toEqual(["Welcome", "Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6", "The science"]);
    expect(lesson.chapters[0].title).toBe("Welcome and materials");
    const steps = lesson.chapters.filter((c) => c.step);
    expect(steps.map((c) => c.step)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const c of steps) expect(c.pause && c.pause.minutes).toBeGreaterThan(0);
    expect(lesson.chapters[0].pause).toBeNull();
    expect(C.TIMER_RATE).toBe(60);
    expect(C.SPEEDS).toEqual([1, 2, 4]);
    expect(fn(page, "pauseCardHTML")).toContain("Your turn");
    expect(page).toContain('id="timerNum" role="timer"');
  });

  it("uses the activity's exact step texts as captions and step cards, over its real step pictures", () => {
    expect(actSteps.length).toBe(6);
    lesson.chapters.filter((c) => c.step).forEach((c, i) => {
      expect(c.lines[0].text).toBe(actSteps[i]);
      expect(c.card.text).toBe(actSteps[i]);
      expect(c.pause.prompt).toBe(actSteps[i]);
      expect(c.frame).toBe("../activities/rubber-band-guitar/step-" + (i + 1) + "-large.jpg");
      expect(readFileSync(new URL("../assets/activities/rubber-band-guitar/step-" + (i + 1) + "-large.jpg", import.meta.url)).length).toBeGreaterThan(1000);
    });
    expect(fn(page, "stageHTML")).toContain('" of 6</span>"');
    expect(css).toContain("@keyframes kenburns");
    expect(rule(".stage.is-paused .stage__frame img")).toContain("animation-play-state:paused");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\{\s*\*, \*::before, \*::after\{ animation:none !important/);
  });

  it("ends with The science from the activity, then share and clean up", () => {
    const sci = lesson.chapters[lesson.chapters.length - 1];
    expect(sci.science).toBe(true);
    expect(sci.pause).toBeNull();
    expect(sci.card.title).toBe("Tighter and thinner strings make higher sounds");
    expect(act).toContain('title:"' + sci.card.title + '", text:"' + sci.card.text + '"');
    expect(sci.guide.ask).toBe("How is your box like a real guitar, and what is the box itself doing to the sound?");
    expect(act).toContain('discussionPrompt:"' + sci.guide.ask + '"');
    expect(fn(page, "stageHTML")).toContain("WAVES");
    expect(lesson.afterVideo.name).toBe("Share and clean up");
    expect(fn(page, "endChapter")).toContain("enterShare()");
  });

  it("uses the activity's materials and safety notes", () => {
    expect(lesson.materials).toEqual(["An empty tissue box or a shoebox with a hole cut in the lid", "4 rubber bands of different thicknesses", "2 pencils", "Tape"]);
    expect(lesson.safety).toEqual(["Rubber bands snap. Point the box away from faces while you stretch them on.", "A grown-up cuts the hole in the box."]);
    expect(fn(page, "panelHTML")).toContain("L.safety.map");
  });

  it("adds a short 'new here?' line to the library Welcome only", () => {
    expect(C.lessonLines(lesson, 0, "school").length).toBe(4);
    const lib = C.lessonLines(lesson, 0, "library");
    expect(lib.length).toBe(5);
    expect(lib[0].text).toMatch(/^New here\?/);
    expect(lib[0].text.length).toBeLessThan(80);
    expect(C.lessonLines(lesson, 1, "library").length).toBe(3);
    expect(C.pauseMinutes(lesson.chapters[6].pause, "school")).toBe(12);
    expect(C.pauseMinutes(lesson.chapters[6].pause, "library")).toBe(10);
  });
});

describe("maker demo: privacy", () => {
  it("shows school attendance as first name and last initial only", () => {
    expect(C.SEED.roster.length).toBe(12);
    for (const k of C.SEED.roster) {
      expect(k.display).toMatch(/^[A-Z][a-z]+ [A-Z]\.$/);
      expect(C.TEAMS).toContain(k.team);
      expect(Object.keys(k).sort()).toEqual(["display", "id", "orgId", "team"]);
    }
    expect(fn(page, "drawerHTML")).toContain("esc(k.display)");
  });

  it("counts library visitors by age band, with no names", () => {
    expect(C.AGE_BANDS.map((b) => b.id)).toEqual(["5-7", "8-10", "11-13", "adults"]);
    const s = C.freshState();
    expect(Object.keys(s.session.library.headcount)).toEqual(["5-7", "8-10", "11-13", "adults"]);
    expect(C.headcountTotal({ "5-7": 4, "8-10": 6, "11-13": 2, "adults": 5 })).toBe(17);
    expect(C.SEED.roster.every((k) => k.orgId === "org-lincoln")).toBe(true);
    expect(page).toContain('id="headcountList"');
    expect(page).toContain("Hands and projects, not faces.");
  });
});

describe("maker demo: demo prices", () => {
  it("shows the owner's demo prices, labeled as demo prices, with no placeholders left", () => {
    const P = (m, id) => C.PLANS[m].find((t) => t.id === id);
    expect([P("school", "starter").price, P("school", "starter").per]).toEqual(["$1,200", "per site, per year"]);
    expect([P("school", "plus").price, P("school", "plus").per, P("school", "plus").pick]).toEqual(["$2,400", "per site, per year", "Most schools pick this"]);
    expect([P("school", "full").price, P("school", "full").per]).toEqual(["$4,800", "per semester"]);
    expect([P("library", "starter").price, P("library", "starter").per]).toEqual(["$150", "per workshop"]);
    expect([P("library", "plus").price, P("library", "plus").per]).toEqual(["$1,500", "per year, up to 12 workshops"]);
    expect(P("library", "plus").inc).toContain("Materials kits included");
    expect([P("library", "full").price, P("library", "full").per]).toEqual(["$450", "per event"]);
    expect(P("library", "full").inc).toContain("Our team on site");
    expect(P("school", "plus").lines).toEqual([["Plus plan, 1 site", "$2,400"], ["Materials kits, 6 units", "Included"], ["Onboarding workshop", "Included"]]);
    expect(P("school", "plus").total).toBe("Total per year");
    expect(page).toContain(">Demo prices</span>");
    expect(fn(page, "jbarHTML") + page.split("V.s3 = ")[1].split("V.s4 = ")[0]).toContain("demoPrices");
    expect(page.split("V.s4 = ")[1].split("V.s5 = ")[0]).toContain("demoPrices");
    expect(page).not.toContain("[PRICE]");
    expect(page).not.toMatch(/\d+\s?(dollars|USD)\b/i);
  });
});

describe("maker demo: guided tour", () => {
  it("has 18 steps on both the school and library paths, each on a known screen", () => {
    for (const path of ["school", "library"]) {
      expect(C.TOUR[path].length).toBe(18);
      for (const st of C.TOUR[path]) {
        expect(C.SCREENS[st.screen]).toBeTruthy();
        expect(page).toMatch(new RegExp("\\b" + st.screen + ": \\{ role:"));
        expect(st.title.length).toBeGreaterThan(0);
        expect(st.target.length).toBeGreaterThan(0);
      }
      expect(C.TOUR[path][0].screen).toBe("s1");
      expect(C.TOUR[path][0].target).toBe("#heroCast");
      expect(C.TOUR[path][17].target).toBe("#expiryBadge");
      expect(C.TOUR[path].map((s) => s.setup)).toContain("science");
    }
    expect(C.TOUR.school[12].target).toBe("#nameChips");
    expect(C.TOUR.library[12].target).toBe("#headcountList");
    expect(C.TOUR_FLOWS.map((f) => f.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("names a real setup and action for every step that has one", () => {
    const setups = page.split("const TOUR_SETUP = {")[1].split("\n};")[0];
    const actions = page.split("const TOUR_ACTIONS = {")[1].split("\n};")[0];
    for (const st of C.TOUR.school.concat(C.TOUR.library)) {
      if (st.setup) expect(setups).toContain("  " + st.setup + ": ");
      if (st.action) expect(actions).toContain("  " + st.action + ": ");
    }
  });

  it("moves with the arrow keys, exits on Escape and traps focus in the tip", () => {
    expect(page).toContain('e.key === "ArrowRight"');
    expect(page).toContain('e.key === "ArrowLeft"');
    expect(page).toContain('if (e.key === "Escape") { e.preventDefault(); tourExit(); return; }');
    expect(page).toContain('id="tourTip" role="dialog" aria-modal="true" aria-labelledby="tourTitle"');
    expect(page).toContain('if (e.key === "Tab")');
  });

  it("hides the journey bar, sidebar and panel in projector mode, and Esc leaves it", () => {
    const proj = css.split("/* projector mode")[1];
    expect(proj).toContain("body.is-projector .jbar, body.is-projector .side, body.is-projector #sidePanel, body.is-projector .band{ display:none !important; }");
    expect(page).toContain("if (UI.projector) { e.preventDefault(); setProjector(false); }");
  });
});

describe("maker demo: Reset demo", () => {
  it("restores the seed: a fresh state is a clean copy that later changes never leak into", () => {
    const a = C.freshState();
    a.data.portfolio.push({ id: "x" });
    a.session.school.attendance.k1 = true;
    a.session.library.headcount["5-7"] = 9;
    a.data.showcases[0].link = "changed";
    const b = C.freshState();
    expect(b.data).toEqual(C.SEED);
    expect(b.data.portfolio.length).toBe(9);
    expect(b.session.school.attendance).toEqual({});
    expect(b.session.library.headcount["5-7"]).toBe(0);
    expect(C.SEED.showcases[0].link).toBeNull();
    expect(b.screen).toBe("s1");
    expect(b.mode).toBe("school");
  });

  it("replaces the live state and clears only the saved copy", () => {
    const reset = fn(page, "resetDemo");
    expect(reset).toContain("S = freshState();");
    expect(reset).toContain("P = freshPlayer();");
    expect(reset).toContain("localStorage.removeItem(STORE_KEY)");
    expect(page).toContain('const STORE_KEY = "ccsMakerDemo:v1";');
    expect(page).not.toContain("localStorage.clear(");
  });
});

describe("maker demo: host art", () => {
  it("keeps every host picture in one HOST_ART map: full-body poses, Stacey as the portrait until poses exist", () => {
    expect(Object.keys(C.HOST_ART)).toEqual(["chike", "stacey", "kiyah", "zech", "yuna", "corey", "mateo"]);
    expect(C.USE_POSES).toBe(true);
    expect(C.HOST_ART.kiyah.poses.wave).toBe("../characters/poses/kylah-wave.png");
    for (const id of Object.keys(C.HOST_ART)) {
      if (id === "stacey") continue;
      expect(Object.keys(C.HOST_ART[id].poses)).toEqual(C.POSE_NAMES);
      expect(Object.keys(C.HOST_ART[id].poses)).toEqual(["wave", "point", "explain", "think", "cheer"]);
      for (const p of Object.values(C.HOST_ART[id].poses)) {
        expect(p).toMatch(/^\.\.\/characters\/poses\/[a-z]+-[a-z]+\.png$/);
        expect(readFileSync(new URL("../assets/" + p.slice(3), import.meta.url)).length).toBeGreaterThan(1000);
      }
    }
    expect(C.HOST_ART.stacey.poses).toBeNull();
    expect(C.hostArt("stacey", "wave")).toBe("../characters/stacey.jpg");
    expect(page).not.toMatch(/stacey-(wave|point|explain|think|cheer)|averi/i);
    // no other picture paths of characters outside the map
    expect(page.replace(core, "")).not.toMatch(/characters\//);
  });
});

describe("maker demo: house rules", () => {
  it("has no em dashes, no emoji, says STEAMM and never STEM", () => {
    expect(page.includes("—")).toBe(false);
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(page).not.toMatch(/\bSTEM\b/);
    expect(page).toContain("STEAMM");
  });

  it("never uses he, she, his or her for the kid characters", () => {
    expect(page).not.toMatch(/\b(he|she|his|her|him|hers)\b/i);
  });

  it("labels the data as a demo and the admin numbers as sample data", () => {
    expect(page).toContain('<span class="jbar__tag">DEMO</span>');
    expect(page).toContain("Lincoln Elementary (demo)");
    expect(page).toContain("Maple Street Library (demo)");
    expect(page).toContain("Sample data");
  });
});
