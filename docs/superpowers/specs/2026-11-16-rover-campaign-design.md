# Remote Lunar Salvage: the Rover Campaign (four made-up worlds)

Status: design, approved in conversation 2026-11-16, awaiting the owner's read of this document.
Game: `supabase/private-games/remote-lunar-salvage.html` (subscribers-only, DRAFT), phone remote `games/lunar-salvage-remote.html`, tests `test/remoteLunarSalvage.test.js`.
Drafts the owner approved: `docs/mockups/lunar-notes-draft.html` (handwritten notepad, Field Notes button).

## Intent

The owner wants more missions, and a reason to keep playing: the repair rover finishes one world, drives into a rocket, the kid presses **Launch**, and during the flight one of the kids from the show appears on the ship's screen with the next mission. The rocket lands on a new made-up world with its own look and its own tools. Four worlds in all.

Audience: grades 1 to 5 (about ages 6 to 11). Many 1st graders can't read yet. Some kids learn by seeing, so every quiz question has a picture.

The education twist stays: the worlds are made up, but their rules are real science, and Field Notes compare each world to Earth.

## Goals

- Four worlds, each with its own sky, ground, gravity, air (or none), tools and missions.
- Today's repair mission stays exactly as it is, as world 1's first mission.
- A rocket trip between worlds: load the rover, press Launch, see a briefing from one kid, land.
- New tools: Drill and Hose.
- Field Notes as a handwritten spiral notepad, with a noticeable notepad button always on screen.
- Scan gets a real job: it is how you fill the notepad.
- A grade picker (1 to 5) that picks which quiz questions you get; every question has a picture; 1st grade questions are read aloud.

## Non-goals

- No new 2-player content. The Rover Contest stays as it is, on world 1's map.
- No paywall (monetization is deferred).
- No voices in briefings. Videos are silent; the words are captions.
- Grade does not change the words during play (only the quiz).

## Anti-goals (would make this a failure even if it works)

- Teaching false science. Snow and fire happen only on worlds with air; Field Notes never claim something that isn't true on Earth or in real space.
- Buttons a kid can't use. The dashboard only shows the tools this world has.
- Bouncy motion. All motion decelerates and settles; banners never animate.
- Emojis anywhere. Foreign uniforms or settings in pictures. Glowing eyes in any video.
- Emailing subscribers about it. Pushing or publishing without the owner saying "push" / "publish".

## Constraints

- One HTML file, uploaded to `portal_game_files.pg-remote-lunar-salvage` and run in a sealed srcdoc iframe (`sandbox="allow-scripts allow-popups"`, opaque origin). Today 230 KB; the campaign may roughly double it. Only one world's scene is built at a time; the previous world's meshes and textures are disposed on launch.
- three.js r128 from cdnjs; colors through `fixColors`. Google Fonts load fine in private games (Kalam 700 + Patrick Hand for the notepad).
- Pure logic between `/* BEGIN pure */` and `/* END pure */`, tested with `new Function`. New rules (world data, mission steps, quiz banks, grade bands, drill/hose/heat math) go there.
- Saving: the site's `ccsSave` postMessage protocol (as in `hexago.html`): `parent.postMessage({ccsSave:"get"|"set", game, data}, "*")` with a localStorage try/catch fallback when opened on its own. Saved: grade, world reached, mission reached, notes found, stars.
- Static media (character pictures, briefing videos) live under `/assets/` on the public site and are referenced by absolute path; they load inside the srcdoc frame like `chike-pose-point.png` does today.
- Phone remote: Supabase Realtime channel `lunarsalvage-remote-<code>`. Rebuild phone buttons only on a mode change (the magnet bug rule).
- Each part ships as a draft update the owner tests; push and re-upload only on "push". Draft any new screen's layout as a mockup in `docs/mockups/` before changing the game.

## Approaches

1. **One engine, worlds as settings (chosen).** Rework today's game so a world is data: sky, ground, gravity, air, tools, places, missions (lists of Chike-style steps). Only special moments (hose spray, rocket landing, meteor strike) get their own code. First part is big; each later world is mostly data, and every world shares the dashboard, phone remote, notepad and quiz.
2. **Each world built separately** (four copies of today's game). Faster for world 2 only; fixes have to be made four times and the copies drift.
3. **Four separate games linked by the rocket.** Simplest code, but each launch reloads, grade/progress must be passed along, and the phone link and Contest break at every launch.

The owner did not pick; I went with my recommendation (1) and said so.

## The worlds

World names are my call; the owner can rename them. Gravity values are real-world comparisons so the notes can be honest.

| # | Name | Look | Gravity | Air | Tools | Kid in the corner (asks for things) | Briefing on the flight there |
|---|---|---|---|---|---|---|---|
| 1 | Pumice Moon | Grey dust, black starry sky, a blue planet in the sky (today's map, renamed) | 1.62 m/s² (same as Earth's Moon) | none | Arm, Magnet, Laser, then Drill | Chike (as today) | (the game's opening briefing, as today) |
| 2 | Glacia | Pale blue ice, falling snow, a pink-grey sky | 3.7 m/s² (like Mars) | thin, cold | Arm, Magnet, Laser | Yuna | Zech |
| 3 | Ember | Red rock, orange haze, a hot sun | 8.9 m/s² (like Venus, close to Earth) | yes, with oxygen | Arm, Magnet, Drill, Hose | Averi | Corey |
| 4 | Gusto Canyon | Tall striped canyon walls, blowing dust, two small suns | 5.0 m/s² | yes, windy | Arm, Magnet, Laser, Drill, Hose | Mateo and Stacey | Kiyah |

Home: after world 4, the last launch flies home to Earth; all four mission kids celebrate on the screen.

Name spellings on screen use the site's spellings (Yuna, Kiyah, Zech). Character pictures come from `assets/characters/<name>.jpg` (Kiyah's file is `kylah.jpg`).

## Missions

Each mission is an ordered list of steps like today's `STEPS` (`{ id, text, hint }`), shown by the kid in the corner with a picture of exactly what they want. The tool each step needs glows on the dashboard (today's `STEP_TOOL`).

**World 1, Pumice Moon**
1. Repair (today's 10 steps, unchanged).
2. Power the satellite: drill at the three marked spots, pick up the energy rocks the drill brings up, load them into the satellite's battery rack (3 slots), then press Test. The satellite dish turns and a message from Earth arrives: "Load the rover into the rocket."
3. Board the rocket: drive up the ramp into the rocket's cargo bay; press **Launch**.

**World 2, Glacia** (Zech's briefing: "It's snowing on Glacia and the base heater is broken.")
1. Warm the base: heat three metal heat blocks with the laser until they glow, then set each one in the heater rack inside the base with the claw. A thermometer on the base climbs; snow around the base melts as it warms.
2. Supply rocket: a small supply rocket lands near the base. Pull its hatch lever with the arm, lift out the package with the claw, put it in the cargo bed, bring it home to the base's drop pad.
3. Board the rocket and launch.

**World 3, Ember** (Corey's briefing: "A meteor is coming down near the base on Ember.")
1. The strike: a meteor streaks in and lands near the base; the dry plants next to the crater catch fire.
2. Find water: drill at the marked ice spot until the water tank gauge is full.
3. Put out the fire: switch to the Hose, aim, hold SPRAY. Each fire patch shrinks while sprayed. If the tank empties, drill again.
4. Clean up: lift the iron meteor pieces with the magnet into the salvage bin.
5. Board the rocket and launch.

**World 4, Gusto Canyon** (Kiyah's briefing: "A storm knocked over Mateo's landing beacon. No ship can find the base.")
1. Drill the hole for the beacon's footing.
2. Laser: cut the fallen girder free.
3. Arm: stand the tower pieces on the outline; the triangle brace comes back.
4. Hose: wash the red dust off the beacon's solar panel.
5. Power it with an energy rock (the rover brought spares from world 1; one sits in the cargo bed at landing).
6. The beacon lights; board the rocket for home.

## New tools

**Drill.** The rover parks over a marked spot (a pencil-dashed ring on the ground). Hold DRILL; a depth gauge on the dashboard fills while the drill bit spins and dust sprays. Layers show on the gauge (dust, rock, then ice or energy rock). At the bottom, the drill brings up what it found: an energy rock (a part to pick up, non-magnetic, claw only) or water (fills the rover's tank). Drilling off a marked spot finds only rock, and Chike/the corner kid says so.

**Hose.** Joystick aims the nozzle, hold SPRAY. Water arcs out (gravity bends the arc, more on high-gravity worlds), the tank gauge drains, fire patches in the stream shrink and go out. Empty tank: "Drill for more water."

**Laser heat (world 2).** Same laser; metal heat blocks glow from dull red to orange as they heat. A block cools slowly after the laser stops (metal holds heat), so kids learn to carry it while it's hot.

Dashboard and phone: a world shows only its tools as mode buttons (Drive plus up to 5). The phone remote gets matching modes (Drill: joystick + hold DRILL; Hose: joystick + hold SPRAY), a Notes button, and a Launch button when the rover is in the rocket.

## Rocket, launch and briefing

- Board: a rocket stands near each base with a ramp; a beam guides the rover to it. Driving into the cargo bay parks the rover and shows a big **Launch** button (keyboard: L; phone: Launch).
- Launch: countdown 3-2-1, the rocket rises (decelerating camera follow), the sky darkens to space.
- Flight screen: inside the ship, a screen shows the next mission's kid. First a still picture (`assets/characters/<name>.jpg`); later a silent looping video (`assets/games/lunar/brief-<name>.mp4`, about 5 seconds, muted, autoplay, loop, playsinline) once the owner approves the credits. Beside it, speech-bubble captions, one line at a time, tapped through (Next). Last caption names the world and the first mission. The flight screen needs a mockup before it is built.
- Landing: the rocket descends onto the new world, the ramp drops, the rover drives out, and the world's corner kid says hello with their first request.
- Between worlds the game saves progress.

## Field Notes notepad and Scan

As drafted in `docs/mockups/lunar-notes-draft.html`:
- The pop-up page and the full notepad are lined paper with spiral rings, Kalam titles, Patrick Hand text in blue ink, a pen doodle per note, chips as highlighter (yes), crossed out (no) and circled (warn); notes not found yet in grey pencil with a clue.
- The Field Notes button is a little notepad on the right below the top bar, always on screen, with "Field Notes, N of M" in pen; a new note slides into it, a red NEW tag stays until it is opened, a yellow ring pulses three times. Opening it pauses the game. N key and a phone Notes button open it.
- Notes are grouped by world in the notepad (a page heading per world). Notes from worlds not reached yet are not shown.
- Scan fills the notepad: anything with a note not yet found shows a small pencil "?" above it; when the rover is close enough, the Scan button lights up; scanning writes the page. Doing the thing (dropping, magnet-lifting) still writes notes too, as today.
- About 5 notes per world. World 1 keeps today's 9 notes, reworded where they say "the Moon" to "Pumice Moon, which pulls like Earth's Moon". New notes (my proposals): Glacia: metal holds heat, snow melts when warmed, heat flows from hot to cold, thin air is cold, rockets push gas down to go up. Ember: fire needs fuel, heat and oxygen; meteors burn up in air; water cools a fire; iron meteorites; heavier gravity bends water arcs more. Gusto: wind is moving air, solar panels need light (dust blocks it), triangles in towers, drilling finds layers, beacons send radio.

## Grade picker and quiz

- First screen asks "What grade are you in?" with buttons 1 2 3 4 5; saved; changeable from the pause menu.
- Bands: 1st grade; 2nd-3rd; 4th-5th. One bank of 3 questions per world per band (12 banks, 36 questions).
  - 1st: 2 picture answers, question read aloud with the device's voice (speechSynthesis) and a speaker button to replay it.
  - 2nd-3rd: 3 short word answers.
  - 4th-5th: 3 answers, may use simple numbers.
- Every question has a picture drawn in the notepad's pen style (inline SVG). A wrong answer shows the picture again with the right part circled, then the explanation.
- A speaker button next to the corner kid's bubble reads any line aloud, for every grade.
- The quiz comes at the end of each world, before boarding the rocket. Stars per world: mission done, all of that world's notes, quiz all right.

## Videos (later, needs the owner's OK)

Silent, about 5 seconds, looping, of each briefing kid talking (Zech, Corey, Kiyah, and Chike for the welcome home). Made in Higgsfield from the series character sheets and episode clips per the series rules (no glowing eyes; match the animated series). About 7 credits per second at 720p: about 140 credits for the four. The residents stay as pictures unless the owner asks. Nothing is spent without asking.

## Build order (each part ships as a draft for testing)

1. Engine + world 1: worlds as data, Pumice Moon look and name, Drill, satellite mission, rocket boarding/launch/flight/landing, briefing screen with stills, grade picker and picture quiz for world 1, notepad, Field Notes button, Scan-fills-notepad, saving. Mockups first: flight/briefing screen, grade picker, picture quiz.
2. Glacia.
3. Ember (Hose).
4. Gusto Canyon and the flight home.
5. Videos, when approved.

## Calls made after the builder review (mine; the owner can change any)

- **Rover Contest:** a separate mode started from the same start screen. It uses world 1's look, never reads or writes campaign saves, and doesn't depend on campaign progress. The engine treats it as a fixed mode on world 1's data.
- **No failing, only retrying:** all three drill spots on world 1 give an energy rock (no decoys). Nothing can be lost for good. Anything dropped off the map or broken (glass, a cooled heat block) comes back at its starting spot, and Chike or the corner kid says so. An empty water tank is refilled by drilling again.
- **Scan:** the range is the same as today's (7 m from the rover's nose in Drive, 4.5 m from the claw in the tool modes). A note is found either by scanning a prop or by an event. Notes with nothing to scan (thin air is cold, wind is moving air) are found by an event, such as the first time snow lands on the rover or a gust pushes it. The "?" marker appears only over props whose note can be scanned.
- **Quiz:** it never blocks the rocket. Each question gets one try; a wrong answer shows the circled picture and the explanation, then the quiz moves on. The quiz star needs all three right. The quiz can be retaken from the pause menu while on that world.
- **Saving and replay:** the campaign moves forward, and the start screen shows the worlds reached so far as a row of planets. Tapping one replays it from its first mission. Notes and stars are kept across replays. Progress isn't tied to grade; changing the grade only changes the questions.
- **Assets:** pictures for all eight kids already exist in `assets/characters/` (Kiyah's is `kylah.jpg`). Rockets, ramps, the beacon, the satellite and the ship interior are built in three.js from simple shapes and canvas textures, like today's rover. I write the 36 questions and the pen pictures, and the owner reviews the science.
- **Performance:** target mid-range phones, iPads and school Chromebooks. Particle budgets per world (snow, dust, fire, spray) with a lower setting chosen automatically when the frame rate drops, and shadows as today.
- **Read-aloud:** test `speechSynthesis` inside the sealed frame first thing in part 1. If it isn't available, the speaker buttons hide and 1st-grade questions rely on their picture answers. Recorded audio is not planned.

## Left to the builder

- Exact map layouts, part positions, and step hint wording, as long as each step names its tool and has a picture.
- How the world data is structured, as long as one engine runs all four worlds.
- Exact quiz wording within each band's rules; science must be correct.
- Doodle drawings and quiz pictures (pen-style SVG).
- Performance tuning for older phones (shadow quality, particle counts).
