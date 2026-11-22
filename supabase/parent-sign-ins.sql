-- Chike's Creative Space - parents' sign-ins for the admin Subscribers table.
--
-- portal_sessions.last_seen_at  the last time a signed-in member had a page of the site open on that session. The
--                               kid-progress Edge Function's `seen` action sets it (at most once a minute per
--                               session). Only a time is kept, never pages or activity.
-- member_activity               one row per member: when they last signed in (entered their 6-digit code) and when
--                               they were last seen. It outlives sessions, so signing out or the clean-up of old
--                               sessions does not lose it; it goes when the member is removed from subscribers.
--                               Filled only by the two triggers on portal_sessions below (the portal function is not
--                               changed), and backfilled once from the sessions that exist when this file runs.
--                               Closed to the browser roles: row level security on, no policies, no grants.
-- subscriber_sign_ins()         admins only (is_active_admin()): one row per member with an activity row or an
--                               unexpired session: last_sign_in and last_seen from member_activity, signed_in = at
--                               least one portal session not yet expired. No session tokens or hashes leave the
--                               database.
--
-- Needs: subscribers, portal_sessions and is_active_admin() (supabase/migration.sql).
-- Safe to run again.

alter table public.portal_sessions add column if not exists last_seen_at timestamptz;

create table if not exists public.member_activity (
  subscriber_id text primary key references public.subscribers(id) on delete cascade,
  last_sign_in timestamptz,
  last_seen timestamptz
);
alter table public.member_activity enable row level security;
revoke all on table public.member_activity from public, anon, authenticated;

-- A new portal session is a sign-in. A session for a subscriber that is not on the list records nothing (and the
-- sign-in itself is never stopped by this).
create or replace function public.member_activity_on_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.member_activity (subscriber_id, last_sign_in)
  select new.subscriber_id, new.created_at
  where exists (select 1 from public.subscribers s where s.id = new.subscriber_id)
  on conflict (subscriber_id) do update
    set last_sign_in = greatest(public.member_activity.last_sign_in, excluded.last_sign_in);
  return null;
end;
$$;
revoke all on function public.member_activity_on_sign_in() from public, anon, authenticated;

-- A session's last_seen_at was set: the member's last_seen moves forward, never back.
create or replace function public.member_activity_on_seen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.member_activity (subscriber_id, last_seen)
  select new.subscriber_id, new.last_seen_at
  where exists (select 1 from public.subscribers s where s.id = new.subscriber_id)
  on conflict (subscriber_id) do update
    set last_seen = greatest(public.member_activity.last_seen, excluded.last_seen);
  return null;
end;
$$;
revoke all on function public.member_activity_on_seen() from public, anon, authenticated;

drop trigger if exists member_activity_sign_in on public.portal_sessions;
create trigger member_activity_sign_in
  after insert on public.portal_sessions
  for each row execute function public.member_activity_on_sign_in();

drop trigger if exists member_activity_seen on public.portal_sessions;
create trigger member_activity_seen
  after update of last_seen_at on public.portal_sessions
  for each row when (new.last_seen_at is not null)
  execute function public.member_activity_on_seen();

-- Backfill: what the sessions that exist today already know (running it again changes nothing).
insert into public.member_activity (subscriber_id, last_sign_in, last_seen)
select p.subscriber_id, max(p.created_at), max(p.last_seen_at)
from public.portal_sessions p
where exists (select 1 from public.subscribers s where s.id = p.subscriber_id)
group by p.subscriber_id
on conflict (subscriber_id) do update
  set last_sign_in = greatest(public.member_activity.last_sign_in, excluded.last_sign_in),
      last_seen = greatest(public.member_activity.last_seen, excluded.last_seen);

create or replace function public.subscriber_sign_ins()
returns table (subscriber_id text, last_sign_in timestamptz, signed_in boolean, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_active_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select coalesce(a.subscriber_id, s.sid),
           a.last_sign_in,
           s.sid is not null,
           a.last_seen
    from public.member_activity a
    full join (
      select distinct p.subscriber_id as sid
      from public.portal_sessions p
      where p.expires_at > now()
    ) s on s.sid = a.subscriber_id;
end;
$$;
revoke all on function public.subscriber_sign_ins() from public, anon;
grant execute on function public.subscriber_sign_ins() to authenticated;
