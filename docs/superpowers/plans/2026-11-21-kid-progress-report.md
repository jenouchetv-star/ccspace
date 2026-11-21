# Progress Report and Chike's Pop Quiz Implementation Plan (Stages 1 and 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in parent adds their children, the site records what the playing child finishes, the Subscriber's Portal
shows a per-child report (finished things, nuggets met and known, life lessons to talk about, recent quizzes), and Chike
offers a weekly 3-question pop quiz pitched to the child's grade.

**Architecture:** A new `kid-progress` Edge Function (a copy of `sound-cloud`'s shape: portal session in every call, service
role, member taken only from the session) is the only reader and writer of five new tables in `supabase/kid-progress.sql`.
The server stores ids only (children, items finished, per-nugget quiz state, quizzes); the site turns ids into titles,
pictures and nugget text from content it already loads, using pure rules in a new `assets/lib/progress.js`. Quiz questions
live in `nugget_questions`, written by the admin through `is_active_admin()` RPCs and approved when the item is published.

**Tech Stack:** Single-file site `index.html` (classic script + ES modules in `assets/lib/`), Supabase Postgres + Deno Edge
Functions, vitest (+ PGlite for SQL), YouTube IFrame API (already loaded by `loadYouTubeApi()`), the admin Copilot's
Ollama chat (`WriterLib.chat`) for drafting questions.

**Spec:** `docs/superpowers/specs/2026-11-21-kid-progress-report-design.md`. **Look:** `docs/mockups/progress-report-draft-4.html`
(three containers: `.box--week`, `.box--learned`, `.box--ask`; never commit mockups).

## Global Constraints

- STEAMM subjects (owner, 2026-11-21): ids `science`, `technology`, `engineering`, `art`, `math`, `music`, labels "Science", "Technology", "Engineering", "Art", "Math", "Music", shown with the site's `STEAMM_ICONS` (index.html:13480) in ink, no colors. One subject (or none) per fact nugget, the same at every grade level. Look: `docs/mockups/progress-report-draft-5.html` (supersedes draft 4).

- Owner rules: never push, publish, deploy, apply SQL to the live project or email without the owner saying so; commit with explicit file lists; never `localStorage.clear()` on localhost:4321; test only with `example.test` addresses; new browser tabs, closed after.
- Never commit: `docs/mockups/**`, show-poster step images, Gemini jpgs, `supabase/functions/*` other than `sound-cloud` and the new `kid-progress` (ruling below), `test/helpers/fakeSupabase.js`, `test/portalFunction.test.js`, `test/portalShared.test.js`, `test/newsletterAudienceShared.test.js`, `test/soundCloudFunction.test.js`, `test/artCloudFunction.test.js`, `docs/welcome-series.md`, `.claude/serve.py`.
- Ruling: `supabase/functions/kid-progress/index.ts` and `test/kidProgressFunction.test.js` are new files with nobody else's edits in them, so they are committed like `sound-cloud`. The owner may say "keep it local like art-cloud" at plan review.
- Copy: no em dashes, no emojis, STEAMM not STEM, kid-friendly words. Never "he/she/her/his" for a child: use the child's name ("Ask Maya about it").
- No marks or scores out of 100, no red marks, no streaks, no leaderboards. Quiz results read "2 of 3 right".
- Children: first name or nickname (1 to 24 characters) + grade 0 to 6 (0 = Kindergarten); at most 6 per parent. Grade goes up one each August 1, capped at 6th.
- Grade levels: grade 0-1 → `k1` (2 choices, read aloud), 2-3 → `g23` (3 choices), 4-6 → `g46` (3 choices that need the why).
- Quiz: at most one started per child per 7 days; offered only when 3 or more eligible fact nuggets have an approved question at the child's level; 3 questions; a started quiz counts for the week; "Later" hides it until the next calendar day.
- Review: right answer → due again in 21 days; right on that review → due in 60 days; right on that one → no more reviews ("still remembered it"). Any wrong answer → back to "Came across it", step 0.
- Nothing is recorded without a portal session (`ccs_portal_session`) and a picked child. "Just me, the grown-up" records nothing.
- Grown-up check guards only the report and "Your children": a single-digit multiplication (3 to 9 times 3 to 9; owner 2026-11-21, was 12..19 x 3..9) typed in; remembered in memory for that page load only.
- Quiz bubble shows only on list pages (never on an episode, book, game, Studio app or activity page).
- Motion: decelerating, never bouncy; reduced-motion respected.
- Push flow (only on "push"): bump `sw.js` CACHE_VERSION, `npx vitest run --exclude ".worktrees/**"`, fetch/merge origin, `git push origin sound-space:main` via run_in_terminal, verify at www.chikescreativespace.com. Deploy order: SQL, then the function, then the site.

## Review Focus

1. **A child id from another family's account** sent to any action → `{ ok:false, error:"not_found" }`, nothing read or written (Task 4 test `rejects a child that belongs to another member`).
2. **The saved "who's playing" child no longer exists** (removed on another device, session expired, unsubscribed) → nothing recorded, picker asks again, no error shown (Task 3 test `recordTarget asks again when the saved child is gone`).
3. **Content unpublished or deleted after it was recorded** → the report quietly leaves it out; the quiz never asks a nugget without an approved question (Task 3 test `buildReport skips items it cannot find`; Task 5 test `never asks a nugget whose question is not approved`).
4. **Double taps and repeats**: the same answer sent twice counts once; a second `quiz_start` in the same week is refused; the same episode finished twice is one row with `times = 2` (Task 5 tests `an answer counts once`, `a second quiz in the same week is not due`; Task 4 test `recording twice keeps one row`).
5. **A grade set before August** shows one grade higher after August 1 and never passes 6th (Task 4 test `grade moves up each August and stops at 6th`).

---

### Task 1: Mockup "Your children" with grades (owner checkpoint)

**Files:**
- Modify: `docs/mockups/progress-report-draft-4.html` (never committed)

Done 2026-11-21 as `docs/mockups/progress-report-draft-5.html` (draft 4 + STEAMM subjects + Your children + the same question at three grade levels + the child's name instead of she/he); sent to the owner. Steps kept for the record:

- [x] **Step 1:** Add a "Your children" scene after the grown-up check scene, in draft 4's style (one container, no boxes inside boxes): each child as a row (name, grade as "Kindergarten" / "1st grade" ... "6th grade", Rename, Change grade, Remove), an "Add a child" row (name box + grade select), the line "Up to 6 children. Grades move up on their own each August.", and the sign-in note "To record what Maya does, stay signed in on the device Maya uses." Remove confirm text: "Remove Maya? Everything recorded for Maya goes too."
- [x] **Step 2:** Replace any "Ask her about it" in draft 4 with "Ask Maya about it".
- [x] **Step 3:** Send the file to the owner with SendUserFile (`display: "render"`). **Stop for the owner's OK** before Task 2.

### Task 2: Tables and admin question RPCs

**Files:**
- Create: `supabase/kid-progress.sql`
- Test: `test/kidProgressSql.test.js` (PGlite, set up like `test/soundSpaceSql.test.js`, plus a stub `create function is_active_admin() returns boolean` driven by a one-row table so tests can switch it)

**Interfaces:**
- Produces tables (all `enable row level security`, no policies, `revoke all ... from public, anon, authenticated`):
  - `children(id uuid pk default gen_random_uuid(), subscriber_id text not null references subscribers(id) on delete cascade, name text not null check (char_length(name) between 1 and 24), grade smallint not null check (grade between 0 and 6), grade_year smallint not null, created_at timestamptz default now())`
  - `child_progress(child_id uuid references children(id) on delete cascade, kind text check (kind in ('episode','book','entry','activity')), item_id text, first_at timestamptz, last_at timestamptz, times int default 1, primary key (child_id, kind, item_id))`
  - `child_nuggets(child_id uuid references children(id) on delete cascade, nugget_id text, status text check (status in ('met','knows')) default 'met', review_step smallint default 0, review_due timestamptz, known_at timestamptz, last_asked timestamptz, last_variant smallint, primary key (child_id, nugget_id))`
  - `child_quizzes(id uuid pk default gen_random_uuid(), child_id uuid references children(id) on delete cascade, started_at timestamptz default now(), nuggets text[] not null, answered text[] not null default '{}', asked smallint default 0, right_count smallint default 0)`
  - `nugget_subjects(nugget_id text primary key, subject text not null check (subject in ('science','technology','engineering','art','math','music')))`
  - `nugget_questions(nugget_id text, level text check (level in ('k1','g23','g46','lesson')), variant smallint check (variant in (1,2)) default 1, question text, choices jsonb, answer smallint, why text, approved boolean default false, updated_at timestamptz default now(), primary key (nugget_id, level, variant))`
- Produces RPCs (security definer, `set search_path = public`, raise `'not allowed'` unless `is_active_admin()`, execute revoked from public/anon, granted to authenticated):
  - `nugget_questions_for(p_prefix text) returns setof nugget_questions` (rows whose `nugget_id` starts with `p_prefix`)
  - `nugget_subjects_for(p_prefix text) returns setof nugget_subjects`
  - `nugget_questions_save(p_prefix text, p_rows jsonb, p_subjects jsonb) returns int` (deletes the prefix's question and subject rows, inserts `p_rows` with `approved=false` and `p_subjects` (`{"<nugget_id>": "science", ...}`), returns the question count; raises `'invalid subject'` for a subject outside the six or a nugget_id without the prefix; raises `'invalid question'` when a row's nugget_id lacks the prefix, a `k1` row has other than 2 choices, a `g23`/`g46` row has other than 3, `answer` is outside the choices, or a `lesson` row has a question)
  - `nugget_questions_approve(p_prefix text) returns int` (sets `approved=true` for the prefix)

- [ ] **Step 1: Write the failing tests** `test/kidProgressSql.test.js`:
  - `can be run again without error`
  - `has the six tables with the columns above` (assert column name lists in order)
  - `closes every table to anon and authenticated` (`has_table_privilege` false for select/insert/update/delete; `pg_policies` empty)
  - `removing a subscriber removes their children and everything recorded for them` (insert subscriber, child, progress, nugget, quiz; delete subscriber; all counts 0)
  - `the admin question RPCs refuse anyone who is not an active admin` (stub false → `nugget_questions_for('video:a:')` throws /not allowed/)
  - `save checks the number of choices per level` (k1 with 3 choices throws /invalid question/; g23 with 3 choices returns 1)
  - `save replaces only that item's rows and leaves them unapproved; approve approves only that prefix`
  - `save keeps one STEAMM subject per nugget and refuses any other word` (`"history"` throws /invalid subject/)
  - `children names and grades are checked` (name '' and grade 7 both fail)
- [ ] **Step 2:** Run `npx vitest run test/kidProgressSql.test.js`. Expected: FAIL (file missing / empty sql).
- [ ] **Step 3:** Write `supabase/kid-progress.sql` (header comment in the style of `supabase/sound-space.sql`: what each table holds, closed to the browser, safe to run again).
- [ ] **Step 4:** Run `npx vitest run test/kidProgressSql.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add supabase/kid-progress.sql test/kidProgressSql.test.js
  git commit -m "Progress report: tables for children, what they finished, quiz state and quiz questions (closed to the browser)"
  ```

### Task 3: The site's rules (`assets/lib/progress.js`)

**Files:**
- Create: `assets/lib/progress.js` (no DOM, database or network)
- Modify: `index.html:4796-4808` (import `* as Progress` and add to the `Object.assign(window, ...)` list)
- Test: `test/progressLib.test.js`

**Interfaces (Produces):**
- `STEAMM_SUBJECTS = [{id:"science",label:"Science"},{id:"technology",label:"Technology"},{id:"engineering",label:"Engineering"},{id:"art",label:"Art"},{id:"math",label:"Math"},{id:"music",label:"Music"}]`; `subjectFromTopic(topic) -> subject id | ""` (structures -> engineering, sound -> music, color -> art, nature/space/weather/recycling -> science, anything else -> "")
- `GRADE_LABELS = ["Kindergarten","1st grade","2nd grade","3rd grade","4th grade","5th grade","6th grade"]`; `gradeLabel(n: number) -> string`
- `nuggetId(kind: "episode"|"book"|"entry"|"activity", itemId: string, part: string) -> string` → `"episode:<id>:discovery"`; `parseNuggetId(id) -> {kind,itemId,part} | null`
- `nuggetsFor(kind, rec) -> Array<{ id, type: "fact"|"lesson", text, title }>`:
  - episode (a `videos` record): `discovery` fact from `rec.learning`, `lesson` lesson from `rec.moral`
  - book (a `stories` record): `word` fact from `rec.data.learn.word` + `say`; `t1`..`t3` facts from `rec.data.learn.takeaways[i]` (`title` + `text`)
  - entry (a portal entry): `word` fact from `vocabWord` + `vocabMeaning`
  - activity: `fact` fact from `rec.learning.title` + `text`; `talk` lesson from `rec.discussionPrompt`
  - blank fields give no nugget
- `recordTarget(hasSession: boolean, playing: string, children: Array<{id}>) -> string | "ask" | null`: null without a session or with no children or `playing === "grownup"`; the id when it is in `children`; otherwise `"ask"`
- `watchedEnough(current: number, duration: number) -> boolean` (duration > 0 and current / duration >= 0.9)
- `doneFromMessage(data: unknown, origin: string, siteOrigin: string) -> null | { kind: "book" } | { kind: string, id: string }`: only when `origin === siteOrigin`; `{source:"ccs-book", atLastPage:true}` → `{kind:"book"}`; the shared shape for later games `{source:"ccs-done", kind, id}` → `{kind, id}`
- `grownUpQuestion(rand: () => number) -> { a, b, answer }` (a and b in 3..9, owner 2026-11-21)
- `buildReport({ progress, nuggets, lessons, subjects, quizzes, content, childName, now }) -> { week, allTime, facts, talk, quizzes, bySubject, weekSubjects }`:
  - `progress` and `nuggets` as the `report` action returns them (Task 4); `content.find(kind, itemId) -> record | null`
  - `week`: items with `last_at` in the last 7 days, newest first, as `{ kind, id, title, img }`; `allTime`: all of them
  - `facts`: every fact nugget of a found item, `status` "knows" or "met" from `nuggets` (absent = "met"), `remembered: true` when `review_step >= 2`
  - `talk`: every lesson nugget of a found item plus fact nuggets listed in `lessons`, worded `"Ask " + childName + " about it: " + text`
  - `quizzes`: newest 5 as `{ date, right, asked }`
  - `subjects`: `{ nugget_id: subject }`; each fact gets `subject` (or ""); `bySubject`: all six in STEAMM order as `{ id, label, met, knows }` (met counts every fact of that subject, knows those with status "knows"); `weekSubjects`: the subject ids of this week's facts, most first (for Chike's note "This week was mostly Science and Engineering.")
- `QUIZ_ROUTES = ["home","watch","stories","play","create","newsletter"]`; `quizBubbleAllowed(route: {name, params}) -> boolean` (name in the list and no `params.id`). Check the names against `parseRoute()` (index.html:9241) and fix the list in this step if they differ.

- [ ] **Step 1: Write the failing tests** in `test/progressLib.test.js`, one `it` per export, including:
  - `recordTarget asks again when the saved child is gone` (`recordTarget(true, "c9", [{id:"c1"}]) === "ask"`; `recordTarget(false, "c1", [{id:"c1"}]) === null`; `recordTarget(true, "grownup", [{id:"c1"}]) === null`)
  - `nuggetsFor leaves out blank fields` (an episode with `moral: ""` gives only the discovery)
  - `doneFromMessage ignores other origins` (same data from `https://evil.test` → null)
  - `watchedEnough` (89/100 false, 90/100 true, 5/0 false)
  - `grownUpQuestion stays in range` (rand 0 → 12 × 3 = 36; rand 0.999 → 19 × 9 = 171)
  - `buildReport skips items it cannot find` (progress row for a missing episode → absent from week, allTime, facts and talk)
  - `buildReport counts each STEAMM subject in order, zeros included` (`bySubject.map(s => s.id)` equals the six ids; one science fact known and one met gives `{id:"science", met:2, knows:1}`)
  - `subjectFromTopic` (`"structures"` -> `"engineering"`, `"language"` -> `""`)
  - `buildReport names the child and never says her or him` (talk text equals `"Ask Maya about it: Sharing makes ideas bigger."`; `JSON.stringify(report)` has no `/\b(her|him|his|she|he)\b/`)
- [ ] **Step 2:** Run `npx vitest run test/progressLib.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the exports above in `assets/lib/progress.js`; add the import in index.html.
- [ ] **Step 4:** Run `npx vitest run test/progressLib.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add assets/lib/progress.js test/progressLib.test.js index.html
  git commit -m "Progress report: the rules the site uses (nuggets, who is playing, the report, the grown-up check)"
  ```

### Task 4: `kid-progress` function: children, recording, report

**Files:**
- Create: `supabase/functions/kid-progress/index.ts` (copy `sound-cloud`'s header style, CORS, `json`/`fail`, `sha256Hex`, `member(token)`, 200 with `{ok:false,error}` for ordinary outcomes, 500 `server_error` on faults)
- Test: `test/kidProgressFunction.test.js` (same in-memory `vi.mock("jsr:@supabase/supabase-js@2")` as `test/soundCloudFunction.test.js`, extended with `insert`, `in` and `order`/`limit` where used; all addresses on example.test; `vi.setSystemTime` for dates)

**Interfaces:**
- Every call: `{ action, session, ... }`; no or bad session → `no_session`. A `child` param must be the id of one of this member's children, else `not_found`.
- `children` → `{ ok, children: [{ id, name, grade }] }` with the grade moved up: `min(6, grade + schoolYear(now) - grade_year)`, where `schoolYear(d) = month >= August ? year : year - 1` (UTC)
- `child_save { child: { id?, name, grade } }` → `{ ok, id }`; name trimmed, 1..24 chars of letters, spaces, `'`, `-`, `.`; grade int 0..6; a new child when the member has 6 → `full`; stores `grade_year = schoolYear(now)` whenever grade is set
- `child_remove { id }` → `{ ok }` (cascade removes the rest)
- `record { child, kind, item }` → `{ ok }`; kind in the four; item `/^[A-Za-z0-9_-]{1,64}$/` else `invalid`; upsert with `first_at` kept, `last_at = now`, `times + 1`; `rate_take` bucket `kid_record`, 300 an hour per member → `slow_down`
- `report { child }` → `{ ok, progress: [{ kind, item_id, first_at, last_at, times }], nuggets: [{ nugget_id, status, review_step, known_at }], lessons: [nugget_id...], subjects: { nugget_id: subject } (nugget_subjects rows whose prefix matches a progress item), quizzes: [{ started_at, asked, right_count }] }` (`lessons` = `nugget_questions` rows with `level='lesson'` whose prefix matches a progress item; quizzes newest 5)

- [ ] **Step 1: Write the failing tests:**
  - `refuses a call with no session, an expired one, or a member who left the list`
  - `rejects a child that belongs to another member` (for `record`, `report`, `child_remove`, `child_save` with an id)
  - `adds up to 6 children and then says full`; `checks names and grades` (name "" / 25 chars / "<b>", grade 7 → `invalid`)
  - `grade moves up each August and stops at 6th` (saved grade 2 on 2026-09-01 → 2 on 2027-07-31, 3 on 2027-08-01; saved 6 → 6 next year)
  - `recording twice keeps one row` (`times` 2, `first_at` unchanged)
  - `report returns only this child's rows, the lessons of things they finished, and 5 newest quizzes`
- [ ] **Step 2:** Run `npx vitest run test/kidProgressFunction.test.js`. Expected: FAIL (function file missing → suite fails to import).
- [ ] **Step 3:** Implement the five actions.
- [ ] **Step 4:** Run `npx vitest run test/kidProgressFunction.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add supabase/functions/kid-progress/index.ts test/kidProgressFunction.test.js
  git commit -m "Progress report: kid-progress function for children, what they finished and the report"
  ```

### Task 5: `kid-progress` function: the pop quiz

**Files:**
- Modify: `supabase/functions/kid-progress/index.ts`
- Test: `test/kidProgressFunction.test.js`

**Interfaces:**
- Eligible nugget for a child: its `<kind>:<item>:` prefix matches one of the child's `child_progress` rows; an **approved** `nugget_questions` row exists at the child's level (`k1`/`g23`/`g46` from the moved-up grade); and in `child_nuggets` it is absent, `status='met'`, or `status='knows'` with `review_due <= now`. Order: never asked first, then review-due, then answered wrong before; oldest `first_at` first. The 3 picked come from different STEAMM subjects (`nugget_subjects`; no subject counts as its own group) before any subject repeats, keeping that order inside each group.
- `quiz_offer { child }` → `{ ok, due }`: `due` true when no `child_quizzes` row started in the last 7 days and eligible count >= 3
- `quiz_start { child }` → `{ ok, quizId, level, questions: [{ nuggetId, question, choices }] }` (3 questions; when a nugget has variants 1 and 2, use the one that is not `last_variant`), or `not_due`; inserts `child_quizzes` with `nuggets`
- `quiz_answer { child, quizId, nuggetId, choice }` → `{ ok, correct, answer, why }`; `not_found` when the quiz isn't this child's or the nugget isn't in it; a nugget already in `answered` returns the same result without changing anything. Right: `status='knows'`, `known_at` set if empty, `review_step + 1`, `review_due = now + 21 days` (step 1) or `+ 60 days` (step 2) or null (step 3). Wrong: `status='met'`, `review_step=0`, `review_due=null`. Always `last_asked=now`, `last_variant`; quiz `asked + 1`, `right_count + 1` when right.

- [ ] **Step 1: Write the failing tests:** `offers a quiz only with 3 eligible nuggets`; `never asks a nugget whose question is not approved`; `asks the question at the child's level`; `a second quiz in the same week is not due` (and due again after 7 days); `an answer counts once`; `a right answer comes back after 21 days, then 60, then not again`; `a wrong answer goes back to came across it`; `a half-finished quiz still counts for the week`; `a quiz mixes subjects before repeating one` (4 eligible, in order science, science, math, music: picks science, math, music).
- [ ] **Step 2:** Run `npx vitest run test/kidProgressFunction.test.js`. Expected: the new tests FAIL with `Unknown action`.
- [ ] **Step 3:** Implement the three actions.
- [ ] **Step 4:** Run `npx vitest run test/kidProgressFunction.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add supabase/functions/kid-progress/index.ts test/kidProgressFunction.test.js
  git commit -m "Progress report: Chike's weekly pop quiz in the kid-progress function (grade levels, review rounds)"
  ```

### Task 6: The report page, "Your children" and the grown-up check

**Files:**
- Modify: `index.html` (near the portal code, index.html:14440-15300; route handling at `parseRoute` index.html:9241 and the view switch at index.html:27539)
- Modify: `assets/lib/portal.js` (`portalValidate`: slugs `progress` and `children` are taken)
- Test: `test/progressSite.test.js` (reads index.html like `test/videoLearned.test.js`); `test/portalClient.test.js` (reserved slug)

**Interfaces:**
- Consumes: Task 3 exports; Task 4 actions.
- Produces in index.html: `kidCall(action: string, extra?: object) -> Promise<object>` (like `soundCloudCall`, function `kid-progress`, `{ok:false,error:"no_session"}` without a session); `ProgressState = { children: null | Array, grownUpOk: false, reportFor: "" }`; `progressLoadChildren() -> Promise<void>`; `viewProgress() -> string` for route name `progress` at `/newsletter/progress`.
- `portalMemberBar()` gains a "Progress report" link to `/newsletter/progress`.

- [ ] **Step 1: Write the failing tests** (`test/progressSite.test.js`): `viewProgress shows the grown-up check first` (contains `grownUpQuestion(` and the words "A quick grown-up check"); `the report uses the three containers` (`box--week`, `box--learned`, `box--ask`); `the learned container shows the six STEAMM subjects with the site's icons` (`bySubject` and `STEAMM_ICONS[` in `viewProgress`); `Your children offers Kindergarten to 6th grade and at most 6` (uses `GRADE_LABELS`, text "Up to 6 children"); `removing a child asks first` ("Everything recorded for"); `the member bar links to the report`; `no em dashes and no he/she in the new copy` (scan `viewProgress` body). In `test/portalClient.test.js`: `an entry cannot use the slug progress or children`.
- [ ] **Step 2:** Run `npx vitest run test/progressSite.test.js test/portalClient.test.js`. Expected: FAIL.
- [ ] **Step 3:** Build `viewProgress()` as draft 4 shows it: the grown-up check card (a wrong answer gets a new question, no other penalty); then a child switcher (name pills); `.box--week` (Chike's note + picture strip from `buildReport().week`), `.box--learned` (first the six STEAMM subjects from `bySubject` with `STEAMM_ICONS`, "5 things, knows 3", a subject with nothing yet dimmed; then facts, each with its subject label, a "Knows it" check or "Came across it" dashed mark, "Still remembered it 2 months later" when `remembered`), `.box--ask` (talk prompts + last quizzes "2 of 3 right"); "Your children" below it (the Task 1 mockup). No children yet: only "Your children", with the sign-in note. Content lookup: `videos`, `stories`, `activities` via `db.find`; entries from `PortalState.entries`.
- [ ] **Step 4:** Run `npx vitest run test/progressSite.test.js test/portalClient.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add index.html assets/lib/portal.js test/progressSite.test.js test/portalClient.test.js
  git commit -m "Progress report: the report page in the Subscriber's Portal, Your children and the grown-up check"
  ```

### Task 7: Who's playing and recording

**Files:**
- Modify: `index.html` (`renderTourRoot` index.html:10537; `viewVideo` index.html:12918; `viewStory` index.html:13102; `viewActivity` index.html:12315; `viewNewsletterEntry` index.html:15271 and the `portal-play-private` handler)
- Test: `test/progressSite.test.js`

**Interfaces:**
- Produces: `PLAYING_KEY = "ccs_playing_child"` (localStorage: a child id or `"grownup"`); `progressRecord(kind, itemId) -> Promise<void>` (uses `recordTarget`; `"ask"` opens the picker and records after the pick; null does nothing); `openWhoIsPlaying(after?: () => void)`.
- Picker: modal "Who's playing today?" with Chike (`assets/characters/chike-pose-wave` as in draft 4), one pill per child, and "Just me, the grown-up". Asked at most once per page load when the pick is missing.
- Chip next to the avatar in `renderTourRoot` when a child is picked: the child's name; pressing it opens the picker.
- Hooks:
  - Episode: the `viewVideo` iframe gets `enablejsapi=1` and `id="ep-player"`. Only when `recordTarget(...)` is not null, `loadYouTubeApi()` then `new YT.Player("ep-player", ...)`. While playing, check `watchedEnough(getCurrentTime(), getDuration())` every 5 s; on that or state 0 (ended), `progressRecord("episode", v.id)` once.
  - Book: one `window` `message` listener; `doneFromMessage(ev.data, ev.origin, location.origin)` → `{kind:"book"}` on a `story` route → `progressRecord("book", route id)` once per page view.
  - Portal entry: opening an entry records `"entry"`, except game entries, which record on `portal-play-private`.
  - Activity: a "We made it!" button on `viewActivity`, shown only when `recordTarget(...)` is not null; pressing records `"activity"` and shows "Nice work, Maya!" (the child's name).

- [ ] **Step 1: Write the failing tests:** `records nothing without a session` (`progressRecord` body calls `recordTarget(` before `kidCall(`); `the episode player loads YouTube's script only for a picked child`; `the book listener checks the origin` (`doneFromMessage(ev.data, ev.origin, location.origin)`); `We made it! shows only for a picked child`; `the picker offers Just me, the grown-up`; `the playing chip sits next to the avatar`.
- [ ] **Step 2:** Run `npx vitest run test/progressSite.test.js`. Expected: new tests FAIL.
- [ ] **Step 3:** Implement the hooks above.
- [ ] **Step 4:** Run `npx vitest run test/progressSite.test.js test/playAll.test.js test/siteTour.test.js test/videoLearned.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add index.html test/progressSite.test.js
  git commit -m "Progress report: Who's playing, and recording episodes, books, portal entries and We made it! activities"
  ```

### Task 8: Chike's quiz bubble and quiz card

**Files:**
- Modify: `index.html` (`renderTourRoot`, a new `openPopQuiz()`, CSS next to `.tour-bubble`)
- Test: `test/progressSite.test.js`

**Interfaces:**
- Consumes: `quizBubbleAllowed`, `kidCall("quiz_offer"|"quiz_start"|"quiz_answer")`.
- `quiz_offer` is asked at most once per page load per child, only when `quizBubbleAllowed(AppState.route)`; "Later" stores `ccs_quiz_later_<childId>` = today's local date (`YYYY-MM-DD`) and hides the bubble until the date changes.
- Bubble text: "Pop quiz! 3 quick questions about things you did." Buttons "Let's go" and "Later".
- Card: one question at a time with the picture of the item it came from (`parseNuggetId` → content), the choices as big buttons. Right: `chike-pose-thumbs-up`, "You got it!" + why. Wrong: `chike-pose-point`, "Good try! It's ..." + the right answer + why (no red). End: "You got 2 of 3 right. See you next week!" `k1`: questions and choices read aloud with `speechSynthesis` (a "Hear it" button too), when the browser has it.

- [ ] **Step 1: Write the failing tests:** `the bubble only shows on list pages` (`quizBubbleAllowed(` in renderTourRoot's path); `Later waits for the next day` (`ccs_quiz_later_`); `a wrong answer is kind` (contains "Good try", no `red` class or color in the quiz CSS); `K to 1st is read aloud` (`speechSynthesis` inside `openPopQuiz`); `no score out of 100` (no `%` or "/100" in the quiz copy).
- [ ] **Step 2:** Run `npx vitest run test/progressSite.test.js`. Expected: new tests FAIL.
- [ ] **Step 3:** Implement the bubble and card (decelerating fade, nothing bouncy; reduced-motion: no animation).
- [ ] **Step 4:** Run `npx vitest run test/progressSite.test.js test/siteTour.test.js test/motion.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add index.html test/progressSite.test.js
  git commit -m "Progress report: Chike's pop quiz bubble and quiz card"
  ```

### Task 9: Quiz questions in the admin editor

**Files:**
- Modify: `index.html` (`openEditor` index.html:17819 for `videos`, `stories`, `activities`, and the portal entry editor at index.html:17791; the `save-record` handler index.html:30150)
- Modify: `assets/lib/progress.js` (+ `questionDraftMessages(nugget, level) -> messages`, `parseQuestionDraft(text, level) -> {question, choices, answer, why, subject} | null`, `subject` one of the six ids or "")
- Test: `test/progressLib.test.js`, `test/progressSite.test.js`

**Interfaces:**
- A "Quiz questions" panel under the record's fields: for each `nuggetsFor(kind, rec)` fact, a STEAMM subject select (the six + "None"; an activity starts from `subjectFromTopic(rec.learning.topic)`; Copilot's draft fills it when empty), three rows (K to 1st, 2nd to 3rd, 4th to 6th) of question, choices (2 or 3), the right one, and "why"; a "This is a life lesson, not quizzed" switch (saves one `lesson` row); a "Draft with Copilot" button that fills empty rows with `WriterLib.chat({ base: WriterState.base, model: WriterState.model, messages: questionDraftMessages(n, level), json: true })` + `parseQuestionDraft`. If Copilot is not running, it says "Copilot isn't running. Type the questions, or leave them empty for now."
- Load: `sb.rpc("nugget_questions_for", { p_prefix: kind + ":" + id + ":" })`. Save (in `save-record`, after the record saves): `nugget_questions_save` with the panel's rows and subjects, then `nugget_questions_approve` when the saved status is `published`. Empty rows are left out (that nugget is just not quizzed).

- [ ] **Step 1: Write the failing tests:** `parseQuestionDraft keeps 2 choices for k1 and 3 otherwise and rejects an answer outside them`; `questionDraftMessages asks for kid-friendly words, no em dashes, one right answer and one STEAMM subject`; `parseQuestionDraft drops a subject that is not one of the six`; `publishing approves that item's questions` (`nugget_questions_approve` follows `nugget_questions_save` inside the published branch).
- [ ] **Step 2:** Run `npx vitest run test/progressLib.test.js test/progressSite.test.js`. Expected: new tests FAIL.
- [ ] **Step 3:** Implement the panel, drafting and saving.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add index.html assets/lib/progress.js test/progressLib.test.js test/progressSite.test.js
  git commit -m "Progress report: quiz questions on each episode, book, activity and portal entry, drafted by Copilot and approved on publish"
  ```

### Task 10: Questions for the nuggets already on the site (owner checkpoint)

**Files:**
- Create: `supabase/nugget-questions-seed.sql` (inserts with `approved = false`, `on conflict do nothing`)
- Test: `test/kidProgressSql.test.js` (+ `the seed loads and every row passes the save rules`: run the seed after `kid-progress.sql`, then check choice counts per level)

- [ ] **Step 1:** Read the live published nuggets (read-only `execute_sql`: `videos` learning, `portal_entries` vocabWord, `stories` data.learn, `activities` learning) and write the failing seed test.
- [ ] **Step 2:** Run `npx vitest run test/kidProgressSql.test.js`. Expected: FAIL (seed file missing).
- [ ] **Step 3:** Pick each fact nugget's STEAMM subject (into `nugget_subjects`) and draft one question per level per fact nugget (episode morals and activity talk prompts are lessons, not quizzed; book takeaways that are life lessons get a `lesson` row) into the seed file.
- [ ] **Step 4:** Run `npx vitest run test/kidProgressSql.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add supabase/nugget-questions-seed.sql test/kidProgressSql.test.js
  git commit -m "Progress report: first quiz questions for the episodes, books, activities and portal entries already published (awaiting approval)"
  ```
- [ ] **Step 6:** Tell the owner the questions are ready to review in the admin (they're approved by saving each published item). **Stop for the owner.**

### Task 11: Check it end to end (owner checkpoint), then ship only when told

- [ ] **Step 1:** Run `npx vitest run --exclude ".worktrees/**"`. Expected: all pass.
- [ ] **Step 2:** Ask the owner before anything goes to the live project: apply `supabase/kid-progress.sql` and the seed (apply_migration), deploy `kid-progress` via MCP (verify_jwt off). Nothing on the live site changes until the site is pushed.
- [ ] **Step 3:** With that OK, test on localhost:4321 in a new tab as an `example.test` member: add two children, pick one, finish an episode, a book and an activity, check the report, run a quiz (seed a test week of `child_progress` rows by SQL to make one due). Then delete the test member and check that the cascade removed everything. Screenshot the report and the quiz for the owner. Close the tab.
- [ ] **Step 4:** Push only on the owner's "push", with the push flow in Global Constraints.
