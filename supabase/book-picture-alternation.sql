-- The wide story pictures alternate: the first one sits on top of its page (text underneath), the next on the bottom
-- (text on top), and so on through each book, instead of every picture at the bottom. Full-page pictures are unchanged.
-- The reader positions a picture by its y (placement is only the fallback), so both are set.
-- Stacey and the Sound of Sunshine already alternates; Mateo and the Floating Train has no wide pictures;
-- Chike and Zech's Space Adventure alternates in book-space-adventure-redraw.sql.
-- Applied to the live database on 2026-11-02. Safe to re-run: each statement only touches the page with the expected id.

begin;
-- the 1st wide picture of each book (page 2) moves to the top
update stories s set data = jsonb_set(s.data, array['pages', '1', 'layers'], (
    select jsonb_agg(case when l->>'type' = 'image' then l || '{"y": 0, "placement": "top-half"}'::jsonb else l || '{"y": 56}'::jsonb end order by o)
    from jsonb_array_elements(s.data->'pages'->1->'layers') with ordinality as q(l, o)))
from (values
  ('story-drawing-nobody-understood', 'pg-mig-56'),
  ('story-fold-that-would-not', 'pg-mig-22'),
  ('story-question-mark', 'pg-mig-5'),
  ('story-slowest-dancer', 'pg-mig-107'),
  ('story-train-with-no-signals', 'pg-mig-73')
) as v(id, pid)
where s.id = v.id and s.data->'pages'->1->>'id' = v.pid and jsonb_array_length(s.data->'pages'->1->'layers') = 2;
-- the 3rd wide picture (page 4) moves to the top
update stories s set data = jsonb_set(s.data, array['pages', '3', 'layers'], (
    select jsonb_agg(case when l->>'type' = 'image' then l || '{"y": 0, "placement": "top-half"}'::jsonb else l || '{"y": 56}'::jsonb end order by o)
    from jsonb_array_elements(s.data->'pages'->3->'layers') with ordinality as q(l, o)))
from (values
  ('story-drawing-nobody-understood', 'pg-mig-61'),
  ('story-fold-that-would-not', 'pg-mig-27'),
  ('story-question-mark', 'pg-mig-10'),
  ('story-slowest-dancer', 'pg-mig-112')
) as v(id, pid)
where s.id = v.id and s.data->'pages'->3->>'id' = v.pid and jsonb_array_length(s.data->'pages'->3->'layers') = 2;
commit;
