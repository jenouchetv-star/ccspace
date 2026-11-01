// Pic Pop Puzzle is one self-contained page, for subscribers only (like Gravity 4): its source is a private file
// (supabase/private-games/pic-pop-puzzle.html, never served), it runs as the example at the top of AI Lesson 04 in a
// sealed frame (so it can't load anything from the site), and its Play page card leads there.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../supabase/private-games/pic-pop-puzzle.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSql = readFileSync(new URL("../supabase/pic-pop-puzzle.sql", import.meta.url), "utf8");
const lessonSql = readFileSync(new URL("../supabase/ai-lesson-picture-puzzle.sql", import.meta.url), "utf8");

describe("Pic Pop Puzzle", () => {
  it("needs nothing from the site: its three pictures are inside the file", () => {
    expect((page.match(/src: 'data:image\/jpeg;base64,/g) || []).length).toBe(3);
    for (const name of ["Toy city", "Bike ride", "Basketball"]) expect(page).toContain("name: '" + name + "'");
    expect(page).not.toMatch(/(src|href)=["']\/?(assets|games)\//);
    expect(page).not.toContain("drawHills");
  });

  it("wears the site's look", () => {
    expect(page).toContain("family=Plus+Jakarta+Sans");
    expect(page).not.toContain("Fredoka");
    expect(page).toContain("--ink: #1E2226;");
    expect(page).toContain("--hard: 4px 4px 0 #1E2226;");
    expect(page).toContain('<h1>Pic Pop <span class="hl">Puzzle</span></h1>');
    expect(page).toContain(".ccs-staged .top { display: none; }");   // the Play page's stage bar names it
  });

  it("has a blue upload button, and says at the very bottom that uploaded pictures stay on the device", () => {
    expect(page).toContain('<button class="btn blue" type="button" id="pick">');
    expect(page).toContain("Upload your own image");
    expect(page).toContain(".btn.blue { background: var(--cyan); color: #fff; }");
    const bottom = page.slice(page.indexOf("</main>"), page.indexOf('<canvas id="confetti"'));
    expect(bottom).toContain("Pictures you upload stay on this device. They are never shared with anyone.");
  });

  it("plays with the keyboard: arrows move around, Enter picks a piece up, arrows slide it, Escape puts it down", () => {
    expect(page).toContain("var STEPS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };");
    expect(page).toContain("if (sel === p) {");                                              // carrying: the arrows slide the piece
    expect(page).toContain("setPos(p, next); setPos(q, pos); afterMove(); focusAt(next);");
    expect(page).toContain("if (where[q] === q) { announce('That spot is already finished. Try another way.'); return; }");
    expect(page).toContain("if (e.key === 'Escape' && sel !== null)");
    /* one piece in the Tab order at a time, words for screen readers, and a tip on the board */
    expect(page).toContain("tiles.forEach(function (t) { t.tabIndex = -1; });");
    expect(page).toContain('<p class="sr-only" id="announce" aria-live="polite"></p>');
    expect(page).toContain('aria-describedby="hint"');
    expect(page).toContain(".board-wrap:has(.tile:focus-visible) .kbd-tip { display: block; }");
    expect(page).toContain("tiles[p].setAttribute('aria-pressed', 'true')");
  });

  it("fits the lesson's example box: board and panel side by side, nothing to scroll", () => {
    expect(page).toContain("@media (min-width: 640px) and (max-height: 760px) {");
    expect(page).toContain("@media (min-width: 640px) and (max-height: 600px) {");
  });

  it("is a subscribers-only card on the Play page that opens AI Lesson 04, and is not a public file", () => {
    expect(existsSync(new URL("../games/pic-pop-puzzle.html", import.meta.url))).toBe(false);
    expect(gameSql).toContain("insert into games (id, data) values ('game-pic-pop-puzzle'");
    expect(gameSql).toContain('"kind":"members"');
    expect(gameSql).toContain('"path":""');
    expect(gameSql).toContain('"portalSlug":"how-to-build-your-own-puzzle-game"');
    const seed = index.split('G({ id:"game-pic-pop-puzzle"')[1].split("}),")[0];
    expect(seed).toContain('kind:"members"');
    expect(seed).toContain('portalSlug:"how-to-build-your-own-puzzle-game", path:""');
    expect(seed).toContain('cover:{ src:"assets/games/pic-pop-puzzle.jpg"');
    for (const f of ["../assets/games/pic-pop-puzzle.jpg", "../assets/games/pic-pop-puzzle-thumb.jpg"]) expect(existsSync(new URL(f, import.meta.url))).toBe(true);
    expect(index).toContain('"game-pic-pop-puzzle":   { vocabWord:"2D spatial awareness"');
    expect(index).not.toContain('"games/pic-pop-puzzle.html"');
  });

  it("shows a visitor why joining is worth it, in place of How to play, on a subscribers-only game's page", () => {
    const view = index.split("function viewGame(")[1].split("\nfunction ")[0];
    expect(view).toContain('(g.kind === "members" && !portalIsSubscriber() ? membersValueHTML(g)');
    const card = index.split("function membersValueHTML(")[1].split("\nfunction ")[0];
    expect(card).toContain("Why join our free mailing list?");
    for (const perk of ["Members-only games", "Kid-friendly AI lessons", "First looks", "Creative tips", "Free, with no spam"]) expect(card).toContain(perk);
    expect(card).toContain('data-act="open-mailing-list" data-next="/newsletter/');
    expect(card).toContain("Already joined? Sign in");
  });

  it("is AI Lesson 04's example, with the kid-friendly prompt and the same Word to know", () => {
    expect(lessonSql).toContain("'privateGameId', 'pg-picture-puzzle'");
    expect(lessonSql).toContain("$p$🧩 Pic Pop Puzzle!");
    expect(lessonSql).toContain("'vocabWord', '2D spatial awareness'");
    expect(lessonSql).toContain("'status', 'published'");
    expect(lessonSql).toContain("'cover', jsonb_build_object('src', 'assets/games/pic-pop-puzzle.jpg'");
  });
});
