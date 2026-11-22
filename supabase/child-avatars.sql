-- Chike's Creative Space - progress report: each child's avatar (owner, 2026-11-22).
--
-- children.avatar  one of 20 avatars (drawn by assets/lib/avatars.js) that a grown-up picks for a child in Your
--                  children. The kid-progress Edge Function gives a new child one at random (child_save) and sends it
--                  with the children list. Children saved before this file get one at random here, once.
--
-- Needs: children (supabase/kid-progress.sql). Safe to run again.

alter table public.children add column if not exists avatar text;

alter table public.children drop constraint if exists children_avatar_check;
alter table public.children add constraint children_avatar_check check (avatar is null or avatar in (
  'robot', 'racecar', 'pencil', 'rocket', 'paintbrush', 'guitar', 'dinosaur', 'planet', 'lightbulb', 'gear',
  'music', 'microscope', 'book', 'telescope', 'drum', 'crayon', 'magnet', 'headphones', 'airplane', 'star'));

-- the children already kept: one each at random (random() runs again for every row)
update public.children
set avatar = (array['robot', 'racecar', 'pencil', 'rocket', 'paintbrush', 'guitar', 'dinosaur', 'planet', 'lightbulb', 'gear',
  'music', 'microscope', 'book', 'telescope', 'drum', 'crayon', 'magnet', 'headphones', 'airplane', 'star'])[1 + floor(random() * 20)::int]
where avatar is null;
