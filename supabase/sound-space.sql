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

-- Song locks (owner, 2026-11-16): a song is open in one place at a time. When a signed-in member opens a song, the
-- app asks the sound-cloud function for the lock and renews it every 25 seconds while the song stays open; another
-- device or browser tab asking for the same song is told it's open somewhere else. A lock runs out by itself (75
-- seconds after the last renewal) when a tab closes or a device goes offline, so a song never stays locked.
-- `holder` is a random id for one browser tab, made by the app. Service role only, like sound_projects.
create table if not exists public.sound_locks (
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  project_id text not null,
  holder text not null,
  expires_at timestamptz not null,
  primary key (subscriber_id, project_id)
);
alter table public.sound_locks enable row level security;
revoke all on table public.sound_locks from public, anon, authenticated;

-- Take or renew a song's lock in one step, so two devices asking at the same moment can't both get it. True when this
-- holder now has the lock: it was free, it had run out, or it was already this holder's (a renewal).
create or replace function public.sound_lock_take(p_sub text, p_project text, p_holder text, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  got boolean;
begin
  insert into public.sound_locks as l (subscriber_id, project_id, holder, expires_at)
  values (p_sub, p_project, p_holder, now() + make_interval(secs => greatest(10, least(coalesce(p_seconds, 75), 600))))
  on conflict (subscriber_id, project_id) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where l.holder = excluded.holder or l.expires_at <= now()
  returning true into got;
  return coalesce(got, false);
end;
$$;
revoke all on function public.sound_lock_take(text, text, text, int) from public, anon, authenticated;
grant execute on function public.sound_lock_take(text, text, text, int) to service_role;
