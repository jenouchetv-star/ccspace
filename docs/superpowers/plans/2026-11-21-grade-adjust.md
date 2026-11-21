# Grade-Adjusted Games and Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a child is picked ("Who's creating today?"), the nine games with a grade picker start at that child's grade, and Create's activities show the ones that fit the child's age first with a "Good for 2nd grade" tag.

**Architecture:** The site works out the picked child's grade (0 = Kindergarten ... 6) from `ProgressState.children` + `progressPlaying()`. It hands the grade to a game when it opens it: a `?grade=N` query for public games (same-origin iframes), an injected `<script>window.CCS_GRADE=N</script>` at the top of a private game's `srcdoc`. Each game reads it with one identical snippet and starts at its nearest level. Activities use the records' `ageMin`/`ageMax`.

**Tech Stack:** index.html, assets/lib/progress.js, standalone game HTML files (games/*.html, supabase/private-games/*.html), vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-grade-adjust-design.md`

## Global Constraints

- Only when `recordTarget(!!portalSavedSession(), progressPlaying(), ProgressState.children)` returns a child id. Visitors, "Just me, the grown-up", no pick, or children not loaded yet: the site passes nothing and everything works exactly as today.
- Grade is an integer 0..6. Anything else passed in (missing, "", "7", "2.5", "abc") is ignored by the games.
- A game never writes the passed grade into the parent's "Your children"; nothing new goes to the server.
- Owner rules: no em dashes, no emojis; never he/she for a child; mockups before building; commit with explicit file lists; never push, upload private games or touch the live DB without the owner saying so; never `localStorage.clear()`.
- Grade to age: grade G fits ages G+5 to G+6. An activity fits when `[ageMin, ageMax]` overlaps `[G+5, G+6]`.
- Grade labels: `gradeLabel(g)` from assets/lib/progress.js ("Kindergarten", "1st grade" ... "6th grade").

## Review Focus

1. **A 6th grader in a game that stops at 5th** plays 5th grade, and a Kindergartner in Remote Lunar Mission (1st to 5th) plays 1st (Tasks 4-7 tests `clamps to the game's range`).
2. **A child changes level inside a game**, then reopens it: the game starts at the child's grade again; nothing breaks (Tasks 4-7 tests `the in-game change still works`).
3. **A bad or missing grade** never breaks a game or shows a blank screen (Task 2 test `childGradeFrom ignores bad values`, and each game test `no grade: the picker shows as today`).
4. **Restart** of a private game keeps the grade, because the injected script is part of the same `srcdoc` (Task 2 test `withChildGrade injects once, before the game's own scripts`).
5. **Activities with no age range** are not tagged and keep their usual order (Task 3 test `an activity without ages is not tagged`).

---

### Task 1: Mockup (owner checkpoint)

**Files:** Create `docs/mockups/grade-adjust-draft.html` (never committed).

- [ ] **Step 1:** Over real screenshots of the live Art and Craft Activities page and one game (headless Edge, as for the progress-report drafts), show: the "Good for 2nd grade" tag on matching activity cards (fitting ones first); and in a game, the small "Playing at 2nd grade. Change" line that replaces the grade picker.
- [ ] **Step 2:** Send it to the owner (SendUserFile, render). **Stop for the owner's OK.**

### Task 2: The shared rule and handing the grade to games

**Files:**
- Modify: `assets/lib/progress.js` (+ `gradeAges`, `activityFitsGrade`, `findAgeForGrade`, `childGradeFrom`, `withChildGrade`)
- Modify: `index.html` (`progressPickedGrade()`; `openGameStage` ~12807 passes the grade)
- Create: `assets/lib/childGrade.snippet.js` (the one snippet every game pastes; a test checks each game holds it verbatim)
- Test: `test/progressLib.test.js`, `test/gradeAdjust.test.js` (new)

**Interfaces (Produces):**
- `gradeAges(g) -> { min: g + 5, max: g + 6 }`
- `activityFitsGrade(a, g) -> boolean`: age overlap AND difficulty match (g 0-1: "easy"; 2-3: "medium"; 4-6: "challenge" or "medium"); false when `ageMin`/`ageMax`/`difficulty` missing (owner, 2026-11-21)
- `difficultyDistance(a, g) -> number` (0 when it matches the grade's difficulty, 1 one step away, 2 two steps; 3 when unknown), for ordering the rest
- `findAgeForGrade(g) -> "3-5" | "6-8" | "9-12"` (age g+5: 3-5 band for K, 6-8 for 1st to 3rd, 9-12 for 4th to 6th)
- `childGradeFrom(raw) -> number | null` (integer 0..6 from a number or a string of digits, else null)
- `withChildGrade(html, g) -> string` (puts `<script>window.CCS_GRADE=G;</script>` right after `<head>` if present, else at the very start; never twice)
- index.html `progressPickedGrade() -> number | null` (the picked child's grade, or null per Global Constraints)
- `openGameStage(g)`: when `progressPickedGrade()` is a number, a public game's `path` gets `grade=N` added (`?` or `&`), a private game's `srcdoc` goes through `withChildGrade`. Admin preview and books (`?story=`) unchanged.
- The snippet (verbatim in every game, before the game's start code):
  `const CCS_CHILD_GRADE = (() => { try { const raw = window.CCS_GRADE ?? new URLSearchParams(location.search).get("grade"); const n = typeof raw === "number" ? raw : /^[0-6]$/.test(String(raw)) ? Number(raw) : NaN; return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null; } catch (_e) { return null; } })();`

- [ ] **Step 1: Failing tests:** `childGradeFrom ignores bad values` ("", "7", "2.5", "abc", null -> null; 0, "0", "6" -> number); `gradeAges`; `activityFitsGrade` (5-9 medium fits grade 2; 5-9 easy does not fit grade 2 but fits grade 0; 9-12 easy doesn't fit grade 0; no ages or no difficulty -> false); `difficultyDistance`; `findAgeForGrade` (0 -> "3-5", 3 -> "6-8", 4 -> "9-12", 6 -> "9-12"); `withChildGrade injects once, before the game's own scripts`; in gradeAdjust.test.js: `openGameStage adds the grade only for a picked child` (fake progressPickedGrade null / 3; public path gets "?grade=3"; private srcdoc starts with the script after <head>); `the snippet file is the one every game uses` (reads the snippet file; Tasks 4-7 add each game to this list).
- [ ] **Step 2:** `npx vitest run test/progressLib.test.js test/gradeAdjust.test.js` -> FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command -> PASS; full suite once.
- [ ] **Step 5:** Commit `assets/lib/progress.js assets/lib/childGrade.snippet.js index.html test/progressLib.test.js test/gradeAdjust.test.js` — "Grade adjust: the site hands the picked child's grade to games".

### Task 3: Activities fit the child's age first

**Files:** Modify `index.html` (`viewCreate` sort ~12288, `activityCard` ~9832, the finder start ~29832); Test `test/gradeAdjust.test.js`.

- When `progressPickedGrade()` is a number: in `viewCreate` (browse and tech) fitting activities come first, the rest ordered by `difficultyDistance` (keeping the page's existing order on a tie); `activityCard` shows a small tag "Good for 2nd grade" (`"Good for " + gradeLabel(g)`; "Good for Kindergarten") on fitting cards; `AppState.finder.age = findAgeForGrade(g)` when the finder starts and no age was chosen.
- No pick: order, cards and finder exactly as today.

- [ ] **Step 1: Failing tests:** `fitting activities come first for a picked child`; `an activity without ages is not tagged`; `no pick: same order and no tag`; `the finder age is filled in`.
- [ ] **Step 2:** `npx vitest run test/gradeAdjust.test.js` -> FAIL.
- [ ] **Step 3:** Implement (tag styled like the site's existing small chips; no new colors).
- [ ] **Step 4:** PASS; `npx vitest run test/activityFinder.test.js test/gradeAdjust.test.js` PASS.
- [ ] **Step 5:** Commit `index.html test/gradeAdjust.test.js` — "Grade adjust: activities that fit the child's age come first, tagged".

### Task 4: Balloon Pop Math and Spelling Detective (grade-only start screens: skip the picker)

**Files:** Modify `games/balloon-pop-math.html` (picker `drawGrades` ~661, start ~674/688), `games/spelling-detective.html` (`openPicker()` at load ~1670, `chooseGrade` ~1328); Test `test/balloonPopMath.test.js`, `test/gradeAdjust.test.js` (+ both files to the snippet list).

- With `CCS_CHILD_GRADE` set: start straight at `min(grade, 5)` (Kindergarten id "k"), skipping the start screen; the HUD shows "Playing at 2nd grade" next to the existing "Change grade" button, which still opens the picker. Balloon Pop's saved-round Resume stays as today when no grade is passed.
- No grade: exactly as today.

- [ ] Tests: `starts at the child's grade without the picker`, `clamps to the game's range` (6 -> 5th), `no grade: the picker shows as today`, `the in-game change still works`. Run -> FAIL; implement; run `npx vitest run test/balloonPopMath.test.js test/gradeAdjust.test.js` -> PASS; commit both game files and tests — "Grade adjust: Balloon Pop Math and Spelling Detective start at the child's grade".

### Task 5: Chrono Billiards, Echo Matrix, Word Quest (title screens that also pick a mode: preselect and hide the grade row)

**Files:** Modify `games/chrono-billiards.html` (`buildGrades` ~1291), `games/echo-matrix.html` (~738), `games/word-quest.html` (~769); Tests `test/chronoBilliards.test.js`, `test/echoMatrix.test.js`, `test/wordQuest.test.js`, `test/gradeAdjust.test.js`.

- With a grade: the title screen still opens (it holds mode and hints), the grade is preselected as `min(grade, 5)` (K id "K") without overwriting the game's own saved grade key, and the grade row is replaced by "Playing at 2nd grade. Change" (Change shows the row again). "Change grade" on pause/over screens unchanged.
- [ ] Tests per game: `preselects the child's grade and hides the grade row`, `clamps to the game's range`, `no grade: the picker shows as today`, `Change shows the grades again`. FAIL -> implement -> PASS (`npx vitest run test/chronoBilliards.test.js test/echoMatrix.test.js test/wordQuest.test.js test/gradeAdjust.test.js`) -> commit — "Grade adjust: Chrono Billiards, Echo Matrix and Word Quest start at the child's grade".

### Task 6: Maze Quest

**Files:** Modify `games/maze-quest.html` (`setGrade(i, byPlayer)` ~2349, picker modal ~1053, `openPicker()` ~3846); Test `test/mazeQuestRace.test.js` or a new `test/mazeQuestGrade.test.js`, `test/gradeAdjust.test.js`.

- With a grade: `setGrade(min(grade,5), false)` before the modal opens (does not save `mq-grade`); the modal still opens for the explorer and race choice, its grade row shows "Playing at 2nd grade. Change".
- [ ] Tests: `uses the child's grade without saving it`, `clamps`, `no grade: as today`. FAIL -> implement -> PASS -> commit — "Grade adjust: Maze Quest starts at the child's grade".

### Task 7: Private games: Robo Math Buddy, Math Runner, Remote Lunar Mission

**Files:** Modify `supabase/private-games/math-robot.html` (askGrade ~254/936), `supabase/private-games/number-dash.html` (levels ~1189/1230, `Game.level`), `supabase/private-games/remote-lunar-salvage.html` (`SAVE.grade` ~815/6525); Tests `test/roboMathVoice.test.js` or `test/mathRobotGrade.test.js`, `test/numberDash.test.js`, `test/remoteLunarSalvage.test.js`, `test/gradeAdjust.test.js`.

- Robo Math Buddy: with a grade, `mem.grade = min(grade,5)` and the chat never asks the grade (still asks the name); typing "grade 3" still changes it.
- Math Runner: with a grade (all 0..6 supported), the title preselects `LEVELS[grade]` and the level row shows "Playing at 2nd grade. Change"; the runner pick stays.
- Remote Lunar Mission: with a grade, the start card uses `clamp(grade, 1, 5)` for this session (skips the grade step) without changing the save's own grade; `#bChangeGrade` still works.
- [ ] Tests per game: `uses the child's grade`, `clamps`, `no grade: as today`, `change still works`. FAIL -> implement -> PASS -> commit — "Grade adjust: Robo Math Buddy, Math Runner and Remote Lunar Mission start at the child's grade".
- [ ] Ask the owner before re-uploading the three private files (portal_game_files: jsonb_set + replace guarded by md5, or the admin upload), then verify each md5 equals the committed file.

### Task 8: Check and ship (only when told)

- [ ] `npx vitest run --exclude ".worktrees/**"` passes.
- [ ] In a new preview tab with an in-memory picked child (kidCall/progressPlaying faked, nothing saved): open Balloon Pop Math, Word Quest and the Art and Craft list; screenshot for the owner; close the tab.
- [ ] On the owner's "push": bump `sw.js`, push, verify at www.chikescreativespace.com; private games uploaded on the owner's OK.
