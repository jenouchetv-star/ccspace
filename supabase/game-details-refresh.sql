-- Play page cards and game pages, brought up to date with the games as they are now (October 2026):
-- Bounce & Bank's arcade cabinet, shop and high score; Memory Match's picture cards; and sound in every game.
-- Run once in the Supabase SQL Editor (safe to run again). Only the summary and How to play change.

update games set data = data || $j${"summary":"An arcade drop game: six balls, a board of glowing pegs, and a bank to grow to $1,000. Can you beat your high score?","rules":["Move the ball left and right with the arrow keys or the mouse, then press the down arrow or click to drop it.","The pegs bounce it into a slot: the $100 jackpot in the middle, $50, $25 and $10 slots, and two −$10 slots. Green pegs bounce harder.","Before your first drop you can buy extra balls with bank money, one of each at most: a normal ball ($25), a 2x ball ($45) or a 3x ball ($75) that multiplies its slot. Buying never changes what the slots pay out.","After your balls are gone, deposit your cash into the bank, or pay if it went below zero.","Play six games and try to grow your bank to $1,000. Your all-time high score is saved on this device.","Sound is on: press the speaker button to turn it off."]}$j$::jsonb, updated_at = now()
where id = 'game-bounce-and-bank';

update games set data = data || $j${"summary":"Ten pairs of picture cards, face down: a rocket, a robot, a guitar and more. Find them all, then try to beat your own best time.","rules":["Click a card, or press Enter, to turn it over.","Turn over a second card to look for a match.","A matching pair stays face up with a green tick; anything else flips back.","Your best time is kept on this device.","Sound is on: press the speaker button to turn it off."]}$j$::jsonb, updated_at = now()
where id = 'game-memory';

-- the rest keep their text and gain one line about sound (added only once)
update games set data = jsonb_set(data, '{rules}', (data->'rules') || '["Sound is on: press the speaker button to turn it off."]'::jsonb), updated_at = now()
where id in ('game-drop-blox', 'game-air-hockey', 'game-spacetime', 'game-doodle-dash')
  and not (data->'rules') @> '["Sound is on: press the speaker button to turn it off."]'::jsonb;

-- Spelling Detective: grades K to 5th, Chike, clues and sound
update games set data = data || $j${"summary": "Be a detective with Chike! Pick your grade, read the clue, and crack the hidden word one letter at a time.", "rules": ["Pick your grade, from Kindergarten to 5th. Each grade has its own words.", "Read the clue on the case card, then click a letter (or type it) to try it.", "Right letters fill in the word. A wrong letter uses up one of your magnifying glasses.", "Stuck? Press Get a clue and Chike finds a letter for you, one clue per case.", "Solve the word before your magnifying glasses run out. Your solved cases are kept on this device.", "Sound is on: press the speaker button to turn it off."], "ageMax": 11}$j$::jsonb, updated_at = now()
where id = 'game-spelling';

-- new card pictures (the same file names, new pictures) get descriptions that match them
update games set data = jsonb_set(data, '{cover,alt}', to_jsonb($a$Memory Match picture cards: matched pairs of a guitar, a puzzle piece and a light bulb with green ticks, a rocket turned over, and yellow card backs$a$::text)), updated_at = now() where id = 'game-memory';
update games set data = jsonb_set(data, '{cover,alt}', to_jsonb($a$The Bounce & Bank arcade cabinet: a light-up sign, LED scoreboards, a board of glowing pegs with two gold balls falling, and lit prize slots with a $100 jackpot$a$::text)), updated_at = now() where id = 'game-bounce-and-bank';
update games set data = jsonb_set(data, '{cover,alt}', to_jsonb($a$Chike points to a clue in Spelling Detective: a case folder with the clue "Where you live with your family", the word h-o-_-s-_ and letter tiles$a$::text)), updated_at = now() where id = 'game-spelling';
