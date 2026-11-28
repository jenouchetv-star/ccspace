# Tech Space: handoff for review

Date: 2026-11-28. Status: designed and drafted, **not built**. Nothing about Tech Space is live on the site.

This document collects what has been decided about Tech Space so a reviewer can check it for accuracy: the product,
the technology, the hardware claims and the safety content. Items marked **Check** are the ones most worth a second
pair of eyes.

Sources: the owner's PRD v1.1 (Tech_Space_PRD.md), the design document
(docs/superpowers/specs/2026-11-28-tech-space-design.md) and the owner's decisions on 2026-11-28.

---

## 1. What Tech Space is

The fourth app in Creative Space Studio, beside Art Space, Sound Space and the Book/Card Maker. A 3D workshop where
children in kindergarten to 5th grade:

1. **Play**: open a ready-made gadget and see it work in under a minute.
2. **Peek inside**: tap any part to hear and read what it does, at their level.
3. **Make your own**: rebuild the gadget step by step (place, wire, code, test), or invent their own from a toolbox.
4. **Go real**: a grown-up page with everything needed to build it with real parts.

The goal is a child who has fun and then wants to build something real. The owner wants the site to lean further
toward technology, and this app is a direct step.

## 2. How many things can a child build?

**26 named gadgets in the catalog, plus unlimited projects of their own.**

| Tier | Board | Grades | Gadgets | Count |
|---|---|---|---|---|
| 1. Starter | Pico-class | All (K-5) | Blinking Light, Traffic Light, Doorbell, Reaction Game | 4 |
| 2. Builder | Pico-class | 2nd-5th | Robot Car; line-following robot, dancing robot, robot arm; MP3 player; sound machine; alarm; weather station; Simon memory game, Pong on a small screen, LED catch game; night light, plant-watering reminder, smart doorbell, mood lamp, pet-feeder timer | 16 |
| 3. Advanced | Full Pi-class, with a grown-up | 4th-5th | Camera; photo booth, spy camera, wildlife camera; games with graphics; smart-home dashboard | 6 |

Beyond the catalog, **Make your own** has a toolbox of parts that children combine freely: lights, buttons, a dial,
a buzzer, a small screen (128 by 64 pixels) and a word screen, motors, a servo, wheels, a distance sensor, a light
sensor, batteries, a motor driver, resistors and wires. What a child can invent is open-ended. It is limited only by
the parts in the toolbox and what the simulator can run.

**Check:** the count depends on how the catalog is read. For example, "photo booth / spy cam / wildlife cam" counts as
3 here, and "Camera" as its own 1.

## 3. What ships first

The PRD's first release (v1) fully builds **3 gadgets**: Blinking Light, Traffic Light and Reaction Game. The other 23
appear in the library as "Coming soon" cards, and each is added later as content (data files), not new code.

Roadmap (PRD):

| Phase | Scope |
|---|---|
| 0. Foundations | Data format, 3D board, simulator core, look matched to Art Space and Sound Space |
| 1. First gadget | Blinking Light end to end |
| 2. MVP | Traffic Light, Reaction Game, rewards, voice, grown-up page |
| 3. Pilot | Testing with K-1 and 4-5 groups |
| 4. Tier 2 | Doorbell, Robot Car and the other Builder gadgets, challenge cards |
| 5. Tier 3 | Camera gadgets, graphics games, smart-home dashboard |
| 6. Growth | Teacher tools, printable 3D companion model, optional real-hardware link |

**Check:** the PRD lists Doorbell as a Tier 1 Starter gadget but schedules it in phase 4 with Tier 2. Confirm which one
is meant.

## 4. Who it is for

| Band | Grades | Reading | Code |
|---|---|---|---|
| Explorers | K-1 | Voice and icons | None: they tap a picture to choose a behavior ("blink fast") |
| Builders | 2nd-3rd | Short sentences, read aloud | Picture blocks (Light on, Wait, Repeat forever, When button pressed, Beep) |
| Inventors | 4th-5th | Full text and a glossary | Labeled blocks with a live MicroPython preview |

The band starts from the picked child's grade and can be switched at any time. Typing is never required in K-3, and
touch targets are at least 56 pixels.

Grown-ups get the Go real page (behind the site's tap-to-answer grown-up check) and the child's results in the
existing progress report.

## 5. Decisions made by the owner

- **Inside the free family account**, like Art Space and Sound Space. This replaces the PRD's "local saves, no account".
- **Saves are per child** (2026-11-28). Each child has their own space; the family shares one storage limit. This
  is now live in Art Space and Sound Space and is the pattern for Tech Space and every future Studio app: a "who's
  making" chip, the child's own shelf, a Family shelf for older or grown-up work with "Move to", and a family space
  bar split by child.
- **Built as one app page with Three.js** (approach A), like the siblings, not the PRD's React stack.
- **Technical but kid-friendly look.** Inspired by Tinkercad Circuits: a real breadboard, a real-looking board and
  real parts. The technical tools (pin labels, Python, specs) are for Inventors only; younger bands see big buttons and
  one step at a time.
- **Parts look familiar but are never branded.** No logos and no brand colors (for example, AA batteries are a plain
  silver body with a black "+ AA" band, not any brand's colors).
- **The Pi brand name is never used** in the app's name, copy or pictures. The app says "Pi-style board",
  "Pico-class board" and "full Pi-class board".
- **Go real stays out of the release until it is tested** (2026-11-28). The page is drafted, but no family sees it
  until each plan has been built and checked on a real board.

## 6. The screens drafted so far (mockups, not built)

- docs/mockups/tech-space-draft-2.html: the technical workspace (breadboard, Pico-class board with its real pin
  layout, resistor, LED, jumper wires, blocks beside MicroPython), and the simpler kid view.
- docs/mockups/tech-space-draft-3.html: the Robot Car driving with its distance reading, the Reaction Game with
  best times, and the Toolbox with a working small screen ("Hello, Maya! / Score: 12").
- docs/mockups/tech-space-goreal-draft.html: the Go real flow (finish card, grown-up check, grown-up build page for
  the Traffic Light).

## 7. Go real (drafted; held until tested)

After a child finishes a gadget, "Go real (build it with a grown-up)" opens the grown-up check, then a page with:

- time, board, power and estimated cost (Traffic Light: 30 to 45 minutes, Pico-class board, USB from a computer,
  $15 to $25);
- the safety rules;
- the parts list on cards (Traffic Light: 1 board, 1 full-size breadboard, 1 USB data cable, 1 red, 1 yellow and
  1 green 5 mm LED, 3 resistors of 220 ohms, 7 jumper wires);
- a wiring diagram and a step checklist, hole by hole;
- the MicroPython code, with how to put it on the board;
- what to do if a light doesn't come on.

No shop links; prices are estimates only.

### Traffic Light wiring, as drafted (**Check** on a real board)

- The board straddles the breadboard's middle gap, USB to the left, pins in rows c and h, columns 1 to 20.
- Board pin 20 = GP15, pin 19 = GP14, pin 18 = GND, pin 17 = GP13.
- Ground: j18 to the blue minus rail.
- Red: wire j20 to j23; resistor g23 to g26; LED long leg h26, short leg h27; i27 to the minus rail.
- Yellow: wire j19 to j29; resistor g29 to g32; LED long leg h32, short leg h33; i33 to the minus rail.
- Green: wire j17 to j35; resistor g35 to g38; LED long leg h38, short leg h39; i39 to the minus rail.

This needs a full-size breadboard (about 60 columns); a half-size one (30 columns) is too short for this layout.

```python
from machine import Pin
import time

red = Pin(15, Pin.OUT)
yellow = Pin(14, Pin.OUT)
green = Pin(13, Pin.OUT)

while True:
    red.on(); time.sleep(3); red.off()
    green.on(); time.sleep(3); green.off()
    yellow.on(); time.sleep(1); yellow.off()
```

Loading it: install a free MicroPython editor such as Thonny; the first time, hold the board's BOOTSEL button while
plugging in the USB cable and let the editor install MicroPython; save the code to the board as main.py so it runs on
its own.

**Check:**
- the pin numbers against the board's pinout;
- the hole positions and the order (red, green, yellow, as in the U.S.);
- 220 ohms with 3.3 V output;
- the cost range;
- the time estimate;
- that "BOOTSEL" and Thonny are named correctly and may be named at all.

## 8. Safety rules on every Go real page

- Every LED gets a resistor.
- Never wire a motor straight to a pin; use a motor driver board.
- Low voltage only: power from USB or a small battery pack, never a wall outlet.
- Unplug before moving wires.
- Small parts away from young children and pets.
- K-2 real builds need a grown-up the whole time.
- Tier 3 projects need a full Pi-class board and a grown-up.

**Check:** whether anything is missing, for example batteries getting hot, motor batteries kept separate from the
board's power, or button cells around small children.

## 9. Hardware claims to verify

- Tier 1 and Tier 2 run on a Pico-class microcontroller.
- Camera work and graphics-heavy games need a full Pi-class single-board computer; a Pico-class board can't do real
  image processing.
- The smart-home dashboard needs Wi-Fi: a Pico-class board with Wi-Fi, or a full Pi-class board.
- The Robot Car (as drafted) uses 2 DC gear motors, a motor driver board, a distance sensor and a 4 x AA pack.
  **Check** that the 4 x AA pack (about 6 V) suits the motors and the driver, and that the sensor runs at the board's
  3.3 V logic or needs a level shifter.
- The small screen is a 128 x 64 display on 4 wires (power, ground, two data lines).

## 10. How it connects to the site

- Opens from the Studio page in its own full window, like Art Space and Sound Space; "Coming soon" until the owner
  launches it; admins can open it early.
- Saves per child to the family account (a new save function and table copied from Sound Space's), with locks so
  a build is open in one place at a time.
- The progress report: short questions after Peek inside and after testing. Code, inputs, outputs and timing count
  toward Technology; building, wiring and power count toward Engineering.
- Voice: the site's recorded voice (Kokoro af_heart) at 80%, with a toggle.
- Rewards: a sticker per gadget, part trading cards, a My gadgets shelf, and a printable certificate with the
  child's first name.

## 11. Not in the first release

- Real-hardware connection.
- Shop links.
- Social sharing or chat.
- Teacher classroom codes.
- The 3D-printable companion model.
- Tier 2 and Tier 3 gadgets fully built.

## 12. Open questions

1. **Who tests each Go real plan on a real board before launch?** Go real stays hidden until this is done.
2. Doorbell: Tier 1 or phase 4 (see section 3)?
3. Pricing after the beta (the Studio is free during the beta; pricing is deferred).
4. Final sign-off of the drafted look (draft 3 and the Go real draft) before building starts.
