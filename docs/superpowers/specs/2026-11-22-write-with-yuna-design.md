# Write with Yuna: design (owner-approved mockup, 2026-11-22)

The look and wording are docs/mockups/writing-game-draft.html (approved: "build it"). This file records the decisions.

## What it is
A handwriting game. A child learns to write letters, then their name, words, sentences and cursive, the way teachers
show it: **Watch** (Yuna draws it, stroke by stroke, with numbered starts and orange direction arrows), **Trace** (a
dotted guide with the arrows and numbers), then **On your own** (only the writing lines and the green start dot; the
model shows over the child's writing afterwards to compare). Stars (0-3) come from starting at the right place, going
the right way, following the stroke order, and staying on the lines. Yuna (not Chike) is the guide: her poses are
assets/characters/yuna-pose-{wave,point,pencil,thumbs-up,cheer}.png.

## Grades (picker K to 5th, starts at the picked child's grade via CCS_GRADE, changeable from the top bar)
| Grade | Writes |
|---|---|
| K | Uppercase and lowercase letters, A to Z, each pair together (B then b). Yuna says the letter's name and sound ("B says /b/, like ball"). |
| 1st | Their full name (first and last), then words: sight words (the, and, see, said, ...) and short sound-out words (cat, ship, frog, ...). |
| 2nd | Words with neat spacing, then short sentences with a capital and a period. |
| 3rd | Cursive lowercase letters, one family at a time (c a d g o q; i t u w; ...), then cursive capitals. |
| 4th-5th | Cursive words, then their own name and a sentence. |

The full name: the first name may be typed by the child or grown-up; the last name is typed once by a grown-up. Both
are kept only on that device (the game's own saved data), never sent to the site.

## Where to write
- **Computer (fine pointer, no touch):** the start screen has two buttons, "Write on this screen" (mouse) and
  "Try it on a phone or a tablet". The QR code never shows by itself: only after the second button, with the 6-digit
  code and "Or go to chikescreativespace.com/write and type", and a Back button.
- **Phone or tablet (touch):** no QR code and no "Try it on" choice: grade, then "Start writing"; the pad fills the
  screen with Yuna and the stars above it.
- **Joined phone/tablet:** the computer is the teacher (Yuna, the model, stars, talking); the phone is the paper (the
  writing lines and guide only, sized to fill it, Undo / Clear / Done). Strokes show on the big screen as they are
  drawn. Joining follows Stack 'Em Up (supabase/private-games/matching-suits.html + games/matching-suits-player.html):
  Supabase Realtime broadcast, a 6-digit room, the ECDH + AES-GCM sealed link and the key fingerprint in the QR link.
  Phone page: games/write-with-yuna-pad.html?room=CODE&k=FP; /write/ forwards there (so a typed code works).

## Progress report
Each item written On your own posts one answer (only inside the site; nothing when opened alone):
`{ ccsAnswer: { game: "write-with-yuna", qid, subject: "reading", level, correct: stars >= 2, question, answer, why } }`
- qid: "write-" + a-z0-9- slug, at most 40 characters (write-upper-b, write-lower-b, write-word-cat, write-name,
  write-sentence-1, write-cursive-a ...).
- level: K-1 "k1", 2nd-3rd "g23", 4th-5th "g45".
- question: "Write the capital letter B." / "Write the word cat." / "Write your name." ; answer: "B" / "cat" / "your
  name" (never the child's real name); why: Yuna's tip (for example "Start at the top and go straight down first.").
Counts toward Reading and Writing (assets/lib/progress.js, kid-progress v5).

## Voice
Yuna speaks in Kokoro's Heart voice (af_heart), pre-recorded clips (scripts/record-lines.mjs; Yuna is said
"You-nah"): letter names and sounds, the words and sentences, and her fixed lines. Never speechSynthesis. Clips follow
the Game sounds level (games/game-sound.js volume panel; a sealed private game saves "volume" through the parent's
ccsSave). The clip key is the FNV-1a hash of the exact text, like the Solar tours (scripts/solar-lines.mjs).

## House rules that bind the build
- Subscribers only for now (like the other phone games): a private game in supabase/private-games/, delivered to
  members as srcdoc; the pad page is public (it shows only lines and strokes). Owner may make it free later.
- Opens on the logo loader (an inline copy, data-name "Write with Yuna"; list it in test/gameLoader.test.js).
- No em dashes, no emojis in any copy; never he/she for a child; STEAMM, not STEM.
- Motion: decelerating, never bouncy; respects prefers-reduced-motion.
- Never send or store a child's name outside the device. Admin previews record nothing (the site already ignores
  answers from an admin).
- Uploading the private game file to the portal, the games/portal rows and the push all wait for the owner's OK.
