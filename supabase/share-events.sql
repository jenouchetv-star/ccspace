-- Share counter: one anonymous row each time a visitor uses a Share option on a page
-- (copy the link, send it from their phone, or pick a site). It answers "which content do
-- people pass on the most?" on the admin Analytics page.
--
-- Privacy: a row is only the page address (no query string, so never an access key), the
-- page title, how it was shared, and when. No name, email, IP address or visitor id is stored.
--
-- Access, the same shape as the subscribers table: visitors can add a row and nothing else;
-- only an active admin can read or delete rows. Safe to run again.

create table if not exists share_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path       text not null check (char_length(path) between 1 and 200 and path like '/%'),
  title      text not null default '' check (char_length(title) <= 200),
  method     text not null check (method in (
               'native', 'copy', 'instagram', 'facebook', 'messenger', 'x',
               'pinterest', 'whatsapp', 'email', 'text'))
);

create index if not exists share_events_created_idx on share_events (created_at desc);

alter table share_events enable row level security;

revoke all on share_events from anon, authenticated;
grant insert on share_events to anon;
grant select, delete on share_events to authenticated;

drop policy if exists "public insert" on share_events;
drop policy if exists "admin read" on share_events;
drop policy if exists "admin delete" on share_events;

create policy "public insert" on share_events for insert to anon with check (true);
create policy "admin read"    on share_events for select to authenticated using (is_active_admin());
create policy "admin delete"  on share_events for delete to authenticated using (is_active_admin());
