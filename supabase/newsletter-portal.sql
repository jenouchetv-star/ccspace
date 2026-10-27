-- Chike's Creative Space - Newsletter Portal (the members-only archive)
--
-- Run this once in the Supabase SQL Editor (it is safe to run again). Nothing
-- here changes an existing table.
--
-- What it adds:
--
--   portal_entries   the archive itself. Written and read by active admins only.
--                    A subscriber never reads this table: the `portal` Edge
--                    Function reads it with the service role, and only after
--                    it has checked the visitor's verified session. That is
--                    what keeps the exclusive content from ever being sent to
--                    a browser that has not been verified - nothing about it
--                    is hidden with CSS.
--
--   portal_tokens    one-time verification links (emailed) - only a SHA-256
--                    of each token is stored. Expire after 30 minutes.
--   portal_sessions  verified sessions (30 days) - again only a SHA-256 of the
--                    token the browser holds.
--
-- portal_tokens and portal_sessions have row level security switched on and
-- NO policy, and all privileges are taken away from the public roles, so
-- neither the anon key nor a signed-in admin's browser can read or write
-- them. Only the Edge Function (service role) can.

create table if not exists portal_entries (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table portal_entries enable row level security;
grant select, insert, update, delete on portal_entries to authenticated;
revoke all on portal_entries from anon;
drop policy if exists "admin only" on portal_entries;
create policy "admin only" on portal_entries for all to authenticated
  using (is_active_admin()) with check (is_active_admin());

create table if not exists portal_tokens (
  token_hash text primary key,
  purpose text not null check (purpose in ('login', 'subscribe')),
  subscriber_id text not null,
  email_hash text not null,
  ip_hash text not null default '',
  next_path text not null default '/newsletter',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists portal_tokens_email_idx on portal_tokens (email_hash, created_at);
create index if not exists portal_tokens_ip_idx on portal_tokens (ip_hash, created_at);
alter table portal_tokens enable row level security;
revoke all on portal_tokens from anon, authenticated;

create table if not exists portal_sessions (
  token_hash text primary key,
  subscriber_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists portal_sessions_sub_idx on portal_sessions (subscriber_id);
alter table portal_sessions enable row level security;
revoke all on portal_sessions from anon, authenticated;

-- Housekeeping, called by the Edge Function now and then: forgets links and
-- sessions that ran out more than a week ago.
create or replace function portal_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from portal_tokens where expires_at < now() - interval '7 days';
  delete from portal_sessions where expires_at < now() - interval '7 days';
$$;
revoke all on function portal_cleanup() from public, anon, authenticated;
