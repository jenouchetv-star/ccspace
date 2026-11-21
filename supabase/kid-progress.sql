-- Chike's Creative Space - progress report: children on a member's account, what each child finished, quiz state,
-- and the quiz questions an admin writes and approves.
--
-- children          a member's children: a first name or nickname (1 to 24 characters) and a school grade (0 is
--                   Kindergarten, up to 6). grade_year is the school year the grade was set for, so the grade can go up
--                   each August. A member's children go when the member is removed from subscribers.
-- child_progress    one row per child per finished item (episode, book, entry or activity): when first and last
--                   finished and how many times.
-- child_nuggets     the facts a child has come across ('met') or shown they know ('knows'), where they are in the
--                   reviews (review_step, review_due), and when each was last asked and with which question variant.
--                   nugget_id is '<kind>:<itemId>:<part>', for example 'episode:abc:discovery'.
-- child_quizzes     one row per quiz started for a child: the nuggets picked, the ones answered, how many were asked
--                   and how many were right.
-- nugget_subjects   the one STEAMM subject (science, technology, engineering, art, math or music) of a fact nugget.
-- nugget_questions  the quiz questions per nugget, per level (k1 = grades 0-1 with 2 choices, g23 = grades 2-3 and
--                   g46 = grades 4-6 with 3 choices; 'lesson' marks a life lesson that is never quizzed, so it has no
--                   question) and per variant (1 or 2). answer is the 0-based position of the right choice. Only
--                   approved questions are ever asked.
--
-- The kid-progress Edge Function reads and writes all six tables with the service role. They are closed to the
-- browser roles: row level security on, no policies, and no grants. Admins read and change the questions only through
-- the RPCs below, which check is_active_admin(); an item is addressed by a prefix '<kind>:<itemId>:'.
-- Needs: subscribers and is_active_admin() (supabase/migration.sql).
-- Safe to run again.

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  subscriber_id text not null references public.subscribers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  grade smallint not null check (grade between 0 and 6),
  grade_year smallint not null,
  created_at timestamptz default now()
);
create index if not exists children_subscriber_idx on public.children (subscriber_id);
alter table public.children enable row level security;
revoke all on table public.children from public, anon, authenticated;

create table if not exists public.child_progress (
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('episode', 'book', 'entry', 'activity')),
  item_id text not null,
  first_at timestamptz,
  last_at timestamptz,
  times int default 1,
  primary key (child_id, kind, item_id)
);
alter table public.child_progress enable row level security;
revoke all on table public.child_progress from public, anon, authenticated;

create table if not exists public.child_nuggets (
  child_id uuid not null references public.children(id) on delete cascade,
  nugget_id text not null,
  status text check (status in ('met', 'knows')) default 'met',
  review_step smallint default 0,
  review_due timestamptz,
  known_at timestamptz,
  last_asked timestamptz,
  last_variant smallint,
  primary key (child_id, nugget_id)
);
alter table public.child_nuggets enable row level security;
revoke all on table public.child_nuggets from public, anon, authenticated;

create table if not exists public.child_quizzes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  started_at timestamptz default now(),
  nuggets text[] not null,
  answered text[] not null default '{}',
  asked smallint default 0,
  right_count smallint default 0
);
create index if not exists child_quizzes_child_idx on public.child_quizzes (child_id, started_at desc);
alter table public.child_quizzes enable row level security;
revoke all on table public.child_quizzes from public, anon, authenticated;

create table if not exists public.nugget_subjects (
  nugget_id text primary key,
  subject text not null check (subject in ('science', 'technology', 'engineering', 'art', 'math', 'music'))
);
alter table public.nugget_subjects enable row level security;
revoke all on table public.nugget_subjects from public, anon, authenticated;

create table if not exists public.nugget_questions (
  nugget_id text not null,
  level text not null check (level in ('k1', 'g23', 'g46', 'lesson')),
  variant smallint not null default 1 check (variant in (1, 2)),
  question text,
  choices jsonb,
  answer smallint,
  why text,
  approved boolean default false,
  updated_at timestamptz default now(),
  primary key (nugget_id, level, variant)
);
alter table public.nugget_questions enable row level security;
revoke all on table public.nugget_questions from public, anon, authenticated;

-- Admins: every question saved for one item (every nugget_id that starts with p_prefix, plain text).
create or replace function public.nugget_questions_for(p_prefix text)
returns setof public.nugget_questions
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_active_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.* from public.nugget_questions q
    where left(q.nugget_id, char_length(p_prefix)) = p_prefix
    order by q.nugget_id, q.level, q.variant;
end;
$$;
revoke all on function public.nugget_questions_for(text) from public, anon;
grant execute on function public.nugget_questions_for(text) to authenticated;

-- Admins: the STEAMM subject of every nugget of one item.
create or replace function public.nugget_subjects_for(p_prefix text)
returns setof public.nugget_subjects
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_active_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.* from public.nugget_subjects s
    where left(s.nugget_id, char_length(p_prefix)) = p_prefix
    order by s.nugget_id;
end;
$$;
revoke all on function public.nugget_subjects_for(text) from public, anon;
grant execute on function public.nugget_subjects_for(text) to authenticated;

-- Admins: replace one item's questions and subjects. Everything saved starts unapproved (whatever the rows say).
-- p_rows: [{nugget_id, level, variant, question, choices, answer, why}, ...]; p_subjects: {"<nugget_id>": "science"}.
-- Refuses the whole save (nothing changes) for a nugget_id outside the prefix, a subject outside the six, a k1 row
-- without exactly 2 choices, a g23 or g46 row without exactly 3, an answer outside the choices, or a lesson row with
-- a question or choices. Returns the number of questions saved.
create or replace function public.nugget_questions_save(p_prefix text, p_rows jsonb, p_subjects jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  s record;
  v_level text;
  v_variant smallint;
  v_choices jsonb;
  v_need int;
  v_answer int;
  v_count int := 0;
begin
  if not is_active_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_prefix is null or p_prefix = '' then
    raise exception 'invalid prefix';
  end if;
  p_rows := coalesce(p_rows, '[]'::jsonb);
  p_subjects := coalesce(p_subjects, '{}'::jsonb);
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid question';
  end if;
  if jsonb_typeof(p_subjects) <> 'object' then
    raise exception 'invalid subject';
  end if;

  -- check everything before changing anything
  for s in select key, value from jsonb_each(p_subjects) loop
    if left(s.key, char_length(p_prefix)) <> p_prefix
       or jsonb_typeof(s.value) <> 'string'
       or (s.value #>> '{}') not in ('science', 'technology', 'engineering', 'art', 'math', 'music') then
      raise exception 'invalid subject';
    end if;
  end loop;

  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) <> 'object'
       or jsonb_typeof(r->'nugget_id') is distinct from 'string'
       or left(r->>'nugget_id', char_length(p_prefix)) <> p_prefix then
      raise exception 'invalid question';
    end if;
    v_level := r->>'level';
    if v_level is null or v_level not in ('k1', 'g23', 'g46', 'lesson') then
      raise exception 'invalid question';
    end if;
    if coalesce(r->>'variant', '1') not in ('1', '2') then
      raise exception 'invalid question';
    end if;
    v_choices := r->'choices';
    if v_level = 'lesson' then
      if coalesce(r->>'question', '') <> ''
         or (v_choices is not null and v_choices <> 'null'::jsonb and v_choices <> '[]'::jsonb) then
        raise exception 'invalid question';
      end if;
    else
      v_need := case v_level when 'k1' then 2 else 3 end;
      if coalesce(btrim(r->>'question'), '') = ''
         or v_choices is null or jsonb_typeof(v_choices) <> 'array'
         or jsonb_array_length(v_choices) <> v_need
         or jsonb_typeof(r->'answer') is distinct from 'number'
         or (r->>'answer') !~ '^[0-9]+$' then
        raise exception 'invalid question';
      end if;
      v_answer := (r->>'answer')::int;
      if v_answer >= v_need then
        raise exception 'invalid question';
      end if;
    end if;
  end loop;

  delete from public.nugget_questions where left(nugget_id, char_length(p_prefix)) = p_prefix;
  delete from public.nugget_subjects where left(nugget_id, char_length(p_prefix)) = p_prefix;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_level := r->>'level';
    v_variant := coalesce((r->>'variant')::smallint, 1);
    insert into public.nugget_questions (nugget_id, level, variant, question, choices, answer, why, approved, updated_at)
    values (r->>'nugget_id', v_level, v_variant,
            case when v_level = 'lesson' then null else r->>'question' end,
            case when v_level = 'lesson' then null else r->'choices' end,
            case when v_level = 'lesson' then null else (r->>'answer')::smallint end,
            nullif(r->>'why', ''), false, now())
    on conflict (nugget_id, level, variant) do update set
      question = excluded.question, choices = excluded.choices, answer = excluded.answer,
      why = excluded.why, approved = false, updated_at = now();
    v_count := v_count + 1;
  end loop;

  for s in select key, value from jsonb_each(p_subjects) loop
    insert into public.nugget_subjects (nugget_id, subject) values (s.key, s.value #>> '{}');
  end loop;

  return v_count;
end;
$$;
revoke all on function public.nugget_questions_save(text, jsonb, jsonb) from public, anon;
grant execute on function public.nugget_questions_save(text, jsonb, jsonb) to authenticated;

-- Admins: approve every saved question of one item, so the quiz may ask them. Returns how many rows were set.
create or replace function public.nugget_questions_approve(p_prefix text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if not is_active_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_prefix is null or p_prefix = '' then
    raise exception 'invalid prefix';
  end if;
  update public.nugget_questions set approved = true, updated_at = now()
  where left(nugget_id, char_length(p_prefix)) = p_prefix;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.nugget_questions_approve(text) from public, anon;
grant execute on function public.nugget_questions_approve(text) to authenticated;
