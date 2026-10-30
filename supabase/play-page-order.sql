-- The Play page's online games, in the owner's order (October 2026). Lowest "order" shows first.
-- Run once in the Supabase SQL Editor (safe to run again).
update games g set data = g.data || jsonb_build_object('order', o.n), updated_at = now()
from (values
  ('game-pathbuilder', 0),
  ('game-doodle-dash', 1),
  ('game-gravity-four', 2),
  ('game-spelling', 3),
  ('game-ufo', 4),
  ('game-bounce-and-bank', 5),
  ('game-air-hockey', 6),
  ('game-balloon-math', 7),
  ('game-maze', 8),
  ('game-drop-blox', 9),
  ('game-memory', 10),
  ('game-spacetime', 11)
) as o(id, n)
where g.id = o.id;
