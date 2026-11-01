-- Doodle Dash's home page intro (November 2026): the Newest game section shows two sentences, while the Play page
-- card keeps the one-line summary. Run once in the Supabase SQL Editor (safe to run again).
update games set data = data || jsonb_build_object('intro', $s$Draw your own level, then run and jump through it. Share a six-character code to play in the same world as a friend.$s$), updated_at = now()
where id = 'game-doodle-dash';
