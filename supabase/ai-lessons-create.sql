-- Chike's Creative Space - the two AI lessons on the Create page, for subscribers.
--
-- Each is an activities row with kind "members": its card shows a "Subscribers only" lock, and clicking it opens
-- the join notice (or, for a subscriber, the lesson in the Subscriber's Portal). It has no activity page of its own,
-- the finder, home page and related activities leave it out, and the sitemap skips it. The lesson itself stays in
-- portal_entries; this row only holds the card. Safe to re-run.

insert into activities (id, data) values ('act-ai-lesson-gravity-four', jsonb_build_object(
  'id', 'act-ai-lesson-gravity-four', 'slug', 'ai-lesson-gravity-four',
  'kind', 'members', 'portalSlug', 'chikes-gravity-four',
  'title', 'AI Lesson 01: Make your own Gravity 4 Game',
  'summary', 'Play Chike''s 3D chip-dropping game, then use AI to make a game of your own, step by step.',
  'type', 'ai', 'access', 'members', 'character', 'chike',
  'ageMin', 6, 'ageMax', 10, 'timeMinutes', 30, 'difficulty', 'easy', 'setting', 'indoor', 'adultSupport', 'nearby',
  'materials', '[]'::jsonb, 'materialsDetail', '[]'::jsonb, 'safetyNotes', '[]'::jsonb, 'steps', '[]'::jsonb,
  'learning', jsonb_build_object('topic', 'structures', 'title', 'Make your own game with AI', 'text', ''),
  'discussionPrompt', '', 'variation', '', 'value', 'curiosity',
  'printable', jsonb_build_object('label', '', 'path', ''), 'youtubeUrl', '',
  'image', jsonb_build_object('src', 'assets/games/gravity-four-loop.gif', 'alt', 'Chike''s Gravity 4: a 3D board of blue and yellow chips'),
  'related', '[]'::jsonb, 'tags', '["ai", "coding", "games", "subscribers"]'::jsonb, 'featured', false,
  'status', 'published', 'createdAt', '2026-10-31T12:00:00.000Z', 'updatedAt', '2026-10-31T12:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into activities (id, data) values ('act-ai-lesson-3d-computer', jsonb_build_object(
  'id', 'act-ai-lesson-3d-computer', 'slug', 'ai-lesson-3d-computer',
  'kind', 'members', 'portalSlug', 'how-to-build-your-own-3d-computer',
  'title', 'AI Lesson 02: Make an Interactive 3D Computer',
  'summary', 'Use AI to build a 3D computer with a monitor, a mouse, and a keyboard you can really type on.',
  'type', 'ai', 'access', 'members', 'character', 'chike',
  'ageMin', 6, 'ageMax', 10, 'timeMinutes', 30, 'difficulty', 'easy', 'setting', 'indoor', 'adultSupport', 'nearby',
  'materials', '[]'::jsonb, 'materialsDetail', '[]'::jsonb, 'safetyNotes', '[]'::jsonb, 'steps', '[]'::jsonb,
  'learning', jsonb_build_object('topic', 'structures', 'title', 'Give AI clear, detailed instructions', 'text', ''),
  'discussionPrompt', '', 'variation', '', 'value', 'curiosity',
  'printable', jsonb_build_object('label', '', 'path', ''), 'youtubeUrl', '',
  'image', jsonb_build_object('src', 'https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/uploads/media/1793490767661-Gemini_Generated_Image_th0wsuth0wsuth0w.jpg', 'alt', 'A 3D computer on a desk, with a monitor, a white keyboard and a red mouse'),
  'related', '[]'::jsonb, 'tags', '["ai", "coding", "3d", "subscribers"]'::jsonb, 'featured', false,
  'status', 'published', 'createdAt', '2026-10-31T12:00:00.000Z', 'updatedAt', '2026-10-31T12:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();

-- AI Lesson 03, beside its Subscriber's Portal lesson (supabase/ai-lesson-math-robot.sql); both are published,
-- and the card uses the lesson's cover.
insert into activities (id, data) values ('act-ai-lesson-math-robot', jsonb_build_object(
  'id', 'act-ai-lesson-math-robot', 'slug', 'ai-lesson-math-robot',
  'kind', 'members', 'portalSlug', 'how-to-build-your-own-math-robot',
  'title', 'AI Lesson 03: Make a Talking 3D Math Robot',
  'summary', 'Use AI to build a friendly 3D robot that chats with you, learns your name, helps with your math homework, and gives high fives.',
  'type', 'ai', 'access', 'members', 'character', 'chike',
  'ageMin', 6, 'ageMax', 10, 'timeMinutes', 30, 'difficulty', 'easy', 'setting', 'indoor', 'adultSupport', 'nearby',
  'materials', '[]'::jsonb, 'materialsDetail', '[]'::jsonb, 'safetyNotes', '[]'::jsonb, 'steps', '[]'::jsonb,
  'learning', jsonb_build_object('topic', 'structures', 'title', 'A detailed prompt makes a smarter robot', 'text', ''),
  'discussionPrompt', '', 'variation', '', 'value', 'curiosity',
  'printable', jsonb_build_object('label', '', 'path', ''), 'youtubeUrl', '',
  'image', jsonb_build_object('src', 'https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/uploads/media/1793509939119-Gemini_Generated_Image_78agxd78agxd78ag.jpg', 'alt', 'Children looking at their Math tutoring robot.'),
  'related', '[]'::jsonb, 'tags', '["ai", "coding", "math", "robot", "subscribers"]'::jsonb, 'featured', false,
  'status', 'published', 'createdAt', '2026-11-01T12:00:00.000Z', 'updatedAt', '2026-11-01T12:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();
