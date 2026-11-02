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
    /* the only picture drawn is into the AI's own canvas, which is never put on the page */
    expect(page.match(/drawImage/g)).toHaveLength(1);
    expect(page).toContain('c.getContext("2d").drawImage(bmp, 0, 0);');
    expect(page).not.toMatch(/appendChild\(relay\.canvas\)|camCtx\.drawImage|xctx\.drawImage/);
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

describe("the camera in a sealed frame", () => {
  it("has the lesson page turn the camera on and pass pictures in, one at a time", () => {
    expect(index).toContain("const CamRelay = { stream: null, video: null, win: null, frame: null, timer: 0, waiting: false };");
    expect(index).toContain('win.postMessage({ ccsCameraFrame: bmp }, "*", [bmp]);');
    expect(index).toContain('if (!frame || /allow-same-origin/.test(frame.getAttribute("sandbox") || "")) return;');
    expect(index).toContain("if (!CamRelay.frame || !CamRelay.frame.isConnected || CamRelay.frame.contentWindow !== win){ camRelayStop(); return; }");
    expect(page).toContain('window.parent.postMessage({ ccsCamera:"start" }, "*");');
    expect(page).toContain('Promise.resolve(hands.send({ image:c })).catch(function(){}).then(next);');
  });

  it("asks on the page every time, so a game can never turn the camera on by itself", () => {
    expect(index).toContain("function camRelayConfirm(name){");
    expect(index).toContain("if (!(await camRelayConfirm(name))){");
    expect(index).toContain("use your camera?</h3>");
  });

  it("lists the gestures with big hands and room between them, and the keys as a tidy list", () => {
    expect(page).toContain(".glist{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }");
    expect(page).toContain(".gico svg{ width:52px; height:52px; }");
    expect(page).toContain('<dl class="keylist">');
    expect(page).toContain("<div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>Turn pages</dd></div>");
  });

  it("shows the book as a preview in the lesson's example box, opening the full-screen player", () => {
    expect(page).toContain('<div class="preview hidden" id="preview" role="button" tabindex="0"');
    expect(page).toContain('function openFull(){ try { window.parent.postMessage({ ccsExample:"fullscreen" }, "*"); } catch(_e){} }');
    expect(page).toContain("if (e.source === window.parent && e.data && e.data.ccsStaged)");
  });
});

describe("How Computers See on the Read page", () => {
  const storySql = readFileSync(new URL("../supabase/story-how-computers-see.sql", import.meta.url), "utf8");
  it("is a subscribers-only book whose card opens the lesson", () => {
    expect(storySql).toContain("'kind', 'members', 'portalSlug', 'how-to-build-a-hands-free-reader'");
    expect(index).toContain('if (s.kind === "members") return membersStoryCard(s);');
    expect(index).toContain("' Subscribers only</span>' + PAGE_CURL + '</div>'");
    expect(index).toContain('data-what="book"');
    expect(index).toContain("'This book is for subscribers'");
    expect(index).toContain('if (col === "stories" && r.kind === "members"){');
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
