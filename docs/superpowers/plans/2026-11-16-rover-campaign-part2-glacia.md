# Rover Campaign, Part 2 (Glacia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The rocket from Pumice Moon lands on Glacia, an ice world where Yuna asks the rover to warm the base by heating metal blocks with the laser, then to bring in a package from a supply rocket, before Corey briefs the flight to Ember.

**Architecture:** Each world gets its own `THREE.Scene`. Shared things are moved into the active scene when the world changes: the rover, the rocket, the guide beam, dust, scan marks and the laser. Per-world lists (colliders, surfaces, parts, boulders, drill rings) are swapped by `enterWorld(id)`. The ground height comes from a pure `TERRAIN` switch, so Glacia has no trench. Missions stay data (`MISSIONS.heat`, `MISSIONS.supply`, then `board`), as in part 1.

**Tech Stack:** three.js r128 in one HTML file, vitest on the pure block.

**Spec:** `docs/superpowers/specs/2026-11-16-rover-campaign-design.md` (Glacia row, Missions → World 2, Laser heat, Drill layers). Part 1 plan: `docs/superpowers/plans/2026-11-16-rover-campaign-part1.md`.

## Global Constraints

These carry over from part 1:
- Run the game tests with `npx vitest run test/remoteLunarSalvage.test.js`. Run the full suite with `npx vitest run --exclude ".worktrees/**"`.
- Commit with explicit file lists.
- Never `localStorage.clear()`. When a test is done, restore the owner's save in the shared localStorage.
- Use new tabs and close them after.
- No emojis. Motion decelerates. Science must be true.
- Push and re-upload only because the owner asked. Never email.
- Glacia's values:
  - gravity 3.71 m/s², like Mars;
  - thin, cold air with falling snow;
  - tools drive, arm, magnet, laser;
  - layers ice, rock, water;
  - corner kid Yuna (`/assets/characters/yuna.jpg`);
  - the briefing on the way to Ember is Corey (`corey.jpg`).

## Review Focus

1. Switching worlds twice (Pumice → Glacia → replay Pumice from the start screen): no stray Pumice objects show on Glacia, and none of Glacia's on Pumice. Colliders belong to the right world.
2. A heat block cools while the kid is still carrying it: the rack refuses a cold block and says why. The block can be heated again.
3. The Rover Contest after visiting Glacia still runs on its own field.
4. A save that already has `glacia` reached: the start screen can start straight on Glacia. A save without it can't.
5. The phone remote on Glacia shows no Drill, and the Laser works there without any boulders.

---

### Task 1: Worlds as scenes

- **Pure:**
  - `let TERRAIN = "pumice"; function setTerrain(id)`;
  - `groundHeight` uses `glaciaHeight(x, z)` when `TERRAIN === "glacia"`: gentle drifts and the same rim walls, no trench;
  - `canDriveTo` checks the trench only on Pumice.
- **Runtime:**
  - `SCENES = { pumice: scene }` and `activeScene`;
  - `WORLD_LISTS[id] = { colliders, surfaces, binWalls, parts, boulders, drillSpots }`;
  - `enterWorld(id)` swaps the lists, sets `G.world`, `G.g` and `TERRAIN`, moves the shared objects, sets the corner kid's face and builds the world if needed. Rendering uses `activeScene`.
- **Start screen:** a reached world's planet is a button. Tapping it chooses where Start begins, and the selected planet gets a ring. Worlds that aren't built yet stay "Coming soon".
- **Corner card:** the photo faces (yuna.jpg) fill the circle.
- **Tests:**
  - glacia ground has no trench at `TRENCH.z`;
  - `canDriveTo` lets the rover cross z = −10 on Glacia;
  - the WORLDS entry for glacia has `missions: ["heat", "supply", "board"]`.

### Task 2: The Glacia scene

- **Look:**
  - pale blue snow ground (canvas texture with sparkle and wind ripples);
  - a pink-grey sky gradient with a pale sun;
  - light fog;
  - falling snow (about 700 points that drift and wrap around the camera);
  - cool light.
- **Places** (`GPLACES`):
  - start (0, 12) and the rocket pad (−10, 12), as on Pumice;
  - the base dome (6, 24) with the heater rack in front of its door (6, 18.6);
  - the supply pad (14, 4);
  - the drop pad (2, 18.6);
  - ice boulders and snow banks scattered, kept off the paths;
  - signs ("BASE HEATER", "DROP PAD").
- **Colliders** for each solid thing.

### Task 3: The heat mission

- **Pure:**
  - `HEAT = { secs: 2.4, cool: 0.035, hot: 0.5 }`;
  - `heatStep(h, heating, dt)`: rises while heating, cools otherwise, clamped 0–1;
  - `PART_TYPES.heat = { name: "Heat block", mat: "steel", kg: 15, note: "heatStore" }`;
  - `TARGET_ACCEPTS.heater = ["heat"]`;
  - `heaterTakes(h)` is true when `h >= HEAT.hot`.
- **Steps** (`MISSIONS.heat`):

  | Flag | Step | Tool |
  |---|---|---|
  | heat1 | "Heat a metal block with the Laser until it glows." | laser |
  | rack1 | "Put the hot block in the base's heater rack." | magnet |
  | rack3 | "Heat two more and fill the rack." | laser |
  | warm | "Switch on the heater!" (Test button) | drive |

- **How it plays:**
  - The laser heats a heat block it hits (ray-sphere on the parts), as well as boulders.
  - Blocks glow from dark red through orange to yellow-white, and cool on their own.
  - The rack refuses a cold block with a radio line ("It cooled down. Heat it again with the laser.").
  - Switching the heater on warms the base: lights turn warm, the thermometer sign fills, snow stops falling near the base, and a melt ring spreads.
- **Notes** (world glacia, each with a doodle):
  - **marsPull:** a drop on Glacia; things fall faster than on Pumice Moon and slower than on Earth.
  - **heatStore:** scanning or heating a block; metal holds heat.
  - **heatFlow:** a hot block that has cooled; heat moves from hot to cold.
  - **melt:** the heater coming on; snow melts when it's warmed.
  - **thinAir:** the landing; thin air can't hold much heat, so Glacia is cold.

### Task 4: The supply rocket

- A small supply rocket lands on its pad: it comes down with its flame, fully scripted, and Yuna says it's here. Its hatch has a handle.
- **Steps** (`MISSIONS.supply`):

  | Flag | Step | Tool |
  |---|---|---|
  | hatch | "Open the supply rocket's hatch." | arm |
  | pkg | "Lift the package out." | arm |
  | home | "Bring the package to the base." | drive |
  | drop | "Set the package on the drop pad." | arm |

- **How it plays:**
  - Aim at the handle, then GRAB: the hatch swings open.
  - `PART_TYPES.package = { name: "Supply package", mat: "plastic", kg: 18 }` (claw only). It goes in the cargo bed and onto `TARGET_ACCEPTS.drop = ["package"]`.
  - The beam and Aim lead each step.

### Task 5: Arriving, leaving, and the questions

- **Arriving:** after Zech's briefing, the flight lands on Glacia: `enterWorld("glacia")`, then the rocket's landing on Glacia's pad, then Yuna's hello. `SAVE.reached` gets glacia.
- **Leaving:** Glacia's board mission is quiz → ramp → Launch. Corey's `BRIEFS.ember` names Ember and Averi. Then a "coming soon" card for Ember. The board goal text names the next world.
- **Quiz:** `QUIZ_BANKS.glacia` has g1, g23 and g45 (3 each) with pen pictures: metal holds heat; snow melts when warmed; Mars-like gravity compared with Pumice Moon and Earth.
- **Stars:** they're kept per world (`showWorldDone(world)` generalizes part 1's card).

### Task 6: Playtest, review, push

- Play the whole Glacia run at desktop and phone sizes, with the phone remote.
- Replay Pumice from the start screen.
- Run a Contest.
- Run the full suite.
- Do one fresh review.
- Push, bump the cache, re-upload `pg-remote-lunar-salvage`, and update the howToPlay text.
