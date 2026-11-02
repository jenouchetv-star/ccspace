// The Hands-Free Reader (AI Lesson 05's example) is one self-contained page for subscribers: its source is a private
// file (supabase/private-games/gesture-lab.html, never served) that runs at the top of the lesson in a sealed frame.
// Hand gestures control the page (flip, scroll, text size, like, dark mode, focus mode, X-ray), and it needs the
// camera, so the portal's sealed frames are allowed to ask for it. It never shows the video, only the digital hand.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../supabase/private-games/gesture-lab.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const lessonSql = readFileSync(new URL("../supabase/ai-lesson-gesture-lab.sql", import.meta.url), "utf8");
const createSql = readFileSync(new URL("../supabase/ai-lessons-create.sql", import.meta.url), "utf8");

describe("Hands-Free Reader", () => {
  it("loads only the hand-tracking AI, from a pinned version, and nothing from the site", () => {
    expect(page).toContain('var MP = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";');
    expect(page).not.toContain("three.min.js");
    expect(page).not.toContain("cannon");
    expect(page).not.toMatch(/(src|href)=["']\/?(assets|games)\//);
  });

  it("asks before using the camera, and never shows the video: only the digital hand", () => {
    expect(page).toContain('id="start-camera"');
    expect(page).toContain('id="start-mouse"');
    expect(page).toContain("You won't see your video, only your digital hand.");
    expect(page).toContain('e.name === "NotAllowedError"');
    expect(page).not.toContain("drawImage");
  });

  it("gives every gesture a job, with a kind", () => {
    for (const [g, kind] of [["swipe", "motion"], ["point", "pointer"], ["pinch", "slider"], ["thumbs", "pose"], ["peace", "pose"], ["open", "pose"], ["rock", "pose"], ["fist", "rest"]])
      expect(page).toMatch(new RegExp("\\b" + g + ":\\s+\\{ name:[^\\n]*kind:\"" + kind + "\""));
    expect(page).toContain('if (g === "thumbs") like();');
    expect(page).toContain('if (g === "peace") setTheme(!dark);');
    expect(page).toContain('if (g === "open") setFocus(!focus);');
    expect(page).toContain("setTextSize(state.ts0 + (state.pinchY0 - py) * 1.8);");
    for (const gone of ["speechSynthesis", "SpeechSynthesisUtterance", "setReading", "Read aloud", "setVolume"]) expect(page).not.toContain(gone);
    expect(page).toContain('if (g === "rock") setXray(!xray);');
  });

  it("avoids mistakes: holds fill a ring, moving restarts it, and swipes cool down", () => {
    expect(page).toContain("var HOLD_MS = 700, SWIPE_MS = 500;");
    expect(page).toContain("if (moved > 0.06 && !state.holdDone) state.holdStart = now;");
    expect(page).toContain("state.cooldown = performance.now() + 900;");
  });

  it("is a book with a cover and six chapters about computer vision, and works with buttons and keys too", () => {
    expect(page).toContain('{ cover:true, title:"How Computers See" }');
    expect(page).toContain(".paper.flipped{ transform:rotateY(-180deg); }");
    expect(page).toContain(".book-area.opened .book-wrap{ transform:translateX(50%); }");
    for (const t of ["What is computer vision?", "Pictures are made of numbers", "Finding a hand: 21 points", "Turning points into gestures", "Where is computer vision used?", "Fair, safe and private"])
      expect(page).toContain('title:"' + t + '"');
    expect(page).toContain(':root[data-theme="dark"]{');
    for (const k of ['k === "ArrowRight"', 'k === "l" || k === "L"', 'k === "d" || k === "D"', 'k === "f" || k === "F"', 'k === "x" || k === "X"']) expect(page).toContain(k);
  });

  it("is a published lesson whose email is off, with a Create card that uses its cover", () => {
    expect(lessonSql).toContain("'status', 'published'");
    expect(lessonSql).toContain("hands-free-reader-cover.svg");
    expect(createSql.slice(createSql.indexOf("act-ai-lesson-gesture-lab"))).toContain("'status', 'published'");
    expect(createSql.slice(createSql.indexOf("act-ai-lesson-gesture-lab"))).toContain("hands-free-reader-cover.svg");
    expect(lessonSql).toContain("'email', jsonb_build_object('on', false");
    expect(lessonSql).toContain("'privateGameId', 'pg-gesture-lab'");
    expect(lessonSql).toContain("'slug', 'how-to-build-a-hands-free-reader'");
    expect(createSql).toContain("'portalSlug', 'how-to-build-a-hands-free-reader'");
    expect(existsSync(new URL("../games/gesture-lab.html", import.meta.url))).toBe(false);
  });

  it("lets the portal's sealed frames ask for the camera, without opening them up to the site", () => {
    expect(index).toContain('sandbox="allow-scripts allow-popups" allow="fullscreen; camera; clipboard-write"></iframe>');
    expect(index).toContain('srcdoc="\' + E(g.srcdoc) + \'" title="\' + E(g.title) + \'" sandbox="allow-scripts allow-popups" allow="fullscreen; camera; clipboard-write; autoplay"');
    expect(index).not.toMatch(/srcdoc="[^>]*allow-same-origin/);
  });
});

describe("Hands-Free Reader look", () => {
  it("has no emojis and none of Chike's branding", () => {
    expect(page).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    for (const brand of ["Chike", "Plus Jakarta", "#F2C230", "#BC3229", "4px 4px 0"]) expect(page).not.toContain(brand);
  });
});

describe("Admins never have to join", () => {
  it("opens subscribers-only lessons and games for an admin instead of the join box", () => {
    expect(index).toContain("function portalHasAccess(){ return portalIsSubscriber() || portalIsAdmin(); }");
    expect(index).toContain('if (next && portalIsAdmin()){ navigate("#" + next); return; }');
    expect(index).toMatch(/function membersActivityCard\(a\)\{[\s\S]*?const sub = portalHasAccess\(\);/);
    expect(index).toMatch(/function membersPoster\(g, what\)\{[\s\S]*?const sub = portalHasAccess\(\);/);
  });
});

describe("Admins see every page", () => {
  it("opens archived and draft pages for admins, and only for them", () => {
    expect(index).toContain("function adminSeesAll(){ return isAuthed() && isActiveAdmin(); }");
    expect(index).toContain('if (!a || (a.status === "archived" && !adminSeesAll())) return notFound("activity");');
    expect(index).toContain('if (!g || (g.status === "archived" && !adminSeesAll())) return notFound("game");');
    expect(index).toContain('if (!a || (a.status !== "published" && !adminSeesAll())) return notFound("article");');
    expect(index).not.toMatch(/\.status === "archived"\) return notFound\(/);
  });
});
