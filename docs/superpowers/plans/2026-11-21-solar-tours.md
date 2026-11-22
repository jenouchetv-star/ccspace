# Solar System Sandbox Tours and Quizzes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 read-aloud tours inside the Solar System Sandbox, each with a "do something" stop and 3 quiz questions at the child's grade, with the answers counted in the child's progress report as a Science level and a list of questions to go over.

**Architecture:** The tours and questions are a JSON block inside the private game file (it ships as one srcdoc file). The game runs the tours with its own camera functions (`select`, `overview`, `setCompare`, the move mode) and posts each answer to the site (`{ ccsAnswer: {...} }`). The site records it for the picked child through the `kid-progress` function (new `game_answer` action, new `child_game_answers` table); Chike's pop quiz answers go into the same table. The report shows a word level per STEAMM subject and the missed questions.

**Tech Stack:** supabase/private-games/solar-system-sandbox.html (three.js r128), index.html, assets/lib/progress.js, supabase/functions/kid-progress/index.ts, Postgres, vitest (+ PGlite).

**Spec:** `docs/superpowers/specs/2026-11-21-solar-lessons-design.md`; level rule in `docs/superpowers/specs/2026-11-21-kid-progress-report-design.md` (Stage 3, "Level per subject"). Look: `docs/mockups/solar-tours-draft.html` (owner-approved).

## Global Constraints

- No Chike in the tours. The sandbox's own dark panel look (`--panel`, `--cyan`, `--blue`), as in the mockup.
- Levels: grade 0-1 `k1` (2 picture-friendly answers, question and answers read aloud), 2-3 `g23` (3 answers), 4-5 `g45` (3 answers that need the why). A 6th grader plays `g45`. Grade comes from the shared snippet `assets/lib/childGrade.snippet.js` (pasted verbatim; add the file to GAME_FILES in test/gradeAdjust.test.js); with no grade, the Tours list asks the grade once and remembers it (ccsSave bridge).
- Tours (owner-approved names): The Sun, our star; Rocky planets; Gas giants; Why we have years; Moons; How big is Earth? (uses Compare sizes); Gravity holds us (move a planet); Rings and ice. 3 or 4 stops each, one of them a "do something" stop; then 3 questions.
- Facts must match the sandbox's own fact cards (NASA figures already in the file). Kid-friendly words, US units, no em dashes, no emojis, never he/she for a child.
- A wrong "do something" tap: "That's <planet>. Try another one!" and nothing counts. A wrong quiz answer: "Good try!" plus the right answer and the why; nothing red.
- Read-aloud: `speechSynthesis` when available (fixed lines; Kokoro clips can replace it later), a "Hear it again" button, cancelled when a tour closes.
- Level per subject (owner): over the last 8 weeks, fewer than 5 answers in a subject or under half right = "Getting started"; half to under 80% = "Growing"; 80% or more of at least 5 = "Strong". No numbers, percentages or letter grades shown to the parent.
- Answers count only for a picked child (recordTarget, as recording does); visitors and the grown-up count nothing. Only the site's own game stage frame may send answers (check `ev.source`).
- Owner rules: commit with explicit file lists; never push, deploy, apply live SQL or upload the private game without the owner's OK; never localStorage.clear().

## Review Focus

1. **A child leaves mid-tour or mid-quiz** (closes the tour, switches planet, Start over): speech stops, nothing breaks, partial answers already sent stay counted (Task 2 test `closing a tour cancels speech and resets the view`).
2. **Another frame or page posts a fake answer**: ignored unless it comes from the game stage frame (Task 4 test `answers only from the game stage frame`).
3. **A double tap on a quiz answer** is sent once (Task 2 test `an answer is sent once`).
4. **A child with no answers in a subject** sees no level for it, not "Getting started" for everything (Task 4 test `subjects with no answers show no level`).
5. **Server limits**: a flood of answers is rate-limited; text fields are capped (Task 3 tests `game_answer validates and limits`).

---

### Task 1: Tour content

**Files:** Modify `supabase/private-games/solar-system-sandbox.html` (a `<script type="application/json" id="toursData">` block); Create `test/solarTours.test.js`.

**Produces:** JSON shape: `[{ id, title, stops: [{ kind: "show"|"do", target: "sun"|"<planet id>"|"overview"|"compare"|"move:<planet id>", title: {k1,g23,g45}, text: {k1,g23,g45}, do?: { ask: {k1,g23,g45}, answer: "<planet id>", yes: {k1,g23,g45} } }], quiz: [{ id: "<tour>-q1", subject: "science", k1: { q, choices:[2], answer, why, pics: [planet ids] }, g23: { q, choices:[3], answer, why }, g45: { q, choices:[3], answer, why } }] }]` with exactly 8 tours, 3-4 stops each, exactly one "do" stop each, exactly 3 quiz items each. Planet ids as the game uses them (check `BODIES`/`P` ids in the file).

- [ ] Failing tests: `8 tours with the owner's names`; `every stop has all three reading levels`; `one do-something stop per tour, answering with a real planet id`; `3 questions per tour, 2 choices for k1 and 3 for the others, answer within choices`; `no em dashes, no emojis, no he/she`; `facts agree with the fact cards` (e.g. Jupiter "Over 90" moons, years per the file's `per`).
- [ ] Write the content; tests pass; commit `supabase/private-games/solar-system-sandbox.html test/solarTours.test.js` — "Solar System Sandbox: 8 tours and their questions at three reading levels".

### Task 2: The tours in the game

**Files:** Modify `supabase/private-games/solar-system-sandbox.html`; Test `test/solarTours.test.js`, `test/solarSandbox.test.js`, `test/gradeAdjust.test.js` (GAME_FILES).

- Tours button in the top bar (left of Pause), the Tours list panel (done checks, "Playing at 2nd grade. Change", grade picker when no grade), the stop card (title, text, dots, Hear it again, Back, Next), "do" stops listening to the existing planet taps (dock buttons and pointer picks call `select(p)`: hook there without changing normal play), the quiz card (k1 picture answers using the dock's planet pictures, read aloud; others text), the end line ("You got 2 of 3 right!").
- Camera per stop: `select(planet)` for a planet, `overview()` for "overview", `setCompare(true)` for "compare" (back to false after), the existing move mode for "move:<id>" (leave it on the planet's card with the Move button highlighted; do not change move physics).
- Done tours saved under the game's ccsSave name `"solar-system-sandbox"` (bridge as in remote-lunar-salvage.html; localStorage fallback in try/catch).
- Each quiz answer posts once: `parent.postMessage({ ccsAnswer: { game: "solar-system-sandbox", qid, subject: "science", level, correct, question, answer: <right choice text>, why } }, "*")`.
- [ ] Failing tests: `Tours button and list`, `stop card reads aloud and cancels on close`, `a do stop accepts only the right planet`, `an answer is sent once`, `k1 shows two picture answers`, `closing a tour cancels speech and resets the view`, `done tours are saved`, snippet in GAME_FILES.
- [ ] Implement; tests pass (`npx vitest run test/solarTours.test.js test/solarSandbox.test.js test/gradeAdjust.test.js`); full suite; commit — "Solar System Sandbox: tours with a do-something stop and a 3-question quiz".

### Task 3: Server: game answers

**Files:** Create `supabase/game-answers.sql`, `test/gameAnswersSql.test.js`; Modify `supabase/functions/kid-progress/index.ts`, `test/kidProgressFunction.test.js`.

- Table `child_game_answers(id bigint generated always as identity primary key, child_id uuid references children(id) on delete cascade, game text, qid text, subject text check in the six STEAMM ids, level text, correct boolean, question text, answer text, why text, at timestamptz default now())`, index (child_id, at desc); RLS on, no policies, closed to browser roles.
- Action `game_answer { child, game, qid, subject, level, correct, question, answer, why }`: own child only; game/qid `^[a-z0-9-]{1,40}$`; subject one of six; level k1|g23|g45; text fields trimmed and capped (question 300, answer 200, why 400); rate_take bucket `kid_answer` 200/hour/member -> `slow_down`.
- `quiz_answer` also inserts a row (game "pop-quiz", qid = nugget id, subject from nugget_subjects or skip when none, level, correct, question text, answer text, why).
- `report` adds `answers: { bySubject: { science: { asked, right } ... }, missed: [{ game, question, answer, why, at }] }` over the last 8 weeks (missed: newest 10 wrong answers).
- [ ] Failing tests (SQL: closed table, cascade, check constraint; function: `game_answer validates and limits`, own child only, quiz_answer also records, report summary and missed list). Implement; tests pass; commit with explicit files — "Progress: game answers count toward the report".

### Task 4: Site: record answers and show levels

**Files:** Modify `index.html`, `assets/lib/progress.js`; Test `test/progressLib.test.js`, `test/progressSite.test.js`.

- progress.js `subjectLevel({ asked, right }) -> "Getting started" | "Growing" | "Strong" | null` (null when asked is 0; the owner's cut-offs).
- index.html: a `message` listener accepting `ccsAnswer` only when `ev.source` is the game stage frame's contentWindow; for a picked child (recordTarget) calls `kidCall("game_answer", ...)`; no_session through progressSessionEnded.
- Report: in the learned container's STEAMM row, each subject with answers shows its level word under the counts; below the facts list, "Questions to go over" (missed: question, the right answer, the why; at most 5; hidden when none). No numbers or percentages for levels.
- [ ] Failing tests: `subjectLevel cut-offs` (4 answers all right = Getting started; 5 with 3 right = Growing; 5 with 4 right = Strong; 0 = null), `answers only from the game stage frame`, `only for a picked child`, `subjects with no answers show no level`, `questions to go over`. Implement; tests pass; full suite; commit — "Progress report: Science level and questions to go over from game answers".

### Task 5: Ship (owner's OK)

- [ ] Ask the owner, then: apply supabase/game-answers.sql; deploy kid-progress; upload pg-solar-system-sandbox (merged data, guarded, md5 = committed blob); end-to-end test with a throwaway example.test member (answers recorded, report levels), delete it; bump sw.js; push; verify live.
