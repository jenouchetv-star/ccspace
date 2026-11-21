# Games and Activities Adjust to the Child's Grade: Design

Date: 2026-11-21. Status: draft for the owner's approval. Builds on the progress report
(docs/superpowers/specs/2026-11-21-kid-progress-report-design.md): a parent adds children with a school grade
(Kindergarten to 6th, moving up each August), and "Who's creating today?" says which child is using the device.

## Intent

Owner (2026-11-21): "based on the child grade level, the games and activities should be auto adjusted for the child
that's currently using the app."

## Owner decisions

1. **Games: start at their grade.** A game with a grade picker skips the picker and starts at the picked child's grade.
   A small grade button stays in the game, so a child or grown-up can still choose an easier or harder level.
2. **Activities: their age first.** Activities that fit the child's age show first with a small "Good for 2nd grade"
   tag (the child's grade, by name); the others are still there further down. The Activity Finder's age question is
   filled in for the child.

## Scope

- Only when a child is picked (a portal session + "Who's creating today?" pick). Visitors, "Just me, the grown-up" and
  devices with no pick see everything exactly as today.
- Games with a grade picker today: Balloon Pop Math, Chrono Billiards, Echo Matrix, Maze Quest, Spelling Detective,
  Word Quest, Robo Math Buddy (math-robot), Math Runner (number-dash), Remote Lunar Mission (remote-lunar-salvage).
  Each maps the child's grade to its own nearest level (games that stop at 5th use 5th for a 6th grader; games with
  grade bands, such as Remote Lunar Mission's K-1 / 2-3 / 4-5, use the band that holds the grade).
- Games without a grade picker are unchanged.
- Activities: the Create page lists (Art and Craft, Digital Activities) and the Activity Finder.

## How (Claude's calls, owner may overrule)

- **Grade to age:** a child in grade G is about G+5 to G+6 years old (Kindergarten 5 to 6, 2nd grade 7 to 8, 6th
  grade 11 to 12). An activity fits when its age range overlaps that.
- **Age + difficulty (owner, 2026-11-21):** nearly every activity's age range is broad (most 5-10 or 6-10), so age alone
  tags everything. "Good for <grade>" needs the age to fit AND the difficulty to match the grade: Kindergarten and 1st,
  Easy start; 2nd and 3rd, A bit of a stretch; 4th to 6th, Big challenge or A bit of a stretch. Those come first; the
  rest follow ordered by how close their difficulty is to the grade's (keeping the page's order on a tie).
- **Passing the grade to a game:** the site adds the child's grade (0 to 6) to the game's address when it opens the
  game (a `grade` parameter); each game reads it once at start. Private (subscribers-only) games get it the same way
  through the portal; each edited private game file is re-uploaded to the portal, which needs the owner's OK.
- **The grade a child picks inside a game** is remembered by that game as today; it does not change the child's grade
  in "Your children".
- No new data is stored and nothing new is sent to the server.

## Non-goals

- No hiding of activities or games.
- No grade changes from inside a game to the parent's "Your children".
- No new grade levels in games that don't have them.

## Order of work

1. Mockup of the "Good for 2nd grade" tag on activity cards and the finder pre-filled; owner checkpoint.
2. A shared rule (grade -> age, grade -> each game's level) with tests.
3. The site passes the grade to games; each of the nine games starts at it (one game at a time, tested).
4. Activities sorted and tagged; the finder pre-filled.
5. Re-upload the edited private games (owner's OK), then push.
