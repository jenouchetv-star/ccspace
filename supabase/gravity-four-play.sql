-- Chike's Gravity 4 on the Play page, for subscribers only.
-- Run once in the Supabase SQL Editor (safe to run again). Nothing here sends an email.
--
-- The game's code stays where it is: in the admin-only portal_game_files table, handed out only by the
-- portal function to someone signed in with a confirmed email. This row only puts a card on the Play page
-- (kind "members", with a lock). Its page sends visitors to the portal entry chikes-gravity-four, where the
-- portal's own gate asks for an email and consent, adds them to the mailing list once they confirm, and opens the game.

insert into games (id, data) values ('game-gravity-four', $j${"id":"game-gravity-four","title":"Chike’s Gravity 4","slug":"chikes-gravity-four","kind":"members","portalSlug":"chikes-gravity-four","path":"","summary":"A 3D chip-dropping game made just for our mailing-list subscribers. Line up four in a row against Chike, or play a friend on one screen or online.","players":"1 against Chike, or 2 (one screen or online)","minutes":10,"ageMin":6,"ageMax":12,"rules":["Pick who to play against: Chike, a friend on the same screen, or a friend far away with a 6-digit code.","Pick a column, then press Drop (or click the board). Your chip falls to the lowest empty spot.","Be the first to line up 4 chips in a row: across, up and down, or on a slant.","Block your friend by dropping a chip where they need one.","Drag the board to spin it and look around. On a keyboard, use the arrow keys to move and Enter to drop."],"vocabWord":"gravity","vocabSay":"GRAV-ih-tee · noun","vocabMeaning":"The invisible pull that brings things down to the ground.","vocabExample":"In Chike’s Gravity 4, gravity pulls your chip down to the lowest empty spot in the column!","leadsTo":"","interactive":true,"icon":"circle-dot","p1":"#D9C2E3","p2":"#7A4A86","status":"published","featured":false,"order":1,"createdAt":"2026-10-30T06:00:00.000Z","updatedAt":"2026-10-30T06:00:00.000Z","cover":{"src":"assets/games/gravity-four.jpg","alt":"Chike smiles at his computer while he plays Gravity 4, a purple board of cyan and yellow chips"}}$j$::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

-- Pathbuilder's How to play still described turns and the old Randomize button: two players now build at the same time.
update games set data = jsonb_set(jsonb_set(data,
    '{rules,4}', '"Stuck? Press Swap my cards for a whole new hand, Undo your last card, or Turn around if the road ends."'),
    '{rules,7}', '"For 2 players, choose 2 players, then make a room and share the 6-character code. Your friend types it under Join a friend. You both build at the same time, and the first car home wins."'),
  updated_at = now()
where id = 'game-pathbuilder' and data->'rules'->>7 like 'For 2 players%';
