-- Each storyboarded book's Read page card shows its payoff picture, cropped wide (16:10) to fit the card.
-- Run AFTER assets/books/<book>/card.jpg (and card-thumb.jpg) are live. Safe to re-run.
-- A book's `card` field wins over its first page's cover (storyCard in index.html); an admin can change it
-- under "Read page card picture", or clear it to go back to the first page.

begin;
update stories set data = data || jsonb_build_object('card', jsonb_build_object('src', v.src, 'alt', v.alt))
from (values
  ('story-drawing-nobody-understood', '/assets/books/kiyah/card.jpg', 'Kiyah holds up her finished garden drawing at sunset while Chike claps for her'),
  ('story-fold-that-would-not', '/assets/books/airplane/card.jpg', 'Zech and Corey cheer with their arms up beneath the treehouse'),
  ('story-question-mark', '/assets/books/flying-box/card.jpg', 'Chike and Mateo wave their arms as their cardboard Sky Spark rolls down the hill'),
  ('story-slowest-dancer', '/assets/books/averi/card.jpg', 'Averi takes her first dance step on the big stage while Yuna cheers from the curtain'),
  ('story-song-in-the-rain', '/assets/books/stacey/card.jpg', 'Stacey strums her guitar as music notes float toward the open window and Corey claps'),
  ('story-city-that-sank', '/assets/books/mateo/card.jpg', 'Mateo points up at a glowing train track climbing the workshop wall while Chike grins'),
  ('story-train-with-no-signals', '/assets/books/windmill/card.jpg', 'Zech holds his pinwheel high on the windy hill as Chike connects the wires')
) as v(id, src, alt)
where stories.id = v.id;
commit;
