# Progress report redesign (parent report): design

Owner approved the look in `docs/mockups/progress-report-draft-8.html` and said "build it" (2026-11-23).

## Why

Parents need to see what their child understands, how much they take part, and where to help, without pop quizzes interrupting play. The current report (photo strip, facts list, pop quiz results) reads as made for kids and mixes effort with understanding.

## Goals

- Four tabs under a report header: **Summary**, **By subject**, **Activity log**, **How it's scored**.
- Understanding and engagement reported separately.
- Understanding comes only from questions built into games, books and activities ("challenges"). Completion, time and taps never count as understanding.
- A status per subject with "Not enough evidence yet" when there are fewer than 5 questions.
- A progress-over-time chart (one graph, one line per rated subject).
- A day-by-day activity log with a calendar.
- Every game, book or activity name links to its own page and says what it is.

## Non-goals (later parts)

- Retiring the pop quiz and adding story choices to books (part 2).
- Adding new challenges to more games (part 3).
- Measuring active play time. The report shows time only when a game reports it; none do yet, so the log leaves it out.

## Anti-goals

- Never rate a subject from one or two answers.
- Never label the child; describe the skill that needs practice.
- Never count exploring or free play against a child.

## Scoring rules (exact)

For a subject in the chosen period:

- `n` = answers, `own` = correct with no hint, `hint` = correct after a hint, `miss` = not correct.
- **Percent correct** = (own + hint) / n. **On their own** = own / n.
- **Not enough evidence yet**: n < 5.
- **Developing**: own / n < 60%.
- **Practicing**: 60% to 84% on their own, or 85%+ from only one game, book or activity.
- **Consistently demonstrated**: 85%+ on their own across at least 2 different games, books or activities.

A Solar System Sandbox tour counts as its own source per tour (the qid prefix names the tour).

The chart plots "on their own" per week for the last 8 weeks. A week with fewer than 5 answers for a subject is a gap, drawn dotted.

## Periods

- **Week** = the 7 days ending today, the same as now. Arrows step back 7 days at a time.
- **All time** = everything the report returns (the last 26 weeks of answers).

## Data changes

- `child_game_answers` gains `given` (the child's answer, at most 200 characters), `hints` (smallint, default 0), `tries` (smallint, default 1) and `skill` (at most 80 characters). All are optional and nullable, so old rows and old games keep working.
- New table `child_days(child_id, day date, kind, item_id, done boolean, answers int, right_count int, last_at)` with primary key `(child_id, day, kind, item_id)`.
  - `kind` adds `game` to the existing kinds.
  - `day` is the family's local date, sent by the browser and accepted only within one day of the server's date.
  - `record` marks a day item done. `game_answer` adds to a day item's answers.
  - Older days are filled in from the answers already stored, which carry dates.
- `report` returns, in addition to what it returns today:
  - `days`: the last 26 weeks of `child_days`.
  - `answerRows`: the last 26 weeks of answers, at most 3000.
    - Short fields: `g, q, s, k, c, h, at`.
    - Question text, answer, given and why are included only for answers that were missed or needed a hint.

## Page

Follows `docs/mockups/progress-report-draft-8.html`.

- **Header:**
  - The child's avatar, "<Name>'s progress report", grade and update time.
  - Week / All time (selected button black), week arrows and Print.
  - The site's yellow highlight on the selected tab.
- **Summary:**
  - A verdict sentence.
  - "Worth practicing this week": up to 2 skills with 2 or more answers not on their own, each with the child's answers and the why or tip text.
  - Understanding and Engagement figures.
  - The progress chart.
  - "STEAMM Subjects this week": seven cards in one row.
  - "Going well".
- **By subject:** an expanding card per subject, with skills and the "Answers to look at" table.
- **Activity log:** the month calendar plus the chosen day's entries, each linked to its page.
- **How it's scored:** the definitions above.
- Colors, cards and chart follow draft 8. Status dots are green for consistently demonstrated, yellow for practicing and blue for developing. Chart lines are teal for Science, plum for Math and orange for Reading and Writing; the other subjects use colors that pass the palette validator.

## Games

The three games that already send answers add the new fields:

- **Spelling Detective:** `given` (the child's last guess) and `skill` (the spelling pattern).
- **Write with Yuna:** `skill` ("Letter formation" or "Word writing").
- **Solar System Sandbox:** `given` (the choice picked) and `tries`. It is a private game, so this needs a portal upload with the owner's OK.

## Deploy (owner OK needed for each)

SQL first, then the `kid-progress` function, then the site push and the Solar portal upload.
