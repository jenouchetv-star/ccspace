# Solar System Sandbox: K-5 Tours and Quizzes: Design

Date: 2026-11-21. Status: draft. Owner: "For Solar System Sandbox: Add K-5 lessons and Quizzes for the child the take."

## Owner decisions (2026-11-21)

- **Lessons are short tours inside the 3D sandbox, without Chike.** The camera flies to the Sun, a planet or an orbit;
  3 or 4 kid-sized lines are read aloud; the child is asked to do something in the sandbox ("tap the biggest planet").
- **Then 3 quiz questions at the child's grade** (the picked child's grade arrives the same way as in the other games;
  otherwise the child picks a grade).
- **About 8 tours**, for example: The Sun; Rocky vs gas planets; Why we have years; Moons.
- **Answers count toward the progress report** (the game stage): the child's Science level (Getting started / Growing /
  Strong) and the questions they missed, with the right answer and the why.

## What exists

`supabase/private-games/solar-system-sandbox.html` (subscribers-only, pg-solar-system-sandbox): a 3D Sun and planets,
fly-to and drag, a fact card per planet (year, moons, size, NASA figures), and a Compare sizes view. Tests in
test/solarSandbox.test.js.

## Left to settle in the mockup and plan

- The tour list (8), each tour's lines at three reading levels (K-1, 2-3, 4-5) and its "do something" step.
- Quiz questions per tour per level (K-1 two answers, read aloud; 2-3 three answers; 4-5 three answers that need the why),
  matching the progress report's quiz rules.
- How a game sends answers to the site for the report (the shared "ccs-done"-style message from the progress report
  design, game stage), which this is the first game to use.
- Read-aloud voice (the site's Kokoro voices are pre-recorded clips; tours have fixed lines, so clips can be recorded).

## Order of work

1. Mockup of one tour (three steps and the "do something" moment) and its quiz, at two grade levels; owner checkpoint.
2. Plan, then build.
