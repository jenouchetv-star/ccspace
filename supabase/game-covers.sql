-- Photo covers for the six "away from the screen" games on the Play page.
-- The image files live in assets/games/ (see docs/image-credits.md). Run after the site is deployed,
-- so the files exist at those addresses. Safe to run again.
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/materials-mashup.jpg","alt":"A child gluing torn pieces of colored paper onto a rainbow"}'::jsonb)
  where id = 'game-materials-mashup';
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/draw-what-i-say.jpg","alt":"Two girls drawing with colorful markers at a table"}'::jsonb)
  where id = 'game-draw-what-i-say';
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/sound-scavenger-hunt.jpg","alt":"A child cupping a hand behind their ear to listen closely"}'::jsonb)
  where id = 'game-sound-hunt';
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/bridge-challenge.jpg","alt":"A woman and a girl building a tower from colorful blocks"}'::jsonb)
  where id = 'game-bridge-challenge';
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/story-relay.jpg","alt":"Two children sharing a picture book"}'::jsonb)
  where id = 'game-story-relay';
update games set data = jsonb_set(data, '{cover}', '{"src":"assets/games/freeze-and-swap.jpg","alt":"A girl twirling with her arms up in a living room"}'::jsonb)
  where id = 'game-freeze-swap';
