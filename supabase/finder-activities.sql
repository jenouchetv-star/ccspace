-- The activity finder's activities (Create page > "What should we create today?", pages at /find/<id>), moved out
-- of the code (FIND_CATALOG in index.html) so admins can edit them under Admin > Finder activities. Same shape and
-- rules as the other content tables: anyone can read, only an active admin can add, change or remove.
-- The 32 built-in activities are copied in once from the site itself (Admin, signed in), keeping their ids A01-A32.
create table if not exists finder_activities (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table finder_activities enable row level security;

revoke all on finder_activities from anon, authenticated;
grant select on finder_activities to anon;
grant select, insert, update, delete on finder_activities to authenticated;

drop policy if exists "public read" on finder_activities;
create policy "public read" on finder_activities for select to anon, authenticated using (true);
drop policy if exists "admin insert" on finder_activities;
create policy "admin insert" on finder_activities for insert to authenticated with check (is_active_admin());
drop policy if exists "admin update" on finder_activities;
create policy "admin update" on finder_activities for update to authenticated using (is_active_admin()) with check (is_active_admin());
drop policy if exists "admin delete" on finder_activities;
create policy "admin delete" on finder_activities for delete to authenticated using (is_active_admin());
