-- =====================================================================
-- XAI Leader experiment — Supabase schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Group codes (Tahap 1 validation)
--    code = "<group_name>-<session_no>", e.g. "Alpha-1".
--    dataset_version (1–5) decides which campaign table the group sees.
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  code            text primary key,
  group_name      text not null,
  session_no      int  not null check (session_no > 0),
  dataset_version int  not null check (dataset_version between 1 and 5),
  class_name      text,            -- e.g. "Kelas A" (groups the Tahap 1 dropdown)
  active         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (group_name, session_no)
);

-- ---------------------------------------------------------------------
-- 2. One experiment session per group code
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  group_code     text not null unique references public.groups(code),
  pic_name       text not null,
  access_token   uuid not null unique default gen_random_uuid(),
  stage          text not null default 'briefing'
                 check (stage in ('briefing', 'workspace', 'submitted')),
  questions_used int  not null default 0,
  started_at     timestamptz not null default now(),
  agreed_at      timestamptz,
  submitted_at   timestamptz,
  last_seen_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Chat log (every question + every XAI Leader answer)
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.sessions(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  bubbles      jsonb,          -- assistant: the chat bubbles, in order
  question_no  int,            -- 1..5 (the question this message belongs to)
  mode         text,           -- assistant: education | strategic | clarification | refusal | out_of_scope
  refusal_code text,           -- assistant: FORBIDDEN_REQUEST | REQUEST_VIOLATES_PERSONA | PERSONA_LOCKED
  confidence   text,           -- assistant: Low | Medium | High
  metadata     jsonb,          -- execution metadata (execution_id, model, usage, latency)
  created_at   timestamptz not null default now()
);
create index if not exists messages_session_idx on public.messages (session_id, id);

-- ---------------------------------------------------------------------
-- 4. Research event log (logins, agreement, jailbreak flags, errors)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  type       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_session_idx on public.events (session_id, id);

-- ---------------------------------------------------------------------
-- 5. PDF submissions + behind-the-scenes grading
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null unique references public.sessions(id) on delete cascade,
  file_path      text not null,
  file_name      text,
  file_size      bigint,
  page_count     int,
  submitted_at   timestamptz not null default now(),
  grading_status text not null default 'pending'
                 check (grading_status in ('pending', 'running', 'done', 'error')),
  grading        jsonb,
  grading_error  text,
  graded_at      timestamptz
);

-- ---------------------------------------------------------------------
-- 6. Atomic question quota (max questions per group is enforced here)
-- ---------------------------------------------------------------------
create or replace function public.claim_question(p_session uuid, p_max int)
returns int
language sql
as $$
  update public.sessions
     set questions_used = questions_used + 1
   where id = p_session
     and stage = 'workspace'
     and questions_used < p_max
  returning questions_used;
$$;

create or replace function public.release_question(p_session uuid)
returns void
language sql
as $$
  update public.sessions
     set questions_used = greatest(questions_used - 1, 0)
   where id = p_session;
$$;

-- ---------------------------------------------------------------------
-- 7. Lock everything down. The app only talks to the database from the
--    server with the service_role key, which bypasses RLS. With RLS on
--    and no policies, the public anon key can read/write nothing.
-- ---------------------------------------------------------------------
alter table public.groups      enable row level security;
alter table public.sessions    enable row level security;
alter table public.messages    enable row level security;
alter table public.events      enable row level security;
alter table public.submissions enable row level security;

revoke execute on function public.claim_question(uuid, int) from public, anon, authenticated;
revoke execute on function public.release_question(uuid)    from public, anon, authenticated;
grant  execute on function public.claim_question(uuid, int) to service_role;
grant  execute on function public.release_question(uuid)    to service_role;

-- ---------------------------------------------------------------------
-- 8. Private storage bucket for the PDF proposals (max 20 MB, PDF only)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposals', 'proposals', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9. Seed group codes.
--    Edit the two arrays below (group names, session numbers) to match
--    your experiment, then run this block. Dataset versions 1–5 are
--    assigned in a random but balanced way (each version gets roughly
--    the same number of groups). Existing codes are never reshuffled.
-- ---------------------------------------------------------------------
with names as (
  select name, ord
    from unnest(array[
      'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo',
      'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett'
    ]) with ordinality as t(name, ord)
),
sessions as (
  select s as session_no from unnest(array[1, 2, 3]) as s
),
combos as (
  select n.name, n.ord, s.session_no,
         row_number() over (order by random()) as rn
    from names n cross join sessions s
)
insert into public.groups (code, group_name, session_no, dataset_version)
select name || '-' || session_no, name, session_no, ((rn - 1) % 5) + 1
  from combos
on conflict (code) do nothing;
