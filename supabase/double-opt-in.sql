-- Double opt-in for the mailing list: nobody is subscribed until the person who owns the inbox clicks the confirm link.
--
-- Run once in the Supabase SQL Editor (safe to run again). Run it AFTER the `portal` and `notify` Edge Functions
-- have been redeployed (supabase/deploy-portal.ps1), because the site's forms now call the portal function
-- instead of writing to this table themselves.
--
-- 1. The public can no longer add a subscriber directly. Before this, anyone holding the site's public key could insert a
--    "published" subscriber without any confirmation, whatever the forms did. Now only the portal function (which saves
--    the address as "pending" and emails a confirm link) and signed-in admins can add one.
-- 2. The welcome email now goes out when an address is CONFIRMED (its status becomes "published"), not when it is typed in.
--    (The notify function skips "pending" rows on insert.) This reuses the existing notify_edge_function() trigger function.
-- 3. An address that is never confirmed is forgotten after 14 days, so unconfirmed emails are not kept around.

drop policy if exists "public insert" on subscribers;
revoke insert on subscribers from anon;

drop trigger if exists trg_notify_confirmed_subscriber on subscribers;
create trigger trg_notify_confirmed_subscriber
  after update on subscribers
  for each row
  when (old.data->>'status' is distinct from 'published' and new.data->>'status' = 'published')
  execute function notify_edge_function();

create or replace function portal_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from portal_tokens where expires_at < now() - interval '7 days';
  delete from portal_sessions where expires_at < now() - interval '7 days';
  delete from subscribers where data->>'status' = 'pending' and created_at < now() - interval '14 days';
$$;
revoke all on function portal_cleanup() from public, anon, authenticated;
