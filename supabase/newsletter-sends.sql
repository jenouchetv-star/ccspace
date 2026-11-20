-- Chike's Creative Space - who each newsletter reached (owner, 2026-11-20: "give me the option to only send to new
-- followers or people who hasn't received this message").
--
-- newsletter_sends  one row per newsletter per subscriber it reached. The send-newsletter and send-scheduled-newsletters
--                   Edge Functions write it (service role) after Resend accepts each batch; the admin page reads it to
--                   count "people who haven't received this newsletter". A subscriber who unsubscribes is deleted, and
--                   their rows go with them.
--
-- Past sends were never recorded, so they are filled in from join dates: everyone confirmed on the list who joined by the
-- time a sent newsletter went out counts as having received it (this matched each one's "Sent to N" when it was written).
-- Safe to run again.

create table if not exists public.newsletter_sends (
  newsletter_id text not null,
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (newsletter_id, subscriber_id)
);
alter table public.newsletter_sends enable row level security;
revoke all on table public.newsletter_sends from public, anon, authenticated;
grant select on table public.newsletter_sends to authenticated;
drop policy if exists "admins read" on public.newsletter_sends;
create policy "admins read" on public.newsletter_sends for select to authenticated using (is_active_admin());

insert into public.newsletter_sends (newsletter_id, subscriber_id, sent_at)
select n.id, s.id, (n.data->>'sentAt')::timestamptz
from public.newsletters n
join public.subscribers s
  on s.data->>'status' = 'published'
 and s.data ? 'at'
 and (s.data->>'at')::timestamptz <= (n.data->>'sentAt')::timestamptz
where n.data->>'status' = 'sent' and coalesce(n.data->>'sentAt', '') <> ''
on conflict (newsletter_id, subscriber_id) do nothing;
