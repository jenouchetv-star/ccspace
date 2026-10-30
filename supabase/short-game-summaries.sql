-- Shorter card summaries for the Play page's online games (October 2026): one short line each.
-- The full How to play list stays on each game's page. Run once in the Supabase SQL Editor (safe to run again).
update games g set data = g.data || jsonb_build_object('summary', s.summary), updated_at = now()
from (values
  ('game-pathbuilder', $s$Build a road across the island and drive the car home.$s$),
  ('game-doodle-dash', $s$Draw your own level, then run and jump through it.$s$),
  ('game-gravity-four', $s$Drop chips in 3D and get four in a row before Chike.$s$),
  ('game-spelling', $s$Crack the hidden word with Chike, one clue at a time.$s$),
  ('game-ufo', $s$Blast flying saucers on a trip from Mercury to Neptune.$s$),
  ('game-bounce-and-bank', $s$Drop balls through glowing pegs and grow your bank.$s$),
  ('game-air-hockey', $s$Knock numbered pucks past Chike. First to 25 wins!$s$),
  ('game-balloon-math', $s$Pop the balloon with the right answer, K to 5th grade.$s$),
  ('game-maze', $s$Guide your explorer through 8 forest mazes.$s$),
  ('game-drop-blox', $s$Stack falling blocks and clear lines of one color.$s$),
  ('game-memory', $s$Flip the cards and find all ten pairs.$s$),
  ('game-spacetime', $s$Fly around a 3D solar system and bend the orbits.$s$)
) as s(id, summary)
where g.id = s.id;
