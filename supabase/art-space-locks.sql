-- Art Space picture locks (owner, 2026-11-18): a picture is open in one place at a time, like Sound Space's songs
-- (supabase/sound-space.sql). When a signed-in member opens a picture, the app asks the art-cloud function for the
-- lock and renews it every 25 seconds while the picture stays open; another device or browser tab asking for the same
-- picture is told it's open somewhere else, and its home page shows the picture greyed out with a lock. A lock runs
-- out by itself (75 seconds after the last renewal) when a tab closes or a device goes offline, so a picture never
-- stays locked. `holder` is a random id for one browser tab, made by the app. Service role only, like art_projects.
create table if not exists public.art_locks (
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  project_id text not null,
  holder text not null,
  expires_at timestamptz not null,
  primary key (subscriber_id, project_id)
);
alter table public.art_locks enable row level security;
revoke all on table public.art_locks from public, anon, authenticated;

-- Take or renew a picture's lock in one step, so two devices asking at the same moment can't both get it. True when
-- this holder now has the lock: it was free, it had run out, or it was already this holder's (a renewal).
create or replace function public.art_lock_take(p_sub text, p_project text, p_holder text, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  got boolean;
begin
  insert into public.art_locks as l (subscriber_id, project_id, holder, expires_at)
  values (p_sub, p_project, p_holder, now() + make_interval(secs => greatest(10, least(coalesce(p_seconds, 75), 600))))
  on conflict (subscriber_id, project_id) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where l.holder = excluded.holder or l.expires_at <= now()
  returning true into got;
  return coalesce(got, false);
end;
$$;
revoke all on function public.art_lock_take(text, text, text, int) from public, anon, authenticated;
grant execute on function public.art_lock_take(text, text, text, int) to service_role;
