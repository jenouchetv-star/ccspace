-- Admin two-factor authentication: hardened database objects, standalone.
--
-- *** ON THE LIVE PROJECT, RUN THIS FILE - NOT THE WHOLE migration.sql. ***
-- migration.sql also redefines notify_edge_function() and reschedules the
-- newsletter cron job with unfilled placeholders (<FUNCTION_URL>,
-- <WEBHOOK_SECRET>); re-running all of it on a live project would silently
-- break new-ticket / new-subscriber emails and scheduled newsletters.
--
-- These are the same definitions that live in migration.sql (a test fails if
-- the two ever differ). Safe to run any number of times. It creates the
-- enforcement switch (admin_mfa_settings) OFF and never changes it afterwards,
-- so it cannot turn enforcement off either. Note that is_active_admin() now
-- also requires the token's session to still exist, which takes effect as soon
-- as this runs (signed-out and revoked sessions stop being admins at once).
--
-- Contents, in order:
--   settings          the one-row enforcement switch (NULL = not enforced)
--   is_active_admin   the rule behind every admin policy, function and Worker
--   handle_new_user   only INVITED people get a profile (invitation hardening)
--   accept_invite     an invitation can only be accepted within 7 days
--   reset_log         the 2FA-reset audit table, begin_mfa_reset() and
--                     revoke_user_sessions()

-- BEGIN MFA-HARDENING:settings
create table if not exists admin_mfa_settings (
  id boolean primary key default true check (id),
  enforce_after timestamptz,
  updated_at timestamptz not null default now()
);
alter table admin_mfa_settings enable row level security;
revoke all on admin_mfa_settings from anon, authenticated;
insert into admin_mfa_settings (id) values (true) on conflict (id) do nothing;
-- END MFA-HARDENING:settings

-- BEGIN MFA-HARDENING:is_active_admin
create or replace function is_active_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
           select 1 from profiles where id = auth.uid() and status = 'active'
         )
     and case
           when nullif(auth.jwt() ->> 'session_id', '') is null then
             coalesce((select enforce_after from admin_mfa_settings where id), 'infinity'::timestamptz) > now()
           else
             exists (
               select 1 from auth.sessions s
               where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
                 and s.user_id = auth.uid()
             )
             and (
               coalesce((select enforce_after from admin_mfa_settings where id), 'infinity'::timestamptz) > now()
               or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
             )
         end;
$$;
-- END MFA-HARDENING:is_active_admin

-- BEGIN MFA-HARDENING:handle_new_user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invited_at is null then
    return new;
  end if;
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
  after insert or update of invited_at on auth.users
  for each row execute function public.handle_new_user();
-- END MFA-HARDENING:handle_new_user

-- BEGIN MFA-HARDENING:accept_invite
create or replace function public.accept_invite() returns void
language plpgsql security definer set search_path = public as $$
declare
  current_status text;
begin
  select status into current_status from public.profiles where id = auth.uid();
  if current_status is distinct from 'invited' then
    return;
  end if;
  update public.profiles p set status = 'active', updated_at = now()
  where p.id = auth.uid() and p.status = 'invited'
    and exists (
      select 1 from auth.users u
      where u.id = p.id
        and u.invited_at is not null
        and u.invited_at > now() - interval '7 days'
    );
  if not found then
    raise exception 'This invitation has expired. Ask an admin to remove you from the Admins screen and invite you again.';
  end if;
end;
$$;
-- END MFA-HARDENING:accept_invite

-- BEGIN MFA-HARDENING:reset_log
create table if not exists mfa_reset_log (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null,
  actor_id uuid,
  verified_how text not null,
  outcome text not null default 'started',
  created_at timestamptz not null default now()
);
alter table mfa_reset_log add column if not exists outcome text not null default 'started';
create index if not exists mfa_reset_log_target_idx on mfa_reset_log (target_id, created_at desc);
create index if not exists mfa_reset_log_actor_idx on mfa_reset_log (actor_id, created_at desc);
alter table mfa_reset_log enable row level security;
revoke all on mfa_reset_log from anon, authenticated;

create or replace function public.begin_mfa_reset(target uuid, actor uuid, how text)
returns table (code text, log_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  t_count integer;
  a_count integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('mfa_reset:target:' || target::text, 0));
  if actor is not null then
    perform pg_advisory_xact_lock(hashtextextended('mfa_reset:actor:' || actor::text, 0));
  end if;

  select count(*) into t_count from mfa_reset_log
   where target_id = target and created_at > now() - interval '24 hours'
     and (outcome = 'completed' or (outcome = 'started' and created_at > now() - interval '10 minutes'));
  if t_count >= 2 then
    return query select 'target_limit'::text, null::uuid;
    return;
  end if;

  if actor is not null then
    select count(*) into a_count from mfa_reset_log
     where actor_id = actor and created_at > now() - interval '24 hours'
       and (outcome = 'completed' or (outcome = 'started' and created_at > now() - interval '10 minutes'));
    if a_count >= 5 then
      return query select 'actor_limit'::text, null::uuid;
      return;
    end if;
  end if;

  insert into mfa_reset_log (target_id, actor_id, verified_how) values (target, actor, how) returning id into new_id;
  return query select 'ok'::text, new_id;
end;
$$;
revoke execute on function public.begin_mfa_reset(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_mfa_reset(uuid, uuid, text) to service_role;

create or replace function public.revoke_user_sessions(target uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = target;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
-- END MFA-HARDENING:reset_log

