-- Chike's Creative Space - game_files (games added from pasted code in the admin Copilot)
--
-- Run once in the Supabase SQL Editor (safe to run again). Changes no existing table.
--
-- Why a separate table: the `games` table is read by every visitor on every page load, so a
-- game's code (often hundreds of kilobytes) must not live in it. A game added from pasted code
-- keeps only its listing in `games` (title, summary, rules...) with hasFile = true, and its code
-- here, fetched only when someone presses Play.
--
--   Anyone can read a game's code (it is the game; the site serves it to every player).
--   Only an active admin can add, change or remove one.

create table if not exists game_files (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table game_files enable row level security;
grant select on game_files to anon, authenticated;
grant insert, update, delete on game_files to authenticated;
drop policy if exists "anyone can read" on game_files;
create policy "anyone can read" on game_files for select to anon, authenticated using (true);
drop policy if exists "admin writes" on game_files;
create policy "admin writes" on game_files for all to authenticated
  using (is_active_admin()) with check (is_active_admin());
