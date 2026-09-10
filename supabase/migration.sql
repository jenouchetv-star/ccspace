-- Chike's Creative Space - Supabase schema migration
-- Run this once in the Supabase SQL Editor (Project: wdctkfhwygwwulipwnys)
-- before running scripts/seed-supabase.mjs.
--
-- Every collection is stored as one table: id text primary key + data jsonb.
-- The app already does all its filtering/sorting client-side in JS, so this
-- keeps every row byte-for-byte the same shape the app already expects,
-- rather than hand-mapping 21 differently-shaped collections into typed
-- columns. See the migration plan for the full rationale.
--
-- RLS is intentionally permissive (anon can select/insert/update/delete on
-- everything): this app has no authentication system today, so this matches
-- its existing zero-auth trust model - just shared globally now instead of
-- per-browser. Anyone with the anon key (which ships in the page source,
-- same as any client-side Supabase app) can read and write every table
-- below via raw REST calls, not only through the app's own UI. Revisit
-- before any real public launch.

create extension if not exists pgcrypto;

-- One row per table, named after the pattern below. Run this block once
-- per table, substituting the table name.
--
--   create table <name> (
--     id text primary key,
--     data jsonb not null,
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now()
--   );
--   alter table <name> enable row level security;
--   grant select, insert, update, delete on <name> to anon;
--   create policy "anon full access" on <name> for all to anon using (true) with check (true);
--
-- Spelled out for all 19 backed collections + the meta singleton below.

do $$
declare
  t text;
  tables text[] := array[
    'users', 'activities', 'pages', 'articles', 'subscribers', 'games',
    'videos', 'stories', 'characters', 'products', 'amazon_products',
    'collections', 'story_submissions', 'announcements', 'homepage_modules',
    'media_assets', 'support_tickets', 'audit_log', 'issues', 'meta'
  ];
begin
  foreach t in array tables loop
    execute format('
      create table if not exists %I (
        id text primary key,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );', t);
    execute format('alter table %I enable row level security;', t);
    execute format('grant select, insert, update, delete on %I to anon;', t);
    execute format('
      drop policy if exists "anon full access" on %I;
      create policy "anon full access" on %I for all to anon using (true) with check (true);
    ', t, t);
  end loop;
end $$;

-- stories.data also carries an optional "pages" array as of the admin
-- book builder (see docs/superpowers/specs/2026-09-07-book-builder-design.md):
--   pages: [{ id, background:{type,value}, layers:[{id,type,...}] }, ...]
-- No column change needed - this is just documentation for a key inside
-- the existing jsonb "data" column.

-- ---------------------------------------------------------------------
-- Launch Readiness Checklist (added after the initial migration above) -
-- one more table, same id/data/RLS pattern, for the launchReadiness
-- collection (70 seeded tasks across 14 categories).
do $$
begin
  create table if not exists launch_readiness (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  alter table launch_readiness enable row level security;
  grant select, insert, update, delete on launch_readiness to anon;
  drop policy if exists "anon full access" on launch_readiness;
  create policy "anon full access" on launch_readiness for all to anon using (true) with check (true);
end $$;

-- Confirm every table exists and RLS is on, before running the seed script.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = any(array[
    'users', 'activities', 'pages', 'articles', 'subscribers', 'games',
    'videos', 'stories', 'characters', 'products', 'amazon_products',
    'collections', 'story_submissions', 'announcements', 'homepage_modules',
    'media_assets', 'support_tickets', 'audit_log', 'issues', 'meta',
    'launch_readiness'
  ])
order by tablename;

-- ---------------------------------------------------------------------
-- Real admin auth, phase 1: additive schema only (see the plan in
-- ~/.claude/plans - "Real admin login with secure invites"). Nothing on
-- any table above is touched by this block - it only adds a new
-- `profiles` table, a status-check helper, an auto-provisioning trigger,
-- and two guarded RPCs. Safe to run any time; the app keeps working
-- exactly as it does today (AdminGate + the open anon RLS above) until
-- the client-side auth UI and the RLS-rewrite phases land in a later
-- pass. This is deliberately its own block, not folded into the anon
-- "full access" pattern above - `profiles` is the one table that must
-- never be anon-writable, since it is what everything else will end up
-- trusting to decide who is an admin.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
-- Any authenticated user may read the roster (needed for the Admins
-- screen's list view) - nobody unauthenticated can read it at all, and
-- writes never go through a generic policy, only the guarded RPCs below.
drop policy if exists "authenticated read" on profiles;
create policy "authenticated read" on profiles for select to authenticated using (true);

-- Reused by every other table's RLS in the later cutover phase, and by
-- the invite Edge Function to authorize its caller.
create or replace function is_active_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'active'
  );
$$;

-- Fires for both paths that create an auth.users row - the invite Edge
-- Function and the one manual dashboard bootstrap - so both end up with
-- a matching profiles row through the same mechanism, no double-insert
-- logic needed in either caller.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'invited'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Self-service: an invited user calls this once, right after setting
-- their password on the accept-invite screen, to activate their own
-- account. Nobody can activate someone else's account with this.
create or replace function public.accept_invite() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set status = 'active', updated_at = now()
  where id = auth.uid() and status = 'invited';
end;
$$;

-- Revoke / reinstate another admin. Requires the caller to already be an
-- active admin, and explicitly forbids changing your own status so
-- nobody can accidentally lock themselves out.
create or replace function public.set_user_status(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  if new_status not in ('active', 'revoked') then
    raise exception 'invalid status';
  end if;
  if target_id = auth.uid() then
    raise exception 'cannot change your own status';
  end if;
  update public.profiles set status = new_status, updated_at = now()
  where id = target_id;
end;
$$;

-- Permanently remove another admin's account - not just revoke access,
-- the account itself. Deleting the auth.users row (rather than just the
-- profiles row) is deliberate: profiles.id references auth.users(id) on
-- delete cascade, so this one delete removes both in one step and never
-- leaves an orphaned auth identity with no matching profile behind. Same
-- guards as set_user_status: caller must already be an active admin, and
-- can never delete their own account.
create or replace function public.delete_admin(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_active_admin() then
    raise exception 'not authorized';
  end if;
  if target_id = auth.uid() then
    raise exception 'cannot delete your own account';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

-- Confirm the new schema landed before moving to phase 2 (the manual
-- dashboard bootstrap of the first real admin account).
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='profiles') as profiles_table_exists,
  (select count(*) from pg_proc where proname='is_active_admin') as fn_is_active_admin,
  (select count(*) from pg_proc where proname='handle_new_user') as fn_handle_new_user,
  (select count(*) from pg_proc where proname='accept_invite') as fn_accept_invite,
  (select count(*) from pg_proc where proname='set_user_status') as fn_set_user_status,
  (select count(*) from pg_trigger where tgname='on_auth_user_created') as trigger_exists;

-- ---------------------------------------------------------------------
-- Own-profile editing + a quick-access PIN (added after the initial auth
-- rollout above). The PIN is deliberately NOT a second password: it only
-- ever unlocks a session that is already fully authenticated and merely
-- gone idle in the browser (see index.html's idle-lock screen) - it can
-- never establish a new session from a signed-out state, which is the
-- only reason a 4-6 digit PIN is an acceptable trade-off here at all.
-- Hashed with pgcrypto (already enabled above), never stored or compared
-- in plain text, and rate-limited: 5 wrong attempts locks it for 5
-- minutes, tracked server-side so the limit can't be bypassed by simply
-- not sending failed attempts from the client.

alter table profiles add column if not exists pin_hash text;
alter table profiles add column if not exists pin_fail_count integer not null default 0;
alter table profiles add column if not exists pin_locked_until timestamptz;

create or replace function public.update_own_profile(new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set name = trim(new_name), updated_at = now() where id = auth.uid();
end;
$$;

create or replace function public.set_own_pin(pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if pin !~ '^[0-9]{4}$' and pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be exactly 4 or 6 digits';
  end if;
  update public.profiles set
    pin_hash = crypt(pin, gen_salt('bf')),
    pin_fail_count = 0, pin_locked_until = null, updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.clear_own_pin() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    pin_hash = null, pin_fail_count = 0, pin_locked_until = null, updated_at = now()
  where id = auth.uid();
end;
$$;

-- Returns true/false rather than raising on a wrong PIN, so the client
-- can show a normal "that's not right" message - it still raises for the
-- two states the client should never normally hit (no PIN set at all,
-- currently locked out), since those are bugs in the caller, not a user
-- mistyping their PIN.
create or replace function public.verify_own_pin(pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  rec record;
  ok boolean;
begin
  select pin_hash, pin_fail_count, pin_locked_until into rec
  from public.profiles where id = auth.uid();

  if rec.pin_hash is null then
    raise exception 'No PIN set';
  end if;
  if rec.pin_locked_until is not null and rec.pin_locked_until > now() then
    raise exception 'Too many attempts - try again later';
  end if;

  ok := (rec.pin_hash = crypt(pin, rec.pin_hash));
  if ok then
    update public.profiles set pin_fail_count = 0, pin_locked_until = null where id = auth.uid();
  else
    update public.profiles set
      pin_fail_count = pin_fail_count + 1,
      pin_locked_until = case when pin_fail_count + 1 >= 5 then now() + interval '5 minutes' else pin_locked_until end
    where id = auth.uid();
  end if;
  return ok;
end;
$$;

select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='pin_hash') as pin_hash_column_exists,
  (select count(*) from pg_proc where proname='update_own_profile') as fn_update_own_profile,
  (select count(*) from pg_proc where proname='set_own_pin') as fn_set_own_pin,
  (select count(*) from pg_proc where proname='verify_own_pin') as fn_verify_own_pin;

-- ---------------------------------------------------------------------
-- URGENT FIX: the original "anon full access" policies (top of this
-- file) are scoped `to anon` only. Now that real admin logins exist,
-- a signed-in admin's requests go out as the `authenticated` role
-- instead of `anon` - and since no policy ever granted `authenticated`
-- anything, RLS silently returns zero rows for every table to anyone
-- signed in (no error - just an empty result), which is exactly what
-- made the whole site look empty for a logged-in admin.
--
-- This is a stop-gap, not the real fix: it restores `authenticated` to
-- the SAME permissive access `anon` already has (no security change -
-- the anon key already grants this to literally anyone), so logging in
-- stops being strictly worse than staying signed out. The real fix -
-- splitting these into public-read-only vs admin-only per table, and
-- finally revoking anon's write access - is the RLS-cutover phase of
-- the auth plan, still to come.

do $$
declare
  t text;
  tables text[] := array[
    'users', 'activities', 'pages', 'articles', 'subscribers', 'games',
    'videos', 'stories', 'characters', 'products', 'amazon_products',
    'collections', 'story_submissions', 'announcements', 'homepage_modules',
    'media_assets', 'support_tickets', 'audit_log', 'issues', 'meta',
    'launch_readiness'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
    execute format('
      drop policy if exists "anon full access" on %I;
      drop policy if exists "anon and authenticated full access" on %I;
      create policy "anon and authenticated full access" on %I
        for all to anon, authenticated using (true) with check (true);
    ', t, t, t);
  end loop;
end $$;

-- Confirm every table's policy now covers both roles.
select tablename, policyname, roles
from pg_policies
where schemaname = 'public' and policyname = 'anon and authenticated full access'
order by tablename;

-- ---------------------------------------------------------------------
-- Server-side rate limiting and fake-email blocking for support_tickets
-- and subscribers.
--
-- index.html already gates both forms client-side (ticketGate()/
-- newsletterGate() - a honeypot field, a minimum-time-open check, a
-- cooldown, and a daily cap), but that is only JavaScript: anyone
-- calling this project's REST API directly with the anon key (which
-- ships in the page source, same as any client-side Supabase app)
-- bypasses all of it. These BEFORE INSERT triggers are the layer that
-- actually can't be bypassed with just the anon key - they run inside
-- Postgres itself, regardless of how the insert arrived.
--
-- Deliberately triggers, not a rewrite of the "anon and authenticated
-- full access" policies above: RLS policies for the same command are
-- OR'd together, so a second, stricter INSERT policy alongside that
-- existing permissive one would have no effect. A trigger runs after
-- RLS already permitted the row and can still reject it, which is
-- exactly the enforcement point needed here without touching the
-- existing policy structure at all.
--
-- Each check is scoped per submitter email (not per-browser, since a
-- bot has no browser to scope by) plus one global cap per table as a
-- flood backstop against many different fake addresses at once. A
-- rejected insert raises a plain-language exception; db.add() in
-- index.html already toasts error.message on any insert failure, so
-- the visitor sees exactly why their message didn't go through with
-- no client-side change needed.

-- Mirrors isFakeEmail() in index.html (same disposable-domain list, same
-- fake-local-part pattern, same repeated-character check) so a bot that
-- skips the page's own JS validation and posts straight to the REST API
-- still can't get a placeholder/test address into either table. Keep
-- this list in sync with index.html's DISPOSABLE_EMAIL_DOMAINS /
-- FAKE_EMAIL_LOCAL_PARTS if either one changes.
create or replace function is_fake_email(email text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  at_pos int := position('@' in email);
  local_part text;
  domain_part text;
  disposable_domains text[] := array[
    'test.com','example.com','example.org','example.net',
    'mailinator.com','guerrillamail.com','yopmail.com','tempmail.com','temp-mail.org',
    'throwawaymail.com','trashmail.com','10minutemail.com','discard.email','fake.com',
    'notreal.com','sample.com','spam.com','dontsendmemail.com'
  ];
begin
  if at_pos = 0 then
    return true;
  end if;
  local_part := lower(substring(email from 1 for at_pos - 1));
  domain_part := lower(substring(email from at_pos + 1));

  if domain_part = any(disposable_domains) then
    return true;
  end if;
  if local_part ~ '^(test|fake|asdf|admin|noreply|no-reply|spam|abc|xxx|sample|example|foo|bar|foobar|user|someone|anonymous)[0-9]*$' then
    return true;
  end if;
  -- the same single character repeated the whole way through, e.g. "aaaa"
  if length(local_part) >= 3
     and local_part = repeat(substring(local_part from 1 for 1), length(local_part)) then
    return true;
  end if;
  -- the same pair of characters repeated the whole way through, e.g. "xyxyxy"
  if length(local_part) >= 6 and length(local_part) % 2 = 0
     and local_part = repeat(substring(local_part from 1 for 2), length(local_part) / 2) then
    return true;
  end if;
  return false;
end;
$$;

create or replace function enforce_support_ticket_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submitter_email text := lower(trim(new.data->>'email'));
  recent_count int;
begin
  /* Only real submissions carry an email (the client already requires one
     before it will call db.add()); seed data and any pre-email-field
     import never should, and never should be blocked from loading, so the
     per-email checks are skipped rather than treating a missing email as
     a violation. The global flood cap below still applies either way. */
  if submitter_email is not null and submitter_email <> '' then
    if is_fake_email(submitter_email) then
      raise exception 'Please use a real email address, not a placeholder or test one.';
    end if;

    select count(*) into recent_count from support_tickets
      where lower(data->>'email') = submitter_email
        and created_at > now() - interval '5 minutes';
    if recent_count > 0 then
      raise exception 'Please wait a few minutes before sending another message.';
    end if;

    select count(*) into recent_count from support_tickets
      where lower(data->>'email') = submitter_email
        and created_at > now() - interval '24 hours';
    if recent_count >= 5 then
      raise exception 'Daily message limit reached for this address. Please try again tomorrow.';
    end if;
  end if;

  select count(*) into recent_count from support_tickets
    where created_at > now() - interval '1 hour';
  if recent_count >= 50 then
    raise exception 'The support queue is receiving an unusually high volume right now. Please try again shortly.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_ticket_rate_limit on support_tickets;
create trigger trg_support_ticket_rate_limit
  before insert on support_tickets
  for each row execute function enforce_support_ticket_rate_limit();

create or replace function enforce_subscriber_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submitter_email text := lower(trim(new.data->>'email'));
  recent_count int;
begin
  /* Same reasoning as enforce_support_ticket_rate_limit(): skip the
     per-email checks rather than block on a missing email, so seed data
     and any pre-email-field import can never be locked out by this
     trigger. The global flood cap below still applies either way. */
  if submitter_email is not null and submitter_email <> '' then
    if is_fake_email(submitter_email) then
      raise exception 'Please use a real email address, not a placeholder or test one.';
    end if;

    -- Blocks a genuine duplicate active subscription (the client's own
    -- "already on the list?" check can never see this anymore now that
    -- subscribers is admin-only under RLS - a public visitor's local
    -- cache is always empty, so that check silently never fired). This
    -- is the real enforcement point, and also closes the same gap for
    -- anyone bypassing the app's UI with just the anon key.
    if exists (
      select 1 from subscribers
      where lower(data->>'email') = submitter_email
        and data->>'status' = 'published'
    ) then
      raise exception 'This email address is already subscribed.';
    end if;

    select count(*) into recent_count from subscribers
      where lower(data->>'email') = submitter_email
        and created_at > now() - interval '20 seconds';
    if recent_count > 0 then
      raise exception 'Please wait a moment before trying again.';
    end if;

    select count(*) into recent_count from subscribers
      where lower(data->>'email') = submitter_email
        and created_at > now() - interval '24 hours';
    if recent_count >= 5 then
      raise exception 'Too many attempts for this address today. Please try again tomorrow.';
    end if;
  end if;

  select count(*) into recent_count from subscribers
    where created_at > now() - interval '1 hour';
  if recent_count >= 100 then
    raise exception 'Signups are receiving an unusually high volume right now. Please try again shortly.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subscriber_rate_limit on subscribers;
create trigger trg_subscriber_rate_limit
  before insert on subscribers
  for each row execute function enforce_subscriber_rate_limit();

-- Verify both triggers are actually attached before relying on them.
select event_object_table, trigger_name
from information_schema.triggers
where trigger_name in ('trg_support_ticket_rate_limit', 'trg_subscriber_rate_limit')
order by event_object_table;

-- ---------------------------------------------------------------------
-- RLS CUTOVER (the "real fix" the URGENT FIX comment above deferred).
--
-- Confirmed exploitable before this ran: a plain, unauthenticated REST
-- call using only the public anon key (the same one that ships in
-- index.html's own source, copyable by anyone) returned real subscriber
-- emails, the one retained child story submission in full (a parent's
-- email, the child's first name, city, and state), support tickets, and
-- rows from the admin audit log. The same "anon and authenticated full
-- access" policy also granted UPDATE/DELETE on every table to that same
-- unauthenticated request, admin login UI notwithstanding.
--
-- Three categories from here on:
--   1. Public content - anyone may read; only a signed-in, active admin
--      (is_active_admin(), defined earlier in this file) may write.
--   2. Public forms - anyone may submit (insert only); only an active
--      admin may read the list back, edit, or delete an entry.
--   3. Admin-only internals - anon gets nothing at all, in either
--      direction.
-- Every table also stops trusting mere `authenticated` on its own -
-- an invited-but-not-yet-active admin account authenticates fine but
-- is_active_admin() is false for it until accept_invite() runs, so it
-- gets the same access as everyone else until then.

do $$
declare
  t text;
  tables text[] := array[
    'activities','pages','articles','games','videos','stories',
    'characters','products','amazon_products','collections',
    'announcements','homepage_modules','media_assets','meta'
  ];
begin
  foreach t in array tables loop
    execute format('revoke insert, update, delete on %I from anon;', t);
    execute format('grant select on %I to anon;', t);
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
    execute format('drop policy if exists "anon full access" on %I;', t);
    execute format('drop policy if exists "anon and authenticated full access" on %I;', t);
    execute format('drop policy if exists "public read" on %I;', t);
    execute format('drop policy if exists "admin insert" on %I;', t);
    execute format('drop policy if exists "admin update" on %I;', t);
    execute format('drop policy if exists "admin delete" on %I;', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true);', t);
    execute format('create policy "admin insert" on %I for insert to authenticated with check (is_active_admin());', t);
    execute format('create policy "admin update" on %I for update to authenticated using (is_active_admin()) with check (is_active_admin());', t);
    execute format('create policy "admin delete" on %I for delete to authenticated using (is_active_admin());', t);
  end loop;
end $$;

do $$
declare
  t text;
  tables text[] := array['subscribers','support_tickets'];
begin
  foreach t in array tables loop
    execute format('revoke select, update, delete on %I from anon;', t);
    execute format('grant insert on %I to anon;', t);
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
    execute format('drop policy if exists "anon full access" on %I;', t);
    execute format('drop policy if exists "anon and authenticated full access" on %I;', t);
    execute format('drop policy if exists "public insert" on %I;', t);
    execute format('drop policy if exists "admin read" on %I;', t);
    execute format('drop policy if exists "admin insert" on %I;', t);
    execute format('drop policy if exists "admin update" on %I;', t);
    execute format('drop policy if exists "admin delete" on %I;', t);
    execute format('create policy "public insert" on %I for insert to anon with check (true);', t);
    execute format('create policy "admin read" on %I for select to authenticated using (is_active_admin());', t);
    execute format('create policy "admin insert" on %I for insert to authenticated with check (is_active_admin());', t);
    execute format('create policy "admin update" on %I for update to authenticated using (is_active_admin()) with check (is_active_admin());', t);
    execute format('create policy "admin delete" on %I for delete to authenticated using (is_active_admin());', t);
  end loop;
end $$;

-- story_submissions gets the strictest category, not the public-insert
-- one: the "Write a story" feature that used to write to it has been
-- fully removed from index.html this session (no route, no form, no
-- ACTIONS handler left anywhere), so there is no longer any legitimate
-- reason for anon to insert here at all. The one already-stored child
-- submission stays in the table untouched, per the site owner's explicit
-- choice - just no longer reachable by anyone without an active admin
-- session, in-app or via raw REST.
do $$
declare
  t text;
  tables text[] := array['audit_log','issues','launch_readiness','story_submissions'];
begin
  foreach t in array tables loop
    execute format('revoke select, insert, update, delete on %I from anon;', t);
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
    execute format('drop policy if exists "anon full access" on %I;', t);
    execute format('drop policy if exists "anon and authenticated full access" on %I;', t);
    execute format('drop policy if exists "admin only" on %I;', t);
    execute format('create policy "admin only" on %I for all to authenticated using (is_active_admin()) with check (is_active_admin());', t);
  end loop;
end $$;

-- The pre-real-auth "users" table: never migrated to real accounts (see
-- profiles instead, set up earlier in this file), and no code in
-- index.html reads or writes it any more - confirmed by grep before
-- this ran. Dropping it removes an open anon-writable surface that
-- served no purpose.
drop table if exists users;

-- Verify: no table should still carry the old wide-open policy, and
-- every table should show row security enabled.
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
  and policyname in ('anon full access', 'anon and authenticated full access');

select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- ---------------------------------------------------------------------
-- notify Edge Function triggers - fires the "notify" function (Resend
-- emails, via https://resend.com) after every insert into support_tickets
-- (new contact/business message -> alert the site's inbox) or subscribers
-- (new newsletter signup -> welcome email). See
-- supabase/functions/notify/index.ts and supabase/deploy-notify.ps1 for
-- the function itself and how to deploy and configure it - this is just
-- the trigger side that calls it.
--
-- pg_net's http_post is fire-and-forget from Postgres's point of view - it
-- queues the request and returns immediately, so a Resend outage or a
-- typo'd URL can never fail or slow down the insert itself (the visitor's
-- form submission always succeeds regardless of email delivery). Check
-- net._http_response for delivery status if an email seems to be missing.
--
-- BEFORE RUNNING: replace both placeholders below.
--   <FUNCTION_URL>    the deployed function's URL - normally
--                      https://wdctkfhwygwwulipwnys.supabase.co/functions/v1/notify
--   <WEBHOOK_SECRET>  the exact same random string set with
--                      `supabase secrets set WEBHOOK_SECRET=...` (see
--                      deploy-notify.ps1) - this is what stops anyone else
--                      on the internet from calling the function directly
--                      and sending mail through your Resend account.
--
-- The trigger passes NEW.data, not row_to_json(NEW) - every backed table in
-- this app is shaped {id, data jsonb, created_at, updated_at}, and notify's
-- own code reads fields straight off the top level of "record" (record.email,
-- record.subject, ...), which only lines up with the data column's contents,
-- not the whole row. Confirmed live: row_to_json(NEW) produced a real
-- "No email on this record" 400 from every trigger-fired call until this was
-- fixed - check net._http_response for a 400 with that message if new
-- signups/tickets silently stop generating email after any future change here.

create extension if not exists pg_net;

create or replace function notify_edge_function()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := '<FUNCTION_URL>',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', NEW.data)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_ticket on support_tickets;
create trigger trg_notify_new_ticket
  after insert on support_tickets
  for each row execute function notify_edge_function();

drop trigger if exists trg_notify_new_subscriber on subscribers;
create trigger trg_notify_new_subscriber
  after insert on subscribers
  for each row execute function notify_edge_function();

-- Verify both triggers are attached before relying on them.
select event_object_table, trigger_name
from information_schema.triggers
where trigger_name in ('trg_notify_new_ticket', 'trg_notify_new_subscriber')
order by event_object_table;

-- ---------------------------------------------------------------------
-- notifications table - a small, general-purpose admin notification feed
-- (unread/read, a message, an optional link into the portal). Unsubscribe
-- events are the first thing that writes to it (see
-- unsubscribe_newsletter() below), but the shape is generic on purpose so
-- a later event type (a new support ticket, say) is just another insert,
-- not a new system. Admin-only, same category as newsletters/audit_log/
-- issues - never anon-readable, since these are internal operational
-- alerts, not public content.
create table if not exists notifications (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table notifications enable row level security;
grant select, insert, update, delete on notifications to authenticated;
drop policy if exists "admin only" on notifications;
create policy "admin only" on notifications for all to authenticated using (is_active_admin()) with check (is_active_admin());

-- ---------------------------------------------------------------------
-- unsubscribe_newsletter() - the one narrow, deliberate hole in the
-- otherwise fully admin-only subscribers table (see the RLS cutover
-- above). A newsletter sent through supabase/functions/send-newsletter
-- has to give every recipient a real, working way to opt out - that's
-- not optional for bulk email, legally or otherwise - but the RLS
-- cutover already correctly took anon's DELETE off subscribers entirely.
-- A security definer function is the standard way to carve out exactly
-- one safe action (nothing else) without reopening the table itself.
--
-- Soft-delete, not a real delete: the row's status flips to
-- "unsubscribed" with a real timestamp, so the admin panel keeps a
-- genuine record of who opted out and when, instead of the row silently
-- vanishing. It also drops one notification row so the admin's
-- notification bell picks it up. Guarded on the row's current status, not
-- just its existence, so a reused or already-processed unsubscribe link
-- silently no-ops instead of refreshing the timestamp or spawning a
-- duplicate notification every time it's clicked again.
create or replace function public.unsubscribe_newsletter(target_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  sub_email text;
begin
  select data->>'email' into sub_email from subscribers
    where id = target_id and coalesce(data->>'status', '') = 'published';
  if sub_email is null then
    return;
  end if;

  update subscribers
    set data = data || jsonb_build_object('status', 'unsubscribed', 'unsubscribedAt', now(), 'updatedAt', now())
    where id = target_id;

  insert into notifications (id, data) values (
    'notif-' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object(
      'type', 'unsubscribe',
      'message', sub_email || ' unsubscribed from the newsletter',
      'link', '#/admin/subscribers',
      'read', false,
      'createdAt', now(),
      'updatedAt', now()
    )
  );
end;
$$;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- newsletters table - saved/reusable newsletters (draft, scheduled, sent,
-- or failed), same id/data/RLS shape as launch_readiness above, but
-- admin-only from the start (never anon-readable or anon-writable - this
-- is operational content, not public site content). See index.html's
-- adminSendNewsletter() and the ACTIONS handlers prefixed "nl-" for the
-- client side of this.
create table if not exists newsletters (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table newsletters enable row level security;
grant select, insert, update, delete on newsletters to authenticated;
drop policy if exists "admin only" on newsletters;
create policy "admin only" on newsletters for all to authenticated using (is_active_admin()) with check (is_active_admin());

-- ---------------------------------------------------------------------
-- Scheduled newsletter sends - pg_cron checks every minute for anything
-- due and hands it to the send-scheduled-newsletters Edge Function, the
-- same fire-and-forget net.http_post()/x-webhook-secret pattern as the
-- notify triggers above, just fired by a schedule instead of an insert.
-- No admin is logged in when this fires, so the function authenticates
-- the caller (this cron job) with the same WEBHOOK_SECRET already set for
-- notify/send-newsletter, not a user session.
--
-- BEFORE RUNNING: replace both placeholders below, same as the notify
-- trigger block.
--   <FUNCTION_URL>    the deployed function's URL - normally
--                      https://wdctkfhwygwwulipwnys.supabase.co/functions/v1/send-scheduled-newsletters
--   <WEBHOOK_SECRET>  the exact same value already set for notify/
--                      send-newsletter - reused here, not a new secret.
--
-- Two things confirmed broken in production when this was first wired up,
-- both silent (the job just failed every minute with nothing visible in
-- the app) - fix both or scheduled sends never fire at all:
--   1. pg_net was never actually enabled on this project (the create
--      extension line near the notify trigger above was apparently never
--      run against production) - every run failed with 'schema "net"
--      does not exist' until `create extension if not exists pg_net;`
--      below was run for real.
--   2. send-scheduled-newsletters MUST be deployed with --no-verify-jwt:
--      npx supabase functions deploy send-scheduled-newsletters --no-verify-jwt
--      pg_cron's net.http_post() has no way to attach a Supabase session
--      JWT, so Supabase's platform-level JWT gate 401s every cron-fired
--      call before the function's own x-webhook-secret check ever runs,
--      if this flag is left off (it defaults to requiring a JWT).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'send-scheduled-newsletters';
select cron.schedule(
  'send-scheduled-newsletters',
  '* * * * *',
  $$
  select net.http_post(
    url := '<FUNCTION_URL>',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job is scheduled before relying on it.
select jobname, schedule, active from cron.job where jobname = 'send-scheduled-newsletters';

-- ---------------------------------------------------------------------
-- Storage RLS for the "uploads" bucket (used by uploadToStorage() in
-- index.html - book builder backgrounds, media library uploads, and
-- generic file/media fields in the admin editor). This bucket predates
-- the real-auth cutover above and was left on an "anon full access"
-- policy the whole time - once admins started signing in for real (as
-- the "authenticated" role, not "anon"), every upload started failing
-- with "new row violates row-level security policy", since no policy
-- ever existed for "authenticated". Every call site that uploads here
-- is admin-only (confirmed by reading every uploadToStorage() call in
-- index.html), so this replaces the anon policy rather than adding
-- alongside it - matching every other admin-write resource in this
-- project, not leaving a redundant anon-write hole next to it.
drop policy if exists "anon full access" on storage.objects;
create policy "active admin full access" on storage.objects
  for all to authenticated
  using (bucket_id = 'uploads' and is_active_admin())
  with check (bucket_id = 'uploads' and is_active_admin());

-- ---------------------------------------------------------------------
-- blocked_senders - the submit-ticket Edge Function's moderation blocklist.
-- A contact/business message that matches its deterministic profanity/
-- slur/violent-language filter is rejected and never reaches
-- support_tickets; that sender's email and IP are recorded here, and every
-- future call checks this table first (before Turnstile even runs) and
-- refuses outright. Admin-only, same category as newsletters/audit_log -
-- never anon-readable or anon-writable. submit-ticket itself reads/writes
-- this table with the service-role key (see SUPABASE_SERVICE_ROLE_KEY in
-- its README), not the anon key, since a visitor's own request must never
-- be able to read or forge the blocklist.
create table if not exists blocked_senders (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table blocked_senders enable row level security;
grant select, insert, update, delete on blocked_senders to authenticated;
drop policy if exists "admin only" on blocked_senders;
create policy "admin only" on blocked_senders for all to authenticated using (is_active_admin()) with check (is_active_admin());

-- Both blocked_senders and moderation_terms below are managed from the
-- live admin portal (#/admin/moderation - block/unblock a sender by hand,
-- add/remove an extra banned term) by any signed-in active admin, not just
-- from the SQL Editor - is_active_admin() is exactly the same check that
-- gates every other admin-only table, so an invited admin who has never
-- touched Supabase directly can manage both from the app itself. The SQL
-- below is a fallback/inspection path, not the primary way to use these.

-- To unblock someone (e.g. a false positive), run this in the SQL Editor:
--   delete from blocked_senders where data->>'email' = 'someone@example.com';
-- To review current blocks:
--   select data->>'email' as email, data->>'ip' as ip, data->>'reason' as reason,
--          data->>'subject' as subject, created_at
--   from blocked_senders order by created_at desc;

-- ---------------------------------------------------------------------
-- moderation_terms - admin-added banned words/phrases, on top of
-- submit-ticket's own fixed, in-code baseline filter (BANNED_TERMS in
-- supabase/functions/submit-ticket/index.ts, never exposed to the
-- browser). submit-ticket reads this table with the service-role key on
-- every request and merges it into that baseline before checking a
-- message - same admin-only category and access pattern as
-- blocked_senders above.
create table if not exists moderation_terms (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table moderation_terms enable row level security;
grant select, insert, update, delete on moderation_terms to authenticated;
drop policy if exists "admin only" on moderation_terms;
create policy "admin only" on moderation_terms for all to authenticated using (is_active_admin()) with check (is_active_admin());
