// The Maker Program demo (owner, 2026-11-25; PRD workshop-prd.md, approved look docs/mockups/maker-demo-player-draft.html):
// a standalone, fictional, clickable prototype at assets/apps/maker-demo.html, opened from Admin > Partners > Maker program demo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const page = read("assets/apps/maker-demo.html");
const html = read("index.html");
const fn = (src, name) => src.split("function " + name + "(")[1].split("\nfunction ")[0];

// the data and pure functions between CORE-START and CORE-END, loaded on their own
const core = page.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0];
const C = new Function(core + "\nreturn { SEED, HOST_ART, USE_POSES, POSE_NAMES, hostArt, TOUR, TOUR_FLOWS, AGE_BANDS, TEAMS, freshState, headcountTotal, lessonLines, pauseMinutes, programMatches, TIMER_RATE, SPEEDS };")();
const lesson = C.SEED.lessons.find((l) => l.id === "l-music-3");

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
    expect(page).toContain('src="../brand/logo.webp"');
  });
});

describe("maker demo: Strings & Pitch", () => {
  it("has the 5 chapters in order and auto-pauses 4 times", () => {
    expect(lesson.title).toBe("Strings & Pitch");
    expect(lesson.chapters.map((c) => c.name)).toEqual(["Hook", "Mini-lesson", "Make time", "Share & reflect", "Wrap-up"]);
    const pauses = lesson.chapters.filter((c) => c.pause);
    expect(pauses.length).toBe(4);
    expect(pauses.map((c) => c.pause.type)).toEqual(["turn-and-talk", "try-it", "make-timer", "share"]);
    expect(lesson.chapters[4].pause).toBeNull();
    expect(lesson.chapters[2].pause.minutes).toBe(45);
    expect(C.TIMER_RATE).toBe(60);
    expect(C.SPEEDS).toEqual([1, 2, 4]);
  });

  it("casts Chike as the Builder and mascot, Kiyah as the Wonderer, Stacey as the Explainer", () => {
    expect(lesson.cast).toEqual({ "h-builder": "chike", "h-wonderer": "kiyah", "h-explainer": "stacey", "h-chike": "chike" });
    expect(lesson.chapters[2].lines.some((l) => l.host === "h-chike" && /Your turn, makers!/.test(l.text))).toBe(true);
  });

  it("adds the 'new here?' intro to the library Hook only", () => {
    expect(C.lessonLines(lesson, 0, "school").length).toBe(4);
    expect(C.lessonLines(lesson, 0, "library")[0].text).toMatch(/^New here\?/);
    expect(C.pauseMinutes(lesson.chapters[2].pause, "library")).toBe(35);
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
    const drawer = page.split("function drawerHTML(")[1].split("\nfunction ")[0];
    expect(drawer).toContain("esc(k.display)");
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

  it("uses only [PRICE] placeholders, never real prices", () => {
    expect(page).toContain("[PRICE]");
    expect(page).not.toMatch(/[$£€]\s?\d/);
    expect(page).not.toMatch(/\d+\s?(dollars|USD)\b/i);
  });
});

describe("maker demo: guided tour", () => {
  it("has 18 steps on both the school and library paths, each on a known screen", () => {
    for (const path of ["school", "library"]) {
      expect(C.TOUR[path].length).toBe(18);
      for (const st of C.TOUR[path]) {
        expect(st.screen).toMatch(/^s\d+$/);
        expect(page).toMatch(new RegExp("\\b" + st.screen + ": \\{ role:"));
        expect(st.title.length).toBeGreaterThan(0);
        expect(st.target.length).toBeGreaterThan(0);
      }
      expect(C.TOUR[path][0].screen).toBe("s1");
      expect(C.TOUR[path][17].target).toBe("#expiryBadge");
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

  it("replaces the live state and clears the saved copy", () => {
    const reset = fn(page, "resetDemo");
    expect(reset).toContain("S = freshState();");
    expect(reset).toContain("P = freshPlayer();");
    expect(reset).toContain("localStorage.removeItem(STORE_KEY)");
    expect(page).not.toContain("localStorage.clear(");
  });
});

describe("maker demo: host art", () => {
  it("keeps every host picture in one HOST_ART map, ready for the pose PNGs", () => {
    expect(Object.keys(C.HOST_ART)).toEqual(["chike", "kiyah", "stacey", "zech", "yuna", "corey", "mateo", "averi"]);
    expect(C.HOST_ART.kiyah.portrait).toBe("../characters/kylah.jpg");
    expect(C.HOST_ART.chike.portrait).toBe("../characters/chike.jpg");
    for (const id of Object.keys(C.HOST_ART)) {
      expect(Object.keys(C.HOST_ART[id].poses)).toEqual(C.POSE_NAMES);
      expect(Object.keys(C.HOST_ART[id].poses)).toEqual(["wave", "point", "explain", "think", "cheer"]);
      for (const p of Object.values(C.HOST_ART[id].poses)) expect(p).toMatch(/^\.\.\/characters\/poses\/[a-z]+-[a-z]+\.png$/);
    }
    expect(C.USE_POSES).toBe(false);
    expect(C.hostArt("stacey", "explain")).toBe("../characters/stacey.jpg");
    // no other picture paths of characters outside the map
    const outside = page.replace(core, "");
    expect(outside).not.toMatch(/characters\/[a-z]+\.(jpg|png)/);
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
    expect(page).toContain('<span class="demo">DEMO</span>');
    expect(page).toContain("Lincoln Elementary (demo)");
    expect(page).toContain("Maple Street Library (demo)");
    expect(page).toContain("Sample data");
  });
});
