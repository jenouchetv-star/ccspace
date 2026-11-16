# Rover Campaign, Part 3 (Ember) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps are worked test-first.

**Goal:** Ember, a red world with air, where Averi needs the rover to put out a meteor fire with the new Hose using water drilled from an ice pocket, then clear the iron meteorite pieces, before Kiyah briefs the flight to Gusto Canyon.

**Architecture:** Same as part 2: `BUILD_WORLD.ember` builds its own scene and lists; the mission is data (`MISSIONS.meteor`); the Hose is a new mode beside the Laser; the water spray is a particle pool shot with Ember's gravity.

**Spec:** `docs/superpowers/specs/2026-11-16-rover-campaign-design.md` (Ember row, World 3, New tools → Hose, Drill layers). The owner's decision of 2026-11-16: drilling off the ring reaches lava ("too hot"); the marked ring sits on an ice pocket.

## Global Constraints

- These are the same as parts 1 and 2: commit lists, no emails, push/upload only on request, restore the owner's save after tests, new tabs only, no emojis, decelerating motion, true science.
- Ember's values:
  - gravity 8.87 m/s², like Venus;
  - air with oxygen;
  - tools drive, arm, magnet, drill, hose;
  - layers dust, rock, lava;
  - corner kid Averi (`averi.jpg`);
  - the briefing to Gusto Canyon is Kiyah (`kylah.jpg`).

## Review Focus

1. Spraying with an empty tank: nothing comes out, and the hint says to drill the ice ring again.
2. Drilling off the ring: the gauge shows lava and Averi says it's too hot; nothing breaks.
3. The phone remote on Ember: the Hose shows with its joystick and SPRAY; the Laser and Drill buttons follow the world's tools.
4. Start over while fires burn: the fires, tank, meteorites and bin all reset.
5. Contest, Pumice and Glacia replay still work after visiting Ember.

## Tasks

1. **Pure:**
   - `HOSE = { speed: 9, drain: 0.12, douse: 0.9, reach: 1.3 }`;
   - `hoseArc(d, v, g)`: the pitch that lands a jet d metres away, or null when out of reach (0.5 × asin(g·d/v²));
   - `waterStep(level, spraying, dt)`;
   - `MISSIONS.meteor` with the steps water, fire, clean1 and clean3 (tools drill, hose, magnet, magnet);
   - `TARGET_ACCEPTS.ebin = ["meteor"]`; `SCANNABLE.meteor = "ironMeteor"`;
   - notes: fireTriangle, waterCools, meteorAir, ironMeteor, venusPull;
   - `QUIZ_BANKS.ember`; `BRIEFS.gusto`; the Hose in the phone remote.
2. **The Ember scene:**
   - red rock ground, orange haze, warm sun;
   - Averi's base with dry scrub around it;
   - a salvage bin and the ice ring;
   - the meteor strike (a streak, a flash, a crater, fires lit, three iron pieces).
3. **The Hose:**
   - mode, dashboard (joystick, tank gauge, SPRAY) and camera;
   - a water particle pool with arcs under G.g;
   - fire patches with health, smoke when out;
   - Aim picks the nearest fire and solves the arc.
4. **The mission flow:**
   - drilling for water fills the tank, and off the ring gives "too hot";
   - fires out, then the magnet lifts meteorites into the bin;
   - board, Kiyah's briefing, Gusto coming soon.
5. **Playtest, review, push.**
