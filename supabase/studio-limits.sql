-- Chike's Creative Space - Studio space limits: admins can change how much each member may keep in Art Space and
-- Sound Space, for everyone (per app) or for one member.
--
-- studio_limits         one row per app ('art', 'sound') with the limits an admin saved. No rows to start with: a
--                       missing row or an empty (null) column means "the usual limit" (the built-in one, which is
--                       the same number the art-cloud and sound-cloud functions have always used), so nothing
--                       changes until an admin saves.
-- studio_member_limits  one member's own items and total space for one app; it beats the app's row for those two.
--                       The largest item and saves an hour are always the same for everyone. A member's limits go
--                       when the member is removed from subscribers.
--
-- The art-cloud and sound-cloud Edge Functions read both tables with the service role on each save. Both tables are
-- closed to the browser roles (row level security on, no policies, no grants); admins read and change them only
-- through the RPCs below, which check is_active_admin() and write each change to the activity log (audit_log, the
-- same rows the admin portal's db.log() writes). Lowering a limit never deletes anything.
--
-- Also here: sound_space_usage(range_days), the admins' Sound Space numbers, with each member's effective limits,
-- and (at the end) a REPLACEMENT for the live art_studio_usage(range_days) that adds the same three keys to its
-- by_member rows and otherwise returns exactly what it did.
-- Needs: subscribers, profiles, audit_log, is_active_admin() (supabase/migration.sql), supabase/sound-space.sql, and
-- Art Space's live art_projects and art_studio_daily tables.
-- Safe to run again.

create table if not exists public.studio_limits (
  app text primary key check (app in ('art', 'sound')),
  max_items int check (max_items between 1 and 2000),
  max_account_bytes bigint check (max_account_bytes between 1000000 and 1000000000),
  max_item_bytes int check (max_item_bytes is null
    or (app = 'art' and max_item_bytes between 100000 and 10000000)
    or (app = 'sound' and max_item_bytes between 50000 and 2000000)),
  max_saves_per_hour int check (max_saves_per_hour between 60 and 3600),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.studio_limits enable row level security;
revoke all on table public.studio_limits from public, anon, authenticated;

create table if not exists public.studio_member_limits (
  app text not null check (app in ('art', 'sound')),
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  max_items int check (max_items between 1 and 2000),
  max_account_bytes bigint check (max_account_bytes between 1000000 and 1000000000),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (app, subscriber_id)
);
alter table public.studio_member_limits enable row level security;
revoke all on table public.studio_member_limits from public, anon, authenticated;

-- The usual limits: the numbers the art-cloud and sound-cloud functions are built with. Private.
create or replace function public.studio_limit_defaults(p_app text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_app
    when 'art' then '{"max_items":200,"max_account_bytes":100000000,"max_item_bytes":3000000,"max_saves_per_hour":600}'::jsonb
    when 'sound' then '{"max_items":200,"max_account_bytes":20000000,"max_item_bytes":500000,"max_saves_per_hour":600}'::jsonb
  end;
$$;
revoke all on function public.studio_limit_defaults(text) from public, anon, authenticated;

-- Bytes as megabytes for people (1 MB = 1,000,000 bytes, as on the admin page): 250, 0.5, 0.05. Private.
create or replace function public.studio_limit_mb(p_bytes bigint)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select trim_scale(round(p_bytes / 1000000.0, 2))::text $$;
revoke all on function public.studio_limit_mb(bigint) from public, anon, authenticated;

-- One line in the activity log, shaped like the admin portal's own db.log() entries. A log that can't be written
-- never undoes the change it describes (the same rule as db.log()). Private.
create or replace function public.studio_limits_log(p_record text, p_label text, p_actor text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id text := 'log-' || to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint) || '-' || substr(md5(random()::text), 1, 6);
begin
  insert into public.audit_log (id, data) values (v_id, jsonb_build_object(
    'id', v_id,
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'action', 'update', 'collection', 'studio', 'recordId', p_record, 'label', p_label, 'actor', p_actor));
exception when others then
  raise warning 'studio limits: activity log not written: %', sqlerrm;
end;
$$;
revoke all on function public.studio_limits_log(text, text, text) from public, anon, authenticated;

-- The signed-in admin's name for updated_by and the log (their email if they have no name). Private.
create or replace function public.studio_limits_actor()
returns text
language sql
stable
set search_path = public, pg_temp
as $$ select coalesce((select coalesce(nullif(p.name, ''), p.email) from public.profiles p where p.id = auth.uid()), 'admin') $$;
revoke all on function public.studio_limits_actor() from public, anon, authenticated;

-- Admins: the limits in force for each app (saved values over the usual ones), which of them are custom, the usual
-- ones, and every member who has their own limits.
create or replace function public.studio_limits_get()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_app text;
  d jsonb;
  r public.studio_limits%rowtype;
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  foreach v_app in array array['art', 'sound'] loop
    d := studio_limit_defaults(v_app);
    r := null;
    select * into r from public.studio_limits where app = v_app;
    v_out := v_out || jsonb_build_object(v_app, jsonb_build_object(
      'max_items', coalesce(r.max_items, (d->>'max_items')::int),
      'max_account_bytes', coalesce(r.max_account_bytes, (d->>'max_account_bytes')::bigint),
      'max_item_bytes', coalesce(r.max_item_bytes, (d->>'max_item_bytes')::int),
      'max_saves_per_hour', coalesce(r.max_saves_per_hour, (d->>'max_saves_per_hour')::int),
      'custom', jsonb_build_object(
        'max_items', r.max_items is not null,
        'max_account_bytes', r.max_account_bytes is not null,
        'max_item_bytes', r.max_item_bytes is not null,
        'max_saves_per_hour', r.max_saves_per_hour is not null),
      'defaults', d,
      'updated_at', r.updated_at,
      'updated_by', r.updated_by));
  end loop;
  return v_out || jsonb_build_object('members', coalesce((
    select jsonb_agg(jsonb_build_object('app', m.app, 'email', s.data->>'email', 'max_items', m.max_items,
                                        'max_account_bytes', m.max_account_bytes)
                     order by m.app, lower(s.data->>'email'))
    from public.studio_member_limits m join public.subscribers s on s.id = m.subscriber_id), '[]'::jsonb));
end;
$$;
revoke all on function public.studio_limits_get() from public, anon;
grant execute on function public.studio_limits_get() to authenticated;

-- Admins: set an app's limits for everyone. A null keeps (or goes back to) the usual value for that one; all nulls
-- go back to the usual limits ("Back to the usual limits"). Returns studio_limits_get().
create or replace function public.studio_limits_set(p_app text, p_max_items int, p_max_account_bytes bigint,
                                                    p_max_item_bytes int, p_max_saves_per_hour int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text;
  v_name text;
  v_word text;
  d jsonb;
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  if p_app is null or p_app not in ('art', 'sound') then
    raise exception 'Unknown app: %', coalesce(p_app, '(none)') using errcode = '22023';
  end if;
  v_name := case p_app when 'art' then 'Art Space' else 'Sound Space' end;
  v_word := case p_app when 'art' then 'pictures' else 'songs' end;
  if p_max_items is not null and p_max_items not between 1 and 2000 then
    raise exception 'Items each member can save must be between 1 and 2,000.' using errcode = '22023';
  end if;
  if p_max_account_bytes is not null and p_max_account_bytes not between 1000000 and 1000000000 then
    raise exception 'Total space must be between 1 MB and 1,000 MB (1 GB).' using errcode = '22023';
  end if;
  if p_app = 'art' and p_max_item_bytes is not null and p_max_item_bytes not between 100000 and 10000000 then
    raise exception 'The largest picture must be between 0.1 MB and 10 MB.' using errcode = '22023';
  end if;
  if p_app = 'sound' and p_max_item_bytes is not null and p_max_item_bytes not between 50000 and 2000000 then
    raise exception 'The largest song must be between 0.05 MB and 2 MB.' using errcode = '22023';
  end if;
  if p_max_saves_per_hour is not null and p_max_saves_per_hour not between 60 and 3600 then
    raise exception 'Saves an hour must be between 60 and 3,600.' using errcode = '22023';
  end if;

  v_actor := studio_limits_actor();
  if p_max_items is null and p_max_account_bytes is null and p_max_item_bytes is null and p_max_saves_per_hour is null then
    delete from public.studio_limits where app = p_app;
    perform studio_limits_log('studio-limits-' || p_app, 'Space limits, ' || v_name || ': back to the usual limits', v_actor);
  else
    insert into public.studio_limits as l (app, max_items, max_account_bytes, max_item_bytes, max_saves_per_hour, updated_at, updated_by)
    values (p_app, p_max_items, p_max_account_bytes, p_max_item_bytes, p_max_saves_per_hour, now(), v_actor)
    on conflict (app) do update set
      max_items = excluded.max_items, max_account_bytes = excluded.max_account_bytes,
      max_item_bytes = excluded.max_item_bytes, max_saves_per_hour = excluded.max_saves_per_hour,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    d := studio_limit_defaults(p_app);
    perform studio_limits_log('studio-limits-' || p_app, 'Space limits, ' || v_name || ': '
      || coalesce(p_max_items, (d->>'max_items')::int) || ' ' || v_word || ', '
      || studio_limit_mb(coalesce(p_max_account_bytes, (d->>'max_account_bytes')::bigint)) || ' MB in all, '
      || studio_limit_mb(coalesce(p_max_item_bytes, (d->>'max_item_bytes')::int)) || ' MB largest, '
      || coalesce(p_max_saves_per_hour, (d->>'max_saves_per_hour')::int) || ' saves an hour', v_actor);
  end if;
  return studio_limits_get();
end;
$$;
revoke all on function public.studio_limits_set(text, int, bigint, int, int) from public, anon;
grant execute on function public.studio_limits_set(text, int, bigint, int, int) to authenticated;

-- Admins: one member's own items and total space for one app, found by email (any case). A null uses the app's
-- value for that one; both null removes the member's own limits ("Back to standard"). Returns studio_limits_get().
create or replace function public.studio_member_limit_set(p_app text, p_email text, p_max_items int, p_max_account_bytes bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_email text;
  v_actor text;
  v_name text;
  v_word text;
  g public.studio_limits%rowtype;
  d jsonb;
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  if p_app is null or p_app not in ('art', 'sound') then
    raise exception 'Unknown app: %', coalesce(p_app, '(none)') using errcode = '22023';
  end if;
  select s.id, s.data->>'email' into v_id, v_email
  from public.subscribers s
  where lower(trim(s.data->>'email')) = lower(trim(coalesce(p_email, '')))
    and trim(coalesce(p_email, '')) <> ''
  order by (s.data->>'status' = 'published') desc nulls last, s.updated_at desc
  limit 1;
  if v_id is null then
    raise exception 'No member with the email %', trim(coalesce(p_email, '')) using errcode = '22023';
  end if;
  if p_max_items is not null and p_max_items not between 1 and 2000 then
    raise exception 'Items each member can save must be between 1 and 2,000.' using errcode = '22023';
  end if;
  if p_max_account_bytes is not null and p_max_account_bytes not between 1000000 and 1000000000 then
    raise exception 'Total space must be between 1 MB and 1,000 MB (1 GB).' using errcode = '22023';
  end if;

  v_name := case p_app when 'art' then 'Art Space' else 'Sound Space' end;
  v_word := case p_app when 'art' then 'pictures' else 'songs' end;
  v_actor := studio_limits_actor();
  if p_max_items is null and p_max_account_bytes is null then
    delete from public.studio_member_limits where app = p_app and subscriber_id = v_id;
    perform studio_limits_log('studio-limits-' || p_app || '-member', 'Space limits for ' || v_email || ', ' || v_name || ': back to standard', v_actor);
  else
    insert into public.studio_member_limits as m (app, subscriber_id, max_items, max_account_bytes, updated_at, updated_by)
    values (p_app, v_id, p_max_items, p_max_account_bytes, now(), v_actor)
    on conflict (app, subscriber_id) do update set
      max_items = excluded.max_items, max_account_bytes = excluded.max_account_bytes,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    d := studio_limit_defaults(p_app);
    g := null;
    select * into g from public.studio_limits where app = p_app;
    perform studio_limits_log('studio-limits-' || p_app || '-member', 'Space limits for ' || v_email || ', ' || v_name || ': '
      || coalesce(p_max_items, g.max_items, (d->>'max_items')::int) || ' ' || v_word || ', '
      || studio_limit_mb(coalesce(p_max_account_bytes, g.max_account_bytes, (d->>'max_account_bytes')::bigint)) || ' MB in all', v_actor);
  end if;
  return studio_limits_get();
end;
$$;
revoke all on function public.studio_member_limit_set(text, text, int, bigint) from public, anon;
grant execute on function public.studio_member_limit_set(text, text, int, bigint) to authenticated;

-- Admins: how Sound Space is used. Songs members keep in their accounts (deleted ones left out) and, for the chosen
-- number of days (0 or null: all time), the anonymous daily counts from sound_space_daily, with the same count for
-- the days just before (opened_before). by_member: each member with songs, newest first, with their effective
-- limits (their own over the app's over the usual ones) and whether they have their own (custom). Counts, sizes and
-- dates only, never the songs.
create or replace function public.sound_space_usage(range_days int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_days int := case when coalesce(range_days, 0) > 0 then least(range_days, 3650) else 0 end;
  v_since date;
  v_before date;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  d jsonb := studio_limit_defaults('sound');
  v_out jsonb;
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  v_since := case when v_days > 0 then v_today - (v_days - 1) else null end;
  v_before := case when v_days > 0 then v_since - v_days else null end;

  select jsonb_build_object(
    'range_days', v_days,
    'members', count(distinct p.subscriber_id),
    'songs', count(*),
    'bytes', coalesce(sum(p.bytes), 0),
    'new7', count(*) filter (where p.created_at >= now() - interval '7 days'),
    'new30', count(*) filter (where p.created_at >= now() - interval '30 days'),
    'active7', count(distinct p.subscriber_id) filter (where p.updated_ms >= v_now_ms - 7 * 86400000::bigint))
  into v_out
  from public.sound_projects p
  where not p.deleted;

  select v_out || jsonb_build_object(
    'opened', coalesce(sum(c.count) filter (where c.event = 'opened'), 0),
    'signin_shown', coalesce(sum(c.count) filter (where c.event = 'signin_shown'), 0),
    'signed_in', coalesce(sum(c.count) filter (where c.event = 'signed_in'), 0),
    'song_played', coalesce(sum(c.count) filter (where c.event = 'song_played'), 0),
    'song_exported', coalesce(sum(c.count) filter (where c.event = 'song_exported'), 0))
  into v_out
  from public.sound_space_daily c
  where v_since is null or c.day >= v_since;

  select v_out || jsonb_build_object('opened_before', case when v_days > 0 then coalesce(sum(c.count), 0) else 0 end)
  into v_out
  from public.sound_space_daily c
  where c.event = 'opened' and v_since is not null and c.day >= v_before and c.day < v_since;

  select v_out || jsonb_build_object('by_member', coalesce(jsonb_agg(jsonb_build_object(
      'email', s.data->>'email',
      'songs', b.songs,
      'first', b.first,
      'last', b.last,
      'bytes', b.bytes,
      'max_items', coalesce(ml.max_items, gl.max_items, (d->>'max_items')::int),
      'max_bytes', coalesce(ml.max_account_bytes, gl.max_account_bytes, (d->>'max_account_bytes')::bigint),
      'custom', ml.subscriber_id is not null)
    order by b.last desc, lower(s.data->>'email')), '[]'::jsonb))
  into v_out
  from (
    select p.subscriber_id, count(*) as songs, min(p.created_at) as first, max(p.updated_ms) as last, coalesce(sum(p.bytes), 0) as bytes
    from public.sound_projects p
    where not p.deleted
    group by p.subscriber_id
  ) b
  join public.subscribers s on s.id = b.subscriber_id
  left join public.studio_limits gl on gl.app = 'sound'
  left join public.studio_member_limits ml on ml.app = 'sound' and ml.subscriber_id = b.subscriber_id;

  return v_out;
end;
$$;
revoke all on function public.sound_space_usage(int) from public, anon;
grant execute on function public.sound_space_usage(int) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- REPLACES the live art_studio_usage(range_days): the admins' Art Space numbers. Everything it returned before stays
-- exactly the same (the body below is the live one, from pg_get_functiondef on 2026-11-14); the only additions are
-- three keys on each by_member row: max_items and max_bytes (that member's effective limits: their own over Art
-- Space's over the usual 200 pictures and 100 MB) and custom (whether they have their own). by_member is grouped by
-- email, as before; if two subscriber rows ever share an email, the most recently changed own limits are shown.
-- search_path gains pg_temp; security definer, stable, the is_active_admin() check ('not allowed', 42501), the
-- 7/30/90/all ranges and the America/New_York day are unchanged.
create or replace function public.art_studio_usage(range_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  tz constant text := 'America/New_York';
  today date := (now() at time zone tz)::date;
  since date;
  prev_since date;
  result jsonb;
begin
  if not is_active_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if range_days is not null and range_days not in (7, 30, 90) then range_days := 30; end if;
  since := case when range_days is null then null else today - (range_days - 1) end;
  prev_since := case when range_days is null then null else since - range_days end;

  with live as (
    select a.*, (a.created_at at time zone tz)::date as made_day
    from art_projects a join subscribers s on s.id = a.subscriber_id
    where not a.deleted and s.data->>'status' = 'published'
  ),
  in_range as (select * from live where since is null or made_day >= since),
  per_member_days as (
    select subscriber_id, count(distinct made_day) as days from in_range group by subscriber_id
  ),
  counts as (
    select event, sum(count)::int as n from art_studio_daily
    where since is null or day >= since group by event
  ),
  prev_open as (
    select coalesce(sum(count), 0)::int as n from art_studio_daily
    where event = 'opened' and prev_since is not null and day >= prev_since and day < since
  ),
  weeks as (
    select generate_series(date_trunc('week', today::timestamp)::date - 49, date_trunc('week', today::timestamp)::date, interval '7 days')::date as wk
  ),
  week_rows as (
    select w.wk,
      coalesce((select sum(d.count) from art_studio_daily d where d.event = 'opened' and d.day >= w.wk and d.day < w.wk + 7), 0)::int as opened,
      coalesce((select count(*) from live l where l.made_day >= w.wk and l.made_day < w.wk + 7), 0)::int as saved
    from weeks w
  ),
  members as (
    select s.data->>'email' as email,
      count(*)::int as pictures,
      count(*) filter (where l.kind = 'paint')::int as paint,
      count(*) filter (where l.kind = 'pixel')::int as pixel,
      min(l.created_at) as first_at,
      max(l.updated_ms)::bigint as last_ms,
      coalesce(sum(l.bytes), 0)::bigint as bytes,
      array_agg(distinct l.subscriber_id) as sids
    from live l join subscribers s on s.id = l.subscriber_id
    group by s.data->>'email'
  ),
  art_row as (
    select g.max_items, g.max_account_bytes from studio_limits g where g.app = 'art'
  ),
  member_limits as (
    select m.*,
      coalesce(o.max_items, (select max_items from art_row), 200) as max_items,
      coalesce(o.max_account_bytes, (select max_account_bytes from art_row), 100000000)::bigint as max_bytes,
      o.subscriber_id is not null as custom
    from members m
    left join lateral (
      select x.subscriber_id, x.max_items, x.max_account_bytes from studio_member_limits x
      where x.app = 'art' and x.subscriber_id = any(m.sids)
      order by x.updated_at desc limit 1
    ) o on true
  )
  select jsonb_build_object(
    'range', range_days,
    'today', today,
    'opened', coalesce((select n from counts where event = 'opened'), 0),
    'opened_before', (select n from prev_open),
    'signin_shown', coalesce((select n from counts where event = 'signin_shown'), 0),
    'signed_in', coalesce((select n from counts where event = 'signed_in'), 0),
    'joined', coalesce((select n from counts where event = 'joined'), 0),
    'came_back_members', (select count(*) from per_member_days where days >= 2),
    'active_members', (select count(*) from per_member_days),
    'members', (select count(distinct subscriber_id) from live),
    'active7', (select count(distinct subscriber_id) from live where updated_ms > (extract(epoch from now() - interval '7 days') * 1000)),
    'pictures', (select count(*) from live),
    'paint', (select count(*) from live where kind = 'paint'),
    'pixel', (select count(*) from live where kind = 'pixel'),
    'new7', (select count(*) from live where made_day > today - 7),
    'new30', (select count(*) from live where made_day > today - 30),
    'bytes', (select coalesce(sum(bytes), 0) from live),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'opened', opened, 'saved', saved) order by wk), '[]'::jsonb) from week_rows),
    'by_member', (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'pictures', pictures, 'paint', paint, 'pixel', pixel,
                   'first', first_at, 'last', last_ms, 'bytes', bytes,
                   'max_items', max_items, 'max_bytes', max_bytes, 'custom', custom) order by last_ms desc), '[]'::jsonb) from member_limits)
  ) into result;
  return result;
end $function$;
revoke all on function public.art_studio_usage(integer) from public, anon;
grant execute on function public.art_studio_usage(integer) to authenticated;
