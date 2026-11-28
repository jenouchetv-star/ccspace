# Tech Space: design

Date: 2026-11-28. Owner: Jeno Uche. Source: the owner's PRD v1.1 (Downloads/Tech_Space_PRD.md, "Tech Space PRD"), plus
the owner's decisions in conversation on 2026-11-28. Where this document and the PRD differ, this document wins; each
difference is marked "(owner)" when the owner decided it and "(builder's call)" when it was proposed and not objected to.

## 1. Intent and the why

Kids meet technology as a black box, and too late. Real boards cost money, break, and their tutorials assume reading
and typing young children don't have yet. Tech Space is the fourth Creative Space Studio app (beside Art Space and
Sound Space): a 3D workshop where K-5 kids play with ready-made gadgets, peek inside every part, rebuild the gadget
themselves step by step, and then take a plan to build it for real on a Pi-style (Pico-class) board with a grown-up.

Success is a child who has fun here and wants to build something real. The PRD's measures: a first success within
5 minutes; kids finishing a first gadget (aim 80%+ after a pilot); gadgets tried per child; how many press Make your
own and open Go real; kids asking for "one more".

The owner works in tech and wants the site to lean further toward technology than crafts; this app is a direct step.

## 2. Goals, non-goals, anti-goals

Goals
- A first success within 5 minutes: open a gadget, see it work, change something, see the change.
- Teach how common machines work by touching and testing parts, at the child's level (three bands).
- Move interested kids to a real build ("Go real").
- Look, feel and navigate like Art Space and Sound Space.
- Feed the grown-up's progress report (Technology and Engineering are thin today).

Non-goals (v1)
- A real Linux desktop or Pi OS; a real-hardware connection.
- Selling hardware, or shop links on Go real (builder's call: no product links in v1; prices are estimates only).
- Social features, sharing, chat. Teacher classroom codes. The 3D-printable companion.
- Tier 2 and Tier 3 gadgets fully built (their content comes later, on the same framework).

Anti-goals (a failure even if it works)
- A K-1 child stuck because something needs reading or typing.
- A child stuck with no hint: every step has a kind hint and, after a few misses, shows the way.
- "Raspberry Pi" in the app's name, branding or copy, or its logo anywhere. Say "Pi-style board", "Pico-class board",
  and "full Pi-class board" for Tier 3.
- Go real instructions that could hurt a child or a board (see Safety).
- An app that feels unlike its Studio siblings, or that stutters on a school Chromebook.

## 3. Who uses it

Children K-5, in three bands (PRD):

| Band | Grades | Reading | Code | Typical activity |
|---|---|---|---|---|
| Explorers | K-1 | Voice and icons | None (drag and drop) | Tap parts, hear about them, trigger lights and sounds |
| Builders | 2-3 | Short sentences, read aloud | Picture blocks | Guided builds, fix simple mistakes |
| Inventors | 4-5 | Full text, glossary | Labeled blocks + a Python preview | Build from scratch, challenges |

The band starts from the picked child's grade (K-1 Explorers, 2-3 Builders, 4-5 Inventors) and can be switched any
time (builder's call). With no child picked (a grown-up exploring), it asks once and remembers on the device.

Grown-ups (parents, teachers): the Go real page behind the grown-up check, and the child's progress in the existing
progress report.

## 4. Decisions already made

- **Family account (owner).** Like Art Space and Sound Space: Tech Space is inside the free family account, opens
  from the Studio page in its own full window, and saves to the account so a child's work is on every device. The
  PRD's F12 "local auto-save, no account" and "saves local by default" are replaced by this. The site's usual
  privacy rules hold: no ads, no tracking, nothing about the child beyond what the family account already keeps.
- **First release (owner, PRD v1 scope):** Blinking Light, Traffic Light and Reaction Game fully working, plus the
  framework and data shape for every other catalog gadget. It ships as a beta, "Coming soon" on the Studio page until
  the owner says to launch it (as Sound Space did); an admin can open it before then.
- **How it is built (owner chose approach A, below).**
- **Name (builder's call):** "Tech Space", matching Art Space and Sound Space.
- **Voice (builder's call):** the site's Kokoro voice (af_heart) at 80%, pre-recorded like the quiz and book voices,
  with a voice on/off toggle. Device speech only as a fallback for a line with no clip.

## 5. Approaches considered

A. **One self-contained app page like Art Space and Sound Space, with Three.js (chosen).** The app is
   `assets/apps/tech-space.html` with the same top bar, menu, Help and look as its siblings; 3D with Three.js from the
   CDN the games already use (Remote Lunar Mission, HexaGone!). Gadgets, parts, steps and Go real plans are data files,
   so a new gadget is content, not code. The simulator is its own small module with its own tests. Matches the
   siblings, publishes like them, light on Chromebooks.

B. **The PRD's suggested stack (React, TypeScript, Vite, React Three Fiber, Zustand).** Same 3D underneath, but adds
   a build step only this app would have, diverges in code and feel from Art Space and Sound Space, and loads more.
   Not chosen.

C. **A flat 2D board first, 3D later.** Fastest and lightest, but drops the 3D tap/rotate/exploded view that is the
   heart of the app. Not chosen.

## 6. The experience

Core loop (PRD): **Play, Peek inside, Make your own, Go real.**

### 6.1 Home (the gadget library, F1)
The app opens on Home, like Sound Space: the child's saved builds ("My gadgets") and the gadget library by tier
(Starter, Builder, Advanced), with band filters. v1 gadgets are open; the rest show as "Coming soon" cards (builder's
call: visible so kids see what's ahead, not tappable). Tier 3 cards carry an "Advanced: full Pi-class board, with a
grown-up" label.

### 6.2 Play (test mode, F2, F3, F6)
A gadget opens already built and running in 3D within a minute: an oversized, color-coded, labeled board on a desk.
The child can rotate, zoom, tap a part to highlight it, and use the gadget (press its button, watch the light).
- An exploded-view slider pulls parts apart.
- Signal flow shows power and data moving, in different colors.
- Reduced motion: the flow is drawn without moving dots, and the exploded view jumps rather than glides.

### 6.3 Peek inside (part explorer, F4)
Tapping a part opens its card:
- what it does, at the child's band (three levels: K-1, 2-3, 4-5), read aloud;
- 3+ use cases;
- what it connects to;
- common mistakes;
- safety notes where they apply;
- a real-world example.

Explorers get a short spoken line and pictures; Inventors get full text and the glossary.

### 6.4 Make your own (F5, F7)
A guided build from an empty board in four kinds of step: **place** a part (drag and snap), **wire** it (connect
pin to pin), **code** it, **test** it. Every step has a hint. A wrong move gets a kind message that says what to try
("The light needs its short leg on the ground row"). After a few misses the right spot glows.
- **Explorers:** no code step. The behavior is chosen by tapping a picture ("blink fast" or "blink slow").
- **Builders:** picture blocks (Light on, Light off, Wait, Repeat forever, When button pressed, Beep).
- **Inventors:** labeled blocks with a live Python preview, MicroPython for a Pico-class board, the same code
  Go real gives.

Typing is never required for K-3. Touch targets are at least 56px. Drag and snap is forgiving.

### 6.5 Break it (F8)
A mystery mode on a finished gadget: something is wrong (a wire is off, a part is backwards, a wait is missing), and the
child finds and fixes it, with hints.

### 6.6 Go real (F10)
After finishing a gadget (and from its card later), "Go real" opens a grown-up page behind the site's existing tap-to-
answer grown-up check. It shows:
- the parts list, with an estimated cost range (no shop links in v1);
- the exact board needed (Pico-class or full Pi-class);
- a wiring diagram drawn from the gadget's data, the same wiring the child built;
- the MicroPython code;
- a printable checklist;
- the safety notes.

### 6.7 Rewards (F9)
- **Stickers:** one for finishing each gadget, plus milestones (first build, first fix in Break it).
- **Part trading cards:** a card for each part met.
- **My gadgets shelf:** finished builds.
- **A printable certificate** per gadget, with the child's first name.

Stickers also go to the site-wide My stuff page when that is built; it is drafted and not yet approved (see
docs/mockups/my-stuff-draft.png).

### 6.8 Voice (F11)
Every screen can be read aloud (Kokoro af_heart at 80%), with a toggle in the top bar that the app remembers. Explorers
hear their part lines and step prompts automatically.

### 6.9 Sessions
Designed for 3-7 minutes, with a clear stopping point: a gadget's build ends with the sticker and "Go real".

## 7. How it connects to the site

- **Studio page:** a new STUDIO_APPS entry (`id:"tech"`, `members:true`, `beta:true`, `live:false` until launch),
  with its own app icon and preview pictures, like Sound Space.
- **Opening:** the same full-window app stage as Art Space and Sound Space (`/create/studio/tech`), with the same
  top-bar behaviors (close, install as an app, background save on close).
- **Saving:** a `tech-cloud` edge function and a `tech_projects` table, copied from sound-cloud and sound_projects:
  the same portal-session check, "newer wins" saves, limits (studio_limits), locks so a build is open in one place at
  a time, and Home's space bar. What is saved per child build: the gadget id, the placed parts, wires, blocks, which
  steps are done, and a small thumbnail. Earned stickers and trading cards are saved in the account too.
- **The child's grade:** Tech Space needs the picked child's grade to choose the band. The site does not pass a grade
  to Studio apps today; it will pass it to Tech Space the same way it passes it to games (window.CCS_GRADE).
- **The progress report:** short questions at the end of Peek inside and after Test send answers with the site's
  existing `ccsAnswer` message. Questions about code, inputs, outputs and timing count toward **Technology**; questions
  about building, wiring and power count toward **Engineering**. Each part card's three levels supply the questions
  for k1, g23 and g45. The site keeps them only for the child picked in "Who's creating today?", as for every game.
  The app's record on the site gets those two subjects for the subject line on its page.

## 8. Content (data files)

One folder: `assets/apps/tech-space/`.
- `parts.json`: each part with a name, a 3D look (which primitive shapes, colors, pins), the three explanation
  levels, use cases, connections, common mistakes, safety notes, a real-world example, its trading card, and its
  report questions per level with subject (technology or engineering).
- `gadgets/<id>.json`: tier, bands, what it teaches, parts and their positions, wires, the program (as blocks and as
  MicroPython), build steps with hints and error messages, Break it puzzles, the Go real plan (parts, cost range,
  board, checklist, safety notes) and its sticker.
- Voice clips in `assets/voice/tech/`, recorded from the data's lines with the existing Kokoro scripts.

v1 content: three gadgets and their parts (board, LED, resistor, button, buzzer, wires, breadboard). Catalog entries
for the rest are cards only ("Coming soon").

## 9. Technical shape

- Three.js from the same CDN and version family the games already load; low-poly primitive shapes built in code, with no
  model files in v1 (PRD: placeholder shapes first, GLB models later). A quality setting drops shadows and
  anti-aliasing on slow devices.
- The simulator is a separate module (`assets/lib/techSim.js`), event based, with no UI. It covers what the v1 gadgets
  need: digital output (LED), input (button), buzzer tones, timing, and simple variables. Dial, sensor, motor,
  speaker, camera and display stubs come with the gadgets that use them. It is tested in vitest like the other
  libraries.
- The block editor is the app's own small one (no third-party editor).
  - Blocks are data.
  - The Python preview is generated from the blocks.
  - The simulator runs the blocks.
- Sound and motion: every action gives a sound or motion cue. It uses the site's game sound kit and mute, and
  respects reduced motion. There is a high-contrast mode.
- Offline after the first load is a "should have" (PRD), via the service worker like the site.

## 10. Safety (Go real)

Every Go real page states the rules that apply:
- LEDs always with a resistor;
- never wire a motor straight to a pin (use a driver board);
- low voltage only;
- small parts away from young children;
- K-2 real builds need a grown-up;
- Tier 3 projects need a full Pi-class board and a grown-up.

The plans are written to be tested on real boards before launch (PRD risk: the simulator must not promise what
hardware won't do), and the app says plainly where the simulator simplifies.

## 11. What is left to the builder

- Exact 3D look, camera, lighting and colors, within the Studio's look. Mockups go to the owner first.
- The block set's exact wording and icons.
- Hint wording and how many misses before the glow.
- The milestone sticker list beyond one per gadget.
- How the code step is graded (it is enough that the light blinks, or must it be exactly this code? Make it enough
  that the behavior matches).
- File layout inside the app.
- The data files' field names.

## 12. Settled after the builder check (builder's calls unless marked)

- **Report level:** an answer counts at the level of the band the child was playing in (what they actually answered),
  not their grade.
- **Content:** written by the builder from the PRD (parts at three levels, use cases, steps, hints, Break it puzzles,
  Go real plans, report questions) and sent to the owner as a review list before it goes in, like the 480 quick
  questions. Voice: every Explorers and Builders line, and part cards at all levels; Inventors' longer text and the
  glossary use the read-aloud button with the same recorded voice where a clip exists, device speech otherwise.
- **Reaction Game:** the simulator and blocks gain "Wait a surprise time" and "How fast was I?" (a timer and a number
  to show), the least needed to code it. Builders get them as picture blocks.
- **Performance:** 30 frames a second or better on a basic school Chromebook (4 GB, integrated graphics); the quality
  setting turns shadows and anti-aliasing off automatically when frames drop.
- **Approval gates (the owner's standing rules):** mockups before building each new screen; nothing pushed, published,
  deployed or uploaded without the owner saying so; the table and edge function go live with the push that needs them
  (SQL, then function, then site).
- **Icon and preview pictures:** an SVG app icon drawn like the other Studio icons; preview pictures are real
  screenshots of the app (no reused images).

## 13. Open questions from the PRD, and where they stand

- Name: "Tech Space" (builder's call, above).
- Web only or app stores: web, installable like Art Space; app stores later if ever.
- Free or paid: free in the beta, like the Studio (the owner has said the Studio won't stay free after beta; pricing
  is deferred).
- 3D-printable companion: later.
