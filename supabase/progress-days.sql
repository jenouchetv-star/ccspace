-- Chike's Creative Space - progress report, part 1 of the parent report (owner, 2026-11-23).
--
-- child_game_answers gains what a parent needs to see an answer in full: given (what the child answered, up to 200
-- characters), hints (how many hints were shown before the answer, 0 to 20), tries (how many tries it took, 1 to 50)
-- and skill (the skill the question practices, up to 80 characters, for example "Spelling ea words"). All four are
-- optional: games that do not send them, and every row kept before, still count.
--
-- child_days  one row per child per day per item: what a child did on a day, for the report's calendar. day is the
--             family's own date (sent by the browser, kept only when it is within a day of the server's), kind the
--             kind of item (episode, book, entry, activity, or game for an answer inside a game), item_id its id (for
--             a game, the game's own name, as in child_game_answers.game), done whether it was finished that day,
--             answers and right_count the questions answered and answered right that day, last_at the last time.
--
-- The kid-progress Edge Function writes and reads both with the service role. Closed to the browser roles: row level
-- security on, no policies, no grants. A child's days go with the child.
-- Needs: children (supabase/kid-progress.sql), child_game_answers (supabase/game-answers.sql).
-- Safe to run again.

alter table public.child_game_answers add column if not exists given text check (char_length(given) <= 200);
alter table public.child_game_answers add column if not exists hints smallint not null default 0 check (hints between 0 and 20);
alter table public.child_game_answers add column if not exists tries smallint not null default 1 check (tries between 1 and 50);
alter table public.child_game_answers add column if not exists skill text check (char_length(skill) <= 80);

create table if not exists public.child_days (
  child_id uuid not null references public.children(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('episode', 'book', 'entry', 'activity', 'game')),
  item_id text not null check (char_length(item_id) between 1 and 64),
  done boolean not null default false,
  answers int not null default 0 check (answers >= 0),
  right_count int not null default 0 check (right_count >= 0),
  last_at timestamptz not null default now(),
  primary key (child_id, day, kind, item_id)
);
create index if not exists child_days_child_idx on public.child_days (child_id, day desc);
alter table public.child_days enable row level security;
revoke all on table public.child_days from public, anon, authenticated;

-- Adds to a child's day in one statement, so two answers arriving together both count (a read then a write would lose
-- one). Called by kid-progress with the service role only.
create or replace function public.child_days_add(p_child uuid, p_day date, p_kind text, p_item text, p_done boolean, p_answers int, p_right int)
returns void language sql security invoker set search_path = public as $$
  insert into public.child_days (child_id, day, kind, item_id, done, answers, right_count, last_at)
  values (p_child, p_day, p_kind, p_item, coalesce(p_done, false), greatest(coalesce(p_answers, 0), 0), greatest(coalesce(p_right, 0), 0), now())
  on conflict (child_id, day, kind, item_id) do update
    set done = child_days.done or excluded.done,
        answers = child_days.answers + excluded.answers,
        right_count = child_days.right_count + excluded.right_count,
        last_at = now();
$$;
revoke all on function public.child_days_add(uuid, date, text, text, boolean, int, int) from public, anon, authenticated;
grant execute on function public.child_days_add(uuid, date, text, text, boolean, int, int) to service_role;
