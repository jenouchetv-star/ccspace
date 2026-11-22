-- Chike's Creative Space - progress report: every answer a child gives to a question inside a game (for example a
-- Solar System Sandbox tour) or in Chike's pop quiz, so the report can say how a child is doing in each STEAMM subject.
--
-- child_game_answers  one row per answer: the game ('pop-quiz' for the pop quiz), the question's id in that game (the
--                     nugget id for the pop quiz), its STEAMM subject (science, technology, engineering, art, math or
--                     music), the level it was asked at, whether it was right, and the question, the right answer and
--                     the why as the child saw them, so a parent can see what was missed. A child's answers go with
--                     the child (and so with the member).
--
-- The kid-progress Edge Function writes and reads it with the service role (actions game_answer, quiz_answer and
-- report). It is closed to the browser roles: row level security on, no policies, and no grants.
-- Needs: children (supabase/kid-progress.sql).
-- Safe to run again.

create table if not exists public.child_game_answers (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  game text not null check (char_length(game) between 1 and 40),
  qid text not null check (char_length(qid) between 1 and 200),
  subject text not null check (subject in ('science', 'technology', 'engineering', 'art', 'math', 'music')),
  level text check (char_length(level) <= 10),
  correct boolean not null,
  question text check (char_length(question) <= 300),
  answer text check (char_length(answer) <= 200),
  why text check (char_length(why) <= 400),
  at timestamptz not null default now()
);
create index if not exists child_game_answers_child_idx on public.child_game_answers (child_id, at desc);
alter table public.child_game_answers enable row level security;
revoke all on table public.child_game_answers from public, anon, authenticated;
revoke all on sequence public.child_game_answers_id_seq from public, anon, authenticated;
