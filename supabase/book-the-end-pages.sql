-- A closing "The End" page for every book with an even number of pages, applied to the live database on 2026-11-02.
-- The reader lays pages out as two-sided sheets, so an even page count ends on a left-hand page with a blank page
-- beside it. One more page makes the book end on the right. It takes the light color of the page before it.
-- Space Adventure's "The End" goes before its closing cover picture, so that picture becomes the back cover.
-- Safe to re-run: books that already have it, or have an odd page count, are left alone.

begin;
with endpage as (
  select s.id, jsonb_array_length(s.data->'pages') as n,
    jsonb_build_object('id', 'pg-the-end', 'layers', jsonb_build_array(
      jsonb_build_object('h', 12, 'w', 80, 'x', 10, 'y', 38, 'id', 'ly-the-end-title', 'type', 'text', 'align', 'center', 'color', '', 'style', 'heading', 'locked', false, 'content', 'The End'),
      jsonb_build_object('h', 10, 'w', 80, 'x', 10, 'y', 52, 'id', 'ly-the-end-line', 'type', 'text', 'align', 'center', 'color', '', 'style', 'body', 'locked', false, 'content', 'What will you create next?')),
      'background', s.data->'pages'->(case when s.id = 'book-space-adventure' then jsonb_array_length(s.data->'pages') - 2 else jsonb_array_length(s.data->'pages') - 1 end)->'background') as page
  from stories s
  where s.data->>'status' = 'published'
    and jsonb_array_length(coalesce(s.data->'pages', '[]'::jsonb)) % 2 = 0
    and jsonb_array_length(coalesce(s.data->'pages', '[]'::jsonb)) > 0
    and s.data::text not like '%pg-the-end%'
)
update stories s set data = jsonb_insert(s.data, array['pages', (e.n - 1)::text], e.page, s.id <> 'book-space-adventure')
from endpage e where s.id = e.id;
commit;
