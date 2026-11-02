-- Chike's Creative Space - "How Computers See" on the Read page, for subscribers only.
-- The book itself is the Hands-Free Reader, the example in AI Lesson 05 (supabase/ai-lesson-gesture-lab.sql). This row
-- only puts a card with a lock on the Read page: a subscriber (or an admin) who clicks it goes to the lesson page, and
-- anyone else is asked to join the free mailing list first. The card image is in the media library. Safe to re-run.

insert into stories (id, data) values ('story-how-computers-see', jsonb_build_object(
  'id', 'story-how-computers-see', 'slug', 'how-computers-see',
  'kind', 'members', 'portalSlug', 'how-to-build-a-hands-free-reader',
  'title', 'How Computers See',
  'blurb', 'A hands-free book about computer vision. Turn the pages with your hand, and find out how a computer spots the 21 points on it.',
  'image', jsonb_build_object('src', 'https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/uploads/media-library/1793624388899-hands-free-reader-book.jpg',
    'alt', 'A boy in a treehouse room waving his hand at a computer with a webcam, turning the pages of the Hands-Free Reader'),
  'character', '', 'readMinutes', 10, 'ageMin', 6, 'ageMax', 12, 'order', 0,
  'opening', '', 'learning', '', 'value', 'curiosity', 'featured', false, 'linkedActivity', '',
  'status', 'published', 'createdAt', '2026-11-02T15:00:00.000Z', 'updatedAt', '2026-11-02T15:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();
