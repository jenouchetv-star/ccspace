# Solar System Sandbox redesign

Approved by the owner on 2026-11-14 ("yes, build it into the game") after the layout draft
(docs/mockups/solar-sandbox-draft.html) and the working preview (docs/mockups/solar-preview.html).

## Why
The old game (games/spacetime-sandbox-simulator.html) was hard to use for kids aged 8-11:
- a jargon-heavy manual on every load;
- a big "Engine Console" mixing settings, modes and navigation;
- m/s² and km/s facts;
- a separate "Warp Orbits" mode;
- clicking a planet in space threw an error for everyone.

The owner wants it intuitive, with planets that look real, a white glowing Sun, a gravity visualizer, and a few mild purple, blue, red and teal tones in the sky so it pops for children.

## What it is
One full-screen 3D scene with four places for things:
1. **Top bar:**
   - title;
   - Pause/Play;
   - Speed − / +, from 0.25x to 8x;
   - View menu, holding the Gravity grid, Orbit lines and Planet names switches;
   - Start over;
   - Sound (the shared CCSSound button);
   - Help (?).
2. **Planet dock** along the bottom: Sun, Mercury … Neptune.
3. **One planet card** on the right, a bottom sheet on phones:
   - name, kind and order from the Sun;
   - 4 facts (one year, moons, size vs Earth, distance in miles);
   - one sentence;
   - "a 60 lb kid would weigh N lb here";
   - **Move <planet>** and **See inside** buttons.
4. **Space:**
   - real NASA surface maps (assets/games/solar-system/, public domain, SOURCES.md);
   - the Sun drawn as a white-hot glowing ball;
   - Venus clouds, Uranus and Saturn's rings drawn in code;
   - Milky Way, sharp stars and soft nebula tones;
   - a stretchy gravity grid that dips under the Sun and each planet, with planets riding in their dips;
   - asteroid and Kuiper belts.

## Behaviour
- **Orbits:** planets orbit counter-clockwise seen from above (north), as in reality, and spin the right way. The Moon orbits Earth.
- **Picking a planet:** tap it in the dock or in space (a drag doesn't count as a tap). The camera flies in from the Sun's side so the day side shows, then rides along with the planet. You can still drag to look around. × or Esc flies back out.
- **Move:**
  - A banner says "Drag <planet> closer to the Sun or farther away, then let go", with a Done button.
  - Dragging sets the orbit radius, kept between neighbours' safe limits.
  - The period follows Kepler's third law: period ∝ radius^1.5.
  - The card shows the new year length and distance, with "was …".
  - Start over restores everything.
- **See inside:** the planet becomes a cutaway (a quarter removed) showing its layers. The card lists the layers in kid words.
- **First visit:** a 3-step help card, remembered on this device. The ? button reopens it.
- **Controller:**
  - LB/RB or d-pad left/right: previous/next body.
  - Left stick: turn the view. Right stick: turn the view too. LT/RT: zoom.
  - A: Move, or Done while moving. In move mode the left stick up/down moves the planet farther/closer.
  - Y: See inside.
  - B: back/close.
  - X: gravity grid.
  - Start: pause. Back: help.
- **Keyboard:**
  - ←/→: previous/next body.
  - Space: pause.
  - Esc: back.
  - M: move, I: inside, G: grid, +/−: speed.
  - In move mode, ↑/↓ move the planet.

## Non-goals
- True-to-scale sizes and distances (planets would be invisible). The sizes toggle is dropped.
- MathJax and Tailwind are dropped (no longer needed).

## Constraints
- The file stays at games/spacetime-sandbox-simulator.html (the DB row and links point at it).
- The game image is unchanged.
- It still loads games/game-sound.js.
- It stays the accepted exception to game-skin.css.
- No emojis.
- Motion decelerates and never bounces.
- The Play-page rules text and the vocab example still name "Warp Orbits"/"Slice Inside View". Update them in the same push.
