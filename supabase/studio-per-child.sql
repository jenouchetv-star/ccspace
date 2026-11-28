-- Each child's own space in the Studio apps (owner, 2026-11-28; assets/lib/studioKids.js).
-- A song or picture may belong to one child (the child's id) or to the Family shelf (null). The family's limits stay
-- shared: nothing here changes how much an account may keep. Run before deploying sound-cloud and art-cloud.
alter table public.sound_projects add column if not exists child_id text;
alter table public.art_projects add column if not exists child_id text;
