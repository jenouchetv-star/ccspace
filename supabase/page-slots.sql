-- Shared page records for the page text slots (PAGE_SLOTS in index.html): the wording every activity, game,
-- episode, book, character, article and printable-pack page shares, the activity finder, the legal pages' closing
-- panel, and the small system pages. Each starts with no edits (texts {}), so the site shows its built-in wording
-- until an admin changes something. Safe to run more than once.
insert into pages (id, data)
select v.id, jsonb_build_object(
  'id', v.id, 'key', v.key, 'title', v.title, 'nav', 'Shared', 'eyebrow', '', 'heading', '', 'highlight', '',
  'tone', 'sun', 'intro', '', 'image', jsonb_build_object('src', '', 'alt', ''), 'body', '', 'texts', '{}'::jsonb,
  'status', 'published', 'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
from (values
  ('page-templates-finder',    'templates/finder',    'Activity finder'),
  ('page-templates-activity',  'templates/activity',  'Every activity page'),
  ('page-templates-game',      'templates/game',      'Every game page'),
  ('page-templates-episode',   'templates/episode',   'Every episode page'),
  ('page-templates-story',     'templates/story',     'Every book page'),
  ('page-templates-character', 'templates/character', 'Every character page'),
  ('page-templates-article',   'templates/article',   'Every article page'),
  ('page-templates-printable', 'templates/printable', 'Every printable pack page'),
  ('page-templates-legal',     'templates/legal',     'Privacy and Terms closing panel'),
  ('page-system',              'system',              'System pages')
) as v(id, key, title)
where not exists (select 1 from pages p where p.data->>'key' = v.key);
