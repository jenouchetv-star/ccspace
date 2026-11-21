# Progress Report and Chike's Pop Quiz: Design

Date: 2026-11-21. Status: draft for the owner's approval.

## Intent

The owner (2026-11-20/21): "Is there a way to track a user's/kid's progress when the parent has signed in? answered in game
questions, books read, digital activities done. Perhaps chike can give a pop quiz to test their knowledge based on their
experiences." Then: "I want the parent to see how Chike's Creative Space is benefiting their child", "directly and
indirectly", "the progress report can be found in the subscriber's portal", and "The videos have some known nuggets of
knowledge shared, when they watch it they may learn something indirectly."

So the report answers one question for a parent: **what is my child getting out of this site?**

- **Directly:** what the child finished (episodes, books, portal lessons and games, craft and digital activities) and what
  they showed they know (Chike's pop quiz answers; later, questions answered inside games).
- **Indirectly:** the "nuggets" of knowledge the child came across along the way: the discovery and life lesson of each
  episode, the Word to know on portal entries, the takeaways at the end of each book.

## The nuggets already exist (no new learning content to invent)

| Source | Field(s) today | Coverage (live data, 2026-11-21) |
|---|---|---|
| Episodes (`videos`) | `learning` ("The discovery"), `moral` ("The life lesson"); shown in `videoLearnedHTML` (index.html) | 10 of 10 published |
| Portal entries (`portal_entries`) | `vocabWord`, `vocabSay`, `vocabMeaning`, `vocabExample` ("Word to know"; `portalWordHTML`) | 13 of 17 published |
| Books | the reader's "What you learned / 3 big takeaways" page (books/reader.html): a word to know + 2 takeaways | every book that has that page |
| Activities | `learning {topic,title,text}` and `discussionPrompt` in the activity data | most activities |

**Kinds of nugget:**
- **Fact nuggets** (an episode's discovery, a Word to know, a book's word and takeaways, an activity's learning fact):
  Chike can quiz on these.
- **Life lessons** (an episode's moral, the "Catch the power around you" kind of book takeaway): never quizzed (character,
  not right or wrong). The report shows them to the parent as **conversation starters** ("Ask them how KK shared her
  pyramid model").

## Decisions the owner made

1. **Where:** the report lives in the **Subscriber's Portal**, visible only to the signed-in parent.
2. **Children:** **a child picker.** The parent adds each child (first name or nickname + school grade). A **"Who's playing?"**
   picker on the device says which child is using it. Each child has their own report and quizzes.
3. **Quiz timing:** **on a later visit**, not right after finishing. Chike's bubble (the corner avatar) offers "Pop quiz! 3
   quick questions about things you watched." Remembering after a break is the better proof for the parent.
4. **Quiz frequency:** **at most once a week per child**, and only when the child has **3 or more fact nuggets** they have
   met but not yet been quizzed on. "Later" waits for the next visit; never asked twice on the same day.
5. **Grown-up lock:** the report and "Your children" screens open only after a quick grown-up check (a question a young
   child cannot easily answer, such as a two-digit multiplication typed in). The check is remembered for that visit only.
   The child can still use "Who's playing?" and take Chike's quizzes. No extra email codes.

## Goals

- A parent sees, per child: what they finished, the nuggets they met, which nuggets they have shown they know, and the
  life lessons to talk about.
- Chike's weekly pop quiz, drawn only from things that child actually did.
- Works across devices: the kid plays on a tablet, the parent reads on a phone.

## Non-goals

- No tracking of anyone who is not signed in. A visitor without a parent session is never recorded.
- No marks or scores out of 100, rankings, streak pressure or comparing children. No leaderboards.
- No emails or notifications about progress (owner rule: never message subscribers). The report is something the parent
  opens.
- Not a school gradebook; not shared with anyone but the parent.

## Anti-goals (a failure even if it works)

- Quizzes that feel like homework or nag: daily pop-ups, repeated asks, scolding on wrong answers.
- Collecting more about a child than the report needs (no full names, birthdays, photos, free text from the child).
- A report that shows only counts ("watched 7 videos") without the learning; the nuggets are the point.

## Constraints

- Owner rules: mockups of every new screen before building; never push, publish or email without being told; commit with
  explicit file lists; no em dashes, no emojis; STEAMM not STEM; kid-friendly words.
- Children's privacy (COPPA-minded): only first name or nickname + grade, entered by the parent; data tied to the
  parent's account; the parent can delete a child and everything recorded for them; deleting the subscriber (unsubscribe)
  deletes it all (foreign key cascade, as `newsletter_sends` does).
- Parent sign-in already exists: email + 6-digit code via the `portal` edge function; the browser keeps
  `ccs_portal_session`; the server keeps only a hash in `portal_sessions`. All new reads and writes go through the portal
  function with that session (as Art Space / Sound Space saves do), never straight to tables from the browser.
- Edge functions deploy via MCP with their `_shared` files; the backward-compatible function goes live before the site.
- Motion: decelerating, never bouncy (motion-preferences). Chike's bubble uses the existing corner avatar and bubble.

## Approaches considered

- **Server record under the parent's account (chosen).** Recorded only while a parent session exists, written through the
  portal function, readable on any device. Matches how Art Space and Sound Space already save.
- **Device-only (localStorage).** Rejected: the parent reading on another device would see nothing.
- **Record everyone, attach later.** Rejected: collects data on children whose parents never asked for it.

## How it works

### Stage 1: children and the report

**Children.** In the portal, a "Your children" section: add a child (name or nickname, grade: Kindergarten to 6th), rename,
change grade, remove (removes their record). Limit 6 per parent. The grade moves up one each August on its own.

**"Who's creating today?"** (owner, 2026-11-21: was "Who's playing?", but a child may be reading, watching or making) On a device with a parent session and at least one child, the first time something would be recorded
in a visit, a small picker asks "Who's playing?" (child names + "Just me, the grown-up", which records nothing). The pick
is remembered on that device until changed; a small chip near Chike's avatar shows who is playing and opens the picker.

**What gets recorded** (one row per child per thing, with first and last time):
- **Episode watched:** the episode plays to the end or past 90% (the YouTube IFrame API, already used by "Play all"; the
  single episode player needs the same API).
- **Book read:** the reader reaches the "What you learned" page (books/reader.html already posts
  `{source:'ccs-book', atLastPage}`; the site starts listening).
- **Portal lesson or game:** opened (and for a game, started).
- **Craft or digital activity:** a new "We made it!" button on the activity page (the site cannot see a craft being
  made).
Each recorded thing brings its nuggets into that child's "met" list.

**The report** (a new portal page, per child, with a child switcher):
- **This week / all time:** what they finished, as small picture cards (episode, book, lesson, activity).
- **What they came across:** the fact nuggets, each marked "Came across it" or "Knows it" (answered right in a pop quiz).
- **Talk about it:** the life lessons from what they watched and read, worded as conversation starters.
- **Chike's quizzes:** the last few quizzes, how many right; no scores out of 100, no red marks.

### Stage 2: Chike's pop quiz

- **Questions:** one multiple-choice question (3 choices, 1 right, a one-line "why") per fact nugget, stored on the
  nugget's own record (episode, portal entry, book, activity) and editable in the admin. Claude drafts them from the
  existing nugget text; the owner approves; only approved questions are asked.
- **When:** on a visit, if the playing child has not had a quiz in 7 days and has 3+ un-quizzed fact nuggets, Chike's
  bubble says "Pop quiz! 3 quick questions about things you did." Buttons: "Let's go" and "Later". "Later" hides it until
  the next visit (not the same day).
- **The quiz:** a card by Chike, one question at a time, picture of the episode or book it came from. A right answer:
  Chike cheers, the nugget becomes "Knows it". A wrong answer: Chike gives the right one kindly with the "why"; the nugget
  stays "Came across it" and can come back in a later quiz. Read-aloud with the site's existing voice is a nice-to-have.
- **Grade levels (owner, 2026-11-21: "would the quizzes change based on the child's grade level?"):** each nugget has one
  question per level, the same three levels Remote Lunar Mission uses: **K to 1st** (2 picture-friendly answers, Chike reads
  the question aloud), **2nd to 3rd** (3 answers), **4th to 6th** (3 answers that need the why). The child's grade picks the
  level. Questions drafted on publish come in all three levels.
- Later: a game opened by a picked child (Remote Lunar Mission, Robo Math Buddy) can take the child's grade instead of asking.

### Stage 3: game questions

Games report questions answered inside them (Remote Lunar Mission's quiz first: it already has `QUIZ_BANKS` with an
answer and a "why"), through a new message from the game to the page, recorded for the playing child and shown in the
report under what they finished. Each game needs its own change, so this comes last and game by game.

**How game answers show (owner, 2026-11-21: "a progress report with a grade based on the questions they encountered during
the games"; then "Level per subject is good"):** a word level per STEAMM subject, worked out from the questions the
child answered in games and in Chike's pop quizzes: **Getting started**, **Growing**, **Strong**. No numbers, letter
grades or percentages shown. Under it, the questions they missed with the right answer and the "why". Claude's call on
the cut-offs (owner may change): fewer than 5 answers in a subject, or under half right = Getting started; half to
under 80% right = Growing; 80% or more of at least 5 answers = Strong; counted over the last 8 weeks so a level can grow. Games that ask questions: Remote Lunar Mission first (QUIZ_BANKS), then the math games (Robo Math
Buddy, Math Runner, Balloon Pop Math) one at a time.

## STEAMM subjects (owner, 2026-11-21: "include Lessons in STEAMM subject (Science, Technology, Engineering, Art, Math, and Music)")

- Every fact nugget is filed under one STEAMM subject: Science, Technology, Engineering, Art, Math or Music (or none, when
  it truly fits none). The subject is the same at every grade level; the question gets harder with the grade.
- The report's "What they learned" container opens with the six subjects (the site's own STEAMM icons from About > STEAMM
  Methodology, in ink, no colors): how many things the child came across in each so far, and how many they know. Each
  nugget in the list shows its subject. Chike's note can say which subjects the week was mostly about.
- The admin sets the subject in the same panel as the quiz questions; Copilot suggests one when it drafts. An activity's
  `learning.topic` gives a starting suggestion (structures → Engineering, sound → Music, color → Art, nature, space,
  weather, recycling → Science).
- A quiz mixes subjects when it can: its 3 questions come from different subjects before any subject repeats.
- Mockup: docs/mockups/progress-report-draft-5.html.

## How the quiz keeps going (owner, 2026-11-21: "how will this scale on its own. Is the quizzes finite?" ... "The games, books, and activities will be added to the site so the content isn't going to always be finite")

- **New content brings its own questions.** Publishing anything with a nugget drafts 2 or 3 quiz questions from the
  nugget text (AI drafting; which service, and its cost, is settled in the plan). They appear on that item's publish screen;
  publishing approves them with it. No separate approval queue. Existing nuggets get the same drafting once, at launch.
- **Review rounds.** A nugget answered right comes back after about 3 weeks, then about 2 months (simple spaced review).
  Review-due nuggets count toward the "3 or more" quiz rule, so quizzes continue between new releases. Still at most one
  quiz a week per child. The report can say "still remembered it 2 months later".
- **Variety.** one question per grade level per nugget (see Stage 2), plus a second wording where it helps, so a review
  rarely repeats the same question.

## Calls made after the builder check (Claude's, owner may overrule)

- **Signing in on the kid's device:** recording needs the parent signed in on the device the child uses (sessions already
  last 30 days, `SESSION_DAYS`). The report and "Your children" screens say so plainly.
- **Where quiz questions live:** one new table, `nugget_questions`, keyed by nugget id, for all sources (books are files,
  not rows, so a column on each record would not work for them). The admin edits and approves them there.
- **Only approved questions count:** the "3 or more un-quizzed nuggets" rule counts only nuggets that have an approved
  question, so a quiz can always be built when it is offered.
- **Where Chike's quiz bubble shows:** on regular pages only; never while a game, book, Studio app or episode is playing.
- **A quiz left partway:** answered questions are kept; a started quiz counts as that week's quiz.
- **One message for "finished" from frames:** books (the reader) and games use one shared message shape to the page,
  checked for the site's own origin, so Stage 3 can reuse what Stage 1 builds.
- **Plan scope:** Stages 1 and 2 planned in detail; Stage 3 outlined, one game at a time later.

## Left to the builder

- Table shapes and names (expected: `children`, `child_progress`, `child_quiz_answers`, all keyed to `subscribers(id)` on
  delete cascade, RLS closed to the browser, written by the portal function).
- How nuggets get stable ids (expected: record id + nugget kind, e.g. `video:abc:discovery`).
- The exact 90% watch rule and how to treat rewatching.
- Mockup look, within the site's existing portal and Chike card styles. Mockups go to the owner before building.

## Order of work

1. Mockups: the "Your children" section, the "Who's playing?" picker, the report page, Chike's quiz bubble and quiz card.
   Owner checkpoint.
2. Stage 1 (children, recording, report).
3. Draft quiz questions for every fact nugget; owner approves them in the admin.
4. Stage 2 (pop quiz).
5. Stage 3 (games), one game at a time.
