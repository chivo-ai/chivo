-- Chivo AI Group 12 upgrade for persistent AI chat history.
-- Run this on an existing database before testing saved Chivo AI guide conversations.

create table if not exists public.ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'home_guide',
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  crew_id uuid references public.lesson_crews(id) on delete cascade,
  title text not null default 'Chivo AI guide',
  language text not null default 'English',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_threads_scope_check check (
    scope in ('home_guide', 'lesson_tutor', 'class_tutor', 'crew_tutor', 'school_guide')
  )
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_chat_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  input_type text not null default 'text',
  audio_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_chat_messages_role_check check (role in ('user', 'assistant', 'system')),
  constraint ai_chat_messages_input_type_check check (input_type in ('text', 'voice'))
);

create index if not exists ai_chat_threads_profile_scope_idx
on public.ai_chat_threads(profile_id, scope, updated_at desc);

create index if not exists ai_chat_messages_thread_created_idx
on public.ai_chat_messages(thread_id, created_at);

alter table public.ai_chat_threads enable row level security;
alter table public.ai_chat_messages enable row level security;

drop policy if exists "users read own ai chat threads" on public.ai_chat_threads;
drop policy if exists "users create own ai chat threads" on public.ai_chat_threads;
drop policy if exists "users update own ai chat threads" on public.ai_chat_threads;
drop policy if exists "users read own ai chat messages" on public.ai_chat_messages;
drop policy if exists "users create own ai chat messages" on public.ai_chat_messages;

create policy "users read own ai chat threads"
on public.ai_chat_threads for select
using (profile_id = auth.uid());

create policy "users create own ai chat threads"
on public.ai_chat_threads for insert
with check (profile_id = auth.uid());

create policy "users update own ai chat threads"
on public.ai_chat_threads for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "users read own ai chat messages"
on public.ai_chat_messages for select
using (
  exists (
    select 1
    from public.ai_chat_threads thread
    where thread.id = ai_chat_messages.thread_id
      and thread.profile_id = auth.uid()
  )
);

create policy "users create own ai chat messages"
on public.ai_chat_messages for insert
with check (
  profile_id = auth.uid()
  and role = 'user'
  and exists (
    select 1
    from public.ai_chat_threads thread
    where thread.id = ai_chat_messages.thread_id
      and thread.profile_id = auth.uid()
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger ai_chat_threads_set_updated_at
  before update on public.ai_chat_threads
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;
