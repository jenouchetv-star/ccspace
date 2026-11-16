# Rover Campaign, Part 4 (Gusto Canyon and the flight home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps are worked test-first.

**Goal:** Gusto Canyon, a windy world with two small suns and striped canyon walls. A storm knocked over Mateo and Stacey's landing beacon. The rover rebuilds it with every tool, then flies home to Earth, where all four mission kids celebrate and a final card sums up all four worlds.

**Architecture:** This works the same as parts 2 and 3:
- `BUILD_WORLD.gusto` builds its own scene and lists, and the mission is data (`MISSIONS.beacon`).
- Laser boulders move from Pumice Moon's `scene` to `activeScene`, so any world can have them.
- The Hose gets a raised target (the beacon's solar panel) next to Ember's fires.
- Wind is a pure, timed gust (`gustAt(t)`) that nudges the rover sideways while it drives and blows the dust.

**Spec:** `docs/superpowers/specs/2026-11-16-rover-campaign-design.md`. The relevant sections are the World 4 row, the Gusto Canyon mission, "Home", and the Gusto Canyon drill layers (dust, rock, metal).

## Global Constraints

- Same rules as parts 1 to 3:
  - commit with explicit file lists;
  - no emails;
  - push or upload only when asked;
  - restore the owner's save after tests and use new tabs only;
  - no emojis, decelerating motion, true science.
- Gusto Canyon values:
  - gravity 5.0 m/s², about half of Earth's 9.81;
  - windy air;
  - tools drive, arm, magnet, laser, drill and hose;
  - layers dust, rock, metal;
  - corner kid Mateo (with Stacey named in his lines).
- The home flight and the final card are new screens. The drafts are `docs/mockups/lunar-home-flight-draft.png` and `docs/mockups/lunar-home-end-draft.png`. Build them only after the owner's OK, and drop the three big stars from the final card (the per-world rows carry the stars).

## Mission: `beacon`

| Step | Flag | Tool | What happens |
|---|---|---|---|
| 1 | footing | drill | Drill the dashed ring at the beacon site. It reaches the metal layer, and the footing hole is ready. |
| 2 | freed | laser | Crack the boulder that pinned the fallen beacon mast. |
| 3 | mast | arm | Carry the mast (aluminum, claw only) to the footing. It stands up. |
| 4 | brace | arm | Set the triangle brace on the mast. |
| 5 | clean | hose | Wash the red dust off the beacon's solar panel. The tank starts full; the base's water tank refills it when the rover parks beside it. |
| 6 | power | arm | Load the spare energy rock from the cargo bed into the beacon's battery box. The beacon lights. |

After the beacon lights: board the rocket, take Mateo's quiz, launch, the flight home (four kids), then the final card.

## Notes (5, all true)

| Note | How it's found |
|---|---|
| windAir: wind is moving air | the first gust |
| dustSolar: solar panels need light, and dust blocks it | the panel is cleaned |
| beaconRadio: a beacon sends radio waves, which travel at the speed of light | the beacon lights |
| twoSuns: some real planets circle two suns (Kepler-16b, found in 2011) | event after landing |
| gustoPull: 5.0 m/s², about half of Earth's pull | the first boulder chunks fall |

## Review Focus

1. A gust never pushes the rover into a wall, rock or the canyon rim (the nudge uses the same collision check as driving).
2. An empty tank at the panel: Mateo points the rover to the base's water tank.
3. Start over mid-mission resets the mast, brace, panel dust, energy rock, boulder and footing.
4. Boulders still work on Pumice Moon after the move to `activeScene`.
5. The phone remote on Gusto shows Laser, Drill and Hose together.
