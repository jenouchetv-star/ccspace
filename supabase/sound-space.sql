-- Chike's Creative Space - Sound Space: members' songs in their account, and anonymous daily usage counts.
--
-- sound_projects    one row per song a mailing-list member saved to their account (the sound-cloud Edge Function
--                   is the only thing that reads or writes it, with the service role). A deleted song keeps a small
--                   row (deleted = true, no data) so other browsers learn to remove their copy too. A member's songs
--                   go when the member is removed from subscribers.
-- sound_space_daily one count per day per event, added to by sound_space_count() from the site. No names, no songs.
--
-- Both tables are closed to the browser roles: row level security on, no policies, and no grants. The key column
-- matches art_projects' reference to subscribers: subscribers.id (text primary key, see supabase/migration.sql).
-- Safe to run again.

create table if not exists public.sound_projects (
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  project_id text not null,
  title text not null default '',
  thumb text,
  data jsonb,
  bytes int not null default 0,
  updated_ms bigint not null default 0,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, project_id)
);
alter table public.sound_projects enable row level security;
revoke all on table public.sound_projects from public, anon, authenticated;

create table if not exists public.sound_space_daily (
  day date not null,
  event text not null,
  count int not null default 0,
  primary key (day, event)
);
alter table public.sound_space_daily enable row level security;
revoke all on table public.sound_space_daily from public, anon, authenticated;

-- Add one to today's count for a known event. Anything else is ignored; a day's count stops at 100000.
create or replace function public.sound_space_count(ev text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if ev is null or ev not in ('opened', 'signin_shown', 'signed_in', 'song_played', 'song_exported') then
    return;
  end if;
  insert into public.sound_space_daily as d (day, event, count)
  values ((now() at time zone 'utc')::date, ev, 1)
  on conflict (day, event) do update set count = least(d.count + 1, 100000);
end;
$$;
revoke all on function public.sound_space_count(text) from public;
grant execute on function public.sound_space_count(text) to anon, authenticated;
