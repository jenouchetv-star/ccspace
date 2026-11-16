# Rover Campaign, Part 1 (engine + Pumice Moon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Remote Lunar Salvage into the first world of a four-world campaign: Pumice Moon with today's repair mission, then a Drill and satellite mission, the rocket and Launch with a briefing, a grade-based picture quiz, the handwritten notepad with Scan filling it, and saved progress.

**Architecture:** The game stays one HTML file. New rules and data (worlds, missions, drill, quiz banks, grade bands, save merging, flight timing) go in the `/* BEGIN pure */` block and are tested with `new Function` like today's. Runtime code is added beside today's modules. World 1 keeps today's scene builder; worlds 2 to 4 (later parts) plug into the same `WORLDS` data.

**Tech Stack:** three.js r128 (cdnjs), plain JS/CSS in one file, Supabase Realtime for the phone, vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-rover-campaign-design.md` (Part 1 of "Build order"). Approved drafts: `docs/mockups/lunar-notes-draft.html`.

## Global Constraints

- Files: game `supabase/private-games/remote-lunar-salvage.html`, phone `games/lunar-salvage-remote.html`, tests `test/remoteLunarSalvage.test.js`. Run tests with `npx vitest run test/remoteLunarSalvage.test.js`; full suite `npx vitest run`.
- Draft a new screen's layout in `docs/mockups/` and get the owner's OK before building it into the game (Task 1 is that checkpoint).
- Never push, re-upload or publish without the owner saying "push". Never email subscribers.
- Commit with explicit file lists only. Never commit docs/mockups/, Gemini jpgs, show-poster images, supabase/functions/*, test helpers, docs/welcome-series.md, .claude/serve.py.
- Never `localStorage.clear()` on localhost:4321. Use new browser tabs and close them after.
- No emojis. Badges black, CTAs blue. Motion decelerates (`cubic-bezier(.2,.7,.2,1)`), never bounces; honor `prefers-reduced-motion`.
- Rebuild phone buttons only on a mode change.
- Science must be true. Pumice Moon pulls like Earth's Moon: 1.62 m/s².
- Fonts: Kalam 700 and Patrick Hand from Google Fonts (notepad only).
- Character pictures: `/assets/characters/<name>.jpg`; Kiyah's is `kylah.jpg`. Site spellings: Yuna, Kiyah, Zech.
- Lines with CRLF break tests: write files with `\n`.

## Review Focus

1. The site never answers the save request (game opened on its own, or an old site): the game must start with defaults and show the grade picker; never hang.
2. Launch pressed twice, or from the keyboard and the phone at once: exactly one flight runs.
3. `speechSynthesis` missing, or `speak()` throwing in the sealed frame: speaker buttons hide, nothing crashes.
4. Switching to Drill while the arm or magnet holds a part: the switch is refused with a spoken reason, like Drive is today, and nothing is dropped.
5. An old cached phone remote that has no Drill button, or sends an unknown mode: the game ignores unknown modes and keeps working.

---

### Task 1: Mockups of the three new screens (owner checkpoint)

**Files:**
- Create: `docs/mockups/lunar-campaign-screens-draft.html` (not committed)

- [ ] **Step 1:** Draft, in the notepad draft's style family (dark game UI, blue CTAs, Kalam/Patrick Hand only for handwritten parts):
  1. **Start screen:** today's briefing card plus "What grade are you in?" with five round buttons 1 to 5, and a row of four planets (Pumice Moon reached; Glacia, Ember, Gusto Canyon shown as locked silhouettes with "?").
  2. **Flight and briefing:** the ship's cabin window (stars sliding by), a screen with Zech's picture (`/assets/characters/zech.jpg`) in a rounded frame with a "LIVE FROM EARTH" label, speech-bubble captions one at a time with a blue Next button, and "Landing on Glacia" as the last line.
  3. **Picture quiz:** one question drawn three ways (1st grade: two picture buttons and a speaker button; 2nd-3rd: picture + three word answers; 4th-5th: picture + three answers with numbers), and the wrong-answer state with the right part circled in red pen.
- [ ] **Step 2:** Check it at 1280x800 and 390x844 in a new tab (no sideways scroll), close the tab, send it to the owner, and wait for their OK. Changes they ask for go into the draft before Task 6 and Task 9.

### Task 2: Worlds as data, world gravity, steps by flag, and the Pumice Moon name

**Files:**
- Modify: `supabase/private-games/remote-lunar-salvage.html` (pure block near `MOON_G`, `NOTES`, `STEPS`, `currentStep`; runtime uses of `MOON_G` at the parts, dust and boulder chunk physics; start card and notes text)
- Test: `test/remoteLunarSalvage.test.js` (add the new names to the `S` export list)

**Interfaces:**
- Produces:
  - `WORLDS` array of `{ id, name, g, air, tools, corner, brief, missions }`, in order: `pumice` ("Pumice Moon", 1.62, false, ["drive","arm","magnet","laser","drill"], corner "chike", brief null, missions ["repair","satellite","board"]); `glacia` ("Glacia", 3.71, true, ["drive","arm","magnet","laser"], "yuna", "zech"); `ember` ("Ember", 8.87, true, ["drive","arm","magnet","drill","hose"], "averi", "corey"); `gusto` ("Gusto Canyon", 5.0, true, ["drive","arm","magnet","laser","drill","hose"], "mateo", "kiyah"). Later worlds have `missions: []` for now.
  - `worldById(id) -> world`.
  - `stepIndex(steps, flags) -> number`: index of the first step whose `flag` key is not truthy in `flags`, else `steps.length`.
  - `STEPS` entries gain `flag` (approach, panel, lever, support, crossed, freed, cellLoaded, atGreenhouse, installed, tested). `currentStep(f)` becomes `stepIndex(STEPS, f)` and keeps returning the same numbers.
  - `earthFeelKg(kg, g)` with `g` defaulting to `MOON_G`.
  - Runtime: `G.world` (the current world object) and `G.g` (its gravity). Every runtime `MOON_G * dt` uses `G.g`.
  - `NOTES` entries gain `world: "pumice"`.

- [ ] **Step 1: Write the failing tests**

```js
describe("worlds are data", () => {
  it("lists four made-up worlds in campaign order with real-place gravity", () => {
    expect(S.WORLDS.map(w => w.id)).toEqual(["pumice", "glacia", "ember", "gusto"]);
    expect(S.worldById("pumice").g).toBe(S.MOON_G);
    expect(S.worldById("glacia").g).toBeCloseTo(3.71, 2);
    expect(S.worldById("ember").air).toBe(true);
    expect(S.worldById("pumice").air).toBe(false);
  });
  it("Pumice Moon has the drill, and only worlds with air have the hose", () => {
    expect(S.worldById("pumice").tools).toContain("drill");
    for (const w of S.WORLDS) if (w.tools.includes("hose")) expect(w.air).toBe(true);
  });
  it("finds the step from the first flag not done", () => {
    expect(S.stepIndex([{ flag: "a" }, { flag: "b" }], { a: true })).toBe(1);
    expect(S.stepIndex([{ flag: "a" }], { a: true })).toBe(1);
    expect(S.currentStep({ approach: true, panel: true })).toBe(2);
    expect(S.currentStep({ tested: true, installed: true, approach: true, panel: true, lever: true, support: true, crossed: true, freed: true, cellLoaded: true, atGreenhouse: true })).toBe(10);
  });
  it("weight feels lighter on Pumice Moon than on Glacia", () => {
    expect(S.earthFeelKg(60)).toBeCloseTo(9.9, 1);
    expect(S.earthFeelKg(60, 3.71)).toBeGreaterThan(S.earthFeelKg(60));
  });
  it("calls world 1 Pumice Moon, and says it pulls like Earth's Moon", () => {
    const g = S.NOTES.find(n => n.id === "gravity").text;
    expect(g).toContain("Pumice Moon");
    expect(g).toContain("Earth's Moon");
    expect(g).toContain("1.62");
    expect(S.NOTES.every(n => n.world)).toBe(true);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run test/remoteLunarSalvage.test.js`. Expected: the new tests FAIL (`WORLDS` undefined); existing tests still pass.
- [ ] **Step 3:** Implement the interfaces above. Reword player-facing "the Moon" to "Pumice Moon" where it names the place the rover is (start card, notes, radio lines, quiz); keep "Earth's Moon" where it compares. The game's title stays "Remote Lunar Salvage". Set `G.world = worldById("pumice"); G.g = G.world.g;` in `resetWorld()`.
- [ ] **Step 4:** Run the file's tests. Expected: all PASS. Then `npx vitest run`. Expected: all PASS.
- [ ] **Step 5:** Commit `supabase/private-games/remote-lunar-salvage.html test/remoteLunarSalvage.test.js` with message "Remote Lunar Salvage: worlds as data, world gravity, Pumice Moon".

### Task 3: Saving, the grade picker and the world row

**Files:**
- Modify: game (pure block; start overlay `#ovStart`; pause overlay `#ovPause`)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Produces:
  - `SAVE_NAME = "remote-lunar-salvage"`.
  - `defaultSave() -> { v: 1, grade: null, reached: ["pumice"], notes: [], stars: {} }`.
  - `mergeSave(raw) -> save`: returns `defaultSave()` merged with only the valid fields of `raw` (grade an integer 1 to 5 else null; `reached` filtered to known world ids, always including "pumice", in `WORLDS` order; `notes` filtered to known note ids, de-duplicated; `stars[worldId] = { mission: bool, notes: bool, quiz: bool }`). Never throws on `null`, strings or junk.
  - `gradeBand(grade) -> "g1" | "g23" | "g45"` (null or unknown treated as "g23").
  - Runtime: `SAVE` (current save), `loadSave(): Promise<save>` (posts `{ccsSave:"get", game: SAVE_NAME}` to the parent, waits up to 800 ms for `{ccsSave:"data", game, data}`, falls back to `localStorage` in try/catch, then `mergeSave`), `writeSave()` (posts `{ccsSave:"set", game, data}` and writes localStorage in try/catch). Read `hexago.html` around its `ccsSave` lines for the exact message shapes the site answers with, and match them.
  - Start overlay: grade buttons (`#gradeRow button[data-g]`, five of them), the world row (`#worldRow`, one button per reached world, locked worlds as non-interactive silhouettes). Start is enabled after a grade is picked; a saved grade is preselected. Pause overlay gains "Change grade".

- [ ] **Step 1: Write the failing tests**

```js
describe("saving", () => {
  it("starts fresh from junk", () => {
    for (const junk of [null, "x", 5, { grade: "7", reached: ["mars"], notes: ["nope"] }]) {
      expect(S.mergeSave(junk)).toEqual(S.defaultSave());
    }
  });
  it("keeps the good parts of a save", () => {
    const s = S.mergeSave({ grade: 3, reached: ["glacia", "pumice", "pumice"], notes: ["steel", "steel", "gravity"], stars: { pumice: { mission: true, notes: false, quiz: true } } });
    expect(s.grade).toBe(3);
    expect(s.reached).toEqual(["pumice", "glacia"]);
    expect(s.notes.sort()).toEqual(["gravity", "steel"]);
    expect(s.stars.pumice).toEqual({ mission: true, notes: false, quiz: true });
  });
  it("puts grades in three bands", () => {
    expect([1, 2, 3, 4, 5, null].map(S.gradeBand)).toEqual(["g1", "g23", "g23", "g45", "g45", "g23"]);
  });
});
```

- [ ] **Step 2:** Run the file's tests. Expected: new tests FAIL.
- [ ] **Step 3:** Implement the interfaces, with the layout the owner approved in Task 1. Picking a grade calls `writeSave()`.
- [ ] **Step 4:** Run the file's tests, then the full suite. Expected: PASS.
- [ ] **Step 5:** In a new tab at `http://localhost:4321/supabase/private-games/remote-lunar-salvage.html` (opened on its own, so no parent answers), confirm the start card appears within 1 s with no grade picked and Start disabled; pick 2; reload; 2 is preselected. Close the tab.
- [ ] **Step 6:** Commit the game and test file: "Remote Lunar Salvage: saved progress, grade picker, world row".

### Task 4: The handwritten notepad and the Field Notes button

**Files:**
- Modify: game (`.note` card CSS/HTML, `#ovNotes`, `#bNotes`, `learn()`, `renderNotes()`, Google Fonts link in `<head>`)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Consumes: `NOTES[].world`, `WORLDS`, `SAVE.reached`, `SAVE.notes` (Task 2, 3).
- Produces:
  - `NOTE_DOODLES` (pure): note id → inline SVG string (pen doodle, `stroke` uses `currentColor`); one per note.
  - `#bNotes` becomes the little notepad from the draft (`.padbtn`), outside `.bar`, top-right under the bar on wide screens, right edge above the dashboard on phones; text "Field Notes" and "N of M" where M counts notes of reached worlds. `.padbtn.new` shows the red NEW tag and the three-pulse ring until the notepad is opened.
  - `learn(id, chips)` also adds the id to `SAVE.notes`, calls `writeSave()`, marks the button new, and plays the slide-into-the-notepad motion (the pop-up page shrinks and moves toward the button over 450 ms, decelerating). Chips render as `.mk.yes` (highlighter), `.mk.no` (crossed out), `.mk.warn` (circled).
  - `renderNotes()` groups by world (a Kalam heading per reached world) and numbers notes within the world; locked notes are grey pencil "Not found yet" with "Clue: " + hint and a "?".
  - Opening the notepad pauses the game (as the pause overlay does) and closing resumes it. The `N` key toggles it. The phone sends `{ t: "notes" }` (Task 6 adds the button).

- [ ] **Step 1: Write the failing tests**

```js
describe("the notepad", () => {
  it("has a pen doodle for every note", () => {
    for (const n of S.NOTES) expect(S.NOTE_DOODLES[n.id]).toMatch(/^<svg/);
  });
  it("uses handwriting fonts and no emojis in the notepad", () => {
    expect(game).toContain("family=Kalam:wght@700&family=Patrick+Hand");
    expect(game).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
  it("the Field Notes button is a notepad, not a small bar button", () => {
    expect(game).toMatch(/<button[^>]*id="bNotes"[^>]*class="padbtn"|<button[^>]*class="padbtn"[^>]*id="bNotes"/);
    expect(game).toMatch(/\.padbtn:after\{[^}]*animation:[^}]*3\}/);
  });
});
```

- [ ] **Step 2:** Run the file's tests. Expected: FAIL.
- [ ] **Step 3:** Implement from `docs/mockups/lunar-notes-draft.html` (copy its `.pad`, `.rings`, `.mk`, `.entry`, `.padbtn` rules; tokens become game CSS variables). Reduced motion: no slide, no pulse.
- [ ] **Step 4:** Run the file's tests, then the full suite. Expected: PASS.
- [ ] **Step 5:** Browser check in a new tab at 1280x800 and 390x844: learn a note (drop a part), see the pop-up page, the slide into the button and NEW; open and close the notepad; the game pauses while it's open; no sideways scroll; the button never covers Chike's card or the dashboard. Close the tab.
- [ ] **Step 6:** Commit: "Remote Lunar Salvage: Field Notes as a handwritten notepad".

### Task 5: Scan fills the notepad

**Files:**
- Modify: game (pure block; `doScan`, `drawTags`/marker drawing, `renderDash`)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Produces:
  - `SCAN = { drive: 7, tool: 4.5 }` (pure) replacing the literals in `doScan`; `scanRange(mode) -> number`.
  - `SCANNABLE` (pure): prop key → note id: part types `panel`/`scrap` → "steel", `block`/`tube` → "aluminum", `wedge` → "triangle", `cell` → "cell", `glass` → "glass", statics `drill` → "weight", `tower` → "radio", `energy` → "layers" (Task 7), `dish` → "satellite" (Task 8).
  - Runtime: a pencil "?" sprite (canvas texture, the notepad's pencil grey) floats 0.6 m above each prop whose note is not in `G.notes`; it hides when the note is found. The Scan button gets `.ready` (a yellow ring, same style as the tool hint) while such a prop is within `scanRange(G.mode)` of the scan origin.

- [ ] **Step 1: Write the failing tests**

```js
describe("scan fills the notepad", () => {
  it("scan reaches farther from the nose than from the claw", () => {
    expect(S.scanRange("drive")).toBe(7);
    expect(S.scanRange("arm")).toBe(4.5);
  });
  it("every scannable prop writes a real note", () => {
    for (const id of Object.values(S.SCANNABLE)) expect(S.NOTES.some(n => n.id === id)).toBe(true);
  });
});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. (Adding `layers` and `satellite` notes happens in Tasks 7 and 8; until then leave those two keys out of `SCANNABLE`, and add them in those tasks.)
- [ ] **Step 4:** Run the file's tests and the full suite. Expected: PASS.
- [ ] **Step 5:** Browser check: drive toward the drill rig; the "?" shows over it, Scan lights up in range, scanning writes "Mass and weight" and the "?" disappears. Close the tab.
- [ ] **Step 6:** Commit: "Remote Lunar Salvage: Scan fills the notepad".

### Task 6: The Drill tool, on screen and on the phone

**Files:**
- Modify: game (pure block; `MODES`, `setMode`, `buildDash`/`renderDash`/`drawDash`, `readInput`, keys, `rmMsg`, `sendPhoneState`, rover mesh)
- Modify: `games/lunar-salvage-remote.html` (Drill mode button, Notes button, Launch button)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Consumes: `WORLDS[].tools` (Task 2).
- Produces:
  - Pure: `DRILL = { secs: 3.2, spotR: 1.4, cool: 0.6 }`; `MATERIALS.crystal = { name: "Energy crystal", magnetic: false }`; `PART_TYPES.energy = { name: "Energy rock", mat: "crystal", kg: 8, r: 0.32 }`; `drillStep(depth, holding, dt) -> depth` (adds `dt / DRILL.secs` while holding, clamps 0 to 1, falls back by `DRILL.cool * dt` when not holding and below 1); `drillFind(spot) -> "energy" | "water" | "rock"` (`spot` is `null` or `{ gives }`); `toolsFor(world, flags) -> string[]` (the world's tools, without `"drill"` on Pumice Moon until `flags.tested`).
  - `MODES` becomes `toolsFor(G.world, G.flags)` at each call; number keys map in that order (1 Drive, 2 Arm, 3 Magnet, 4 Laser, 5 Drill). Unknown or locked modes from the phone are ignored.
  - Drill mode: the rover parks; the dashboard shows a depth gauge (layers: dust, rock, then what the spot gives) and one big "DRILL" hold button (keyboard Space; pad button 0); the drill bit (a cylinder under the rover's nose) lowers and spins, with dust. Not allowed while holding something (refused like Drive is, with radio "Put it down first. The drill needs both hands of the rover.").
  - At depth 1 over a spot: `energy` spawns an energy rock part beside the hole; off a spot, radio "Only rock here. Drill on a dashed ring." and depth resets.
  - Spots: a pencil-dashed ring on the ground (`drillSpots`, each `{ x, z, gives, used }`).
  - Phone: `#modes` shows only the modes the game sends in `st.tools`; the game adds `tools` to its state message. A Drill pad: hold DRILL sends `{ t:"b", b:true/false }` like FIRE. A "Notes" button sends `{ t:"notes" }`. A "Launch" button appears when `st.launch` is true and sends `{ t:"launch" }`.

- [ ] **Step 1: Write the failing tests**

```js
describe("the drill", () => {
  it("goes down while held and creeps back when let go", () => {
    let d = 0;
    for (let i = 0; i < 16; i++) d = S.drillStep(d, true, 0.1);
    expect(d).toBeCloseTo(0.5, 1);
    expect(S.drillStep(0.5, false, 0.5)).toBeCloseTo(0.2, 1);
    expect(S.drillStep(0.99, true, 1)).toBe(1);
  });
  it("finds what the spot hides, and only rock off a spot", () => {
    expect(S.drillFind({ gives: "energy" })).toBe("energy");
    expect(S.drillFind(null)).toBe("rock");
  });
  it("energy rocks need the claw", () => {
    expect(S.magnetCheck("energy").ok).toBe(false);
    expect(S.clawCheck("energy").ok).toBe(true);
  });
  it("the drill unlocks on Pumice Moon after the greenhouse works", () => {
    const w = S.worldById("pumice");
    expect(S.toolsFor(w, {})).not.toContain("drill");
    expect(S.toolsFor(w, { tested: true })).toContain("drill");
  });
  it("the phone shows only the tools the game sends, and has Notes and Launch", () => {
    expect(remote).toContain('data-m="drill"');
    expect(remote).toMatch(/st\.tools|p\.tools/);
    expect(remote).toContain('t: "notes"');
    expect(remote).toContain('t: "launch"');
  });
});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep the magnet rule: the phone rebuilds buttons only when the mode or the tool list changes.
- [ ] **Step 4:** Run the file's tests and the full suite. Expected: PASS.
- [ ] **Step 5:** Browser check in new tabs (game + phone remote): before the greenhouse works, there's no Drill button anywhere, and a hand-sent `{ t:"mode", m:"drill" }` or `{ t:"mode", m:"hose" }` changes nothing. After it works, drill a ring to depth and an energy rock appears. Switching to Drill while holding a part is refused with the radio line and the part stays held. Close the tabs.
- [ ] **Step 6:** Commit game, remote and test: "Remote Lunar Salvage: the Drill, on screen and on the phone".

### Task 7: The satellite mission

**Files:**
- Modify: game (pure: `NOTES`, `MISSIONS`, `TARGET_ACCEPTS`; runtime: outpost builder near `PLACES`, `updateStep`, `renderObjective`, `STEP_TOOL`/`STEP_PIC`, `doTest`)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Consumes: `stepIndex`, `drillFind`, `PART_TYPES.energy`, `SCANNABLE` (Tasks 2, 5, 6).
- Produces:
  - `MISSIONS` (pure): `{ repair: { steps: STEPS, tool: [...today's STEP_TOOL], pic: [...today's STEP_PIC] }, satellite: { steps: SAT_STEPS, tool: [...], pic: [...] }, board: { steps: BOARD_STEPS, tool: [...], pic: [...] } }`. `STEP_TOOL`/`STEP_PIC` lookups become `MISSIONS[G.mission].tool[G.step]` / `.pic[...]`.
  - `SAT_STEPS` (pure), in order, with flags: `drill1` "Drill at a dashed ring to find an energy rock." (drill) · `rack1` "Put the energy rock in the satellite's battery rack." (arm) · `rack3` "Find two more and fill the rack." (drill) · `satTest` "Switch on the satellite!" (drive; a Test button like the greenhouse's). Three drill spots, all `gives: "energy"`, placed east of the hub; the satellite dish and its 3-slot rack beside the radio tower.
  - `TARGET_ACCEPTS.rack = ["energy"]`, with three snap slots.
  - Notes: `layers` (Pumice Moon) "Drilling finds layers": "The ground is made in layers. Loose dust sits on top, then rock, and sometimes something useful deep down. Scientists drill to read the layers, like pages in a book." hint "Drill at a dashed ring." · `satellite` "Satellites relay messages": "A satellite dish catches radio waves and sends them on. With no air to carry sound, radio is how space stations talk to Earth." hint "Scan the satellite dish." Both get doodles (Task 4's `NOTE_DOODLES`).
  - After the greenhouse test (today's end): no longer opens the end card. Chike says the satellite needs power, the Drill unlocks (`toolsFor`), `G.mission = "satellite"`, steps restart at 0.
  - Satellite test: the dish turns to the sky over 2.5 s, then the briefing radio: "Message from Earth: great work. Load the rover into the rocket." and `G.mission = "board"`.

- [ ] **Step 1: Write the failing tests**

```js
describe("the satellite mission", () => {
  it("runs drill, rack, fill, test in order", () => {
    const st = S.MISSIONS.satellite.steps;
    expect(st.map(s => s.flag)).toEqual(["drill1", "rack1", "rack3", "satTest"]);
    expect(S.MISSIONS.satellite.tool).toEqual(["drill", "arm", "drill", "drive"]);
    expect(S.stepIndex(st, { drill1: true, rack1: true })).toBe(2);
  });
  it("the rack only takes energy rocks", () => {
    expect(S.TARGET_ACCEPTS.rack).toEqual(["energy"]);
  });
  it("every mission's tool and picture lists match its steps", () => {
    for (const m of Object.values(S.MISSIONS)) {
      expect(m.tool.length).toBe(m.steps.length);
      expect(m.pic.length).toBe(m.steps.length);
    }
  });
  it("teaches layers and satellites", () => {
    expect(S.NOTES.find(n => n.id === "layers").world).toBe("pumice");
    expect(S.SCANNABLE.energy).toBe("layers");
    expect(S.SCANNABLE.dish).toBe("satellite");
  });
});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Pictures for Chike's requests: add `energy`, `dish`, `ring` (dashed drill ring) to `PICS`.
- [ ] **Step 4:** Run the file's tests and the full suite. Expected: PASS.
- [ ] **Step 5:** Browser playthrough from the greenhouse test through the satellite test (use the console only to read state, never to skip steps). Close the tab.
- [ ] **Step 6:** Commit: "Remote Lunar Salvage: the satellite mission with the Drill".

### Task 8: Rocket, Launch, flight briefing and landing

**Files:**
- Modify: game (pure: `BOARD_STEPS`, `FLIGHT`, `BRIEFS`, `NOTES`; runtime: rocket mesh near the hub, `#ovFlight`, `#bLaunch`, camera, `frame`, `rmMsg`, keys)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Consumes: `MISSIONS`, `WORLDS`, `SAVE`, `writeSave` (Tasks 2, 3, 7).
- Produces:
  - `BOARD_STEPS`: `quiz` "Answer Chike's three questions." (drive) · `inRocket` "Drive up the ramp into the rocket." (drive) · `launched` "Press Launch!" (drive). The quiz step opens Task 9's quiz; it is done when the quiz closes, whatever the score.
  - `FLIGHT = { count: 3, lift: 4.0, space: 2.0, land: 4.5 }` seconds; `flightPhase(t) -> { phase: "count"|"lift"|"space"|"brief"|"land"|"done", k: 0..1 }` where "brief" holds until the briefing is finished (`t` stops advancing during "brief").
  - `BRIEFS` (pure): `{ glacia: { kid: "zech", name: "Zech", lines: [...] } }` with lines: "Hi! This is Zech, live from Earth." · "Great job powering the satellite. Now we can talk!" · "Your next stop is Glacia. It's snowing there, and the base heater is broken." · "Yuna lives at the base. She'll tell you what she needs." · "Landing on Glacia..."
  - `NOTES.rocket` (Pumice Moon) "Rockets push down to go up": "A rocket engine throws hot gas down very fast, and the gas pushes the rocket up. Every push has an equal push back the other way." Found by event at liftoff.
  - Runtime: `launchRocket()` is idempotent (a `G.launching` guard); keyboard `L`, `#bLaunch`, and phone `{ t:"launch" }` all call it. `#bLaunch` (big blue) and the phone's Launch show only while `inRocket` is true and not launching. `showBrief(id)` renders the approved Task 1 layout with `/assets/characters/<kid>.jpg`. After "Landing on Glacia...", Part 1 shows a "Glacia is coming in the next update" card with the world's stars and "Play Pumice Moon again"; `SAVE.reached` gains "glacia" and `writeSave()` runs.
  - `landRocket()` plays the landing (rocket descends with decelerating easing, ramp drops, rover drives out 4 m). Part 1 uses it at the start of a fresh Pumice Moon game (after Start), skippable by any input; it ends exactly where today's game starts.

- [ ] **Step 1: Write the failing tests**

```js
describe("the rocket", () => {
  it("counts down, lifts off, flies, waits for the briefing, lands", () => {
    expect(S.flightPhase(0).phase).toBe("count");
    expect(S.flightPhase(3.5).phase).toBe("lift");
    expect(S.flightPhase(7.5).phase).toBe("space");
    expect(S.flightPhase(9.5).phase).toBe("brief");
  });
  it("boards after the quiz", () => {
    expect(S.MISSIONS.board.steps.map(s => s.flag)).toEqual(["quiz", "inRocket", "launched"]);
  });
  it("Zech's briefing names Glacia and Yuna, and the kid's picture exists", () => {
    const b = S.BRIEFS.glacia;
    expect(b.lines.join(" ")).toContain("Glacia");
    expect(b.lines.join(" ")).toContain("Yuna");
    expect(existsSync(new URL("../assets/characters/" + b.kid + ".jpg", import.meta.url))).toBe(true);
  });
  it("launch can only start once", () => {
    expect(game).toMatch(/function launchRocket\(\)\{\s*if \(G\.launching\) return;/);
  });
});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Dispose nothing in Part 1 (the world stays loaded); leave a `// Part 2: dispose the old world and build the next` marker at the landing hand-off.
- [ ] **Step 4:** Run the file's tests and the full suite. Expected: PASS.
- [ ] **Step 5:** Browser check: Start shows the landing then today's start; after boarding, Launch from the keyboard and from a second tab running the phone remote; pressing both at once runs one flight; the briefing captions tap through; the end card shows. Close the tabs.
- [ ] **Step 6:** Commit game, remote and test: "Remote Lunar Salvage: rocket, Launch, flight briefing and landing".

### Task 9: The picture quiz by grade, with read-aloud

**Files:**
- Modify: game (pure: replace `QUIZ` with `QUIZ_BANKS`, add `QUIZ_PICS`; runtime: replace `quizAt`/end-card quiz with `#ovQuiz`; speaker buttons; stars)
- Test: `test/remoteLunarSalvage.test.js`

**Interfaces:**
- Consumes: `gradeBand`, `SAVE`, `writeSave`, `BOARD_STEPS.quiz` (Tasks 3, 8).
- Produces:
  - `QUIZ_BANKS.pumice = { g1: [3 questions], g23: [3], g45: [3] }`. Question shape: `{ q, pic, opts: [{ t, pic? }], a, why, circle: { x, y, r } }`. `g1` questions have exactly 2 options, each with a `pic`; `g23` and `g45` have 3 options. `pic` and option pics are keys of `QUIZ_PICS`; `circle` is in the question picture's 0-100 viewBox and marks the right part. Topics: what the magnet lifts; how things fall on Pumice Moon vs Earth; why triangles hold the bridge (g45 may use "about 6 times" and 1.62 vs 9.8).
  - `QUIZ_PICS` (pure): key → pen-style SVG string (viewBox `0 0 100 100`, notepad ink color).
  - `starsForWorld({ mission, notesFound, notesTotal, quizRight }) -> { mission, notes, quiz }` booleans; quiz star needs 3 right.
  - Runtime: `#ovQuiz` per the Task 1 draft; one try per question; wrong shows the picture with a red-pen circle at `circle` plus `why`, then moves on after Next; `speak(text)` uses `speechSynthesis` inside try/catch and is a no-op when missing; speaker buttons (`.say`) render only when `"speechSynthesis" in window`. For `g1`, the question is spoken when shown. A `.say` button also sits beside the corner kid's bubble for every grade. Results go to `SAVE.stars.pumice` and `writeSave()`. The pause menu gains "Take the quiz again" while on a world.

- [ ] **Step 1: Write the failing tests**

```js
describe("the picture quiz", () => {
  it("has three questions per grade band, each with a picture and the right number of answers", () => {
    const b = S.QUIZ_BANKS.pumice;
    for (const band of ["g1", "g23", "g45"]) {
      expect(b[band]).toHaveLength(3);
      for (const q of b[band]) {
        expect(S.QUIZ_PICS[q.pic]).toMatch(/^<svg/);
        expect(q.opts).toHaveLength(band === "g1" ? 2 : 3);
        expect(q.a).toBeLessThan(q.opts.length);
        expect(q.circle.r).toBeGreaterThan(0);
        if (band === "g1") for (const o of q.opts) expect(S.QUIZ_PICS[o.pic]).toMatch(/^<svg/);
      }
    }
  });
  it("the quiz star needs all three right", () => {
    expect(S.starsForWorld({ mission: true, notesFound: 9, notesTotal: 9, quizRight: 3 })).toEqual({ mission: true, notes: true, quiz: true });
    expect(S.starsForWorld({ mission: true, notesFound: 8, notesTotal: 9, quizRight: 2 })).toEqual({ mission: true, notes: false, quiz: false });
  });
  it("read-aloud never crashes when the voice is missing", () => {
    expect(game).toMatch(/function speak\(text\)\{\s*try \{/);
    expect(game).toContain('"speechSynthesis" in window');
  });
});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with the approved Task 1 layout. Remove the old `QUIZ` and its tests' references (update the old quiz tests to the new bank).
- [ ] **Step 4:** Run the file's tests and the full suite. Expected: PASS.
- [ ] **Step 5:** Browser check for grade 1, 3 and 5 at 1280x800 and 390x844: pictures render, the 1st-grade question is read aloud (or speaker buttons are absent if the frame has no voice; record which), a wrong answer shows the circle. Close the tabs.
- [ ] **Step 6:** Commit: "Remote Lunar Salvage: picture quiz by grade with read-aloud".

### Task 10: Whole-world playtest and wrap-up

**Files:**
- Modify: whatever the playtest finds; memory file `remote-lunar-salvage-game.md` (not in the repo)

- [ ] **Step 1:** Fresh save (in the new tab, clear only this game's own localStorage key, never `localStorage.clear()`): pick grade 2, play Pumice Moon start to finish (landing, repair, satellite, quiz, board, launch, briefing, end card) at 1280x800, then the same at 390x844 with the phone remote in a second tab driving. Note every snag; fix with a failing test first where the fix is in pure code.
- [ ] **Step 2:** Rover Contest still starts, plays and returns to the mission (`Back to the mission`).
- [ ] **Step 3:** `npx vitest run`. Expected: all PASS. Console: no errors.
- [ ] **Step 4:** Commit fixes. Update memory. Report to the owner and wait for "push" (push = `git push origin sound-space:main`, bump `CACHE_VERSION` in `sw.js`, re-upload `pg-remote-lunar-salvage` from the signed-in admin tab, merge `privateGameKb` and how-to-play lines).
