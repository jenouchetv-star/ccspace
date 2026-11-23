# Progress report redesign Implementation Plan

> **For agentic workers:** Executed inline (superpowers:executing-plans style); each task is test-first and ends with a commit made with explicit file lists.

**Goal:** Replace the kid Progress report with the parent report from `docs/mockups/progress-report-draft-8.html`.

**Architecture:**
- New optional answer fields and a per-day log, stored by `kid-progress` and returned raw by `report`.
- All scoring, statuses, trends, focus picks and day logs are computed by pure functions in `assets/lib/progress.js`, which are unit-tested.
- `index.html` renders the four tabs and the SVG chart.

**Tech:** Supabase Postgres and Deno Edge Function, a vanilla JS single-page app, vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-progress-report-redesign-design.md`

## Global Constraints

- No em dashes or emojis in any copy. Never use he/she for a child; use their name or "they".
- New answer fields are optional. Old games and old rows keep working.
- Never commit any of the following:
  - `supabase/functions/*` other than kid-progress
  - `docs/mockups/**`
  - the show-poster images and the Gemini jpgs
  - `test/helpers/fakeSupabase.js`, `test/portalFunction.test.js`, `test/portalShared.test.js` and `test/newsletterAudienceShared.test.js`
- Commit with explicit file lists.
- Never deploy SQL or the function, push, or upload a private game without the owner's OK. The order is SQL, then the function, then the site.
- Statuses:
  - `none` when n < 5
  - `dev` when own/n < 0.60
  - `cons` when own/n >= 0.85 and there are 2 or more sources
  - `prac` otherwise

## Review Focus

- A report from a child with no answers or days still renders every tab, with the "Not enough evidence yet" copy.
- An answer row with an unknown subject or an unknown game id is skipped, and the page doesn't throw.
- `day` sent by a browser with a skewed clock falls back to the server's date.
- The week arrows never step into the future, and step back no further than 26 weeks.
- The chart redraws when the Summary tab opens after loading on another tab, which happens because the hidden chart measures 0 wide.

---

### Task 1: Data: SQL and function

**Files:**
- New: `supabase/progress-days.sql`
- Modified: `supabase/functions/kid-progress/index.ts`
- Tests: `test/progressDaysSql.test.js` (new) and `test/kidProgressFunction.test.js`

**Interfaces:**
- `game_answer` accepts optional `given` (string, cut to 200), `hints` (integer 0 to 20), `tries` (integer 1 to 50), `skill` (string, cut to 80) and `day` (`YYYY-MM-DD`).
  - It stores the four fields.
  - It upserts `child_days {kind:"game", item_id:game, answers+1, right_count+1 if correct, last_at}`.
- `record` accepts optional `day` and upserts `child_days {kind, item_id:item, done:true}`.
- `report` adds two fields:
  - `answerRows: [{g,q,s,k,c,h,at, qt?,a?,gv?,w?}]`: the last 182 days, at most 3000 rows, newest first. The text fields are present only when `c` is false or `h` > 0.
  - `days: [{day,kind,item_id,done,answers,right_count}]`: the last 182 days.
- A failure to read or write `child_days`, or the new columns, is logged and never fails the call.

### Task 2: Pure report builder

**Files:**
- Modified: `assets/lib/progress.js`
- Tests: `test/parentReport.test.js` (new) and `test/progressLib.test.js` (answerFromMessage)

**Interfaces:**
- `answerFromMessage` keeps the optional `given`, `hints`, `tries` and `skill` when they are valid.
- `subjectStatus({own,hint,miss,sources}) -> "none"|"dev"|"prac"|"cons"`
- `parentReport({answerRows, days, progress, now, weekOffset, span, content, childName}) -> { period, subjects[7], totals, engagement, focus[], going[], trend, days: Map(dateKey -> items[]), verdict }`
- `sourceOf(row)`: for `solar-system-sandbox`, the game plus the tour (the qid before the first "-"); otherwise the game.

### Task 3: Page

**Files:**
- Modified: `index.html` (progressReportHTML and its CSS, the chart, tabs and handlers)
- Tests: `test/progressSite.test.js`, rewritten for the new page

**Interfaces:**
- Uses `parentReport`.
- `ProgressState` gains `tab`, `weekOffset`, `open` (the subject ids opened), `day` and `hidden` (the chart lines hidden).

### Task 4: Games send the new fields

**Files:**
- `games/spelling-detective.html`
- `games/write-with-yuna.html`
- `supabase/private-games/solar-system-sandbox.html`
- their tests

### Task 5: Verify in the preview, then hand back to the owner for the deploy OKs
