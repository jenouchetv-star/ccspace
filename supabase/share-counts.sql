-- Share counts for the Share buttons: how many times each page has been shared, and nothing else.
--
-- share_events (see share-events.sql) stays readable only by an active admin. This function runs with the
-- table owner's rights so anyone can ask for the totals, but it returns only a page address and a number: no
-- titles, methods or times, and never a single event. Safe to run again.

create or replace function public.share_counts()
returns table (path text, shares bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.path, count(*)::bigint as shares
  from share_events e
  group by e.path
$$;

revoke all on function public.share_counts() from public;
grant execute on function public.share_counts() to anon, authenticated;
