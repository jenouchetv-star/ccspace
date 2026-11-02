-- A small picture beside every step of an activity (shown left of the words, opened large on a click), made in
-- Higgsfield from the character sheets. Each activity's pictures live in assets/activities/<activity>/step-N.jpg
-- with a step-N-large.jpg for the enlarged view. Run AFTER the pictures are live. Safe to re-run; an activity is
-- only touched when its step count still matches its pictures.

begin;
update activities set data = data || '{"stepPictures": [
  {"src": "assets/activities/rubber-band-guitar/step-1.jpg", "full": "assets/activities/rubber-band-guitar/step-1-large.jpg", "alt": "Stacey stretches four rubber bands around a tissue box, across its hole"},
  {"src": "assets/activities/rubber-band-guitar/step-2.jpg", "full": "assets/activities/rubber-band-guitar/step-2-large.jpg", "alt": "Stacey slides a pencil under the bands at one end of the box to lift them"},
  {"src": "assets/activities/rubber-band-guitar/step-3.jpg", "full": "assets/activities/rubber-band-guitar/step-3-large.jpg", "alt": "Stacey plucks each band, with notes rising from low to high"},
  {"src": "assets/activities/rubber-band-guitar/step-4.jpg", "full": "assets/activities/rubber-band-guitar/step-4-large.jpg", "alt": "Stacey studies the thinnest, tightest bands through a magnifying glass"},
  {"src": "assets/activities/rubber-band-guitar/step-5.jpg", "full": "assets/activities/rubber-band-guitar/step-5-large.jpg", "alt": "Stacey slides one pencil closer to the other and plucks the same band"},
  {"src": "assets/activities/rubber-band-guitar/step-6.jpg", "full": "assets/activities/rubber-band-guitar/step-6-large.jpg", "alt": "Stacey plays a tune on her tissue-box guitar while Corey claps along"}
]}'::jsonb where id = 'act-rubber-band-guitar' and jsonb_array_length(data->'steps') = 6;
commit;
