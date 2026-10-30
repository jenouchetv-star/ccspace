-- Air Hockey Arcade rebuilt as a full-screen 3D arcade table, seen from the player's end, against Chike.
-- Run once in the Supabase SQL Editor (safe to run again).
update games set data = data || $j${"summary": "Step up to a glowing 3D arcade table and knock numbered pucks into Chike's goal. Add them up and be first to 25!", "rules": ["Pick Easy, Medium or Hard to start.", "You stand at your end of the table, and Chike guards the far goal.", "Move your paddle with the mouse, the Arrow keys, or by dragging your finger. It stays on your half.", "Five numbered pucks are in play at once. Knock one into Chike's goal to score its number.", "The scoreboard adds up each side's goals as you go.", "First to reach 25 wins the match.", "Sound is on: press the speaker button to turn it off."], "players": "1 against Chike"}$j$::jsonb
  || jsonb_build_object('cover', (data->'cover') || jsonb_build_object('alt', $a$A glowing blue 3D air hockey table seen from the player's end, flashing GOAL! +5 and 3 + 5 = 8 under an LED scoreboard in a dark neon arcade$a$::text)),
  updated_at = now()
where id = 'game-air-hockey';
