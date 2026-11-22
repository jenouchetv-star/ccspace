-- Chike's Creative Space - parents' sign-ins for the admin Subscribers table.
--
-- portal_sessions.last_seen_at  the last time a signed-in member had a page of the site open. The kid-progress Edge
--                               Function's `seen` action sets it (at most once a minute per session). Only a time is
--                               kept, never pages or activity.
-- subscriber_sign_ins()         admins only (is_active_admin()): one row per subscriber id that has a portal session:
--                               last_sign_in = the newest created_at (when they last entered their 6-digit code),
--                               signed_in = at least one session not yet expired, last_seen = the newest last_seen_at.
--                               No session tokens or hashes leave the database.
--
-- Needs: portal_sessions and is_active_admin() (supabase/migration.sql).
-- Safe to run again.

alter table public.portal_sessions add column if not exists last_seen_at timestamptz;

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
    select s.subscriber_id,
           max(s.created_at),
           bool_or(s.expires_at > now()),
           max(s.last_seen_at)
    from public.portal_sessions s
    group by s.subscriber_id;
end;
$$;
revoke all on function public.subscriber_sign_ins() from public, anon;
grant execute on function public.subscriber_sign_ins() to authenticated;
